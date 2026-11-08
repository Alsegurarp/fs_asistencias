-- Usuarios, reportes y bitácora del portal: desde cuándo vale el permiso de
-- expediente y los índices de las listas de exportes, expedientes y bitácora.

-- Desde cuándo vale el permiso. Se borra al retirarlo; un permiso anterior a
-- esta columna sin rastro en la bitácora queda vigente y sin fecha.
ALTER TABLE dossier_permission
    ADD COLUMN granted_at timestamptz,
    ADD CONSTRAINT dossier_permission_granted_only_enabled CHECK (enabled OR granted_at IS NULL);

-- Los permisos vigentes toman de la bitácora la última vez que se concedieron.
-- Los que no tienen rastro quedan sin fecha.
UPDATE dossier_permission p
SET granted_at = g.at
FROM (
    SELECT DISTINCT ON (tenant_id, target_id) tenant_id, target_id, at
    FROM audit_log
    WHERE action = 'dossier.permission_granted' AND target_type = 'user'
    ORDER BY tenant_id, target_id, at DESC
) AS g
WHERE p.enabled AND g.tenant_id = p.tenant_id AND g.target_id = p.user_id::text;

-- La bitácora se filtra por quién actuó y por lo que tocó, de lo más reciente a lo más antiguo.
CREATE INDEX audit_log_tenant_actor_idx ON audit_log (tenant_id, actor_id, at DESC, id DESC);
CREATE INDEX audit_log_tenant_target_idx ON audit_log (tenant_id, target_type, target_id, at DESC, id DESC);

-- Los historiales de exportes y de expedientes se leen del más reciente al más antiguo.
CREATE INDEX export_tenant_created_idx ON export (tenant_id, created_at DESC, id DESC);
CREATE INDEX dossier_tenant_requester_idx ON dossier (tenant_id, requested_by, created_at DESC, id DESC);

GRANT UPDATE (granted_at) ON dossier_permission TO zenit_app;
