// Microphone input preference — explicit routes survive direct entry without changing another live capture.

import { listInputs } from '@irchiinnuss/audio-io'
import { micManager } from '@irchiinnuss/pitch-engine'
import type { GlassMicrophoneInput } from '../host'

export function createBrowserMicrophoneInput(preferenceKey: string) {
  let selected = ''
  let selectionRevision = 0
  try {
    selected = localStorage.getItem(preferenceKey) ?? ''
  } catch {
    // The current visit can still choose an input when storage is unavailable.
  }
  const input: GlassMicrophoneInput = {
    list: listInputs,
    selected: () => selected,
    async select(deviceId) {
      selected = deviceId
      selectionRevision++
      try {
        if (deviceId) localStorage.setItem(preferenceKey, deviceId)
        else localStorage.removeItem(preferenceKey)
      } catch {
        // Keep the in-memory selection for this visit.
      }
    },
  }
  return {
    input,
    /** Bind one start to its chosen input; a late completion cannot erase a newer choice. */
    forStart() {
      const requested = selected
      const requestedRevision = selectionRevision
      return {
        prepareMicrophone: () =>
          micManager.setPreferredDevice(requested || null),
        microphoneOpened: () => {
          // MicManager falls back to default when an exact device disappeared.
          // Forget that stale id only after a successful open, never on denial.
          if (
            requested !== '' &&
            selectionRevision === requestedRevision &&
            micManager.getPreferredDevice() === null
          )
            void input.select('')
        },
      }
    },
  }
}
