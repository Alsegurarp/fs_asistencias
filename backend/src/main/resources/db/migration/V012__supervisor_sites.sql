-- Un supervisor sin sedes asignadas no obtiene acceso a datos de ninguna sede.
CREATE TABLE tenant_user_site (
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    site_id uuid NOT NULL,
    PRIMARY KEY (tenant_id, user_id, site_id),
    FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_user (tenant_id, id),
    FOREIGN KEY (tenant_id, site_id) REFERENCES site (tenant_id, id)
);
GRANT SELECT, INSERT, DELETE ON tenant_user_site TO zenit_app;
GRANT SELECT ON tenant_user_site TO zenit_backup;
