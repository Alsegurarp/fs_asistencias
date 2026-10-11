-- Dispositivos y captura. El dispositivo no tiene cuenta: se identifica con
-- su propia clave, registrada al activarlo. Cada marcaje conserva el sobre
-- que firmó el dispositivo, tal como llegó.

-- Código de un solo uso para enrolar. Sólo se guarda su huella.
CREATE TABLE device_enrollment (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    mode text NOT NULL CHECK (mode IN ('personal', 'terminal')),
    employee_id uuid,
    site_id uuid,
    label text,
    code_sha256 char(64) NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'used', 'expired')),
    expires_at timestamptz NOT NULL,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    used_at timestamptz,
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT device_enrollment_code_key UNIQUE (code_sha256),
    FOREIGN KEY (tenant_id, employee_id) REFERENCES employee (tenant_id, id),
    FOREIGN KEY (tenant_id, site_id) REFERENCES site (tenant_id, id),
    -- La modalidad decide a qué se liga: una persona o una sede, nunca las dos.
    CONSTRAINT device_enrollment_target CHECK (
        (mode = 'personal' AND employee_id IS NOT NULL AND site_id IS NULL)
        OR (mode = 'terminal' AND site_id IS NOT NULL AND employee_id IS NULL)
    )
);

CREATE TABLE device (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    mode text NOT NULL CHECK (mode IN ('personal', 'terminal')),
    status text NOT NULL CHECK (status IN ('active', 'revoked', 'replaced')),
    employee_id uuid,
    site_id uuid,
    label text,
    -- Clave pública en formato JWK y su huella. La privada nunca sale del teléfono.
    public_jwk jsonb NOT NULL,
    key_thumbprint text NOT NULL,
    manufacturer text NOT NULL,
    model text NOT NULL,
    android_sdk integer NOT NULL,
    app_version text NOT NULL,
    enrolled_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz,
    revoked_at timestamptz,
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT device_id_key UNIQUE (id),
    CONSTRAINT device_key_thumbprint_key UNIQUE (key_thumbprint),
    FOREIGN KEY (tenant_id, employee_id) REFERENCES employee (tenant_id, id),
    FOREIGN KEY (tenant_id, site_id) REFERENCES site (tenant_id, id),
    CONSTRAINT device_target CHECK (
        (mode = 'personal' AND employee_id IS NOT NULL AND site_id IS NULL)
        OR (mode = 'terminal' AND site_id IS NOT NULL AND employee_id IS NULL)
    )
);

-- Una persona tiene a lo más un teléfono personal activo.
CREATE UNIQUE INDEX device_active_personal_key ON device (tenant_id, employee_id)
    WHERE mode = 'personal' AND status = 'active';
CREATE INDEX device_tenant_enrolled_idx ON device (tenant_id, enrolled_at, id);

-- Sesión de captura. Los marcajes se numeran dentro de ella.
CREATE TABLE device_session (
    tenant_id uuid NOT NULL,
    id uuid NOT NULL,
    device_id uuid NOT NULL,
    app_version text NOT NULL,
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id, device_id) REFERENCES device (tenant_id, id)
);

CREATE UNIQUE INDEX device_session_open_key ON device_session (tenant_id, device_id) WHERE ended_at IS NULL;

-- La tabla de marcajes del primer esqueleto nunca recibió datos: ninguna ruta
-- escribía en ella. Se sustituye por la forma que el contrato definió después.
DROP TABLE attendance_event;

