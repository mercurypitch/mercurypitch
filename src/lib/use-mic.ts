// ── useMic ───────────────────────────────────────────────────────────
// SolidJS abstraction over the shared {@link micManager}. Any page or view can
// hold the microphone for its own lifetime without touching getUserMedia or
// worrying about cross-page contention — acquire on enable, and the hook
// auto-releases the consumer's hold when the component unmounts.

import type { Accessor } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import type { MicError, MicState } from './mic-manager'
import { micManager } from './mic-manager'

export interface UseMicResult {
  /** True while the device is open and held by at least one consumer. */
  active: Accessor<boolean>
  /** Last acquisition error (classified), or null. */
  error: Accessor<MicError | null>
  /** Whether this hook's own consumer currently holds the mic. */
  held: Accessor<boolean>
  /** Acquire the shared mic for this consumer. Resolves with the stream. */
  enable: () => Promise<MediaStream>
  /** Release this consumer's hold (no-op if not held). */
  disable: () => void
  /** The shared capture stream, or null when closed. */
  stream: () => MediaStream | null
}

/** Reactive snapshot of the shared mic state, scoped to the caller's lifetime. */
export function useMicState(): Accessor<MicState> {
  const [state, setState] = createSignal<MicState>(
    { active: false, error: null, consumers: [] },
    { equals: false },
  )
  onCleanup(micManager.subscribe(setState))
  return state
}

/**
 * Bind the shared microphone to a component for `consumerId`. The hold is
 * released automatically on unmount, so a view can `enable()` freely without
 * leaking the device when the user navigates away.
 */
export function useMic(consumerId: string): UseMicResult {
  const state = useMicState()
  const [held, setHeld] = createSignal(false)

  const enable = async (): Promise<MediaStream> => {
    const stream = await micManager.acquire(consumerId)
    setHeld(true)
    return stream
  }

  const disable = (): void => {
    if (!held()) return
    micManager.release(consumerId)
    setHeld(false)
  }

  onCleanup(disable)

  return {
    active: () => state().active,
    error: () => state().error,
    held,
    enable,
    disable,
    stream: () => micManager.getStream(),
  }
}
