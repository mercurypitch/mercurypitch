// ============================================================
// Plan questions — the four questions and their options per instrument
// ============================================================
//
// What Merc asks after First Light: the instrument (Q1), what the person
// is working toward (Q2), what gets in the way (Q3) and what they have
// tried before (Q4). An option is a label, the person's own words, and a
// line, Merc's reply to the tap. The copy is the approved mockup's, word
// for word.
//
// Three things are easy to break:
//
// - The ids are what gets saved and counted as events, so an id is never
//   renamed. The labels and lines are the approved copy, and
//   questions.test.ts pins the ones that change with the instrument, so a
//   wording change is made on purpose, in both files.
// - "A bit of everything" and a skipped Q1 use the Singing column
//   (planColumn), but Q4 reads Q1 itself: "everything" sang or played
//   along, singing only sang.
// - This file is pure. The rules, the record and the events all read these
//   types, so it imports nothing from src/stores.
//
// questions.test.ts holds every label and line of every column to the copy
// rules: no em dash, and "practice", never "practise".

/** A column of the plan's rule tables: one per instrument. */
export type Instrument = 'singing' | 'guitar' | 'piano' | 'ear'

/** Q1: an instrument, or "A bit of everything". */
export type Q1Answer = Instrument | 'everything'

/** Q2: what the person is working toward. Ear training has five of its own. */
export type Q2Id =
  | 'song'
  | 'together'
  | 'audition'
  | 'basics'
  | 'fun'
  | 'tune'
  | 'intervals'
  | 'exam'
  | 'by_ear'
  | 'curious'

/** Q3: what gets in the way. Every column offers seven of these. */
export type Q3Id =
  | 'time'
  | 'progress'
  | 'what'
  | 'tune'
  | 'difference'
  | 'tempo'
  | 'setup'
  | 'shy'
  | 'alone'
  | 'other'

/** Q4: what the person has tried before. */
export type Q4Id = 'video' | 'teacher' | 'app' | 'along' | 'starting'

export type QuestionId = 'q1' | 'q2' | 'q3' | 'q4'

/** One tappable answer: the person's words, and Merc's reply to the tap. */
export interface PlanOption<Id extends string> {
  id: Id
  label: string
  line: string
}

/**
 * What the person has picked. `q3` and `q4` keep the order of the taps: the
 * plan starts from the first hardest part, and in Q4 the last tap decides
 * whether "Nothing yet" stays. The typed lines behind "Something else" and
 * "Another app" are not here on purpose; they live under PLAN_TEXT_KEY,
 * apart from the ids.
 */
export interface PlanChoices {
  q1: Q1Answer | null
  q2: Q2Id | null
  q3: Q3Id[]
  q4: Q4Id[]
}

/**
 * Nothing picked yet. Every caller shares it, so it is frozen, arrays
 * included: a write throws, and Solid's createStore copies a frozen seed
 * instead of writing into it. The type stays PlanChoices so it goes wherever
 * a choice does; spread it into a new object to change it.
 */
export const EMPTY_CHOICES: PlanChoices = Object.freeze({
  q1: null,
  q2: null,
  q3: Object.freeze<Q3Id[]>([]) as Q3Id[],
  q4: Object.freeze<Q4Id[]>([]) as Q4Id[],
})

/** How many things a person can say get in the way. */
export const Q3_MAX = 2

/** Q1's four cards, in the order they are shown. `art` is the card's painting. */
export const INSTRUMENTS: readonly (PlanOption<Instrument> & {
  art: string
})[] = [
  {
    id: 'singing',
    label: 'Singing',
    line: "Singing it is. I'll start you where you can hear yourself.",
    art: '/onboarding/plan/q1-singing.webp',
  },
  {
    id: 'guitar',
    label: 'Guitar',
    line: "Guitar. I'll show you the play-along.",
    art: '/onboarding/plan/q1-guitar.webp',
  },
  {
    id: 'piano',
    label: 'Piano',
    line: "Piano. I'll show you the falling notes.",
    art: '/onboarding/plan/q1-piano.webp',
  },
  {
    id: 'ear',
    label: 'Ear training',
    line: 'Ears first. That helps everything else.',
    art: '/onboarding/plan/q1-ear.webp',
  },
]

