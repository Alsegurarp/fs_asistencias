-- Qué hicieron las filas aceptadas de cada importación en el padrón: altas,
-- personas con cambios y personas que ya estaban igual. Una revisión lo
-- anticipa. Las importaciones anteriores quedan sin desglose.
ALTER TABLE employee_import
    ADD COLUMN created integer CHECK (created >= 0),
    ADD COLUMN updated integer CHECK (updated >= 0),
    ADD COLUMN unchanged integer CHECK (unchanged >= 0),
    ADD CONSTRAINT employee_import_changes_add_up CHECK (
        (created IS NULL AND updated IS NULL AND unchanged IS NULL)
        OR (created IS NOT NULL AND updated IS NOT NULL AND unchanged IS NOT NULL AND created + updated + unchanged = accepted)
    );
