// ============================================================
// Plan copy — the words on the plan's cards
// ============================================================
//
// The approved mockup's tables and cards, except the guitar and piano
// "progress" cells (spec 5.1, corrected 20 Oct): the Start-here cell for each
// column and hardest part, what the person said as a card hands it back, the
// goal that ends the headline, and the Play cards. build-plan.ts holds the
// rules that pick among them; this file holds only words, so a change of
// wording is made here, on purpose, together with build-plan.test.ts, which
// pins every line.
//
// A Start-here cell names its stop as a plain string, and build-plan.ts reads
// the table as PlanDest names, so a name that is not a stop fails to compile
// there. This file imports types only, so it cannot import a store.

import type { Instrument, Q2Id, Q3Id } from './questions'

/** The hard parts that can decide Start here. "Something else" never does. */
export type HardPart = Exclude<Q3Id, 'other'>

/**
 * A Start-here card before the person's words: where, the first job, why.
 * `Dest` names the stop; build-plan.ts reads the table with it set to PlanDest.
 */
export type StartCell<Dest extends string = string> = readonly [
  dest: Dest,
  title: string,
  why: string,
]

/** One column of the table: a cell for each hardest part it offers, and one for none. */
export type StartRow<Dest extends string = string> = Partial<
  Record<HardPart, StartCell<Dest>>
> & { none: StartCell<Dest> }

/** The Ascent's cell is the same in every column that reaches it. */
const CLIMB = [
  'ascent',
  "Start this week's climb",
  'The Ascent sets out each week, so you only have to start.',
] as const

/** Guitar Night's and Piano Night's title when a song is played through. */
const SCORE_A_SONG = 'Play a song through, see the score'

/** What a Night is called when it puts a band behind someone playing alone. */
const BACKING_BAND = 'A song with its backing band'

/**
 * Start here: the first hard part decides, by column. Every cell is a shipped
 * web surface. Guitar and piano "progress" are not the mockup's cells: they
 * lead to the Night, which scores a song, because Progress counts voice runs
 * only (run-kinds.ts).
 */
export const START = {
  singing: {
    time: [
      'homeSession',
      "Start today's session",
      "Today's session is one short guided workout, and Home keeps your streak.",
    ],
    progress: [
      'sing',
      'One take, then see it in Progress',
      'Every take lands in Progress, so you can watch the line move.',
    ],
    what: CLIMB,
    tune: [
      'sing',
      'Sing and watch the pitch line',
      'The line shows your pitch against the note while you sing.',
    ],
    setup: ['sing', 'Tap, sing, done', 'Sing needs your mic and one tap.'],
    shy: ['sing', 'Sing where only you can hear', 'Only you can hear you.'],
    none: [
      'sing',
      'Sing one note, see the line',
      'Start where you can hear yourself.',
    ],
  },
  guitar: {
    time: ['guitar', 'Play one song along', 'One song is a whole session.'],
    progress: [
      'guitarNight',
      SCORE_A_SONG,
      'Guitar Night scores every song you play through.',
    ],
    what: CLIMB,
    tempo: [
      'guitarNight',
      SCORE_A_SONG,
      'Guitar Night plays the band with you and scores the song.',
    ],
    setup: [
      'guitar',
      'Load a song and play',
      "Load a song and play. That's the setup.",
    ],
    alone: [
      'guitarNight',
      BACKING_BAND,
      'Guitar Night puts a band behind you.',
    ],
    none: ['guitar', 'Play one song along', 'Start with one song you like.'],
  },
  piano: {
    time: ['piano', 'One song, falling notes', 'One song is a whole session.'],
    progress: [
      'pianoNight',
      SCORE_A_SONG,
      'Piano Night scores every song you play through.',
    ],
    what: CLIMB,
    tempo: [
      'pianoNight',
      SCORE_A_SONG,
      'Piano Night plays the band with you and scores the song.',
    ],
    setup: [
      'piano',
      'Load a song and play',
      "Load a song and play. That's the setup.",
    ],
    alone: ['pianoNight', BACKING_BAND, 'Piano Night puts a band behind you.'],
    none: ['piano', 'One song, falling notes', 'Start with one song you like.'],
  },
  ear: {
    time: [
      'earLab',
      "Today's regulation",
      "One short round a day: today's regulation.",
    ],
    progress: [
      'earLab',
      'Your Mercury Index',
      'Ear Lab gives your ear one number, the Mercury Index, so you can watch it move.',
    ],
    what: [
      'earLab',
      'Follow the Ear Path',
      'The Ear Path puts the drills in order, so you only have to start.',
    ],
    difference: ['earLab', 'One drill', 'One drill trains exactly that.'],
    setup: ['earLab', 'One drill, one tap', 'A drill starts with one tap.'],
    alone: ['earLab', 'One short drill', 'Start with one short drill.'],
    none: [
      'earLab',
      'One drill',
      'Start with one drill and see what you hear.',
    ],
  },
} as const satisfies Readonly<Record<Instrument, StartRow>>

