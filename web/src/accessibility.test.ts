import { decomposeColor, getContrastRatio, recomposeColor } from '@mui/material/styles'
import { expect, it } from 'vitest'
import { theme } from './theme'

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
