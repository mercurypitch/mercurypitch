// ============================================================
// V2 onboarding audio director — exact-once hold transitions
// ============================================================

import type { AudioSessionCue, AudioSessionScope, AudioSessionStartResult, } from '../audio/audio-session'

export interface V2OnboardingAudioBeat {
  readonly scoreAssetId?: string
  readonly dialogueAssetId?: string
  readonly foleyAssetId?: string
  readonly uiAssetId?: string
}

export interface V2OnboardingAudioHold extends V2OnboardingAudioBeat {
  readonly holdId: string
  readonly holdBedAssetId?: string
}

export interface V2OnboardingAudioHoldToken {
  readonly holdId: string
  readonly generation: number
}

export interface V2OnboardingAudioDirector {
  /** Enters authored, finite material and retires any decision bed safely. */
  enterBeat(beat: V2OnboardingAudioBeat): AudioSessionCue | undefined
  /** Enters an indefinite decision hold and returns its correlated exit token. */
  enterHold(hold: V2OnboardingAudioHold): V2OnboardingAudioHoldToken
  /** A matching hold can leave once. Rapid or stale exits are ignored. */
  exitHold(
    token: V2OnboardingAudioHoldToken,
    nextBeat: V2OnboardingAudioBeat,
  ): boolean
  stop(): void
  dispose(): void
}

type AudioDirectorScope = Pick<
  AudioSessionScope,
  'play' | 'stopLane' | 'stopAll' | 'dispose'
>

interface ActiveHold {
  readonly token: V2OnboardingAudioHoldToken
  exited: boolean
}

function playOptional(
  scope: AudioDirectorScope,
  assetId: string | undefined,
): AudioSessionCue | undefined {
  return assetId === undefined ? undefined : scope.play(assetId)
}

function afterStart(
  cue: AudioSessionCue | undefined,
  callback: (result?: AudioSessionStartResult) => void,
): void {
  if (cue === undefined) {
    callback()
    return
  }
  void cue.started.then(callback, () => callback())
}

/**
 * Coordinates the feature's semantic audio cues without owning bytes, clocks,
 * or UI state. Missing assets stay silent and never block the journey.
 */
export function createV2OnboardingAudioDirector(
  scope: AudioDirectorScope,
): V2OnboardingAudioDirector {
  let generation = 0
  let activeHold: ActiveHold | undefined
  let disposed = false

  function retireDialogue(): void {
    scope.stopLane('dialogue', 'lane-stopped')
  }

  function playBeatAccents(
    beat: V2OnboardingAudioBeat,
  ): AudioSessionCue | undefined {
    const dialogue = playOptional(scope, beat.dialogueAssetId)
    playOptional(scope, beat.foleyAssetId)
    playOptional(scope, beat.uiAssetId)
    return dialogue
  }

  function retireHoldAfter(
    cue: AudioSessionCue | undefined,
    expectedGeneration: number,
  ): void {
    afterStart(cue, (result) => {
      if (disposed || generation !== expectedGeneration) return
      if (result?.kind !== 'started') {
        scope.stopLane('score', 'lane-stopped')
      }
      scope.stopLane('hold-bed', 'lane-stopped')
    })
  }

  return {
    enterBeat(beat) {
      if (disposed) return undefined
      generation += 1
      activeHold = undefined
      const expectedGeneration = generation
      retireDialogue()
      const score = playOptional(scope, beat.scoreAssetId)
      retireHoldAfter(score, expectedGeneration)
      return playBeatAccents(beat)
    },

    enterHold(hold) {
      generation += 1
      const token = { holdId: hold.holdId, generation } as const
      if (disposed) return token

      activeHold = { token, exited: false }
      retireDialogue()
      const bed = playOptional(scope, hold.holdBedAssetId)
      afterStart(bed, (result) => {
        if (
          disposed ||
          activeHold?.token.generation !== token.generation ||
          activeHold.exited
        ) {
          return
        }
        if (result?.kind !== 'started') {
          scope.stopLane('hold-bed', 'lane-stopped')
        }
        scope.stopLane('score', 'lane-stopped')
      })
      playBeatAccents(hold)
      return token
    },

    exitHold(token, nextBeat) {
      const hold = activeHold
      if (
        disposed ||
        hold === undefined ||
        hold.exited ||
        hold.token.generation !== token.generation ||
        hold.token.holdId !== token.holdId
      ) {
        return false
      }

      hold.exited = true
      activeHold = undefined
      generation += 1
      const expectedGeneration = generation
      retireDialogue()
      const score = playOptional(scope, nextBeat.scoreAssetId)
      retireHoldAfter(score, expectedGeneration)
      playBeatAccents(nextBeat)
      return true
    },

    stop() {
      if (disposed) return
      generation += 1
      activeHold = undefined
      scope.stopAll('scope-stopped')
    },

    dispose() {
      if (disposed) return
      disposed = true
      generation += 1
      activeHold = undefined
      scope.dispose()
    },
  }
}
