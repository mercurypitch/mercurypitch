// ============================================================
// Voice Constellation Isolation — route-lifetime focus and page isolation.
// ============================================================
//
// This starts at the route signal, before the lazy surface chunk is available.
// It therefore owns the background inert state, scroll lock, opener restoration
// and pending-Back reset for loading, loaded and failed states alike.

import type { Accessor } from 'solid-js'
import { createEffect, onCleanup } from 'solid-js'
import { resetVoiceConstellationExit } from './navigation'

export function useVoiceConstellationIsolation(
  isOpen: Accessor<boolean>,
): void {
  createEffect(() => {
    if (!isOpen()) {
      resetVoiceConstellationExit()
      return
    }

    const app = document.getElementById('app')
    const previousInert = app?.inert ?? false
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement as HTMLElement | null

    if (app !== null) app.inert = true
    document.body.style.overflow = 'hidden'

    onCleanup(() => {
      if (app !== null) app.inert = previousInert
      document.body.style.overflow = previousOverflow
      queueMicrotask(() => {
        if (previousFocus?.isConnected === true) {
          previousFocus.focus({ preventScroll: true })
        }
      })
    })
  })
}
