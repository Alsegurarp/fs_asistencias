import { decomposeColor, getContrastRatio, recomposeColor } from '@mui/material/styles'
import { expect, it } from 'vitest'
import { theme } from './theme'
import { color } from './design'

/** Color que se ve al poner uno con transparencia sobre un fondo opaco. */
function over(color: string, background: string) {
  const front = decomposeColor(color)
  const back = decomposeColor(background)
  const opacity = front.values[3] ?? 1
  const mixed = [0, 1, 2].map(i => Math.round(front.values[i] * opacity + back.values[i] * (1 - opacity))) as [number, number, number]
  return recomposeColor({ type: 'rgb', values: mixed })
}

// jsdom no calcula colores, así que el contraste del texto se comprueba aquí,
// con la paleta del tema y sobre los fondos en los que aparece.
it('el texto del tema cumple contraste AA sobre los fondos que usa', () => {
  const { palette } = theme
  const pairs: [string, string, string][] = [
    ['texto principal sobre el fondo', palette.text.primary, palette.background.default],
    ['texto principal sobre papel', palette.text.primary, palette.background.paper],
    ['texto secundario sobre el fondo', palette.text.secondary, palette.background.default],
    ['texto secundario sobre papel', palette.text.secondary, palette.background.paper],
    ['primario sobre papel', palette.primary.main, palette.background.paper],
    ['primario sobre el fondo', palette.primary.main, palette.background.default],
    ['texto de un botón primario', palette.primary.contrastText, palette.primary.main],
    ['error sobre papel', palette.error.main, palette.background.paper],
  ]
  for (const [name, color, background] of pairs) {
    expect(getContrastRatio(over(color, background), background), name).toBeGreaterThanOrEqual(4.5)
  }
})

// Pares de texto del lienzo que no pasan por la paleta de MUI: menú, barra
// superior, pestañas, insignias y tarjetas de estado.
it('los colores de texto del lienzo cumplen contraste AA donde se usan', () => {
  const pairs: [string, string, string][] = [
    ['blanco sobre el inicio del degradado azul', color.white, color.gradientFrom],
    ['blanco sobre el final del degradado azul', color.white, color.gradientTo],
    ['texto del menú sobre blanco', color.inkSoft, color.white],
    ['título de grupo del menú sobre blanco', color.subtle, color.white],
    ['ruta de la página sobre el fondo', color.subtle, color.page],
    ['sección activa sobre su mosaico', color.deep, color.tile],
    ['pestaña sin elegir sobre el fondo', color.muted, color.page],
    ['enlace sobre el fondo', color.link, color.page],
    ['insignia de pendientes', color.warnInk, color.warnBg],
    ['texto principal sobre vidrio', color.ink, 'rgba(255,255,255,0.7)'],
  ]
  for (const [name, front, background] of pairs) {
    const back = background.startsWith('rgba') ? over(background, color.page) : background
    expect(getContrastRatio(over(front, back), back), name).toBeGreaterThanOrEqual(4.5)
  }
})
