-- Cambio programado de la política de comida. Ya no cambia al instante: se
-- programa y entra el primer día de semana de la empresa dentro de la
-- siguiente quincena, con al menos siete días de aviso. Así una semana nunca
-- mezcla dos políticas y las semanas anteriores conservan su cálculo.
--
-- `tenant.break_policy` queda como la política anterior a cualquier cambio
-- programado. La que vale en una fecha es la del último cambio no cancelado
-- cuya fecha de entrada ya llegó; sin ninguno, la de `tenant`.
CREATE TABLE break_policy_change (
    tenant_id uuid NOT NULL REFERENCES tenant (id),
    id uuid NOT NULL,
    break_policy text NOT NULL CHECK (break_policy IN ('not_considered', 'marked')),
    -- Fecha del calendario de la empresa en que entra; es un inicio de semana.
    effective_on date NOT NULL,
    reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 500),
    scheduled_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    cancelled_at timestamptz,
    PRIMARY KEY (tenant_id, id)
);

-- Dos cambios vigentes nunca entran el mismo día.
CREATE UNIQUE INDEX break_policy_change_one_per_day
    ON break_policy_change (tenant_id, effective_on) WHERE cancelled_at IS NULL;

-- Un cambio no se edita ni se borra: sólo se cancela antes de entrar.
GRANT SELECT, INSERT ON break_policy_change TO zenit_app;
GRANT UPDATE (cancelled_at) ON break_policy_change TO zenit_app;
