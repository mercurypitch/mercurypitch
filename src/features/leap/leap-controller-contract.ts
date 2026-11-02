// ============================================================
// What Leap's controller gives the room, apart from its workings
// ============================================================
//
// The contract of useLeapController.ts, so the room, its demo
// (demo/useLeapDemo.ts) and the tests can name it without reading the run.

import type { Accessor } from 'solid-js'
import type { ShellRun } from '@/components/room-kit/RoomShell'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import type { TrailPoint } from '@/components/room-kit/voice-trail'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import type { LeapState } from './leap-machine'
import type { LeapRound } from './leap-round'
import type { LeapLevel } from './leap-rules'
import type { LeapSummary } from './leap-run'
import type { LeapScript } from './scripted-take'

/** The chip while the singer sings. */
export const YOUR_TURN = 'Your turn'

/** What the leap's lamp under the chip shows. */
export type LeapLampState = 'toCome' | 'landed' | 'missed'

/** The leap's lamp: "Up a fifth", which way, and how it went. */
export interface LeapLampView {
  readonly name: string
  readonly up: boolean
  readonly state: LeapLampState
}

/** Draws the voice: its readings and now (frames' clock), the hold; null clears it. */
export type TrailSink = (
  trail: {
    readonly points: readonly TrailPoint[]
    readonly now: number
    /** The target's hold so far, 0 to 1 of the land time. */
    readonly hold: number
  } | null,
) => void

export interface LeapControllerOptions {
  /**
   * Merc's voice: the native screen's sampled one. Without it the room
   * sings him with the synth "ooh".
   */
  readonly voice?: RoundVoice
  /**
   * What that voice needs loaded before the demo sings his call (his
   * sampled set), if anything: the demo waits for it, but not for long.
   */
  readonly ready?: () => Promise<unknown>
  readonly random?: () => number
}

export interface LeapController extends ShellRun {
  readonly state: Accessor<LeapState>
  /** Merc's line, in his bubble; '' for none. */
  readonly line: Accessor<string>
  /** The chip under the bar; null for none. */
  readonly chip: Accessor<string | null>
  /** The leap's lamp under the chip: its name, its way and how it went. */
  readonly lamp: Accessor<LeapLampView | null>
  /** The run's numbers, at its result; null before. */
  readonly summary: Accessor<LeapSummary | null>
  /** The level's name the result was sung at. */
  readonly resultLevel: Accessor<string>
  /** The round on screen, or null outside a run. */
  readonly round: Accessor<LeapRound | null>
  /** The rules the run is heard by (the band's height on screen). */
  readonly rules: Accessor<LeapLevel>
  /** The rules of the last run, as its result names its leaps. */
  readonly runRules: Accessor<LeapLevel>
  /** The voice sits on Merc's note now. */
  readonly onFrom: Accessor<boolean>
  /** The voice is in the target's band now: the lantern warms. */
  readonly onTarget: Accessor<boolean>
  /** The target's name shows: once the leap has landed or Merc has sung it. */
  readonly revealed: Accessor<boolean>
  /** Merc sings both notes after a miss: his line draws. */
  readonly answering: Accessor<boolean>
  readonly mercState: Accessor<MercState>
  readonly mercVoice: () => MercVoice
  /** "Hear Merc again" can be tapped now. */
  readonly canHearAgain: Accessor<boolean>
  readonly hearAgain: () => void
  /** The round of the result heard again now, by its index; null for none. */
  readonly replaying: Accessor<number | null>
  /** At the result: round `index` again, Merc singing both its notes. */
  readonly replayLeap: (index: number) => void
  /** The room's trail, drawn every frame of the singer's turn. */
  readonly drawTrail: (sink: TrailSink) => void
  /** "How it works": the demo's takes, sung through the room. */
  readonly script: LeapScript
}
