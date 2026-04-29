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

interface StoppableEngine {
  stopTone: () => void
  stopAllNotes: () => void
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
}
