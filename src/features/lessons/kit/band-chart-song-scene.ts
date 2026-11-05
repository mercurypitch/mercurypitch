// ============================================================
// Band chart song scene — what a song line shows, as data
// ============================================================
//
// The scene a chart given band-chart-song.ts's painters draws (BandScene
// `song`): Merc's notes as bands over their own time, the words and chords
// under the plot, the breath marks over it, the windows' labels and the
// name of what it shows, and the singer's takes kept on it. Its own module,
// as the spectrum strip's scene sits in band-chart-draw.ts, so the chart
// can name it without importing the painter that reads it.

import type { TracePoint } from './band-chart-draw'
import type { LevelPoint } from './band-chart-hold'

/** One of Merc's notes over its own time. */
export interface SongBand {
  /** Its note, in cents from the chart's target, do. */
  readonly c: number
  /** Its time, seconds across the window. */
  readonly from: number
  readonly to: number
  /** While its note sounds: 0 to 1, as a rung's glow. */
  readonly glow?: number
  /** Its note's level along its length, seconds across the window and 0 to 1. */
  readonly light?: readonly LevelPoint[]
  /** How far the light has come, seconds across the window: kept once sounded. */
  readonly upTo?: number
  /** A planned level, drawn as faint light along the whole band. */
  readonly plan?: readonly LevelPoint[]
}

/** A word under the plot, centred under its time: a syllable, a phrase's number or a numeral. */
export interface SongWord {
  readonly t: number
  readonly text: string
  /** The sounding one, in ink. */
  readonly on?: boolean
}

/** A breath mark over the gap at `t`. */
export interface SongBreath {
  readonly t: number
  /** The voice has reached it. */
  readonly lit: boolean
  /** With its word, "breathe"; none where the marks stand too close. */
  readonly word: boolean
}

/** What a song line shows this frame (BandScene `song`). */
export interface SongScene {
  readonly bands: readonly SongBand[]
  readonly words: readonly SongWord[]
  /** The chord strip, under the words; empty for none. */
  readonly chords: readonly SongWord[]
  readonly breaths: readonly SongBreath[]
  /** Labels over windows of the plot, centred over their time. */
  readonly labels: readonly SongWord[]
  /** The name in the plot's top left corner: "take 1". */
  readonly name: string | null
  /** The level strip under the plot, in place of the words: level as height (Step 3). */
  readonly level: readonly LevelPoint[] | null
  /** The singer's takes kept on the chart, under the live line: none when absent. */
  readonly traces?: readonly SongTrace[]
}

/** A take's line kept on the chart, faint once a later take is drawn, named at its end ("take 1"). */
export interface SongTrace {
  readonly line: readonly TracePoint[]
  readonly faint: boolean
  readonly name: string
}
