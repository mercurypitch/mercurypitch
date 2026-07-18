// ============================================================
// useScrollLock — counted body-scroll lock for overlays.
// ============================================================
//
// Full-screen stages, sheets and modals must stop the page behind them
// from scrolling. Mutating document.body.style.overflow directly (the old
// KaraokeMobileStage approach) breaks as soon as two overlays overlap in
// time: whichever unmounts last restores the value the OTHER one saved.
// A module-level count makes the lock re-entrant — the body unlocks only
// when the last locker is gone.
//
// Call inside a component body (needs an owner for onCleanup); the lock
// holds for the component's lifetime.

import { onCleanup } from 'solid-js'

let lockCount = 0
let prevOverflow = ''

export function useScrollLock(): void {
  if (typeof document === 'undefined') return
  if (lockCount === 0) {
    prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount++
  onCleanup(() => {
    lockCount--
    if (lockCount === 0) {
      document.body.style.overflow = prevOverflow
    }
  })
}
