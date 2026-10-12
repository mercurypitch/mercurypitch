// ============================================================
// Scripted takes — how the demo sings through the Long note room
// ============================================================
//
// The "how it works" demo (demo/useLongNoteDemo.ts) plays Merc's takes
// through useLongNoteController instead of beside it: scripted frames take
// the microphone's place, and the same engine, Merc, chip, lantern and
// trace answer them, so the demo can only show what the room really does.
// A scripted take never opens the mic, fires a haptic or keeps a result.

import type { TakeClock } from '@/components/demo-kit/demo-plan'
import type { DemoScript } from '@/components/demo-kit/useExerciseDemo'
import type { HoldEventType, HoldPreset } from '@/lib/hold/hold-engine'
import type { MercState } from '@/lib/merc/constants'

/**
 * One of the demo's takes, sung through the room instead of the mic: its
 * frames released on its own clock (the demo kit's TakeClock), and every
 * engine event reported back as it fires.
 */
export interface ScriptedTake extends TakeClock<HoldEventType> {
  readonly targetMidi: number
  /** The rules it is sung under: the demo's own level, not the singer's. */
  readonly preset: HoldPreset
  /** Take 2 ends on the result; take 1 only shows a note ending. */
  readonly toResult: boolean
  /** Merc's state when a take without a result ends. */
  readonly after: MercState
  /** Reduced motion: Merc moves without hopping. */
  readonly still: boolean
}

/** The demo's way into the room (the demo kit's DemoScript), and Merc's. */
export interface LongNoteScript extends DemoScript<ScriptedTake> {
  /** Merc's state for a moment the script calls for. */
  mood: (state: MercState) => void
}