CREATE TABLE attendance_event (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    idempotency_key uuid NOT NULL,
    event_type text NOT NULL CHECK (event_type IN ('clock_in', 'clock_out', 'break_start', 'break_end')),
    declared_type text CHECK (declared_type IN ('clock_in', 'clock_out', 'break_start', 'break_end')),
    outcome text NOT NULL CHECK (outcome IN ('accepted', 'accepted_with_incident')),
    -- Hora del dispositivo al leer la tarjeta y hora en que el servidor lo recibió.
    observed_at timestamptz NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    time_zone text NOT NULL,
    elapsed_realtime_ms bigint,
    device_id uuid NOT NULL,
    device_mode text NOT NULL CHECK (device_mode IN ('personal', 'terminal')),
    session_id uuid NOT NULL,
    sequence integer NOT NULL CHECK (sequence >= 1),
    employee_id uuid NOT NULL,
    card_id uuid NOT NULL,
    card_scheme text NOT NULL,
    site_id uuid,
    location_verdict text NOT NULL CHECK (location_verdict IN ('inside', 'outside', 'inconclusive', 'not_evaluated')),
    accuracy_m numeric(8, 2),
    -- El sobre tal como lo firmó el dispositivo, y su huella.
    envelope text NOT NULL,
    payload_sha256 char(64) NOT NULL,
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT attendance_event_idempotency_key UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT attendance_event_sequence_key UNIQUE (tenant_id, session_id, sequence),
    FOREIGN KEY (tenant_id, device_id) REFERENCES device (tenant_id, id),
    FOREIGN KEY (tenant_id, session_id) REFERENCES device_session (tenant_id, id),
    FOREIGN KEY (tenant_id, employee_id) REFERENCES employee (tenant_id, id),
    FOREIGN KEY (tenant_id, card_id) REFERENCES card (tenant_id, id),
    FOREIGN KEY (tenant_id, site_id) REFERENCES site (tenant_id, id)
);

CREATE INDEX attendance_event_employee_idx ON attendance_event (tenant_id, employee_id, observed_at);
CREATE INDEX attendance_event_observed_idx ON attendance_event (tenant_id, observed_at, id);

-- Coordenada de un marcaje. Vive aparte: las listas entregan el veredicto, no
-- el punto.
CREATE TABLE location_evidence (
    tenant_id uuid NOT NULL,
    event_id uuid NOT NULL,
    latitude numeric(9, 6) NOT NULL,
    longitude numeric(9, 6) NOT NULL,
    accuracy_m numeric(8, 2) NOT NULL,
    captured_at timestamptz NOT NULL,
    provider text,
    mock boolean,
    PRIMARY KEY (tenant_id, event_id),
    FOREIGN KEY (tenant_id, event_id) REFERENCES attendance_event (tenant_id, id)
);

-- Anomalía de un marcaje que una persona debe revisar. No es una sanción.
CREATE TABLE incident (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    event_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    site_id uuid,
    type text NOT NULL CHECK (
        type IN ('duplicate', 'missing_pair', 'outside_window', 'location_inconclusive', 'clock_anomaly', 'foreign_site', 'late_sync')
    ),
    status text NOT NULL CHECK (status IN ('open', 'justified', 'confirmed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id, event_id) REFERENCES attendance_event (tenant_id, id),
    FOREIGN KEY (tenant_id, employee_id) REFERENCES employee (tenant_id, id),
    FOREIGN KEY (tenant_id, site_id) REFERENCES site (tenant_id, id)
);

CREATE INDEX incident_event_idx ON incident (tenant_id, event_id);

-- Marcaje que no se aceptó. Queda como rastro y para devolver el mismo recibo
-- si el dispositivo repite la clave.
CREATE TABLE attendance_rejection (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    idempotency_key uuid NOT NULL,
    device_id uuid NOT NULL,
    code text NOT NULL CHECK (
        code IN ('card_unknown', 'card_revoked', 'card_not_owner', 'signature_invalid', 'session_invalid', 'payload_invalid', 'too_old')
    ),
    message text NOT NULL,
    observed_at timestamptz,
    received_at timestamptz NOT NULL DEFAULT now(),
    payload_sha256 char(64) NOT NULL,
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT attendance_rejection_idempotency_key UNIQUE (tenant_id, idempotency_key),
    FOREIGN KEY (tenant_id, device_id) REFERENCES device (tenant_id, id)
);

-- Permisos del rol que atiende. La evidencia sólo se agrega: marcajes,
-- coordenadas, incidencias y rechazos no se corrigen ni se borran.
GRANT SELECT, INSERT, UPDATE ON device_enrollment TO zenit_app;
GRANT SELECT, INSERT, UPDATE ON device TO zenit_app;
GRANT SELECT, INSERT, UPDATE ON device_session TO zenit_app;
GRANT SELECT, INSERT ON attendance_event TO zenit_app;
GRANT SELECT, INSERT ON location_evidence TO zenit_app;
GRANT SELECT, INSERT ON incident TO zenit_app;
GRANT SELECT, INSERT ON attendance_rejection TO zenit_app;
