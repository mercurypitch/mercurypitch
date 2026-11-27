// Types for legend-queue.mjs, which src/tests/legend-queue.test.ts imports.

/** Where a row's melody and words come from, and why it may be used. */
export interface LegendSource {
  piece: string
  credits: string
  publicDomain: string
  score: string
  lyric: string
  hook: string
}

/** One queued Legend Attempt, before it becomes a POST /api/weekly body. */
export interface LegendRow {
  key: string
  title: string
  description: string
  featType: string
  difficulty: string
  /** Absolute MIDI, one beat each; a repeated note is a held one. */
  notes: number[]
  targetScore: number
  startsAt: string
  endsAt: string
  evergreen: boolean
  hearItUrl: string | null
  founderScore: number | null
  source: LegendSource
}

/** G3, the lowest note the queue check accepts. */
export declare const COMFORT_LOW: number
/** C5, the highest note the queue check accepts. */
export declare const COMFORT_HIGH: number
/** Days in every window: four weeks. */
export declare const PERIOD_DAYS: number

export declare const LEGENDS: LegendRow[]

/** A MIDI number spelled the way the app shows it: sharps, C4 is middle C. */
export declare function noteLabel(midi: number): string

/** Every problem the seeder would refuse to post; empty when sound. */
export declare function legendQueueProblems(legends: LegendRow[]): string[]

/** The slug the server stores: the key plus the start's day number. */
export declare function legendSlug(row: LegendRow): string
