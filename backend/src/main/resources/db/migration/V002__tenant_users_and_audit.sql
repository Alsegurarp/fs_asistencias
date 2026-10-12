-- Empresa: zona horaria, inicio de semana y política de descanso. Se agregan
-- con un valor para las filas que ya existan y después se exige darlos.
ALTER TABLE tenant
    ADD COLUMN time_zone text NOT NULL DEFAULT 'America/Mexico_City',
    ADD COLUMN week_starts_on text NOT NULL DEFAULT 'monday' CHECK (
        week_starts_on IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    ),
    ADD COLUMN break_policy text NOT NULL DEFAULT 'not_considered' CHECK (
        break_policy IN ('not_considered', 'marked')
    );

ALTER TABLE tenant
    ALTER COLUMN time_zone DROP DEFAULT,
    ALTER COLUMN week_starts_on DROP DEFAULT,
    ALTER COLUMN break_policy DROP DEFAULT;

-- Persona con acceso al portal. Pertenece a una sola empresa. Nace invitada
-- por correo y se liga con su identidad la primera vez que entra.
CREATE TABLE tenant_user (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    email text NOT NULL,
    subject text,
    display_name text NOT NULL DEFAULT '',
    status text NOT NULL CHECK (status IN ('invited', 'active', 'disabled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    linked_at timestamptz,
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT tenant_user_email_lowercase CHECK (email = lower(email)),
    CONSTRAINT tenant_user_link_is_whole CHECK ((subject IS NULL) = (linked_at IS NULL)),
    CONSTRAINT tenant_user_active_is_linked CHECK (status <> 'active' OR subject IS NOT NULL)
);

-- Un correo y una identidad pertenecen a una sola empresa.
CREATE UNIQUE INDEX tenant_user_email_key ON tenant_user (email);
CREATE UNIQUE INDEX tenant_user_subject_key ON tenant_user (subject) WHERE subject IS NOT NULL;

-- Rol de una persona en su empresa. La llave foránea lleva la empresa: un rol
-- no se puede asignar a una persona de otra.
CREATE TABLE tenant_user_role (
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL CHECK (role IN ('admin_empresa', 'rh', 'supervisor', 'trabajador', 'auditor')),
    granted_at timestamptz NOT NULL DEFAULT now(),
    granted_by text NOT NULL,
    PRIMARY KEY (tenant_id, user_id, role),
    FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_user (tenant_id, id)
);

-- Bitácora de acciones administrativas. Sólo se agrega.
CREATE TABLE audit_log (
    id uuid PRIMARY KEY,
    tenant_id uuid REFERENCES tenant (id),
    at timestamptz NOT NULL DEFAULT now(),
    actor_type text NOT NULL CHECK (actor_type IN ('user', 'device', 'system')),
    actor_id text,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text,
    correlation_id uuid NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX audit_log_tenant_at_idx ON audit_log (tenant_id, at DESC);

-- Permisos del rol que atiende peticiones. No hereda nada: cada tabla se abre
-- aquí de forma explícita y lo que no aparezca no lo puede tocar.
--
-- Una empresa y una persona se suspenden o deshabilitan, no se borran. La
-- evidencia (marcas y bitácora) sólo se agrega: no se corrige ni se borra.
GRANT SELECT, INSERT, UPDATE ON tenant TO zenit_app;
GRANT SELECT, INSERT, UPDATE ON tenant_user TO zenit_app;
GRANT SELECT, INSERT, DELETE ON tenant_user_role TO zenit_app;
GRANT SELECT, INSERT ON audit_log TO zenit_app;
GRANT SELECT, INSERT ON attendance_event TO zenit_app;
GRANT SELECT, INSERT, UPDATE ON job TO zenit_app;

-- El historial de migraciones se puede leer, para que el backend compruebe al
-- arrancar que el esquema está al día. No se puede escribir.
GRANT SELECT ON flyway_schema_history TO zenit_app;
