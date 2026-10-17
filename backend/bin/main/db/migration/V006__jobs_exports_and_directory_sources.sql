-- Trabajos durables, exportes de cierres y fuentes del padrón.

-- La tabla de trabajos del primer esqueleto nunca recibió datos: nada escribía
-- en ella, y el rol que atiende podía cambiarle cualquier columna. Se
-- sustituye por la forma que usa quien atiende los trabajos.
DROP TABLE job;

-- Trabajo que se atiende fuera de la petición. Lo toma un proceso por un
-- tiempo; si ese proceso falla o muere, se vuelve a tomar, hasta agotar sus
-- intentos. No lleva datos: sólo apunta a lo que hay que hacer.
CREATE TABLE job (
    id uuid PRIMARY KEY,
    tenant_id uuid REFERENCES tenant (id),
    type text NOT NULL,
    reference_id uuid NOT NULL,
    status text NOT NULL CHECK (status IN ('queued', 'running', 'done', 'failed')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts integer NOT NULL CHECK (max_attempts >= 1),
    next_run_at timestamptz NOT NULL DEFAULT now(),
    lease_until timestamptz,
    -- Clase del último error, nunca su mensaje: un mensaje puede traer datos.
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz
);

CREATE INDEX job_pending_idx ON job (next_run_at) WHERE status IN ('queued', 'running');
CREATE INDEX job_reference_idx ON job (type, reference_id);

-- Exporte de los cierres vigentes de una semana. El archivo se guarda aquí
-- mientras se puede descargar; después quedan su manifiesto y sus huellas.
CREATE TABLE export (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    idempotency_key uuid NOT NULL,
    request_sha256 char(64) NOT NULL,
    week_start date NOT NULL,
    site_id uuid,
    format text NOT NULL CHECK (format IN ('csv')),
    template_version integer NOT NULL CHECK (template_version >= 1),
    time_zone text NOT NULL,
    rule_set_id uuid NOT NULL REFERENCES rule_set (id),
    rule_set_version integer NOT NULL,
    status text NOT NULL CHECK (status IN ('queued', 'ready', 'failed', 'expired')),
    row_count integer CHECK (row_count >= 0),
    -- json y no jsonb: la huella del manifiesto se vuelve a calcular sobre este texto.
    manifest json,
    manifest_hash char(64),
    file_hash char(64),
    content bytea,
    failure text,
    requested_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    ready_at timestamptz,
    expires_at timestamptz,
    downloaded_at timestamptz,
    downloaded_by uuid,
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT export_idempotency_key UNIQUE (tenant_id, idempotency_key),
    FOREIGN KEY (tenant_id, site_id) REFERENCES site (tenant_id, id),
    FOREIGN KEY (tenant_id, requested_by) REFERENCES tenant_user (tenant_id, id),
    FOREIGN KEY (tenant_id, downloaded_by) REFERENCES tenant_user (tenant_id, id),
    -- Listo quiere decir con archivo, manifiesto, huellas y vencimiento.
    CONSTRAINT export_ready_is_whole CHECK (
        status <> 'ready'
        OR (content IS NOT NULL AND manifest IS NOT NULL AND manifest_hash IS NOT NULL AND file_hash IS NOT NULL
            AND row_count IS NOT NULL AND ready_at IS NOT NULL AND expires_at IS NOT NULL)
    ),
    -- Vencido o ya descargado, el archivo no se conserva.
    CONSTRAINT export_expired_keeps_no_file CHECK (status <> 'expired' OR content IS NULL),
    CONSTRAINT export_download_is_whole CHECK ((downloaded_at IS NULL) = (downloaded_by IS NULL))
);

CREATE INDEX export_expiring_idx ON export (expires_at) WHERE status = 'ready';

-- De dónde viene el padrón de una empresa y hasta dónde se sincronizó.
CREATE TABLE integration_source (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    type text NOT NULL CHECK (type IN ('csv', 'api', 'connector')),
    status text NOT NULL CHECK (status IN ('active', 'paused', 'error')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    -- Por ahora, una fuente de cada tipo por empresa.
    CONSTRAINT integration_source_type_key UNIQUE (tenant_id, type)
);

CREATE TABLE integration_checkpoint (
    tenant_id uuid NOT NULL,
    source_id uuid NOT NULL,
    sync_cursor text,
    source_version text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, source_id),
    FOREIGN KEY (tenant_id, source_id) REFERENCES integration_source (tenant_id, id)
);

-- Las empresas que ya cargaron su padrón por archivo tienen esa fuente.
INSERT INTO integration_source (tenant_id, id, type, status, created_at)
SELECT tenant_id, gen_random_uuid(), 'csv', 'active', min(created_at)
FROM employee_import
WHERE status = 'applied'
GROUP BY tenant_id;

INSERT INTO integration_checkpoint (tenant_id, source_id, sync_cursor, source_version, updated_at)
SELECT DISTINCT ON (i.tenant_id) i.tenant_id, s.id, cast(i.id AS text), cast(i.template_version AS text), i.created_at
FROM employee_import i
JOIN integration_source s ON s.tenant_id = i.tenant_id AND s.type = 'csv'
WHERE i.status = 'applied'
ORDER BY i.tenant_id, i.created_at DESC;

-- Permisos del rol que atiende. Nada se borra. De un trabajo cambia su
-- avance, nunca qué es ni a qué apunta. De un exporte cambia su resultado,
-- nunca lo que se pidió ni quién lo pidió.
GRANT SELECT, INSERT ON job TO zenit_app;
GRANT UPDATE (status, attempts, next_run_at, lease_until, last_error, finished_at) ON job TO zenit_app;
GRANT SELECT, INSERT ON export TO zenit_app;
GRANT UPDATE (status, row_count, manifest, manifest_hash, file_hash, content, failure, ready_at, expires_at, downloaded_at, downloaded_by)
    ON export TO zenit_app;
GRANT SELECT, INSERT ON integration_source TO zenit_app;
GRANT UPDATE (status) ON integration_source TO zenit_app;
GRANT SELECT, INSERT ON integration_checkpoint TO zenit_app;
GRANT UPDATE (sync_cursor, source_version, updated_at) ON integration_checkpoint TO zenit_app;
