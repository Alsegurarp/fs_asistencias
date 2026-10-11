-- Jornada: reglas con vigencia, atención de incidencias, ajustes, cierres
-- semanales y acuse del trabajador.

-- Reglas laborales. Los topes son filas con vigencia y fuente, no constantes
-- del código. No son de una empresa: valen para todas.
CREATE TABLE rule_set (
    id uuid PRIMARY KEY,
    jurisdiction text NOT NULL,
    version integer NOT NULL CHECK (version >= 1),
    valid_from date NOT NULL,
    valid_to date,
    weekly_ordinary_max_minutes integer NOT NULL CHECK (weekly_ordinary_max_minutes > 0),
    parameters jsonb NOT NULL,
    sources jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT rule_set_version_key UNIQUE (jurisdiction, valid_from, version),
    CONSTRAINT rule_set_validity_in_order CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

-- Calendario de la reducción de la jornada, 2026 a 2030. Cada tramo empieza el
-- 1 de enero de su año. Lectura sujeta a revisión jurídica antes de usarse con
-- datos reales.
INSERT INTO rule_set (id, jurisdiction, version, valid_from, valid_to, weekly_ordinary_max_minutes, parameters, sources)
SELECT
    cast('00000000-0000-4000-8000-00000000' || year AS uuid),
    'MX-LFT',
    1,
    make_date(year, 1, 1),
    CASE WHEN year < 2030 THEN make_date(year, 12, 31) END,
    weekly_hours * 60,
    jsonb_build_object(
        'weeklyOvertimeMaxMinutes', cast(overtime_hours * 60 AS text),
        'weeklyExcessOvertimeMaxMinutes', '240',
        'dailyCombinedMaxMinutes', '720',
        'dailyOrdinaryMaxMinutesDay', '480',
        'dailyOrdinaryMaxMinutesNight', '420',
        'dailyOrdinaryMaxMinutesMixed', '450'
    ),
    jsonb_build_array(
        'DOF, decreto del 1 de mayo de 2026, transitorios segundo y cuarto: https://dof.gob.mx/nota_detalle_popup.php?codigo=5786537',
        'Ley Federal del Trabajo, artículos 61, 66 y 68: https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf'
    )
FROM (VALUES (2026, 48, 9), (2027, 46, 9), (2028, 44, 10), (2029, 42, 11), (2030, 40, 12)) AS step (year, weekly_hours, overtime_hours);

-- Quien entra al portal como trabajador se liga con su fila del padrón.
ALTER TABLE tenant_user
    ADD COLUMN employee_id uuid,
    ADD CONSTRAINT tenant_user_employee_fk FOREIGN KEY (tenant_id, employee_id) REFERENCES employee (tenant_id, id);

CREATE UNIQUE INDEX tenant_user_employee_key ON tenant_user (tenant_id, employee_id) WHERE employee_id IS NOT NULL;

-- Corrección de la jornada. No toca el marcaje: agrega una intención, con
-- autor y motivo, que el cálculo aplica.
CREATE TABLE adjustment (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    employee_id uuid NOT NULL,
    kind text NOT NULL CHECK (kind IN ('add_event', 'exclude_event', 'retype_event')),
    event_id uuid,
    event_type text CHECK (event_type IN ('clock_in', 'clock_out', 'break_start', 'break_end')),
    occurred_at timestamptz,
    reason text NOT NULL,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id, employee_id) REFERENCES employee (tenant_id, id),
    FOREIGN KEY (tenant_id, event_id) REFERENCES attendance_event (tenant_id, id),
    -- Cada clase de ajuste trae lo que necesita y nada más.
    CONSTRAINT adjustment_shape CHECK (
        (kind = 'add_event' AND event_id IS NULL AND event_type IS NOT NULL AND occurred_at IS NOT NULL)
        OR (kind = 'exclude_event' AND event_id IS NOT NULL AND event_type IS NULL AND occurred_at IS NULL)
        OR (kind = 'retype_event' AND event_id IS NOT NULL AND event_type IS NOT NULL AND occurred_at IS NULL)
    )
);

CREATE INDEX adjustment_employee_idx ON adjustment (tenant_id, employee_id, created_at);

-- Atención de una incidencia: gravedad, a quién se asigna y cómo se resuelve.
ALTER TABLE incident DROP CONSTRAINT incident_status_check;

ALTER TABLE incident
    ADD CONSTRAINT incident_status_check CHECK (status IN ('open', 'resolved')),
    ADD COLUMN severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
    ADD COLUMN assignee_user_id uuid,
    ADD COLUMN resolution_decision text CHECK (resolution_decision IN ('justified', 'confirmed', 'adjusted')),
    ADD COLUMN resolution_reason text,
    ADD COLUMN adjustment_id uuid,
    ADD COLUMN resolved_by uuid,
    ADD COLUMN resolved_at timestamptz,
    ADD CONSTRAINT incident_assignee_fk FOREIGN KEY (tenant_id, assignee_user_id) REFERENCES tenant_user (tenant_id, id),
    ADD CONSTRAINT incident_resolver_fk FOREIGN KEY (tenant_id, resolved_by) REFERENCES tenant_user (tenant_id, id),
    ADD CONSTRAINT incident_adjustment_fk FOREIGN KEY (tenant_id, adjustment_id) REFERENCES adjustment (tenant_id, id),
    -- Resuelta quiere decir con decisión, motivo, autor y hora; abierta, sin ninguno.
    ADD CONSTRAINT incident_resolution_is_whole CHECK (
        (status = 'open' AND resolution_decision IS NULL AND resolution_reason IS NULL AND resolved_by IS NULL
            AND resolved_at IS NULL AND adjustment_id IS NULL)
        OR (status = 'resolved' AND resolution_decision IS NOT NULL AND resolution_reason IS NOT NULL
            AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL
            AND ((resolution_decision = 'adjusted') = (adjustment_id IS NOT NULL)))
    );

