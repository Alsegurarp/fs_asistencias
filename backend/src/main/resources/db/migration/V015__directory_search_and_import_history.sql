-- Búsqueda del padrón y historial de importaciones.

-- Texto para comparar sin distinguir mayúsculas ni acentos del español. Es una
-- sola expresión, sin FROM ni STRICT, para que el planificador la incorpore a
-- la consulta en lugar de llamarla fila por fila.
CREATE FUNCTION search_key(value text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT lower(translate(value,
        'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇáàäâãéèëêíìïîóòöôõúùüûñç',
        'AAAAAEEEEIIIIOOOOOUUUUNCaaaaaeeeeiiiiooooouuuunc'))
$$;

-- Cada importación conserva el nombre del archivo que se subió, nunca su
-- contenido, y la que aplica un archivo ya revisado apunta a esa revisión.
ALTER TABLE employee_import
    ADD COLUMN file_name text CHECK (file_name IS NULL OR char_length(file_name) BETWEEN 1 AND 255),
    ADD COLUMN reviewed_import_id uuid,
    ADD CONSTRAINT employee_import_review_fk FOREIGN KEY (tenant_id, reviewed_import_id) REFERENCES employee_import (tenant_id, id),
    ADD CONSTRAINT employee_import_review_applies CHECK (reviewed_import_id IS NULL OR (dry_run = false AND status = 'applied'));

-- Una revisión se aplica una sola vez, también con dos peticiones a la par.
CREATE UNIQUE INDEX employee_import_review_key ON employee_import (tenant_id, reviewed_import_id) WHERE reviewed_import_id IS NOT NULL;

-- El historial se lee de la más reciente a la más antigua.
CREATE INDEX employee_import_tenant_created_idx ON employee_import (tenant_id, created_at DESC, id DESC);

-- Quién tuvo cada tarjeta por última vez, y la lista de tarjetas en su orden.
-- Sin el primero, cada tarjeta recorría todas las asignaciones de la empresa.
CREATE INDEX card_assignment_card_since_idx ON card_assignment (tenant_id, card_id, since DESC, id DESC);
CREATE INDEX card_tenant_created_idx ON card (tenant_id, created_at, id);

REVOKE ALL ON FUNCTION search_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_key(text) TO zenit_app;
