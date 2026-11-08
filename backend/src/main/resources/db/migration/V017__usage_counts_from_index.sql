-- Consola de operación: el uso del mes de todas las empresas cuenta personas
-- distintas y marcajes por empresa y periodo. Con la persona dentro del índice
-- de marcajes por hora, esa cuenta sale sólo del índice, sin leer cada fila de
-- la tabla. Medido con 1.7 millones de marcajes: los totales de un mes pasaron
-- de 1.1 s a 0.28 s.
--
-- Reemplaza al índice anterior, que tenía las mismas columnas de orden: las
-- consultas que lo usaban siguen usando este, y la tabla no carga con dos.
CREATE INDEX attendance_event_observed_people_idx
    ON attendance_event (tenant_id, observed_at, id) INCLUDE (employee_id);

DROP INDEX attendance_event_observed_idx;
