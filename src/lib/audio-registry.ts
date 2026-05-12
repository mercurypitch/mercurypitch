/**
 * Typed audio engine registry.
 *
 * Replaces ad-hoc `window.pianoRollAudioEngine` writes with a typed
 * singleton that any component owning a secondary AudioEngine can
 * register itself into. `stopAll()` is the single API that controllers
 * (e.g. usePlaybackController.resetPlaybackState) call instead of
 * reading from `window`.
 *
 * Phase 13 of refactor v3.
 */

import type { InstrumentType } from '@/stores'

type SetInstrumentFn = (instrument: InstrumentType) => void

interface StoppableEngine {
  stopTone: () => void
  stopAllNotes: () => void
  setInstrument?: SetInstrumentFn
}

const registered = new Set<StoppableEngine>()

export const audioRegistry = {
  register(engine: StoppableEngine): void {
    registered.add(engine)
  },

  unregister(engine: StoppableEngine): void {
    registered.delete(engine)
  },

  stopAll(): void {
    for (const engine of registered) {
      try {
        engine.stopTone()
        engine.stopAllNotes()
      } catch (err) {
        console.warn('[audioRegistry] error stopping engine:', err)
      }
    }
  },

  size(): number {
    return registered.size
  },

  /**
   * Broadcast an instrument change to every registered engine.
   * Called by App.tsx onInstrumentChange so the piano-roll's secondary
   * AudioEngine (used for in-editor preview clicks) stays in sync with
   * the App's primary engine — otherwise changing the instrument
   * dropdown wouldn't audibly affect playback in the editor.
   */
  setInstrumentAll(instrument: InstrumentType): void {
    for (const engine of registered) {
      try {
        engine.setInstrument?.(instrument)
      } catch (err) {
        console.warn('[audioRegistry] setInstrument error:', err)
      }
    }
  },
}
