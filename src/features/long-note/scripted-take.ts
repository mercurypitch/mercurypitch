// ============================================================
// Scripted takes — how the demo sings through the Long note room
// ============================================================
//
// The "how it works" demo (demo/useLongNoteDemo.ts) plays Merc's takes
// through useLongNoteController instead of beside it: scripted frames take
// the microphone's place, and the same engine, Merc, chip, lantern and
// trace answer them, so the demo can only show what the room really does.
// A scripted take never opens the mic, fires a haptic or keeps a result.

import type { Accessor } from 'solid-js'
import type { HoldEventType } from '@/lib/hold/hold-engine'
import type { MercState } from '@/lib/merc/constants'
import type { PitchFrame } from '@/lib/pitch-f0-stream'

/** One of the demo's takes, sung through the room instead of the mic. */
export interface ScriptedTake {
  readonly targetMidi: number
  /** The frames released so far, oldest first, on the take's own clock. */
  frames: () => readonly PitchFrame[]
  /** The take's clock: engine seconds since it started. */
  now: () => number
  /** Take 2 ends on the result; take 1 only shows a note ending. */
  readonly toResult: boolean
  /** Merc's state when a take without a result ends. */
  readonly after: MercState
  /** Reduced motion: Merc moves without hopping. */
  readonly still: boolean
  /** Every engine event, as it fires. */
  onEvent: (event: HoldEventType) => void
}

/** The demo's way into the room. */
export interface LongNoteScript {
  /** From `enter` to `leave`: the mic stays shut and nothing is kept. */
  active: Accessor<boolean>
  /** The room's audio clock, running (call it inside a tap), or null. */
  audio: () => Promise<AudioContext | null>
  /** The note the demo sings: the room's own, else the voice type's. */
  note: () => number
  /**
   * Clear the room for the demo, with `line` in Merc's bubble. False, and
   * nothing changed, while the singer is mid-take or the mic is opening.
   */
  enter: (line: string) => boolean
  play: (take: ScriptedTake) => void
  /** Between takes: the light empties and the trace clears. */
  rest: () => void
  /** Merc's state for a moment the script calls for. */
  mood: (state: MercState) => void
  /** Back to the room's start, as it was before the demo. */
  leave: () => void
  /**
   * Whether the demo is playing. The screen stays on while it does: it
   * plays about 20 s, and Android's shortest screen timeout is 15 s.
   */
  playing: (on: boolean) => void
}
