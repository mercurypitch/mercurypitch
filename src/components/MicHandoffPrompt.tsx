// ============================================================
// MicHandoffPrompt — "your mic is open in another tab"
// ============================================================
//
// The one thing a blocked singer needs is not an error, it is a button. When
// the cross-tab lock (@/lib/mic-lock) refuses an acquire because another
// MercuryPitch tab holds the device, this offers to move it here: the other
// tab is asked to let go, and this one takes over.
//
// Mounted once, near the app root. It is invisible until a mic start is
// actually blocked, so there is nothing to gate it on.

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { micManager } from '@/lib/mic-manager'
import { micBlockedBy, setMicBlockedBy } from '@/stores/mic-store'
import { showNotification } from '@/stores/notifications-store'
import { ConfirmDialog } from './ConfirmDialog'
import { Mic } from './icons'

export const MicHandoffPrompt: Component = () => {
  const [busy, setBusy] = createSignal(false)

  const takeOver = async (): Promise<void> => {
    setBusy(true)
    try {
      const won = await micManager.takeOverFromOtherTab()
      if (won) {
        setMicBlockedBy(null)
        showNotification(
          'Microphone moved to this tab. Turn it on to start singing.',
          'success',
        )
      } else {
        // The holder never answered — frozen rather than closed. Opening the
        // device anyway would put two live handles on it, which is the exact
        // thing the lock exists to prevent.
        showNotification(
          'The other tab did not respond. Close it, then try again.',
          'error',
        )
      }
    } finally {
      setBusy(false)
    }
  }

  /**
   * The holder's document title, when it says something this tab's title does
   * not. Two tabs sitting on the default title would just repeat it back, and
   * a name that matches nothing in the tab strip is worse than no name.
   */
  const holderName = (label: string): string | null => {
    if (label === '' || label === document.title) return null
    return label
  }

  return (
    <Show when={micBlockedBy()}>
      {(holder) => (
        <ConfirmDialog
          open
          title="Your mic is open in another tab"
          message={
            <>
              <Show
                when={holderName(holder().label)}
                fallback={<>Another MercuryPitch tab is already listening.</>}
              >
                {(name) => (
                  <>
                    The tab <strong>{name()}</strong> is already listening.
                  </>
                )}
              </Show>{' '}
              Only one tab can use the microphone at a time.
            </>
          }
          confirmLabel="Use it here"
          confirmIcon={<Mic />}
          busy={busy()}
          onConfirm={() => void takeOver()}
          onCancel={() => setMicBlockedBy(null)}
        />
      )}
    </Show>
  )
}

export default MicHandoffPrompt
