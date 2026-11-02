// ============================================================
// What Harmony's controller gives the room, apart from its workings
// ============================================================
//
// The contract of useHarmonyController.ts, so the room and the tests can
// name it without reading the run.

import type { Accessor } from 'solid-js'
import type { ShellRun } from '@/components/room-kit/RoomShell'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import type { HarmonyTrailPoint } from './harmony-ear'
import type { HarmonyLine } from './harmony-line'
import type { HarmonyState } from './harmony-machine'
import type { HarmonyLevel, HarmonyWay } from './harmony-rules'
import type { HarmonySummary } from './harmony-run'

/** The chip while the singer sings on their own. */
export const YOUR_TURN = 'Your turn'

/**
 * A lamp of the harmony: waiting for the voice, heard as Merc sings it
 * (at Learning, in his call), lit by the voice, or missed.
 */
export type HarmonyLampState = 'waiting' | 'heard' | 'lit' | 'missed'

/** Draws the voice: its trail, now (frames' clock), the hold; null clears it. */
export type HarmonyTrailSink = (
  trail: {
    readonly points: readonly HarmonyTrailPoint[]
    /** The voice's head, or null while it is silent. */
    readonly head: HarmonyTrailPoint | null
    /** The note's hold so far, 0 to 1 of the land time. */
    readonly hold: number
  } | null,
) => void

export interface HarmonyControllerOptions {
  /**
   * Merc's voice: the native screen's sampled one. Without it the room
   * sings him with the synth "ooh".
   */
  readonly voice?: RoundVoice
  readonly random?: () => number
}

export interface HarmonyController extends ShellRun {
  readonly state: Accessor<HarmonyState>
  /** Merc's line, in his bubble; '' for none. */
  readonly line: Accessor<string>
  /** The chip under the bar; null for none. */
  readonly chip: Accessor<string | null>
  /** The task under the chip: "A third above" or "A third below"; null for none. */
  readonly task: Accessor<string | null>
  /** The run's numbers, at its result; null before. */
  readonly summary: Accessor<HarmonySummary | null>
  /** The level's name the result was sung at. */
  readonly resultLevel: Accessor<string>
  /** The line on screen, or null outside a run. */
  readonly current: Accessor<HarmonyLine | null>
  /** The rules the run is heard by (the band's height on screen). */
  readonly rules: Accessor<HarmonyLevel>
  /** The way the room sings: the singer's choice, or the run's once it starts. */
  readonly way: Accessor<HarmonyWay>
  /** Merc's lamps lit so far in the line: as he sings each one. */
  readonly mercLit: Accessor<number>
  /** The harmony's lamps, one each. */
  readonly harmonyLamps: Accessor<readonly HarmonyLampState[]>
  /** After a miss, the note whose pair Merc sings; null for none. */
  readonly answering: Accessor<number | null>
  readonly mercState: Accessor<MercState>
  readonly mercVoice: () => MercVoice
  /** "Hear Merc again" can be tapped now. */
  readonly canHearAgain: Accessor<boolean>
  readonly hearAgain: () => void
  /** The line of the result heard again now, by its index; null for none. */
  readonly replaying: Accessor<number | null>
  /** At the result: line `index` again, in two voices. */
  readonly replayLine: (index: number) => void
  /** The room's trail, drawn every frame of the singer's turn. */
  readonly drawTrail: (sink: HarmonyTrailSink) => void
}
