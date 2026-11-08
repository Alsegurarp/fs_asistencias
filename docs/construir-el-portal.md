# Construir el portal

El portal sigue el [lienzo aprobado](https://claude.ai/artifact/6nguqVzZ7N9rtHX2LDScvq)
el 7 de noviembre: 81 pantallas con código por sección (ACC, CTA, OPE, PAD,
EMP, REP, EST, TEL y CON). El backend que piden ya está en `main` y en el
ambiente publicado (contrato 0.23.0). Este documento dice en qué orden se
construye, cómo está armado el marco y qué reglas evitan que dos personas
hagan lo mismo.

## Orden

Cada bloque entra por PR y se despliega en el ambiente publicado al
integrarse con CI en verde. Mientras una sección no se reconstruye, sus
pantallas anteriores se muestran dentro del marco nuevo, en su dirección: el
ambiente nunca pierde una función.

| Bloque | Qué entra | Pantallas del lienzo | Pantalla anterior que se retira | Estado |
| --- | --- | --- | --- | --- |
| 0 | Marco: colores, tipografía, direcciones, barra superior, menú lateral, barra inferior de teléfono, menú de la cuenta y estados | CTA-02, EST-01, EST-03, EST-04, EST-05, TEL-06, ACC-07 | Las pestañas de `Workspace` | En la rama `feat/portal-base` |
| 1 | Operación: Asistencia → Incidencias → Cierres → Panel con avisos y primeros pasos | OPE-01 a 12, CTA-03, EST-08, EST-09, TEL-01, TEL-02, TEL-07 a 10 | `Incidents`, `Closures` | Siguiente |
| 2 | Padrón: Personal y horarios → Importar → Dispositivos y tarjetas, con el buscador | PAD-01 a 12, CTA-05, EST-07 | `Directory` (personas y tarjetas), `Schedules`, `Imports`, `Devices` | Pendiente |
| 3 | Empresa: Configuración, sedes, comida y reglas → Usuarios y permisos, con Mi perfil | EMP-01 a 08, CTA-01, TEL-11 | `TenantSettings`, `BreakPolicyChange`, `Users`, sedes de `Directory` | Pendiente |
| 4 | Reportes: nómina, expediente y bitácora con vista previa del PDF | REP-01 a 09 | `Exports`, `Dossiers` | Pendiente |
| 5 | Consola de operación; puede ir en paralelo desde el bloque 0 | CON-01 a 08 | `Tenants` | Pendiente |
| 6 | Antes del piloto: pantallas de acceso con la marca en Keycloak y portal instalable | ACC-01 a 06, TEL-03 a 05, EST-06 | Tema genérico de Keycloak | Pendiente |

El menú Crear (CTA-04) aparece con los primeros modales que abre, en los
bloques 1 y 2.

## Reglas para no duplicar

1. Quien tome un bloque lo avisa al equipo y abre `feat/portal-<bloque>`
   antes de escribir código. Una persona lleva un bloque a la vez.
2. `design.ts`, `theme.ts`, `Shell.tsx`, `sections.ts` y el cliente del API
   sólo cambian en el bloque 0 o en una PR chica avisada antes.
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
| `/` | La primera sección del rol |
| `/incidencias`, `/cierres` | Operación |
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
| Avisos de la campana (CTA-03) | Bloque 1 |
| Buscador (CTA-05) | Bloque 2 |
| Menú Crear (CTA-04) | Bloques 1 y 2 |
| Mi perfil y seguridad de la cuenta en el menú (CTA-01) | Bloque 3 |
| «En línea · datos de las…», «Instalar Zenit» y sin conexión | Bloque 6 |
| «Ayuda y soporte» en el menú de la cuenta | Sin destino definido: falta decidir el canal de soporte |
| Empresa suspendida (EST-02) | Falta que `/me` distinga la suspensión: hoy responde igual que una cuenta sin acceso (sin empresa ni roles) y el portal muestra EST-01 |
| Pantallas de acceso con la marca (ACC-01 a 06) | Bloque 6 |

Dos diferencias deliberadas con el lienzo:

- **Mi asistencia** no está en el lienzo. Se conserva en el menú de la cuenta
  y es el inicio de quien sólo tiene el rol de trabajador, hasta decidir si
  el portal la mantiene.
- **El panel de marca** del lienzo muestra una cifra de ejemplo («Asistencia
  de hoy 38 / 42»). El portal no la muestra: antes de entrar no hay datos
  reales.

## Verificar

```powershell
docker build --target build --tag zenit-web-check web
docker run --rm --network none zenit-web-check pnpm test
```

Las pruebas del marco están en `Portal.test.tsx` y `States.test.tsx`; el
contraste de los colores del lienzo, en `accessibility.test.ts`.
