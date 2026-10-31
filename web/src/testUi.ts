import { act } from 'react'

export async function waitFor(predicate: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
  }
  throw new Error(`No se cumplió la condición. Pantalla: ${document.body.textContent}`)
}
/** Espera a que ninguna parte de la pantalla diga que sigue cargando. */
export async function loaded() {
  await waitFor(() => ![...document.querySelectorAll('[role="status"]')].some(item => item.textContent?.startsWith('Cargando')))
}
export function button(text: string) { return [...document.querySelectorAll<HTMLButtonElement>('button')].findLast(item => item.textContent?.trim() === text) }
export async function click(text: string) {
  await waitFor(() => !!button(text))
  await act(async () => button(text)!.click())
}
export async function setInput(name: string, value: string) {
  const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)!
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
export async function choose(name: string, label: string) {
  await waitFor(() => {
    const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`)
    const combo = input?.parentElement?.querySelector('[role="combobox"]')
    return !!combo && combo.getAttribute('aria-disabled') !== 'true'
  })
  const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!
  const combo = input.parentElement!.querySelector('[role="combobox"]')!
  await act(async () => combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })))
  await waitFor(() => [...document.querySelectorAll('[role="option"]')].some(option => option.textContent?.includes(label)))
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].findLast(item => item.textContent?.includes(label))!
  await act(async () => option.click())
}