/** What the person said, as the card hands it back after "You said". */
export const SAID: Readonly<Record<HardPart, string>> = {
  time: 'finding the time is the hard part',
  progress: "telling if you're getting better is the hard part",
  what: 'knowing what to practice is the hard part',
  tune: "hearing if you're in tune is the hard part",
  tempo: 'keeping time is the hard part',
  difference: 'hearing the difference is the hard part',
  setup: 'setting up is the hard part',
  shy: 'you feel shy about your voice',
  alone: 'practicing alone is the hard part',
}

/** The end of the headline: what the person is working toward. */
export const GOAL: Readonly<Record<Q2Id, string>> = {
  song: 'for the song you love',
  together: 'with other people',
  audition: 'for the audition',
  basics: 'from the basics up',
  fun: 'for the fun of it',
  tune: 'for singing in tune',
  intervals: 'for intervals and chords',
  exam: 'for the exam',
  by_ear: 'for playing by ear',
  curious: 'out of curiosity',
}

/** Karaoke Night's title when the person only wants to sing along. */
export const SING_ALONG_TITLE = 'Sing along, scored'

/** The chip a card carries when the voiceprint made it. */
export const VOICEPRINT_CHIP = 'Your voiceprint'

// ── Play ───────────────────────────────────────────────────────────────

/** What in the answers asked for a Night or Jam. */
export type PlayTrigger =
  | 'song'
  | 'audition'
  | 'together'
  | 'alone'
  | 'fun'
  | 'along'

/** A Play card's title and its reason. */
export type PlayCopy = readonly [title: string, why: string]

/** Jam's card, the one Play card that is not a Night. */
export const JAM_COPY: PlayCopy = [
  'Sing with a friend',
  'You want to sing with other people. Jam is for singing with a friend.',
]

/** Karaoke Night's card: a rehearsal, a song, or just singing along. */
export function karaokeCopy(trigger: PlayTrigger): PlayCopy {
  if (trigger === 'audition') {
    return [
      'Rehearse it, scored',
      'You have a performance coming. Rehearse it with the band and see how you score.',
    ]
  }
  if (trigger === 'song') {
    return [
      'Your song, scored',
      "You're working toward a song you love. Karaoke Night scores every note you sing.",
    ]
  }
  return [
    SING_ALONG_TITLE,
    'Sing your favorite songs at Karaoke Night and see how you score.',
  ]
}

/** Guitar Night's or Piano Night's card, named by `night`. */
export function nightCopy(trigger: PlayTrigger, night: string): PlayCopy {
  if (trigger === 'audition') {
    return [
      'Rehearse with the band',
      'You have a performance coming. Rehearse with the band and see your score.',
    ]
  }
  const title = BACKING_BAND
  if (trigger === 'song') {
    return [
      title,
      `You're working toward a song you love. ${night} gives each song its band.`,
    ]
  }
  if (trigger === 'alone') {
    return [
      title,
      `You said practicing alone is the hard part. ${night} puts a band behind you.`,
    ]
  }
  return [title, `${night} puts a band behind you and scores the song.`]
}
