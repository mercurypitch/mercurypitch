// ============================================================
// Ambient music — one continuous score across onboarding and home
// ============================================================

import type { AudioSession, AudioSessionCue } from './audio-session'

export interface AmbientMusicState {
  readonly active: boolean
  readonly muted: boolean
  readonly foreground: boolean
  readonly gain: number
}

/** Route changes adjust the running mix without restarting the composition. */
export function createAmbientMusic(session: AudioSession, assetId: string) {
  const scope = session.createScope('ambient-music')
  let current: AudioSessionCue | undefined
  let unlockGeneration = 0
  let state: AmbientMusicState = {
    active: false,
    muted: true,
    foreground: false,
    gain: 1,
  }
  let disposed = false

  function update(next: AmbientMusicState): void {
    state = next
    if (disposed) return
    scope.setGain(next.gain)
    if (!next.active || next.muted || !next.foreground) {
      current?.stop()
      current = undefined
      return
    }
    if (current !== undefined) return
    const attemptedUnlockGeneration = unlockGeneration
    const cue = scope.play(assetId)
    current = cue
    void cue.finished.then((result) => {
      if (current !== cue) return
      current = undefined
      // A non-gesture resume can fail after the begin tap has already unlocked
      // iOS. Retry that superseded attempt once, not on every render or failure.
      // A retry records the new generation, so a real load error cannot spin.
      if (
        result.kind === 'silent' &&
        result.reason === 'load-failed' &&
        attemptedUnlockGeneration < unlockGeneration
      ) {
        update(state)
      }
    })
  }

  return {
    update,
    /** Synchronous gesture entry also unlocks a returning iOS browser tab. */
    unlock() {
      if (disposed || !state.active || !state.foreground) return
      // The session's mute flag updates inside the unmute handler; this
      // controller's reactive snapshot may still be muted until its batch ends.
      // Ask permission now. The session and update() still forbid muted sound.
      void session
        .unlock()
        .then((ready) => {
          if (!ready || disposed) return
          unlockGeneration += 1
          update(state)
        })
        .catch(() => undefined)
    },
    dispose() {
      if (disposed) return
      disposed = true
      current = undefined
      scope.dispose()
    },
  }
}
