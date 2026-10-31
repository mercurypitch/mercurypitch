// ============================================================
// Challenge result — the after-run moment above the frozen challenge stage
// ============================================================
//
// A consumed weekly Legend attempt publishes here without changing tabs.
// App.tsx owns the card so it can appear over the challenge stage whether
// the singer launched from Home or Challenges. Dismissing it reveals the
// frozen trace; another scored attempt must be armed explicitly.

import { createSignal } from 'solid-js'
import type { ExerciseVoiceCaptureOutcome } from '@/lib/domain/exercise-voice-capture'
import type { ChallengeResultPresenter } from '@/lib/domain/weekly-attempt-context'
import type { MelodyItem } from '@/types'
import type { WeeklyTier } from './weekly-attempt'

export interface ChallengeResult {
  challengeId: string
  title: string
  score: number
  targetScore: number
  tier: WeeklyTier
  /** True when this run granted the challenge's reward badge. */
  badgeGranted: boolean
  /** Present for stage-launched attempts so the line can move into Zen. */
  targetItems?: MelodyItem[]
  /** Temporary local replay handed off before the Exercise page unmounts. */
  voiceCapture?: ExerciseVoiceCaptureOutcome
  /** Who draws it; left out, the app's result card. */
  presenter?: ChallengeResultPresenter
}

const [lastChallengeResult, setLastChallengeResult] =
  createSignal<ChallengeResult | null>(null)

export { lastChallengeResult }

/**
 * True while a finished run is being written up.
 *
 * Between the last note and the result card there are three sequential
 * round trips — the session record, the reward badge, then the grant
 * engine re-reading 200 records. That is a second or two on a decent
 * connection and longer on a phone, and the screen showed NOTHING: the
 * stage sat frozen, so singers thought it had hung and left the
 * exercise, only for the card to appear over whatever they opened next.
 */
const [finalizingResult, setFinalizingResult] = createSignal(false)

export { finalizingResult }

// The native Legend room draws its own result, inside the room, and the
// app's card must never draw over it: an attempt the room armed names it as
// presenter, and its saving and its result go to these two instead, which
// the card does not read.
const [roomChallengeResult, setRoomChallengeResult] =
  createSignal<ChallengeResult | null>(null)
const [roomFinalizing, setRoomFinalizing] = createSignal(false)

export { roomChallengeResult, roomFinalizing }

/** Wrap the after-run work so the UI can say it is happening. */
export async function whileFinalizing<T>(
  work: () => Promise<T>,
  presenter?: ChallengeResultPresenter,
): Promise<T> {
  const setFinalizing =
    presenter === 'native-room' ? setRoomFinalizing : setFinalizingResult
  setFinalizing(true)
  try {
    return await work()
  } finally {
    setFinalizing(false)
  }
}

export function presentChallengeResult(result: ChallengeResult): void {
  if (result.presenter === 'native-room') {
    setRoomFinalizing(false)
    setRoomChallengeResult(result)
    return
  }
  setFinalizingResult(false)
  setLastChallengeResult(result)
}

/**
 * The native room is done with its result. The saving is left alone: it
 * belongs to the save still running, and the room waits on it before the
 * next take, or that save's result would be shown as the next take's.
 */
export function clearRoomChallengeResult(): void {
  setRoomChallengeResult(null)
}

export function clearChallengeResult(): void {
  setLastChallengeResult(null)
  setFinalizingResult(false)
}

export function discardChallengeVoiceCapture(): void {
  setLastChallengeResult((result) =>
    result === null || result.voiceCapture === undefined
      ? result
      : {
          ...result,
          voiceCapture: { state: 'discarded', take: null },
        },
  )
}
