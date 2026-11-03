// ============================================================
// What Home note's controller gives the room, apart from its workings
// ============================================================
//
// The contract of useHomeNoteController.ts, so the room, its demo
// (demo/useHomeNoteDemo.ts) and the tests can name it without reading the
// run.

import type { Accessor } from 'solid-js'
import type { ShellRun } from '@/components/room-kit/RoomShell'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import type { TrailPoint } from '@/components/room-kit/voice-trail'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import type { HomeNoteState } from './home-note-machine'
import type { HomeRound } from './home-note-round'
import type { HomeNoteLevel } from './home-note-rules'
import type { HomeNoteSummary } from './home-note-run'
import type { HomeNoteScript } from './scripted-take'

/** The chip while the singer sings. */
export const YOUR_TURN = 'Your turn'

/** Draws the voice's trail: its readings and now, frames' clock; null clears it. */
export type TrailSink = (
  trail: {
    readonly points: readonly TrailPoint[]
    readonly now: number
  } | null,
) => void

export interface HomeNoteControllerOptions {
  /**
   * Merc's voice: the native screen's sampled one. Without it the room
   * sings him with the synth "ooh".
   */
  readonly voice?: RoundVoice
  /** What that voice needs loaded before the demo sings (his sampled set). */
  readonly ready?: () => Promise<unknown>
  readonly random?: () => number
}

export interface HomeNoteController extends ShellRun {
  readonly state: Accessor<HomeNoteState>
  /** Merc's line, in his bubble between rounds; '' for none. */
  readonly line: Accessor<string>
  /** The chip under the bar; null for none. */
  readonly chip: Accessor<string | null>
  /** The run's numbers, at its result; null before. */
  readonly summary: Accessor<HomeNoteSummary | null>
  /** The level's name the result was sung at. */
  readonly resultLevel: Accessor<string>
  /** The round on screen, or null outside a run. */
  readonly round: Accessor<HomeRound | null>
  /** The rules the run (or the demo's take) is heard by. */
  readonly rules: Accessor<HomeNoteLevel>
  /** The voice is in home's band now. */
  readonly inBand: Accessor<boolean>
  /**
   * The band's chord count in this intro: the lighthouse pulses on each,
   * and the chip's lamps light.
   */
  readonly beat: Accessor<number>
  /** The intro's last chord has ended: every lamp has passed. */
  readonly chordsOver: Accessor<boolean>
  /** The key of the result heard again now, by its index; null for none. */
  readonly replaying: Accessor<number | null>
  /** At the result: key `index` again, its intro and Merc singing home. */
  readonly replayKey: (index: number) => void
  readonly mercState: Accessor<MercState>
  readonly mercVoice: () => MercVoice
  /** "Hear it again" can be tapped now. */
  readonly canHearAgain: Accessor<boolean>
  readonly hearAgain: () => void
  /** The room's trail, drawn every frame of the singer's turn. */
  readonly drawTrail: (sink: TrailSink) => void
  /** The "how it works" demo's way in (scripted-take.ts). */
  readonly script: HomeNoteScript
}
