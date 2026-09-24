// Merc narration lifecycle — gameplay cues yield synchronously to voice capture and session stops.
import type { GlassMercNarration, MercNarrationCue, MercNarrationLine, MercNarrationPreferences, } from '../host'
import { createMercReactionSelector, MERC_PATH_OPEN_LINE, } from './merc-reactions'

export interface AdventureNarration {
  preferences(): MercNarrationPreferences | undefined
  welcomeGesture(): void
  breakCompleted(optional: boolean): MercNarrationLine
  silenceForVoice(): Promise<void>
  releaseVoice(): void
  pause(): void
  setEnabled(enabled: boolean): void
  dispose(): void
}

export function createAdventureNarration(
  audio: GlassMercNarration | undefined,
  canPlay: () => boolean,
  random: () => number = Math.random,
): AdventureNarration {
  let welcomeConsumed = audio?.preferences().enabled === false
  let welcomePending = false
  let welcomeGeneration = 0
  let voiceHeld = false
  let disposed = false
  let requiredUsesPathOpen = true
  const reactions = createMercReactionSelector(random)

  function invalidateWelcomeAttempt(consume = true): void {
    welcomeGeneration++
    welcomePending = false
    welcomeConsumed = consume
  }

  function play(cue: MercNarrationCue): void {
    if (
      !audio ||
      !audio.preferences().enabled ||
      disposed ||
      voiceHeld ||
      !canPlay()
    )
      return
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
      const line =
        optional || !requiredUsesPathOpen
          ? reactions.next()
          : MERC_PATH_OPEN_LINE
      if (!optional) requiredUsesPathOpen = !requiredUsesPathOpen
      play(line.cue)
      return line
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
      // Loading pauses before the first gesture; only retire a welcome that
      // was attempted, so the first ready interaction can still introduce Merc.
      invalidateWelcomeAttempt(welcomeConsumed || welcomePending)
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
