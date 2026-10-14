// ============================================================
// Scripted takes: how the demo sings through the Echo room
// ============================================================
//
// The "how it works" demo (demo/useEchoDemo.ts) plays Merc's two takes
// through useEchoController instead of beside it: scripted frames take the
// microphone's place, and the same engine, sky, ribbon, Merc and result
// answer them, so the demo can only show what the room really does. A
// scripted take never opens the mic, fires a haptic, says a line or keeps
// a result.
//
// The room reports each moment a tooltip may wait for, as it happens:
// the sequence engine's own events (`land:<i>`, `miss:<i>`, `phraseEnd`),
// and three of its own around them: the call starting (`call`), the voice
// coming in over it (`early`, the room's own rule, early-singing.ts) and
// the result showing (`result`).

import type { TakeClock } from '@/components/demo-kit/demo-plan'
import type { DemoScript } from '@/components/demo-kit/useExerciseDemo'
import type { EchoPhrase } from '@/lib/sequence/phrase-bank'
import type { EchoLevelId } from '@/lib/sequence/sequence-engine'
import type { CallNote } from './early-singing'
import type { CallVoice } from './merc-call'

/** A moment of a take the demo's tooltips can wait for. */
export type EchoDemoMark =
  | 'call'
  | 'early'
  | `land:${number}`
  | `miss:${number}`
  | 'phraseEnd'
  | 'result'

/**
 * One of the demo's takes, sung through the room instead of the mic: its
 * frames released on its own clock (the demo kit's TakeClock), and every
 * moment reported back as it happens.
 */
export interface ScriptedEchoTake extends TakeClock<EchoDemoMark> {
  /** The phrase, its notes timed from the start of Merc's call. */
  readonly phrase: EchoPhrase
  /** Merc's notes on the take's clock. */
  readonly call: readonly CallNote[]
  /** The end of Merc's last note, take clock: the response opens after it. */
  readonly callEnd: number
  /** The level it is sung under: the demo's own, not the singer's. */
  readonly level: EchoLevelId
  /** Take 2 ends on the result; take 1 only shows the phrase ending. */
  readonly toResult: boolean
  /** Reduced motion: Merc moves without hopping. */
  readonly still: boolean
}

/** The demo's way into the room (the demo kit's DemoScript). */
export interface EchoScript extends DemoScript<ScriptedEchoTake> {
  /** The voice that sings the room's calls: the demo sings through it too. */
  readonly callVoice: CallVoice
}
