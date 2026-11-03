// ============================================================
// What First note's controller gives the room, apart from its workings
// ============================================================
//
// The contract of useFirstNoteController.ts, so the room, its stage, its
// demo (demo/useFirstNoteDemo.ts) and the tests can name it without
// reading the run.

import type { Accessor } from 'solid-js'
import type { ShellRun } from '@/components/room-kit/RoomShell'
import type { RoundVoice } from '@/components/room-kit/round-voice'
import type { TrailPoint } from '@/components/room-kit/voice-trail'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import type { FirstNoteState } from './first-note-machine'
import type { FirstNoteLevel } from './first-note-rules'
import type { FirstNoteSummary } from './first-note-run'
import type { FirstNoteRound, FirstNoteSong } from './first-note-songs'
import type { FirstNoteScript } from './scripted-take'
import type { SongPlayerFactory } from './song-player'

/** The chip while the singer sings, before their entry. */
export const YOUR_TURN = 'Your turn'

/**
 * Entries in a Warm-up stop's run (room-kit routine-stop.ts): two songs'
 * first notes, about half a minute, where a run on its own has six.
 */
export const WARM_UP_ENTRIES = 2

/** Draws the voice's trail: its readings and now, frames' clock; null clears it. */
export type TrailSink = (
  trail: {
    readonly points: readonly TrailPoint[]
    readonly now: number
  } | null,
) => void

/** The lead-in's countdown: how far through it is, and the beats lit. */
export interface Countdown {
  /** 0 at the lead-in's start, 1 where the singer comes in. */
  readonly progress: number
  /** The beats before the entry, and how many have gone by. */
  readonly beats: number
  readonly lit: number
}

export interface FirstNoteControllerOptions {
  /**
   * Merc's voice: the native screen's sampled one. Without it the room
   * sings him with the synth "ooh".
   */
  readonly voice?: RoundVoice
  /** What that voice needs loaded before the demo sings (his sampled set). */
  readonly ready?: () => Promise<unknown>
  /**
   * The songs a run plays (a test's), read at each start; by default the
   * ones the singer chose: the examples, their own, or both.
   */
  readonly songs?: readonly FirstNoteSong[] | (() => readonly FirstNoteSong[])
  /** A song with stems that play now (a test's); first-note-own-songs.ts's by default. */
  readonly playable?: (song: FirstNoteSong) => Promise<FirstNoteSong>
  /**
   * The mic's tap found no song to sing (the singer's own chosen, none read
   * yet): the room shows where the songs come from instead of starting.
   */
  readonly onNoSongs?: () => void
  /** The song player (a test's); the streamed one by default. */
  readonly player?: SongPlayerFactory
  readonly random?: () => number
  /** Entries a run plans; FIRST_NOTE_ROUNDS by default, WARM_UP_ENTRIES in the Warm-up. */
  readonly rounds?: number
  /** A stop of the Warm-up: Merc opens on its cue, and no demo plays unasked. */
  readonly routine?: boolean
}

export interface FirstNoteController extends ShellRun {
  readonly state: Accessor<FirstNoteState>
  /** Merc's line, in his bubble between rounds; '' for none. */
  readonly line: Accessor<string>
  /** The chip under the bar; null for none. */
  readonly chip: Accessor<string | null>
  /** The run's numbers, at its result; null before. */
  readonly summary: Accessor<FirstNoteSummary | null>
  /** The level's name the result was sung at. */
  readonly resultLevel: Accessor<string>
  /** The round on screen, or null outside a run. */
  readonly round: Accessor<FirstNoteRound | null>
  /** The rules the run is heard by (the band's height on screen). */
  readonly rules: Accessor<FirstNoteLevel>
  /** The note's line shows now. */
  readonly lineShown: Accessor<boolean>
  /** The voice is in the note's band now. */
  readonly inBand: Accessor<boolean>
  /** The lead-in's countdown while the band plays; null otherwise. */
  readonly countdown: Accessor<Countdown | null>
  readonly mercState: Accessor<MercState>
  readonly mercVoice: () => MercVoice
  /** "Hear the band again" can be tapped now. */
  readonly canHearAgain: Accessor<boolean>
  readonly hearAgain: () => void
  /** The room's trail, drawn every frame of the singer's turn. */
  readonly drawTrail: (sink: TrailSink) => void
  /** The demo's way in: its takes sing through the room (scripted-take.ts). */
  readonly script: FirstNoteScript
}
