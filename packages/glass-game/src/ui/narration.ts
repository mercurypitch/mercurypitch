// Merc narration lifecycle — gameplay cues yield synchronously to voice capture and session stops.
import type { GlassMercNarration, MercNarrationCue, MercNarrationPreferences, } from '../host'

export interface AdventureNarration {
  preferences(): MercNarrationPreferences | undefined
  welcomeGesture(): void
  breakCompleted(optional: boolean): void
  silenceForVoice(): Promise<void>
  releaseVoice(): void
  pause(): void
  setEnabled(enabled: boolean): void
  dispose(): void
}

export function createAdventureNarration(
  audio: GlassMercNarration | undefined,
  canPlay: () => boolean,
): AdventureNarration {
  let welcomeConsumed = audio?.preferences().enabled === false
  let welcomePending = false
  let welcomeGeneration = 0
  let voiceHeld = false
  let disposed = false

  function invalidateWelcomeAttempt(): void {
    welcomeGeneration++
    welcomePending = false
    welcomeConsumed = true
  }

  function play(cue: MercNarrationCue): void {
    if (!audio || disposed || voiceHeld || !canPlay()) return
    void audio.play(cue)
  }

  return {
    preferences: () => audio?.preferences(),
    welcomeGesture() {
      if (
        welcomeConsumed ||
        welcomePending ||
        disposed ||
        voiceHeld ||
        !canPlay()
      )
        return
      if (!audio || !audio.preferences().enabled) {
        welcomeConsumed = true
        return
      }
      const generation = ++welcomeGeneration
      welcomePending = true
      void audio.play('tutorial-note').then(
        (playing) => {
          if (disposed || generation !== welcomeGeneration) return
          welcomePending = false
          if (playing) welcomeConsumed = true
        },
        () => {
          if (disposed || generation !== welcomeGeneration) return
          welcomePending = false
        },
      )
    },
    breakCompleted(optional) {
      play(optional ? 'optional-break' : 'required-break')
    },
    silenceForVoice() {
      if (disposed) return Promise.resolve()
      invalidateWelcomeAttempt()
      voiceHeld = true
      return audio?.silenceForVoice() ?? Promise.resolve()
    },
    releaseVoice() {
      if (!disposed) voiceHeld = false
    },
    pause() {
      if (disposed) return
      invalidateWelcomeAttempt()
      audio?.pause()
    },
    setEnabled(enabled) {
      if (disposed) return
      if (!enabled) {
        invalidateWelcomeAttempt()
      }
      audio?.setPreferences({ enabled })
      if (!enabled) audio?.pause()
    },
    dispose() {
      if (disposed) return
      disposed = true
      voiceHeld = true
      invalidateWelcomeAttempt()
      audio?.dispose()
    },
  }
}
