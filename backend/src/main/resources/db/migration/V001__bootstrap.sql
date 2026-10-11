CREATE TABLE tenant (
    id uuid PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    status text NOT NULL CHECK (status IN ('active', 'suspended')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE attendance_event (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    idempotency_key uuid NOT NULL,
    event_type text NOT NULL CHECK (
        event_type IN ('entry', 'exit', 'break_start', 'break_end')
    ),
    observed_at timestamptz NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    device_id text NOT NULL,
    card_reference text NOT NULL,
    latitude numeric(9, 6),
    longitude numeric(9, 6),
    accuracy_m numeric(8, 2),
    raw_payload_sha256 char(64) NOT NULL,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX attendance_event_tenant_received_idx
    ON attendance_event (tenant_id, received_at DESC);

CREATE TABLE job (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    type text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL CHECK (status IN ('pending', 'running', 'done', 'quarantined')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    run_after timestamptz NOT NULL DEFAULT now(),
    lease_until timestamptz,
    lease_owner text,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id)
);

CREATE INDEX job_claim_idx ON job (status, run_after, lease_until);
