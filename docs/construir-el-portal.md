# Construir el portal

El portal sigue el [lienzo aprobado](https://claude.ai/artifact/6nguqVzZ7N9rtHX2LDScvq)
el 7 de noviembre: 81 pantallas con código por sección (ACC, CTA, OPE, PAD,
EMP, REP, EST, TEL y CON). El backend que piden ya está en `main` y en el
ambiente publicado (contrato 0.23.0; la búsqueda de Asistencia lo sube a 0.24.0, la de Incidencias a 0.25.0 y los días de la semana a 0.26.0). Este documento dice en qué orden se
construye, cómo está armado el marco y qué reglas evitan que dos personas
hagan lo mismo.

## Orden

Cada bloque entra por PR y se despliega en el ambiente publicado al
integrarse con CI en verde. Mientras una sección no se reconstruye, sus
pantallas anteriores se muestran dentro del marco nuevo, en su dirección: el
ambiente nunca pierde una función.

| Bloque | Qué entra | Pantallas del lienzo | Pantalla anterior que se retira | Estado |
| --- | --- | --- | --- | --- |
| 0 | Marco: colores, tipografía, direcciones, barra superior, menú lateral, barra inferior de teléfono, menú de la cuenta y estados | CTA-02, EST-01, EST-03, EST-04, EST-05, TEL-06, ACC-07 | Las pestañas de `Workspace` | Integrado (PR #37) y desplegado |
| 1 | Operación: Asistencia → Incidencias → Cierres → Panel con avisos y primeros pasos | OPE-01 a 12, CTA-03, EST-08, EST-09, TEL-01, TEL-02, TEL-07 a 10 | `Incidents`, `Closures` | Asistencia (PR #38), Incidencias (PR #39) y la fase 6 del backend (PR #40) integradas y desplegadas; Cierres integrado (PR #41), con su despliegue sin confirmar; sigue Panel |
| 2 | Padrón: Personal y horarios → Importar → Dispositivos y tarjetas, con el buscador | PAD-01 a 12, CTA-05, EST-07 | `Directory` (personas y tarjetas), `Schedules`, `Imports`, `Devices` | Pendiente |
| 3 | Empresa: Configuración, sedes, comida y reglas → Usuarios y permisos, con Mi perfil | EMP-01 a 08, CTA-01, TEL-11 | `TenantSettings`, `BreakPolicyChange`, `Users`, sedes de `Directory` | Pendiente |
| 4 | Reportes: nómina, expediente y bitácora con vista previa del PDF | REP-01 a 09 | `Exports`, `Dossiers` | Pendiente |
| 5 | Consola de operación; puede ir en paralelo desde el bloque 0 | CON-01 a 08 | `Tenants` | Pendiente |
| 6 | Antes del piloto: pantallas de acceso con la marca en Keycloak y portal instalable | ACC-01 a 06, TEL-03 a 05, EST-06 | Tema genérico de Keycloak | Pendiente |

El bloque 1 entra en cuatro PR, una por pantalla y en ese orden: Asistencia
(OPE-02, OPE-07, OPE-08, EST-09, TEL-07, TEL-08), Incidencias (OPE-03,
OPE-05, OPE-06, EST-08, TEL-02, TEL-09), Cierres y Panel. Entre Incidencias y
Cierres va la fase 6 del backend: los días de la semana con su tiempo
ordinario y extra, que Cierres y el reporte de nómina también muestran. El menú Crear (CTA-04) aparece con los primeros modales que abre, en
los bloques 1 y 2.

## Reglas para no duplicar

1. Quien tome un bloque lo avisa al equipo y abre `feat/portal-<bloque>`
   antes de escribir código. Una persona lleva un bloque a la vez.
2. `design.ts`, `theme.ts`, `Shell.tsx`, `sections.ts`, `ui.tsx` y el
   cliente del API sólo cambian en el bloque 0 o en una PR chica avisada
   antes. Una pieza nueva de `ui.tsx` entra con la primera pantalla que la
   usa, y las demás la reusan.
3. Cada PR de sección borra la pantalla anterior que reemplaza y sus pruebas.
   Nunca conviven dos versiones de la misma pantalla.
4. Listas, filtros, búsquedas y conteos salen del servidor, con las rutas del
   contrato. No se filtra en el navegador lo ya cargado ni se pide una ruta
   por fila.
5. Cada pantalla sale lista para teléfono en su misma PR.
6. Si al construir algo del lienzo tiene que cambiar, se anota en la PR y se
   confirma antes de integrarla.

## Cómo está armado el marco

| Pieza | Archivo |
| --- | --- |
| Valores del lienzo: colores, degradados, vidrio, sombras, ancho de teléfono | `web/src/design.ts` |
| Tema de MUI con esos valores; botón principal con degradado y forma de píldora | `web/src/theme.ts` |
| Menú, direcciones, pestañas y roles de cada pantalla | `web/src/sections.ts` |
| Barra superior, menú lateral, barra inferior, menú de la cuenta, encabezado de página y envoltura de pantallas anteriores | `web/src/Shell.tsx` |
| Rutas, falta de permiso (EST-03) y página no encontrada (EST-04) | `web/src/Portal.tsx` |
| «Más» en teléfono (TEL-06) | `web/src/More.tsx` |
| Sesión terminada (ACC-07), cuenta sin empresa (EST-01), error (EST-05) y carga | `web/src/States.tsx`, `web/src/App.tsx` |
| Íconos y marca de dos ondas | `web/src/Icons.tsx` |
| Piezas de las secciones: etiquetas de estado, filtros de un toque, búsqueda, sede, semana, tabla con paginador, filas de espera, avisos, ficha lateral (de persona o de registro, con pie de acciones), conmutador de vista, pestañas de estado y texto para lectores de pantalla (`visuallyHidden`) | `web/src/ui.tsx` |
| Pendientes junto a una sección del menú, como las incidencias abiertas | `counts` de `Shell`, que llena `Portal.tsx` |
| Piezas de las pantallas anteriores que todavía se usan (`RecordName`, `WeekSummary`) | `web/src/legacy.tsx` |
| Listas cortas pedidas completas (sedes, horarios) | `web/src/lists.ts` |

- **Sesión.** Sin sesión, el portal va directo al inicio de sesión del
  servicio de identidad (ACC-01) y vuelve a la misma dirección; un enlace
  directo sobrevive al inicio de sesión. Al salir, o si la sesión vence, se
  muestra «Tu sesión terminó» en `/sesion-terminada`.
- **Inter** se sirve desde el propio portal (`@fontsource/inter` 5.3.0, pesos
  400 a 700): la CSP sólo admite fuentes de `'self'`.
- **Menú por rol.** Una sección aparece si el rol puede abrir al menos una de
  sus pantallas; sus pestañas son las que el rol puede abrir. Una dirección
  sin permiso muestra EST-03 con los roles que sí la ven, calculados con
  `permissions()`; el servidor sigue autorizando cada operación.
- **Pantallas anteriores.** `LegacyScreen` las pone en un panel blanco y baja
  sus títulos a h2 y h3, para que la página tenga un solo h1. Se retira
  cuando la última sección se reconstruya.
- **Teléfono** (hasta 860 px): sin menú lateral; barra inferior con hasta
  cuatro secciones, o tres y «Más».
- **El menú lateral** se oculta con el botón de la barra superior y se
  recuerda en el navegador; los grupos se pliegan.

### Direcciones

| Dirección | Pantalla |
| --- | --- |
| `/` | La primera sección del rol: Asistencia para Administración, RH, Supervisión y Auditoría |
| `/asistencia` | Asistencia; lo elegido va en la dirección: `semana`, `sede`, `filtro` (`alertas`, `extra`, `sin-entrada`, `en-turno`), `q`, `persona` y `ficha` (`marcajes`, `cierres`) |
| `/incidencias` | Incidencias; en la dirección: `estado` (`resueltas`), `vista` (`tablero`), `q`, `tipo`, `sede`, `semana`, `mias`, `alta`, `bloquean` e `incidencia`, la que está abierta. Cierres y Asistencia llegan con `semana` e `incidencia` |
| `/cierres` | Cierres; en la dirección: `semana`, `sede`, `pestana` (`bloqueadas`, `reabiertas`), `acuse` (`conformes`, `objecion`, `sin-acuse`) y `cierre`, el que está abierto: un enlace con `cierre` abre ese cierre aunque no esté en la página |
| `/personal`, `/personal/horarios`, `/personal/importaciones` | Personal y horarios |
| `/dispositivos`, `/dispositivos/tarjetas` | Dispositivos y tarjetas |
| `/configuracion`, `/configuracion/sedes` | Configuración |
| `/usuarios` | Usuarios y roles |
| `/reportes`, `/reportes/expediente` | Reportes y expediente |
| `/dossier/callback` | Regreso de la verificación del expediente; está registrada en Keycloak y no se cambia |
| `/mi-asistencia` | Mi asistencia, desde el menú de la cuenta |
| `/empresas` | Consola de operación |
| `/mas` | Más, en teléfono |
| `/sesion-terminada` | Tu sesión terminó |

## Reconstruir una sección

1. Abrir la rama del bloque y avisar.
2. Construir las pantallas nuevas con `design.ts` y el tema; los títulos de
   página con `PageHeader`.
3. En `sections.ts`, cambiar las pantallas de la sección por las nuevas.
4. Borrar la pantalla anterior y sus pruebas; las nuevas llevan el caso
   negativo por rol y la revisión automática de accesibilidad.
5. Revisarla a 1440 y a 390 px con una sesión real.
6. Actualizar este documento y la [guía del portal](guia-portal-web.md).

## Lo que el marco todavía no tiene

| Falta | Llega con |
| --- | --- |
| Panel (OPE-01): mientras no exista, el inicio es la primera sección del rol y los estados dicen «Ir al inicio» | Bloque 1 |
| Cierres de una persona más allá de seis semanas: `GET /week-closures` pide la semana, y la ficha consulta las seis últimas en seis llamadas fijas | Una ruta de cierres por persona, si se necesita más historia |
| Avisos de la campana (CTA-03) | Bloque 1 |
| Historial completo de una incidencia: la incidencia trae su apertura, su asignación actual y su resolución; lo demás está en la bitácora, que sólo ven Administración y Auditoría | Bitácora en Reportes (bloque 4) |
| Buscador (CTA-05) | Bloque 2 |
| Menú Crear (CTA-04) | Bloques 1 y 2 |
| Mi perfil y seguridad de la cuenta en el menú (CTA-01) | Bloque 3 |
| «En línea · datos de las…», «Instalar Zenit» y sin conexión | Bloque 6 |
| «Ayuda y soporte» en el menú de la cuenta | Sin destino definido: falta decidir el canal de soporte |
| Empresa suspendida (EST-02) | Falta que `/me` distinga la suspensión: hoy responde igual que una cuenta sin acceso (sin empresa ni roles) y el portal muestra EST-01 |
| Pantallas de acceso con la marca (ACC-01 a 06) | Bloque 6 |

Diferencias deliberadas con el lienzo:

- **Mi asistencia** no está en el lienzo. Se conserva en el menú de la cuenta
  y es el inicio de quien sólo tiene el rol de trabajador, hasta decidir si
  el portal la mantiene.
- **El panel de marca** del lienzo muestra una cifra de ejemplo («Asistencia
  de hoy 38 / 42»). El portal no la muestra: antes de entrar no hay datos
  reales.
- **Marcajes de la ficha.** El lienzo dice «Terminal Bodega Norte · tarjeta
  T-0031». El marcaje no guarda con qué tarjeta se hizo y Supervisión no lee
  los lectores: la ficha dice «Terminal de *sede*» o «Teléfono personal», sin
  tarjeta.
- **Atención en Asistencia.** Además de «Extra 3 de 4 días», como en el
  lienzo, la columna muestra los topes rebasados, el tramo sin salida que ya
  no es el turno de hoy y cada incidencia abierta, que abre Incidencias. Una
  semana cerrada antes del contrato 0.26.0 no guardó sus días: ahí dice
  «Tiempo extra» y la ficha muestra lo trabajado de cada día.
- **Días sin marcas.** Un día con horario que ya pasó y no tiene marcas dice
  «Sin marcas · programado …»; el lienzo no tiene ese caso.
- **Incidencias: semana elegida.** Cuando se llega desde Cierres con una
  semana, aparece un filtro «Semana …» que se quita con un toque; el lienzo
  no lo tiene.
- **Incidencias: «Ver su semana»** también está en una abierta, junto a las
  marcas del día, y lleva a la ficha de la persona en Asistencia.
- **Incidencias: «Mías»** no aparece para Auditoría, que no se asigna
  incidencias.
- **El historial de una resuelta** se arma con lo que guarda la incidencia:
  abierta, asignada, resuelta y, si hubo ajuste, semana recalculada.
- **Cierres: sin cerrar personas elegidas.** El portal cierra sólo por
  corrida, de toda la empresa o de una sede, y la corrida deja fuera a quien
  tenga algo abierto. Así hay un solo camino para cerrar y no un tope de 500
  personas por petición.
- **Cierres: quién pidió la corrida** se muestra con su nombre, sin su rol.
- **Cierres: bloqueadas** salen de las incidencias abiertas que bloquean el
  cierre, agrupadas por persona. Un tramo sin salida aparece cuando una
  corrida lo vuelve incidencia «Falta la marca que cierra».
- **Cierres: nombres repetidos.** Dos bloqueadas que se llaman igual llevan
  su sede; en las cerradas va el número de empleado junto al nombre.
- **Cierres en Supervisión.** Supervisión sólo ve las corridas de su sede;
  si la última fue de toda la empresa, el banner lo dice en lugar de «Sin
  corridas».

## Verificar

```powershell
docker build --target build --tag zenit-web-check web
docker run --rm --network none zenit-web-check pnpm test
```

Las pruebas del marco están en `Portal.test.tsx` y `States.test.tsx`; las de
Asistencia, en `Attendance.test.tsx` y `attendanceModel.test.ts`; las de
Incidencias, en `Incidents.test.tsx`; las de Cierres, en `Closures.test.tsx` y
`closureModel.test.ts`; el
contraste de los colores del lienzo, en `accessibility.test.ts`.
