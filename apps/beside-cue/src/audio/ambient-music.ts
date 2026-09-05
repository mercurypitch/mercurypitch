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
    const cue = scope.play(assetId)
    current = cue
    void cue.finished.then(() => {
      if (current === cue) current = undefined
    })
  }

  return {
    update,
    /** Synchronous gesture entry also unlocks a returning iOS browser tab. */
    unlock() {
      if (disposed || !state.active || state.muted || !state.foreground) return
      void session.unlock().then((ready) => {
        if (ready) update(state)
      })
    },
    dispose() {
      if (disposed) return
      disposed = true
      current = undefined
      scope.dispose()
    },
  }
}