/** Q1's fifth answer. It has no column of its own: the plan starts with the voice. */
export const EVERYTHING: PlanOption<'everything'> = {
  id: 'everything',
  label: 'A bit of everything',
  line: "A bit of everything. We'll start with your voice.",
}

/**
 * What Merc says as each screen opens. `q1Returning` stands in for `q1` for
 * someone who has been here before, to whom the plan is the new thing.
 */
export const MERC_INTRO = {
  q1: "Four quick questions, then I'll make you a plan.",
  q1Returning: "New in Mercury Pitch: four taps and I'll show you what fits.",
  q2: 'Next one.',
  q3: 'Tell me what gets in the way.',
  q4: 'Last one.',
  plan: "Here's where I'd start.",
} as const

/** Guitar and piano are played. The voice and the ear are not. */
function plays(q1: Q1Answer | null): boolean {
  return q1 === 'guitar' || q1 === 'piano'
}

/**
 * The column of the plan's rule tables a first answer reads from.
 * "A bit of everything" and a skipped Q1 both read the Singing column.
 */
export function planColumn(q1: Q1Answer | null): Instrument {
  return q1 === 'guitar' || q1 === 'piano' || q1 === 'ear' ? q1 : 'singing'
}

/** The words for a first answer, as the plan names it. A forbidden id reads as ''. */
export function q1Label(q1: Q1Answer): string {
  if (q1 === 'everything') return EVERYTHING.label
  return INSTRUMENTS.find((i) => i.id === q1)?.label ?? ''
}

/** Q2 for a first answer. Ear training has goals of its own; the rest share one list. */
export function q2Options(q1: Q1Answer | null): PlanOption<Q2Id>[] {
  if (q1 === 'ear') {
    return [
      {
        id: 'tune',
        label: 'Singing in tune',
        line: 'Hearing a note right is half of singing it.',
      },
      {
        id: 'intervals',
        label: 'Hearing intervals and chords',
        line: 'Intervals first, then chords.',
      },
      {
        id: 'exam',
        label: 'A music exam or course',
        line: 'Then a little every day, so it sticks.',
      },
      {
        id: 'by_ear',
        label: 'Playing by ear',
        line: 'That starts with hearing where a note goes.',
      },
      {
        id: 'curious',
        label: 'Just curious',
        line: "Good. Let's find out what you can hear.",
      },
    ]
  }
  return [
    {
      id: 'song',
      label: 'A song I love',
      line: "Then we'll work toward that song.",
    },
    {
      id: 'together',
      label: plays(q1)
        ? 'Playing with other people'
        : 'Singing with other people',
      line: "Then we'll get you ready for that.",
    },
    {
      id: 'audition',
      label: 'A performance or audition',
      line: "Then we'll rehearse it and keep your takes.",
    },
    {
      id: 'basics',
      label: 'Strong basics',
      line: 'Basics first, then songs.',
    },
    { id: 'fun', label: 'Just for fun', line: 'Fun it is. Songs first.' },
  ]
}

/** What "Telling if I'm getting better" is promised, in each column. */
function progressLine(column: Instrument): string {
  if (column === 'ear') return 'Then you get one number to watch.'
  if (column === 'singing') return "Then you'll see every take in Progress."
  return "Then we'll keep score, song by song."
}

/** The hard part only this column has: pitch, telling sounds apart, the beat. */
function ownHardPart(column: Instrument): PlanOption<Q3Id> {
  if (column === 'singing') {
    return {
      id: 'tune',
      label: "Hearing if I'm in tune",
      line: "Then you'll see your pitch while you sing.",
    }
  }
  if (column === 'ear') {
    return {
      id: 'difference',
      label: 'Hearing the difference',
      line: "Then we'll train exactly that.",
    }
  }
  return {
    id: 'tempo',
    label: 'Keeping time with the music',
    line: "Then you'll play along with the song itself.",
  }
}

/** What setting up costs in each column. */
function setupLine(column: Instrument): string {
  if (column === 'singing') return "Then it's one tap. Just the mic."
  if (column === 'ear') return "Then it's one drill, one tap."
  return "Then it's one song, one tap."
}

