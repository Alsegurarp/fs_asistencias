Expediente Zenit, formato 1. EJEMPLO FICTICIO E1; no es una exportación real.
Contiene una empresa y su solicitante, sin empleados, marcajes ni cierres.
Todos los instantes son UTC; zona de consulta: America/Mexico_City.
records.ndjson: un objeto JSON por línea UTF-8 sin BOM, con terminador LF.
kind identifica la colección; tenantId fija la empresa; data usa campos fuente.
Se conservan identificadores y referencias. null representa ausencia conocida.
Los cierres reabiertos y sus acuses son versiones distintas; no se sobrescriben.
snapshot y envelope se leen como cadenas; no reformatear sus bytes UTF-8.
Verificar SHA-256 y tamaño exacto de cada archivo contra manifest.json.
Contar filas por kind y compararlas con counts; comprobar tenantId y relaciones.
Comparar además la huella del manifiesto con la recibida por el canal autorizado.
Modificar simultáneamente datos y manifiesto puede eludir las huellas locales.
Las huellas no acreditan firma avanzada, autoría ni certificación jurídica.
Los sobres de rechazos no están en servidor; no se reconstruyen.
El archivo no incluye evidencia que sólo permanezca en Android ni textos
históricos de acuse que no se guardaron; declara estas limitaciones.
La metadata de auditoría se filtra por lista permitida, sin credenciales.
Consultar y verificar sin Zenit antes de aceptar una salida del servicio.
La descarga y este ejemplo no autorizan borrado ni purga Android.
