# Accesibilidad del portal

El portal debe poder usarse con teclado, tener contraste suficiente y no
depender sólo del color para decir algo. La referencia es WCAG 2.1, nivel AA.
Este documento dice qué se comprueba solo, qué se revisó a mano y qué falta.

**Revisión de código del 6 de noviembre:** la referencia ID/SHA-256 del acuse
en Mi asistencia adopta el ajuste de línea que ya usan expediente y exportes,
sin truncar la huella. Las 218 pruebas y compilación aprueban. No sustituye
comprobación visual a 320 px ni lector de pantalla; el control del navegador
continúa indisponible. [Acta](qa-continuacion-multiagente-2026-11-06.md).

## Revisión manual parcial — 5 de noviembre de 2026

Sobre la base integrada `2ab9745`, navegador Zen en Windows y componentes
reales del portal con cuentas/datos ficticios y respuestas del API simuladas
en una fixture local. No se usaron cuentas, tokens ni registros de producción;
no acredita sesión OIDC, permisos del backend ni el ambiente publicado.

- Alta de sede: apertura del diálogo, foco visible, recorrido con Tab,
  envío con teclado, error simulado visible conservando los campos y cierre
  con Escape. Horarios y cierre de empleados: apertura y salida con Escape;
  no se ejecutó una operación real.
- Pestañas: navegación con flechas y Enter entre empleados, horarios,
  importación, incidencias, cierres, exportes y expediente. Se inspeccionaron
  sus controles/estados disponibles; no los detalles de registros ausentes.
- Ancho 320 CSS px: inspección de sedes, formulario de horario e importación.
  La línea de encabezados CSV se desbordaba por no tener espacios. Se añadió
  `overflowWrap: 'anywhere'` en ese párrafo y se verificó visualmente que se
  parte dentro del ancho, sin cambiar el texto que se copia.
- Zoom 200 %: inspección del contenido de importación; luego se restauró
  el zoom y se cerró el modo adaptable y la pestaña de QA.
- El selector CSV sí abre desde el teclado. Una captura inicial no mostraba
  todavía su diálogo nativo; la observación posterior y la implementación
  de MUI confirman la activación. Se conserva el control original.

La compilación y TypeScript aprobaron; se mantiene el aviso de paquete mayor
de 500 kB. La suite automática y la repetición de importación se registran
en la bitácora. **Sigue pendiente el lector de pantalla**: una inspección del
árbol accesible no prueba el anuncio audible de errores/avisos. También falta
completar teclado/zoom/320 px en todos los recorridos, roles y detalles con
datos reales de ensayo contra backend, y la aceptación pública/del usuario.
El apartado de pendientes de abajo conserva esos requisitos globales.

## Qué se comprueba en cada cambio

Corre con las pruebas del portal (`pnpm test`) y, por lo tanto, en el CI.

| Comprobación | Dónde | Qué hace |
| --- | --- | --- |
| Reglas automáticas | `web/src/accessibility.ts` y una prueba por pantalla | axe-core 4.14.0 con las reglas de WCAG 2.1 A y AA sobre Cierres, Dispositivos, Expediente, Exportes, Importación, Incidencias, Mi asistencia, Horarios, Configuración, Empresas y Usuarios, más los diálogos de alta y de uso de empresas. Una sola falla rompe la prueba |
| Contraste de la paleta | `web/src/accessibility.test.ts` | Texto principal y secundario sobre el fondo y sobre papel, primario, texto de botón primario y error: cada par con al menos 4.5:1. El color con transparencia se mezcla con su fondo antes de medir |

jsdom no calcula colores ni tamaños, así que la regla de contraste de axe va
apagada en las pruebas de pantalla: el contraste lo cubre la prueba de la
paleta. El primario `#176b87` da unos 6.0:1 sobre blanco.

## Revisión del código, 30 de octubre de 2026

- La página declara `lang="es-MX"`.
- No hay botones de ícono sin nombre, ni clics en elementos que no sean
  botones, ni imágenes sin texto alternativo.
- Los estados llevan texto: avisos con ícono y mensaje, estados de empresa y
  de cierre escritos. Ninguno depende sólo del color.
- El secundario `#00a6a6` da 3.0:1 sobre blanco y hoy no se usa. Si se usa,
  que sea en texto grande o en controles, no en texto normal.

## Lo que falta y no cubre la automatización

- Recorrer con teclado, en un navegador real, alta, padrón, horarios,
  incidencias, cierre, exportes y expediente: orden del foco, foco visible,
  cerrar diálogos con Escape y no quedar atrapado.
- Probar con un lector de pantalla (NVDA o VoiceOver) que los errores y los
  avisos se anuncian.
- Probar al 200 % de zoom y a 320 px de ancho.

## Cómo se agrega una pantalla

En su prueba, después de montarla:

```ts
await mount(); await loaded()
expect(await accessibilityViolations()).toEqual([])
```

`loaded()` espera a que ninguna parte de la pantalla diga que sigue cargando.
Conviene repetir la comprobación con cada diálogo abierto.
