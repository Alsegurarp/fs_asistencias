-- Cierre de la semana como trabajo, y cierre programado.

-- La empresa decide si sus semanas se cierran solas, y cuántas horas después
-- de terminar. Nulo: sólo las cierra una persona. Nace así.
ALTER TABLE tenant ADD COLUMN auto_close_after_hours integer
    CONSTRAINT tenant_auto_close_range CHECK (auto_close_after_hours BETWEEN 1 AND 168);

-- Un cierre que hizo el sistema no tiene persona que lo haya cerrado.
ALTER TABLE week_closure ALTER COLUMN closed_by DROP NOT NULL;

-- Corrida de cierre: cierra la semana de toda la empresa o de una sede, una
-- persona a la vez. La pide una persona o la abre el cierre programado.
CREATE TABLE week_closure_run (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    week_start date NOT NULL,
    site_id uuid,
    origin text NOT NULL CHECK (origin IN ('requested', 'scheduled')),
    status text NOT NULL CHECK (status IN ('queued', 'running', 'done', 'failed')),
    requested_by uuid,
    total integer CHECK (total >= 0),
    closed integer NOT NULL DEFAULT 0 CHECK (closed >= 0),
    blocked_open_incidents integer NOT NULL DEFAULT 0 CHECK (blocked_open_incidents >= 0),
    blocked_open_segment integer NOT NULL DEFAULT 0 CHECK (blocked_open_segment >= 0),
    failure text,
    created_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    finished_at timestamptz,
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id, site_id) REFERENCES site (tenant_id, id),
    FOREIGN KEY (tenant_id, requested_by) REFERENCES tenant_user (tenant_id, id),
    -- La que abre el sistema no tiene quien la pida; la que pide una persona, sí.
    CONSTRAINT week_closure_run_origin_is_whole CHECK ((origin = 'scheduled') = (requested_by IS NULL)),
    -- El cierre programado es de toda la empresa.
    CONSTRAINT week_closure_run_scheduled_is_whole CHECK (origin <> 'scheduled' OR site_id IS NULL),
    CONSTRAINT week_closure_run_finish_is_whole CHECK ((status IN ('done', 'failed')) = (finished_at IS NOT NULL))
);

-- Una sola corrida en curso por semana y alcance: pedirla otra vez devuelve la que ya corre.
CREATE UNIQUE INDEX week_closure_run_active_key
    ON week_closure_run (tenant_id, week_start, coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE status IN ('queued', 'running');

-- El cierre programado pasa una vez por semana: lo que deja sin cerrar lo cierra una persona.
CREATE UNIQUE INDEX week_closure_run_scheduled_key ON week_closure_run (tenant_id, week_start) WHERE origin = 'scheduled';

CREATE INDEX week_closure_run_tenant_created_idx ON week_closure_run (tenant_id, created_at, id);

-- Permisos del rol que atiende. De una corrida cambia su avance, nunca qué se
-- pidió ni quién lo pidió. Nada se borra.
GRANT SELECT, INSERT ON week_closure_run TO zenit_app;
GRANT UPDATE (status, total, closed, blocked_open_incidents, blocked_open_segment, failure, started_at, finished_at)
    ON week_closure_run TO zenit_app;
