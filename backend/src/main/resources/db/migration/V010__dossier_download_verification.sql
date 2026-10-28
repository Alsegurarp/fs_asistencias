-- Los cambios de estado de la empresa tampoco deben revivir una prueba MFA.
ALTER TABLE tenant ADD COLUMN dossier_access_version bigint NOT NULL DEFAULT 1;
CREATE FUNCTION dossier_tenant_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        NEW.dossier_access_version := OLD.dossier_access_version + 1;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER dossier_tenant_changed BEFORE UPDATE ON tenant
    FOR EACH ROW EXECUTE FUNCTION dossier_tenant_changed();

CREATE TABLE dossier_challenge (
    tenant_id uuid NOT NULL,
    id uuid NOT NULL,
    dossier_id uuid NOT NULL,
    user_id uuid NOT NULL,
    state_sha256 char(64) NOT NULL,
    nonce_sha256 char(64) NOT NULL,
    code_challenge char(43) NOT NULL,
    permission_version bigint NOT NULL,
    account_version bigint NOT NULL,
    tenant_version bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    invalidated_at timestamptz,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, id, dossier_id, user_id),
    FOREIGN KEY (tenant_id, dossier_id) REFERENCES dossier (tenant_id, id),
    FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_user (tenant_id, id)
);
CREATE INDEX dossier_challenge_dossier_idx ON dossier_challenge (tenant_id, dossier_id);

CREATE TABLE dossier_authorization (
    tenant_id uuid NOT NULL,
    id uuid NOT NULL,
    dossier_id uuid NOT NULL,
    user_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    authorization_sha256 char(64) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    PRIMARY KEY (tenant_id, id),
    UNIQUE (authorization_sha256),
    UNIQUE (tenant_id, challenge_id),
    FOREIGN KEY (tenant_id, challenge_id, dossier_id, user_id)
        REFERENCES dossier_challenge (tenant_id, id, dossier_id, user_id)
);
GRANT SELECT, INSERT ON dossier_challenge, dossier_authorization TO zenit_app;
GRANT UPDATE (consumed_at, invalidated_at) ON dossier_challenge TO zenit_app;
GRANT UPDATE (consumed_at) ON dossier_authorization TO zenit_app;
