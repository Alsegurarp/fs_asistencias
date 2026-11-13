-- Datos que el lienzo muestra y no se guardaban (contrato 0.37.0).

-- Quién programó un cambio de la política de comida: el nombre con que actuó.
-- Los programados antes quedan sin nombre.
ALTER TABLE break_policy_change ADD COLUMN scheduled_by_name text;

-- La suspensión vigente de una empresa: cuándo, quién y por qué. Se borra al
-- reactivarla; la historia completa sigue en la bitácora de la empresa. Una
-- empresa suspendida antes de esta versión queda sin estos datos.
ALTER TABLE tenant
    ADD COLUMN suspended_at timestamptz,
    ADD COLUMN suspended_by_name text,
    ADD COLUMN suspension_reason text,
    ADD CONSTRAINT tenant_suspension_only_when_suspended CHECK (suspended_at IS NULL OR status = 'suspended');
