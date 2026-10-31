import axe from 'axe-core'

/**
 * Reglas automáticas de WCAG 2.1, niveles A y AA, sobre lo que hay en pantalla.
 * jsdom no calcula colores: el contraste se comprueba con la paleta en
 * accessibility.test.ts. Devuelve cada falla con su regla y dónde ocurrió.
 */
export async function accessibilityViolations(root: Element = document.body) {
  const result = await axe.run(root, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } },
  })
  return result.violations.map(failure => `${failure.id}: ${failure.help} (${failure.nodes.map(node => node.target.join(' ')).join(', ')})`)
}