/** A singer may feel shy. Everyone else may practice alone. */
function companyPart(column: Instrument): PlanOption<Q3Id> {
  if (column === 'singing') {
    return {
      id: 'shy',
      label: 'Feeling shy about my voice',
      line: 'Only you can hear you.',
    }
  }
  return {
    id: 'alone',
    label: 'Practicing alone',
    line:
      column === 'ear'
        ? "Then we'll go one drill at a time."
        : "Then you'll have a band behind you.",
  }
}

/** Q3 for a first answer: seven things that can get in the way. */
export function q3Options(q1: Q1Answer | null): PlanOption<Q3Id>[] {
  const column = planColumn(q1)
  return [
    {
      id: 'time',
      label: 'Finding the time',
      line: 'Then short sessions, one a day.',
    },
    {
      id: 'progress',
      label: "Telling if I'm getting better",
      line: progressLine(column),
    },
    {
      id: 'what',
      label: 'Knowing what to practice',
      line: "Then I'll tell you what's next.",
    },
    ownHardPart(column),
    {
      id: 'setup',
      label: 'Setting up before I can start',
      line: setupLine(column),
    },
    companyPart(column),
    {
      id: 'other',
      label: 'Something else',
      line: 'Tell me in a few words.',
    },
  ]
}

/** The sing-along answer, worded for what the person sings or plays. */
function alongLabel(q1: Q1Answer | null): string {
  if (plays(q1)) return 'I played along to songs'
  if (q1 === 'ear' || q1 === 'everything') {
    return 'I sang or played along to songs'
  }
  return 'I sang along to songs'
}

/** The Night someone who plays along will like: theirs, or Karaoke Night. */
function nightName(q1: Q1Answer | null): string {
  if (q1 === 'guitar') return 'Guitar Night'
  if (q1 === 'piano') return 'Piano Night'
  return 'Karaoke Night'
}

/** Q4 for a first answer: what the person has tried before. */
export function q4Options(q1: Q1Answer | null): PlanOption<Q4Id>[] {
  return [
    {
      id: 'video',
      label: 'A video lesson',
      line: "Our lessons are short films, and I'm in them.",
    },
    {
      id: 'teacher',
      label: 'A teacher',
      line: 'Good. Keep takes to play your teacher.',
    },
    { id: 'app', label: 'Another app', line: 'Which one? It helps us.' },
    {
      id: 'along',
      label: alongLabel(q1),
      line:
        q1 === 'ear'
          ? 'Good. Songs train ears too.'
          : `Then you'll like ${nightName(q1)}.`,
    },
    {
      id: 'starting',
      label: "Nothing yet, I'm just starting",
      line: plays(q1)
        ? 'Then we start with the twelve notes.'
        : 'Then we start with what a note is.',
    },
  ]
}

/**
 * "Nothing yet" says there is nothing else to say, so it stands alone: the
 * last tap decides whether it or the rest stays.
 */
function settleQ4(picks: Q4Id[]): Q4Id[] {
  return picks[picks.length - 1] === 'starting'
    ? ['starting']
    : picks.filter((id) => id !== 'starting')
}

/** A pick counts once, at the tap that first made it. */
function unique<T>(picks: T[]): T[] {
  return [...new Set(picks)]
}

/**
 * Settles the picks after a change. A new first answer changes what Q2 and
 * Q3 offer, so a pick that is no longer offered is dropped, and Q3 keeps the
 * first two that remain, in tap order. A pick repeated in Q3 or Q4 counts
 * once, so it cannot take both Q3 slots. "Nothing yet" stands alone in Q4.
 * Returns new arrays and leaves its argument as it was.
 */
export function pruneChoices(c: PlanChoices): PlanChoices {
  const offered = q3Options(c.q1).map((o) => o.id)
  const goalStays = c.q2 !== null && q2Options(c.q1).some((o) => o.id === c.q2)
  return {
    q1: c.q1,
    q2: goalStays ? c.q2 : null,
    q3: unique(c.q3)
      .filter((id) => offered.includes(id))
      .slice(0, Q3_MAX),
    q4: settleQ4(unique(c.q4)),
  }
}
