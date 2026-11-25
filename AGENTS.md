# Instrucciones para agentes

## Catálogo de errores para soporte

- Muestra únicamente `Error NNN` en los avisos del flujo de invitación y del portal de auditoría. Si hay un botón **Copiar código**, copia exactamente ese texto.
- Guarda el significado, la causa y los pasos de diagnóstico en el [diccionario interno](docs/diccionario.md#códigos-de-soporte-de-auditoría). Mantén fuera de los avisos los mensajes de la API y las referencias de las solicitudes.
- Al agregar un error, elige un número libre del bloque temático documentado. Conserva los códigos publicados. Actualiza el diccionario y el mapeo correspondiente en [Usuarios](web/src/AuditInvitationNotice.tsx) o en el [portal PHP](audit-portal/src/zenit.php) en el mismo cambio.
- Si amplías el catálogo a otro módulo, documenta su bloque temático y su mapeo sin reutilizar números ya asignados.
- Verifica que el aviso y la copia incluyan solo el código. Comprueba que cada número nuevo tenga una entrada en el diccionario.
