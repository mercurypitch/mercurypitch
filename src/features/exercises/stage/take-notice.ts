// ============================================================
// Take notice — what Merc's notice says about a finished run's voice take
// ============================================================
//
// A drill records the singer's voice as a temporary local copy and keeps it
// only when asked. The question, and then how keeping went, is a notice that
// pops out of Merc's bubble on the drill stage (TakeNotice.tsx), as an iOS
// banner pops out beside its app's icon; the result card says only the
// result. This is the notice's words and buttons, by the keep's state, the
// capture's, and whether the last keep failed for want of storage: null
// where there is nothing to say, which is most of the time.
//
// A take that was never recorded (the browser cannot, or nothing came
// through) has nothing to keep, so it is not a notice: the result card says
// so in one quiet line (exercise-replay-note.ts).

import type { ExerciseVoiceCaptureState } from '@/lib/domain/exercise-voice-capture'

/** Where the singer's Keep has got to for this run. */
export type TakeKeepState = 'idle' | 'saving' | 'saved' | 'error'

/** The notice's hairline and mark: asking, done, or why it could not. */
export type TakeNoticeTone = 'ask' | 'success' | 'warning' | 'error'

export interface TakeNotice {
  kind: 'ready' | 'keeping' | 'kept' | 'full' | 'failed'
  tone: TakeNoticeTone
  title: string
  line: string
  /** The filled capsule's word; null where the notice has no capsule. */
  primary: string | null
  /** The capsule is on show but a keep is under way, so it does nothing. */
  primaryBusy: boolean
  /** The close button's accessible name; null where there is no close. */
  close: string | null
}

export interface TakeNoticeInput {
  keep: TakeKeepState
  capture: ExerciseVoiceCaptureState
  /** The last keep failed because the device is out of browser storage. */
  storageFull: boolean
  /** "Take kept" has been dismissed, or has left on its own: it is not
   *  offered again for that run. */
  keptSeen: boolean
}

/** How long "Take kept" stays before it leaves and the brief is back. */
export const TAKE_KEPT_LINGER_MS = 4000

/** The close that throws the temporary copy away. */
export const DISCARD_TAKE_LABEL = 'Discard take'

export function takeNotice(input: TakeNoticeInput): TakeNotice | null {
  if (input.keep === 'saving') {
    return {
      kind: 'keeping',
      tone: 'ask',
      title: 'Keeping your take',
      line: 'Saving on this device…',
      primary: 'Keeping',
      primaryBusy: true,
      close: null,
    }
  }
  if (input.keep === 'saved') {
    if (input.keptSeen) return null
    return {
      kind: 'kept',
      tone: 'success',
      title: 'Take kept',
      line: 'Find it in Hear Yourself, on this device.',
      primary: null,
      primaryBusy: false,
      close: 'Dismiss',
    }
  }
  if (input.keep === 'error') {
    return input.storageFull
      ? {
          kind: 'full',
          tone: 'warning',
          title: 'Not enough storage',
          line: 'Free some browser storage, then retry.',
          primary: 'Retry',
          primaryBusy: false,
          close: DISCARD_TAKE_LABEL,
        }
      : {
          kind: 'failed',
          tone: 'error',
          title: 'Could not keep it',
          line: 'The temporary copy stays until you retry or leave.',
          primary: 'Retry',
          primaryBusy: false,
          close: DISCARD_TAKE_LABEL,
        }
  }
  // Nothing kept yet: only a take that is ready has a question to ask. One
  // still being prepared says nothing until it is, and a discarded take
  // (back to idle) says nothing at all.
  if (input.capture !== 'ready') return null
  return {
    kind: 'ready',
    tone: 'ask',
    title: 'Keep this take?',
    line: 'Not saved unless you keep it.',
    primary: 'Keep',
    primaryBusy: false,
    close: DISCARD_TAKE_LABEL,
  }
}
