-- Padrón y configuración de una empresa: sedes, horarios, personas, tarjetas e
-- importaciones. Toda tabla lleva la empresa y toda referencia la incluye: un
-- registro no puede apuntar a datos de otra empresa.

-- Sede con su geocerca circular.
CREATE TABLE site (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    name text NOT NULL,
    time_zone text NOT NULL,
    latitude numeric(9, 6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude numeric(9, 6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    radius_m integer NOT NULL CHECK (radius_m BETWEEN 20 AND 2000),
    status text NOT NULL CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id)
);

-- Horario con vigencia. No se edita: para cambiarlo se crea otro.
CREATE TABLE schedule (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    name text NOT NULL,
    time_zone text NOT NULL,
    valid_from date NOT NULL,
    valid_to date,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT schedule_validity_in_order CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE schedule_day (
    tenant_id uuid NOT NULL,
    schedule_id uuid NOT NULL,
    day_of_week text NOT NULL CHECK (
        day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    ),
    start_time time NOT NULL,
    -- Si es menor que el inicio, el turno termina al día siguiente.
    end_time time NOT NULL,
    break_minutes integer NOT NULL CHECK (break_minutes BETWEEN 0 AND 480),
    PRIMARY KEY (tenant_id, schedule_id, day_of_week),
    FOREIGN KEY (tenant_id, schedule_id) REFERENCES schedule (tenant_id, id),
    CONSTRAINT schedule_day_has_length CHECK (start_time <> end_time)
);

-- Persona del padrón. La baja es lógica: nunca borra marcajes ni cierres.
CREATE TABLE employee (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    external_id text NOT NULL,
    display_name text NOT NULL,
    status text NOT NULL CHECK (status IN ('active', 'inactive')),
    site_id uuid,
    employment_start date NOT NULL,
    employment_end date,
    source text NOT NULL CHECK (source IN ('manual', 'csv', 'api', 'connector')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT employee_external_id_key UNIQUE (tenant_id, external_id),
    FOREIGN KEY (tenant_id, site_id) REFERENCES site (tenant_id, id),
    CONSTRAINT employee_period_in_order CHECK (employment_end IS NULL OR employment_end >= employment_start)
);

CREATE INDEX employee_tenant_created_idx ON employee (tenant_id, created_at, id);

-- Horario de una persona por rango de fechas.
CREATE TABLE schedule_assignment (
    tenant_id uuid NOT NULL,
    id uuid NOT NULL,
    employee_id uuid NOT NULL,
    schedule_id uuid NOT NULL,
    valid_from date NOT NULL,
    valid_to date,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id, employee_id) REFERENCES employee (tenant_id, id),
    FOREIGN KEY (tenant_id, schedule_id) REFERENCES schedule (tenant_id, id),
    CONSTRAINT schedule_assignment_in_order CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

-- Una persona tiene a lo más una asignación sin fecha de fin.
CREATE UNIQUE INDEX schedule_assignment_open_key
    ON schedule_assignment (tenant_id, employee_id) WHERE valid_to IS NULL;
CREATE INDEX schedule_assignment_employee_idx ON schedule_assignment (tenant_id, employee_id, valid_from);

-- Tarjeta. La identidad es su huella criptográfica, no el UID público.
CREATE TABLE card (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    label text NOT NULL,
    fingerprint text NOT NULL,
    status text NOT NULL CHECK (
        status IN ('inventory', 'assigned', 'active', 'revoked', 'lost', 'damaged', 'replaced')
    ),
    key_version integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT card_label_key UNIQUE (tenant_id, label),
    CONSTRAINT card_fingerprint_key UNIQUE (tenant_id, fingerprint)
);

CREATE TABLE card_assignment (
    tenant_id uuid NOT NULL,
    id uuid NOT NULL,
    card_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    since timestamptz NOT NULL DEFAULT now(),
    until timestamptz,
    replaced_card_id uuid,
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id, card_id) REFERENCES card (tenant_id, id),
    FOREIGN KEY (tenant_id, employee_id) REFERENCES employee (tenant_id, id),
    FOREIGN KEY (tenant_id, replaced_card_id) REFERENCES card (tenant_id, id)
);

-- Una asignación abierta por tarjeta y una por persona. El reemplazo cierra la
-- anterior en la misma transacción; estas reglas sólo impiden lo imposible.
CREATE UNIQUE INDEX card_assignment_open_card_key ON card_assignment (tenant_id, card_id) WHERE until IS NULL;
CREATE UNIQUE INDEX card_assignment_open_employee_key ON card_assignment (tenant_id, employee_id) WHERE until IS NULL;

-- Resultado de una importación del padrón. No guarda el archivo: sólo su
-- huella, los conteos y las filas rechazadas.
CREATE TABLE employee_import (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    idempotency_key uuid NOT NULL,
    content_sha256 char(64) NOT NULL,
    dry_run boolean NOT NULL,
    status text NOT NULL CHECK (status IN ('validating', 'ready', 'applied', 'failed')),
    template_version integer NOT NULL,
    total integer NOT NULL CHECK (total >= 0),
    accepted integer NOT NULL CHECK (accepted >= 0),
    rejected integer NOT NULL CHECK (rejected >= 0),
    errors jsonb NOT NULL DEFAULT '[]'::jsonb,
    manifest_hash char(64),
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT employee_import_idempotency_key UNIQUE (tenant_id, idempotency_key)
);

-- Permisos del rol que atiende. Lo que no aparece aquí no lo puede tocar. No
-- hay DELETE: sedes y personas se desactivan, horarios y tarjetas no se borran
-- y el resultado de una importación no se corrige.
GRANT SELECT, INSERT, UPDATE ON site TO zenit_app;
GRANT SELECT, INSERT ON schedule TO zenit_app;
GRANT SELECT, INSERT ON schedule_day TO zenit_app;
GRANT SELECT, INSERT, UPDATE ON employee TO zenit_app;
GRANT SELECT, INSERT, UPDATE ON schedule_assignment TO zenit_app;
GRANT SELECT, INSERT, UPDATE ON card TO zenit_app;
GRANT SELECT, INSERT, UPDATE ON card_assignment TO zenit_app;
GRANT SELECT, INSERT ON employee_import TO zenit_app;
