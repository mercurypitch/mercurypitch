// ============================================================
// Lesson toast — one short status line, with an optional action
// ============================================================
//
// A plain toast says its line for about four seconds. One with an action
// ("Sound is off" with Turn on) stays until it is used or put away: a tap
// anywhere else, or Escape. It sits after the footer, and four seconds was
// never long enough for a keyboard to reach its button (WCAG 2.2.1). Idle,
// the line holds no words, so a screen reader reading the page does not
// find "Sound is off." under the footer; the region stays in the page, so
// its next words are a change it speaks.

import { q } from './dom'

/** How long a plain toast shows, ms. */
export const TOAST_MS = 4200
/** The fade out, after which the idle line is emptied, ms. */
const FADE_MS = 400

let timer = 0
let clearTimer = 0
let putAway: (() => void) | null = null

export function hideToast(): void {
  const box = q('#toast')
  box.classList.remove('on')
  q('#toastBtn').hidden = true
  putAway?.()
  putAway = null
  window.clearTimeout(timer)
  window.clearTimeout(clearTimer)
  clearTimer = window.setTimeout(() => {
    if (!box.classList.contains('on')) q('#toastText').textContent = ''
  }, FADE_MS)
}

/** Shows `message`: for about four seconds, or with its button until used or put away. */
export function toast(message: string, withButton = false): void {
  const box = q('#toast')
  const button = q<HTMLButtonElement>('#toastBtn')
  putAway?.()
  putAway = null
  window.clearTimeout(timer)
  window.clearTimeout(clearTimer)
  q('#toastText').textContent = message
  button.hidden = !withButton
  box.classList.add('on')
  if (withButton) {
    const away = (e: Event): void => {
      if (!(e.target instanceof Node && box.contains(e.target))) hideToast()
    }
    const escape = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      const held = document.activeElement
      hideToast()
      // Escape hid the button that had focus. The one toast with a button is
      // the sound one, so focus goes to the sound switch, as Turn on's does.
      if (held instanceof Node && box.contains(held))
        document
          .querySelector<HTMLElement>('#soundSwitch')
          ?.focus({ preventScroll: true })
    }
    document.addEventListener('pointerdown', away, true)
    document.addEventListener('keydown', escape)
    putAway = () => {
      document.removeEventListener('pointerdown', away, true)
      document.removeEventListener('keydown', escape)
    }
    return
  }
  timer = window.setTimeout(hideToast, TOAST_MS)
}