UPDATE incident SET severity = CASE type
    WHEN 'clock_anomaly' THEN 'high'
    WHEN 'duplicate' THEN 'low'
    WHEN 'late_sync' THEN 'low'
    WHEN 'outside_window' THEN 'low'
    ELSE 'medium'
END;

ALTER TABLE incident ALTER COLUMN severity DROP DEFAULT;

CREATE INDEX incident_tenant_created_idx ON incident (tenant_id, created_at, id);

-- Cierre semanal de una persona. Congela el cálculo con la versión de reglas
-- vigente. Reabrir conserva la versión cerrada; volver a cerrar crea otra.
CREATE TABLE week_closure (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    employee_id uuid NOT NULL,
    week_start date NOT NULL,
    version integer NOT NULL CHECK (version >= 1),
    status text NOT NULL CHECK (status IN ('closed', 'reopened')),
    rule_set_id uuid NOT NULL REFERENCES rule_set (id),
    rule_set_version integer NOT NULL,
    worked_minutes integer NOT NULL CHECK (worked_minutes >= 0),
    break_minutes integer NOT NULL CHECK (break_minutes >= 0),
    ordinary_minutes integer NOT NULL CHECK (ordinary_minutes >= 0),
    overtime_minutes integer NOT NULL CHECK (overtime_minutes >= 0),
    -- El cálculo completo tal como quedó, y su huella. Es json y no jsonb porque
    -- conserva el texto exacto: la huella se puede volver a calcular sobre él.
    snapshot json NOT NULL,
    hash char(64) NOT NULL,
    closed_at timestamptz NOT NULL DEFAULT now(),
    closed_by uuid NOT NULL,
    reopened_at timestamptz,
    reopened_by uuid,
    reopen_reason text,
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT week_closure_version_key UNIQUE (tenant_id, employee_id, week_start, version),
    FOREIGN KEY (tenant_id, employee_id) REFERENCES employee (tenant_id, id),
    FOREIGN KEY (tenant_id, closed_by) REFERENCES tenant_user (tenant_id, id),
    FOREIGN KEY (tenant_id, reopened_by) REFERENCES tenant_user (tenant_id, id),
    CONSTRAINT week_closure_reopen_is_whole CHECK (
        (status = 'closed' AND reopened_at IS NULL AND reopened_by IS NULL AND reopen_reason IS NULL)
        OR (status = 'reopened' AND reopened_at IS NOT NULL AND reopened_by IS NOT NULL AND reopen_reason IS NOT NULL)
    )
);

-- Una persona tiene a lo más un cierre vigente por semana.
CREATE UNIQUE INDEX week_closure_current_key ON week_closure (tenant_id, employee_id, week_start) WHERE status = 'closed';
CREATE INDEX week_closure_tenant_closed_idx ON week_closure (tenant_id, closed_at, id);

-- Conformidad u objeción del trabajador con su cierre. Una por cierre.
CREATE TABLE closure_acknowledgement (
    tenant_id uuid NOT NULL,
    id uuid NOT NULL,
    closure_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    type text NOT NULL CHECK (type IN ('agreed', 'objected')),
    note text,
    at timestamptz NOT NULL DEFAULT now(),
    actor_type text NOT NULL CHECK (actor_type IN ('user', 'device')),
    actor_id text NOT NULL,
    evidence_hash char(64) NOT NULL,
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT closure_acknowledgement_closure_key UNIQUE (tenant_id, closure_id),
    FOREIGN KEY (tenant_id, closure_id) REFERENCES week_closure (tenant_id, id),
    FOREIGN KEY (tenant_id, employee_id) REFERENCES employee (tenant_id, id)
);

-- Permisos del rol que atiende. Las reglas sólo se leen. Un ajuste y un acuse
-- sólo se agregan. De una incidencia y de un cierre se puede cambiar el
-- estado y su atención, nunca lo que dicen: el resto de sus columnas no se
-- toca.
GRANT SELECT ON rule_set TO zenit_app;
GRANT SELECT, INSERT ON adjustment TO zenit_app;
GRANT UPDATE (status, assignee_user_id, resolution_decision, resolution_reason, adjustment_id, resolved_by, resolved_at)
    ON incident TO zenit_app;
GRANT SELECT, INSERT ON week_closure TO zenit_app;
GRANT UPDATE (status, reopened_at, reopened_by, reopen_reason) ON week_closure TO zenit_app;
GRANT SELECT, INSERT ON closure_acknowledgement TO zenit_app;
