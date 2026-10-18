// ============================================================
// Lesson toast — one short status line, with an optional action
// ============================================================

import { q } from './dom'

let timer = 0

export function hideToast(): void {
  q('#toast').classList.remove('on')
  q('#toastBtn').hidden = true
}

/** Shows `message` for about four seconds; held while its button has focus. */
export function toast(message: string, withButton = false): void {
  const box = q('#toast')
  const button = q<HTMLButtonElement>('#toastBtn')
  q('#toastText').textContent = message
  button.hidden = !withButton
  box.classList.add('on')
  window.clearTimeout(timer)
  const later = (): void => {
    timer = window.setTimeout(() => {
      if (document.activeElement === button) later()
      else hideToast()
    }, 4200)
  }
  later()
}
