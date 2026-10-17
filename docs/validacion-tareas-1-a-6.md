# Validación de tareas 1 a 6

Fecha: 17 de octubre de 2026. Entorno local Docker Desktop sobre Windows.
Datos ficticios. No se publicó el sistema ni se cambiaron reglas de negocio.

| Tarea | Estado | Evidencia y límite |
| --- | --- | --- |
| 1. Unificar documentación | Completada | README, índice, estado y guías distinguen funciones conectadas, presentación móvil y verificaciones pendientes |
| 2. Acordar decisiones de negocio | Pendiente de respuesta | [Criterios concretos preparados](decisiones-de-negocio.md); no se presentan como aprobados |
| 3. Repetir verificaciones | Completada | Backend: 47 unitarias y 73 de integración; portal: 128; Android: 9 unitarias, lint y APK debug; contrato y secretos correctos |
| 4. Horarios/importación con sesión real | Bloqueada | No se pudo controlar una sesión de navegador; pruebas automatizadas no sustituyen el recorrido manual |
| 5. URL de identidad del portal | Completada para construcción y HTTP | Imagen construida con URL local y HTTPS ficticia; nginx válido, cliente y CSP coinciden y respuesta HTTP 200. Acceso real por HTTPS sigue pendiente del ambiente publicado |
| 6. Autoprueba de respaldos | Completada | Restauración sin origen y rechazo de filas eliminadas, contenido distinto, paquete alterado y clave incorrecta |

## Resultados reproducibles

- `docker compose up --build --detach`: construcción y arranque correctos;
  incluye pruebas unitarias del backend. La salud del API respondió `UP`
  en `http://localhost:18080/actuator/health`, según el `.env` local.
- `docker compose --profile test run --rm --build backend-it`: 73 pruebas
  de integración pasaron contra PostgreSQL desechable; contrato ejercitado.
- `docker build --target build --tag zenit-web-check web` y
  `docker run --rm --network none zenit-web-check pnpm test`:
  128 pruebas pasaron, incluidos horarios (8) e importación (9).
  El primer intento con paralelismo por omisión produjo 8 fallos en dos
  archivos, con esperas agotadas y avisos de `act()` superpuestos. No se
  cambió la suite. El comando `pnpm test` ahora limita la ejecución a dos
  procesos para usar el modo que pasó en esta máquina. Se reconstruyó la imagen
  y se repitió ese comando habitual: 128/128 correctas.
- `docker compose --profile tools run --rm contract-lint`: contrato válido.
- `docker build --file android/Dockerfile --tag zenit-android-local android`:
  9 pruebas unitarias sin fallos, `lintDebug` y `assembleDebug` correctos.
  Se consultaron los XML de resultados de la imagen; no se repitió release
  ni instrumentación en teléfono en esta ejecución.
- `docker compose --profile tools run --rm secret-scan`: 36 commits, sin
  secretos detectados tras exceptuar un UUID ficticio de idempotencia. El
  hallazgo inicial fue comprobado en la prueba y en su commit histórico;
  la excepción exige archivo exacto y valor exacto, no omite el archivo.

Los registros locales de backend y portal están en
`build/validacion-2026-10-17-backend.log` y
`build/validacion-2026-10-17-web.log`; el de Android está en
`build/validacion-2026-10-17-android.log`. Todos están ignorados por Git.
`git diff --check` y la comprobación de enlaces Markdown locales de los
documentos modificados pasaron. Se retiró el contenedor desechable `db-it`;
las aplicaciones y los datos locales permanecen disponibles.

## Identidad configurable

Se construyó `zenit-web-identity-check` con
`--build-arg VITE_IDENTITY_URL=https://identidad.zenit.example`.
Se comprobó `nginx -t`, presencia de esa URL en el JavaScript y ausencia de
la URL local en esos archivos. nginx respondió HTTP 200 con
`connect-src 'self' https://identidad.zenit.example` en la CSP.
La imagen del portal local conserva `http://localhost:8082` y respondió
HTTP 200 con la CSP correspondiente. El dominio `.example` no se publicó;
esto no verifica certificados, DNS ni un inicio de sesión por HTTPS.

## Respaldo aislado

Se construyó `zenit-backup-tools` con el target `backup-tools` y se ejecutó
la [autoprueba documentada](respaldos-cifrados.md#autoprueba-sin-datos-reales)
sin red, con archivos temporales y sin secretos del entorno local.
Resultado: `AUTOPRUEBA CORRECTA`. Verificó dos bases ficticias, dos tablas
y cuatro filas; apagó el origen antes de restaurar. Las claves y copias
de esta prueba desaparecieron con el contenedor.

Esto cierra la tarea 6. La copia cifrada de operación, custodia de claves,
copia externa y recuperación completa del servicio siguen siendo otras tareas.

También pasó `docker compose --profile ops run --rm backup-rehearsal` con las
bases locales: 130 tablas y 1.772 filas con contenido idéntico (producto:
29 tablas/92 filas, incluida la tabla de migraciones; identidad: 101/1.680).
La instancia temporal se eliminó sin modificar los volúmenes originales.
Registro: `build/validacion-2026-10-17-respaldo.log`.

## Guion pendiente con sesión real

Computer Use agotó primero la autorización de Chrome y después detuvo el
control porque no pudo determinar la URL activa con suficiente certeza.
No se realizaron acciones en horarios ni importaciones del portal.
Hace falta una sesión de administración o RH en `http://localhost:8081`.
Ejecutar sólo sobre datos ficticios, con un identificador nuevo por recorrido.

1. Crear un horario `VALIDACION-20261017-A`, con zona de la empresa, vigencia
   que incluya hoy, lunes a viernes 09:00–17:00 y descanso de 30 minutos.
   Recargar y comprobar que persisten días, horas y vigencias.
2. Crear un empleado ficticio nuevo; asignarle el horario desde hoy.
   Comprobar la confirmación y el horario vigente en Empleados.
3. Crear otro horario con vigencia futura y asignarlo desde esa fecha.
   Verificar que Empleados sigue mostrando el horario vigente hoy.
4. Preparar CSV UTF-8 con encabezados
   `external_id,display_name,employment_start,site_name`: una fila nueva
   válida con sede activa y otra con fecha inválida. Validar sin aplicar.
   Confirmar un error por fila y que el padrón no cambió.
5. Confirmar y aplicar sólo la fila aceptada; recargar Empleados y verificar
   nombre, fecha y sede. Repetir el mismo archivo: no debe duplicarla.
6. Repetir con el identificador aceptado y nombre distinto: debe actualizarlo.
   Probar sede inexistente y CSV vacío; comprobar errores visibles.
7. Entrar como supervisor: puede consultar horarios y no crearlos/asignarlos;
   no debe tener importación. Registrar resultados e identificadores ficticios.

La escritura de datos ficticios por estas pantallas es parte de la prueba.
No borrar históricos ni reutilizar empleados de otros recorridos.
