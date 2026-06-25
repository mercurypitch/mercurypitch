import { createSignal } from 'solid-js'
import { micManager } from '@/lib/mic-manager'

export const [micActive, setMicActive] = createSignal<boolean>(false)
export const [micWaveVisible, setMicWaveVisible] = createSignal<boolean>(true)
export const [micError, setMicError] = createSignal<string | null>(null)

export function toggleMicWaveVisible(): void {
  setMicWaveVisible(!micWaveVisible())
}

// Mirror the shared MicManager (the single source of truth for the device) into
// these global signals, so any view can read mic state without importing the
// manager. The manager is authoritative: it flips `micActive` off the moment the
// last consumer releases, and surfaces classified acquisition errors.
micManager.subscribe((state) => {
  setMicActive(state.active)
  setMicError(state.error?.message ?? null)
})
