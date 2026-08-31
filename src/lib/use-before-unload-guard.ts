// Keeps a browser document mounted while an irreplaceable local operation is in flight.

import type { Accessor } from 'solid-js'
import { createEffect, onCleanup } from 'solid-js'

/**
 * Ask the browser to confirm a full-page navigation while `shouldBlock` is true.
 * In-app navigation should use its own accessible confirmation or veto flow.
 */
export function useBeforeUnloadGuard(shouldBlock: Accessor<boolean>): void {
  createEffect(() => {
    if (!shouldBlock()) return

    const preventUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', preventUnload)
    onCleanup(() => window.removeEventListener('beforeunload', preventUnload))
  })
}
