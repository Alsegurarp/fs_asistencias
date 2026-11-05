-- Nuevas versiones: los cierres conservan su rule_set y snapshot anteriores.
-- Los límites de distribución del decreto aplican desde el 1 de mayo de 2026.
INSERT INTO rule_set (
    id, jurisdiction, version, valid_from, valid_to,
    weekly_ordinary_max_minutes, parameters, sources
)
SELECT
    gen_random_uuid(), jurisdiction, version + 1,
    greatest(valid_from, DATE '2026-05-01'), valid_to,
    weekly_ordinary_max_minutes,
    parameters || jsonb_build_object(
        'dailyOvertimeMaxMinutes', '240',
        'overtimeMaxDays', '4'
    ),
    sources
FROM rule_set
WHERE jurisdiction = 'MX-LFT'
    AND (valid_to IS NULL OR valid_to >= DATE '2026-05-01');
