-- Permiso explícito, ligado a la cuenta que recibió la concesión.
CREATE TABLE dossier_permission (
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    enabled boolean NOT NULL,
    subject text,
    linked_at timestamptz,
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    PRIMARY KEY (tenant_id, user_id),
    FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_user (tenant_id, id),
    CHECK (NOT enabled OR (subject IS NOT NULL AND linked_at IS NOT NULL))
);

-- E4 podrá ligar sus desafíos a esta versión: deshabilitar y reactivar no
-- revive una autorización, aunque se conserven el usuario y su subject.
ALTER TABLE tenant_user ADD COLUMN dossier_access_version bigint NOT NULL DEFAULT 1;
CREATE FUNCTION dossier_account_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW.tenant_id, NEW.subject, NEW.linked_at, NEW.status, NEW.employee_id)
        IS DISTINCT FROM (OLD.tenant_id, OLD.subject, OLD.linked_at, OLD.status, OLD.employee_id) THEN
        NEW.dossier_access_version := OLD.dossier_access_version + 1;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER dossier_account_changed BEFORE UPDATE ON tenant_user
    FOR EACH ROW EXECUTE FUNCTION dossier_account_changed();

CREATE TABLE dossier (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    requested_by uuid NOT NULL,
    requested_subject text NOT NULL,
    requested_linked_at timestamptz NOT NULL,
    idempotency_key uuid NOT NULL,
    request_sha256 char(64) NOT NULL,
    format_version integer NOT NULL CHECK (format_version = 1),
    status text NOT NULL CHECK (status IN ('queued', 'preparing', 'ready', 'failed', 'expired', 'downloaded')),
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    expires_at timestamptz NOT NULL DEFAULT (statement_timestamp() + interval '24 hours'),
    snapshot_at timestamptz,
    ready_at timestamptz,
    manifest text,
    manifest_sha256 char(64),
    file_sha256 char(64),
    failure_code text CHECK (failure_code = 'preparation_failed'),
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, requested_by, idempotency_key),
    FOREIGN KEY (tenant_id, requested_by) REFERENCES tenant_user (tenant_id, id),
    CHECK (expires_at > created_at),
    CHECK ((status = 'failed') = (failure_code IS NOT NULL)),
    CHECK ((manifest IS NULL) = (manifest_sha256 IS NULL)),
    CHECK ((manifest IS NULL) = (file_sha256 IS NULL)),
    CHECK ((manifest IS NULL) = (ready_at IS NULL)),
    CHECK (status NOT IN ('ready', 'downloaded') OR (manifest IS NOT NULL AND snapshot_at IS NOT NULL)),
    CHECK (status NOT IN ('queued', 'preparing', 'failed') OR manifest IS NULL),
    CHECK (status <> 'queued' OR snapshot_at IS NULL),
    CHECK (status <> 'preparing' OR snapshot_at IS NOT NULL)
);
CREATE INDEX dossier_expiring_idx ON dossier (expires_at) WHERE status IN ('queued', 'preparing', 'ready');

-- El ZIP se guarda por bloques: ni JDBC ni la aplicación materializan el
-- archivo entero. Una preparación fallida revierte también todos sus bloques.
CREATE TABLE dossier_chunk (
    tenant_id uuid NOT NULL,
    dossier_id uuid NOT NULL,
    position integer NOT NULL CHECK (position >= 0),
    content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 65536),
    PRIMARY KEY (tenant_id, dossier_id, position),
    FOREIGN KEY (tenant_id, dossier_id) REFERENCES dossier (tenant_id, id)
);

GRANT SELECT, INSERT ON dossier_permission TO zenit_app;
GRANT UPDATE (enabled, subject, linked_at, version) ON dossier_permission TO zenit_app;
GRANT SELECT, INSERT ON dossier TO zenit_app;
GRANT UPDATE (status, snapshot_at, ready_at, manifest, manifest_sha256, file_sha256, failure_code) ON dossier TO zenit_app;
GRANT SELECT, INSERT, DELETE ON dossier_chunk TO zenit_app;
