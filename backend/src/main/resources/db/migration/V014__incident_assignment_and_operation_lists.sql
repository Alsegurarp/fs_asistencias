-- Listas de operación del portal: quién asignó cada incidencia, la semana de
-- la empresa que contiene un instante y los índices de las listas de
-- incidencias y cierres.

-- Quién asignó la incidencia y cuándo. Quitar la asignación los borra.
ALTER TABLE incident
    ADD COLUMN assigned_at timestamptz,
    ADD COLUMN assigned_by uuid,
    ADD CONSTRAINT incident_assigner_fk FOREIGN KEY (tenant_id, assigned_by) REFERENCES tenant_user (tenant_id, id),
    ADD CONSTRAINT incident_assignment_is_whole CHECK (
        (assigned_at IS NULL) = (assigned_by IS NULL) AND (assignee_user_id IS NOT NULL OR assigned_at IS NULL)
    );

-- Las asignaciones vigentes toman de la bitácora su autor y su hora. La
-- consulta materializada filtra antes de convertir el identificador.
WITH last_assignment AS MATERIALIZED (
    SELECT DISTINCT ON (tenant_id, target_id) tenant_id, target_id, at, actor_id
    FROM audit_log
    WHERE action = 'incident.assigned'
        AND actor_type = 'user'
        AND metadata ->> 'assigned' = 'true'
        AND actor_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ORDER BY tenant_id, target_id, at DESC
)
UPDATE incident i
SET assigned_at = l.at, assigned_by = l.actor_id::uuid
FROM last_assignment l
JOIN tenant_user u ON u.tenant_id = l.tenant_id AND u.id = l.actor_id::uuid
WHERE i.assignee_user_id IS NOT NULL
    AND l.tenant_id = i.tenant_id
    AND l.target_id = i.id::text;

-- Primer día de la semana de la empresa que contiene ese instante, en su zona.
-- Se calcula al consultar porque la empresa puede cambiar el día en que empieza
-- su semana. Es una sola expresión, sin FROM ni STRICT, para que el planificador
-- la incorpore a la consulta en lugar de llamarla fila por fila.
CREATE FUNCTION week_start_of(moment timestamptz, time_zone text, starts_on text) RETURNS date
LANGUAGE sql STABLE AS $$
    SELECT (moment AT TIME ZONE time_zone)::date
        - ((extract(isodow FROM moment AT TIME ZONE time_zone)::int
            - array_position(ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], starts_on) + 7) % 7)
$$;

-- Las abiertas se cuentan y se ordenan a menudo; las resueltas crecen sin
-- tope y se leen de la más reciente a la más antigua.
CREATE INDEX incident_tenant_open_idx ON incident (tenant_id, created_at, id) WHERE status = 'open';
CREATE INDEX incident_tenant_resolved_idx ON incident (tenant_id, resolved_at DESC, id DESC) WHERE status = 'resolved';

-- Los cierres se listan por semana.
CREATE INDEX week_closure_tenant_week_idx ON week_closure (tenant_id, week_start, closed_at, id);

REVOKE ALL ON FUNCTION week_start_of(timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION week_start_of(timestamptz, text, text) TO zenit_app;
GRANT UPDATE (assigned_at, assigned_by) ON incident TO zenit_app;
