// ============================================================
// Mic Store — page-facing mic indicator (NOT the device owner)
// ============================================================
//
// Device ownership lives in src/lib/mic-manager.ts. This store is only the
// per-page "is this page's mic on" light. See the comment below before wiring
// anything new to it.

import { createSignal } from 'solid-js'
import type { MicLockRecord } from '@/lib/mic-lock'
import { onMicLockChange } from '@/lib/mic-lock'
import { micManager } from '@/lib/mic-manager'
import { createPersistedSignal } from '@/lib/storage'

// `micActive`/`micError` reflect the SHARED practice/analysis engine mic
// (singing, guitar, piano, exercises) and are driven by those controllers'
// onMicStateChange callbacks — i.e. "is this page's mic on". They are
// deliberately NOT bridged to the device-level MicManager: separate consumers
// like the stem mixer or jam hold the device under their own ids, and must not
// flip this page-facing indicator (doing so corrupted the Singing mic toggle
// after using the Karaoke stem mixer).
export const [micActive, setMicActive] = createSignal<boolean>(false)
// Off until the singer asks for it: the waveform overlay is a mic-health
// check, not something every run needs drawn over it. Persisted, so asking
// once is enough.
export const [micWaveVisible, setMicWaveVisible] =
  createPersistedSignal<boolean>('pitchperfect_mic_wave_visible', false)
export const [micError, setMicError] = createSignal<string | null>(null)

export function toggleMicWaveVisible(): void {
  setMicWaveVisible(!micWaveVisible())
}

// Unlike the signals above, this one IS device-level: another MercuryPitch tab
// holding the mic blocks every surface in this tab at once, so there is nothing
// per-page about it. Set when an acquire is refused by the cross-tab lock,
// cleared once we hold the device (or the other tab lets go).
export const [micBlockedBy, setMicBlockedBy] =
  createSignal<MicLockRecord | null>(null)

micManager.subscribe((state) => {
  setMicBlockedBy(state.blockedBy)
})

// The other tab can also let go on its own — closed, navigated away, crashed.
// Watching the lock as well as the manager means the prompt disappears when the
// reason for it does, instead of waiting for something else to emit.
onMicLockChange((status) => {
  if (status !== 'other') setMicBlockedBy(null)
})
