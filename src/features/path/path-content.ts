// ============================================================
// The Ascent — guided-path content (data, not code)
// ============================================================
//
// One path = an ordered list of themed weeks (the celestial orbs). Each
// week binds the in-app exercises its daily sessions should favour, plus
// authored focus/goal copy and curated external resources. The 7-theme
// cycle follows standard vocal pedagogy (SOVT warm-ups first, tone &
// vibrato last, a recovery week to close) — see the guided-path plan.
//
// Resource links are curated by hand (official uploads only) in the
// content pass; an empty list simply hides the section in the UI.

import type { ExerciseType } from '@/features/exercises/types'
import { EXERCISE_ARPEGGIO_JUMPER, EXERCISE_CALL_RESPONSE, EXERCISE_DRONE_INTONATION, EXERCISE_DYNAMIC_SWELL, EXERCISE_INTERVAL_TRAINER, EXERCISE_LONG_NOTE, EXERCISE_MIRROR_MELODY, EXERCISE_PITCH_HOLD, EXERCISE_SCALE_RUNNER, EXERCISE_SIGHT_SINGING, EXERCISE_SIREN, EXERCISE_SLIDE, EXERCISE_STACCATO, EXERCISE_VIBRATO, } from '@/features/exercises/types'

export type WeekTheme =
  | 'foundations'
  | 'breath'
  | 'range'
  | 'ear'
  | 'agility'
  | 'tone'
  | 'recovery'

export interface ResourceLink {
  title: string
  url: string
  author: string
  kind: 'video' | 'article'
  minutes?: number
}

export interface PathWeek {
  /** 1-based node position on the path. */
  order: number
  theme: WeekTheme
  title: string
  subtitle: string
  /** 1–2 sentences shown on the week card: what to focus on. */
  focus: string
  /** Concrete outcomes for the week. */
  goals: string[]
  /** In-app drills this week's daily sessions favour. */
  exercises: ExerciseType[]
  /** Warm-up pattern the guided warmup should use this week. */
  warmupPattern?: string
  /** Curated external links (official uploads only). */
  resources: ResourceLink[]
}

export const ASCENT_ID = 'ascent-foundations'
export const ASCENT_NAME = 'The Ascent'
export const DAYS_PER_WEEK = 7

export const ASCENT_WEEKS: PathWeek[] = [
  {
    order: 1,
    theme: 'foundations',
    title: 'Find Your Instrument',
    subtitle: 'Foundations',
    focus:
      'Gentle warm-ups that wake the voice without strain — lip rolls, sirens and steady tones. This week is about meeting your instrument, not pushing it.',
    goals: [
      'Warm up daily with lip rolls and sirens',
      'Hold one steady, comfortable note for 6 seconds',
      'Learn what "easy" singing feels like',
    ],
    exercises: [EXERCISE_LONG_NOTE, EXERCISE_PITCH_HOLD, EXERCISE_SIREN],
    warmupPattern: 'lip-trill',
    resources: [],
  },
  {
    order: 2,
    theme: 'breath',
    title: 'Breath & Power',
    subtitle: 'Dynamics',
    focus:
      'The engine under every note. Build breath support, then shape it — swelling a note from soft to strong and back without losing pitch.',
    goals: [
      'Swell a note soft-loud-soft in one breath',
      'Keep pitch steady while volume changes',
      'Longer, calmer exhales day by day',
    ],
    exercises: [EXERCISE_DYNAMIC_SWELL, EXERCISE_LONG_NOTE, EXERCISE_SIREN],
    warmupPattern: 'sirens',
    resources: [],
  },
  {
    order: 3,
    theme: 'range',
    title: 'Reach New Notes',
    subtitle: 'Range',
    focus:
      'Extend your range the safe way — gliding sirens and small leaps that visit high and low notes lightly before you ever hold them.',
    goals: [
      'Glide smoothly past your comfortable top note',
      'Land octave leaps without reaching or strain',
      'Touch one new note at each end of your range',
    ],
    exercises: [EXERCISE_SIREN, EXERCISE_ARPEGGIO_JUMPER, EXERCISE_SLIDE],
    warmupPattern: 'sirens',
    resources: [],
  },
  {
    order: 4,
    theme: 'ear',
    title: 'Tuning & Ear',
    subtitle: 'Ear Training',
    focus:
      'Train the ear that steers the voice. Hear an interval, then sing it back true — scale degrees, fifths and echoes, tuned against a drone.',
    goals: [
      'Sing back intervals on the first try',
      'Hold your line against a drone',
      'Echo short phrases accurately',
    ],
    exercises: [
      EXERCISE_INTERVAL_TRAINER,
      EXERCISE_CALL_RESPONSE,
      EXERCISE_DRONE_INTONATION,
      EXERCISE_MIRROR_MELODY,
    ],
    warmupPattern: 'ascending-scale',
    resources: [],
  },
  {
    order: 5,
    theme: 'agility',
    title: 'Flexibility & Runs',
    subtitle: 'Agility',
    focus:
      'Speed built on accuracy. Crisp staccato, clean scale runs and quick arpeggios — small patterns first, tempo only when every note lands.',
    goals: [
      'Run a five-note scale cleanly at speed',
      'Keep staccato notes short and centred',
      'String two patterns together without smearing',
    ],
    exercises: [
      EXERCISE_SCALE_RUNNER,
      EXERCISE_STACCATO,
      EXERCISE_ARPEGGIO_JUMPER,
    ],
    warmupPattern: 'five-tone-descending',
    resources: [],
  },
  {
    order: 6,
    theme: 'tone',
    title: 'Tone & Vibrato',
    subtitle: 'Expression',
    focus:
      'Colour, earned last for a reason — vibrato and dynamics only bloom on top of steady breath. Shape notes you can already hold.',
    goals: [
      'Let an even vibrato appear on a held note',
      'Shade one phrase from bright to warm',
      'Finish notes with intention, not collapse',
    ],
    exercises: [EXERCISE_VIBRATO, EXERCISE_DYNAMIC_SWELL, EXERCISE_LONG_NOTE],
    warmupPattern: 'lip-trill',
    resources: [],
  },
  {
    order: 7,
    theme: 'recovery',
    title: 'Recovery',
    subtitle: 'The Gentle Week',
    focus:
      'Rest is training too. Light, easy warm-ups, soft echoes, and time to listen back at how far your voice has climbed.',
    goals: [
      'Keep every session light and easy',
      'Sing one favourite phrase from earlier weeks',
      "Arrive at week's end rested, not spent",
    ],
    exercises: [
      EXERCISE_LONG_NOTE,
      EXERCISE_MIRROR_MELODY,
      EXERCISE_SIGHT_SINGING,
    ],
    warmupPattern: 'lip-trill',
    resources: [],
  },
]

export function getWeek(order: number): PathWeek | undefined {
  return ASCENT_WEEKS.find((w) => w.order === order)
}
