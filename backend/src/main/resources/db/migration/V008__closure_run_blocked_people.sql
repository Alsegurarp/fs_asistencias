-- Último bloqueo registrado por persona y corrida; los reintentos actualizan
-- el motivo o lo retiran si esa misma corrida logra cerrar a la persona.
CREATE TABLE week_closure_run_blocked (
    tenant_id uuid NOT NULL,
    run_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    reason text NOT NULL CHECK (reason IN ('open_incidents', 'open_segment')),
    incident_ids uuid[] NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, run_id, employee_id),
    FOREIGN KEY (tenant_id, run_id) REFERENCES week_closure_run (tenant_id, id),
    FOREIGN KEY (tenant_id, employee_id) REFERENCES employee (tenant_id, id)
);

CREATE INDEX week_closure_run_blocked_page_idx
    ON week_closure_run_blocked (tenant_id, run_id, created_at, employee_id);

GRANT SELECT, INSERT, DELETE ON week_closure_run_blocked TO zenit_app;
GRANT UPDATE (reason, incident_ids) ON week_closure_run_blocked TO zenit_app;
