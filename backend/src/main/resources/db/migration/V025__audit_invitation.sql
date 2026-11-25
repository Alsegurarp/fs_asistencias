ALTER TABLE tenant_user
    ADD COLUMN audit_invitation_hash text,
    ADD COLUMN audit_invitation_expires_at timestamptz;
