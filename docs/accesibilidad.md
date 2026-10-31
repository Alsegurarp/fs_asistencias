# Accesibilidad del portal

El portal debe poder usarse con teclado, tener contraste suficiente y no
depender sólo del color para decir algo. La referencia es WCAG 2.1, nivel AA.
Este documento dice qué se comprueba solo, qué se revisó a mano y qué falta.

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
