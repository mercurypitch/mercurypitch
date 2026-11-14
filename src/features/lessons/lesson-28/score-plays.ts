// ============================================================
// Lesson 28's staffs' plays — what each step draws, and what each play sounds
// ============================================================
//
// Pure: every state of the steps' staffs and every play on them (WEB-SPEC,
// Toys 2 and 3; FACTS 48 to 51). Each state draws a stretch of the song on
// the staffs, its first bar numbered, with its marks: Step 1's A with the
// breaths and the house on do, a phrase's tag over its last bar and its
// numerals under its bars once that bar has sounded; Step 2's three ways
// from bar 7, each with its tag and numerals once heard; Step 3's sections,
// one at a time; Step 4's A. A play is one run of both parts' notes, or one
// part's, through one leg or two in turn, each a section on the staffs
// under the cursor; Step 3's B is written as it plays. The figure's words
// for each state, and a tag's once it shows.

import type { RunNote } from '@/features/lessons/kit/run'
import type { ScoreMarks, ScoreNumeral, ScoreScene, ScoreTag, ScoreWord, } from '@/features/lessons/kit/score-layout'
import type { Section } from './song'
import { A, B, BAR_SEC, barsOf, bothNotes, chordNotes, DO_MERC, DO_TAVI, GOING, join, partNotes, sceneOf, secondsOf, TAG, } from './song'

export type StepState = 1 | 2 | 3 | 4

/** Every play on the staffs: the steps' text's and the toy's own. */
export type ScorePlayId =
  | 'phrase1'
  | 'phrase2'
  | 'perfect'
  | 'interrupted'
  | 'plagal'
  | 'bridge'
  | 'block1'
  | 'block2'
  | 'block3'
  | 'block4'
  | 'both'
  | 'tavi'
  | 'merc'

/** One stretch of a play on the staffs: where in the state's scene it starts, how long it runs, and whether its notes are written as they sound. */
export interface Leg {
  /** Beats into the scene where the play starts, and how many it runs. */
  readonly from: number
  readonly beats: number
  readonly write: boolean
  /** The form strip's block it sounds, 1 to 4, in Step 3. */
  readonly block?: number
}

export interface ScorePlan {
  readonly state: StepState
  readonly legs: readonly Leg[]
  readonly notes: readonly RunNote[]
  readonly seconds: number
  /** The staffs whose notes light: one part's alone, or both. */
  readonly staffs?: readonly number[]
}

/** The breaths after bars 2, 4 and 6, and the house on do on each staff (WEB-SPEC, Toys 2). */
const A_MARKS: ScoreMarks = {
  breaths: [1, 3, 5],
  home: [DO_TAVI, DO_MERC],
}

const tag = (bar: number, text: string): ScoreTag => ({ bar, text })
const numeral = (bar: number, text: string): ScoreNumeral => ({ bar, text })

/** A phrase's cadence: its last bar, counted from 0, the tag over it and the numerals under its bars. */
export interface Phrase {
  readonly last: number
  readonly tags: readonly ScoreTag[]
  readonly numerals: readonly ScoreNumeral[]
}

/** Step 1's two cadences, each shown as its phrase's last bar starts: V under bar 4 and its tag; V and I under bars 7 and 8 and theirs (FACTS 31, 48). */
export const PHRASES: readonly Phrase[] = [
  { last: 3, tags: [tag(3, 'Imperfect: on V')], numerals: [numeral(3, 'V')] },
  {
    last: 7,
    tags: [tag(7, 'Perfect: V to I')],
    numerals: [numeral(6, 'V'), numeral(7, 'I')],
  },
]

/** Step 2's three ways, each from bar 7 with its tag and numerals (FACTS 33, 35, 49). */
export const WAYS = {
  perfect: {
    section: barsOf(A, 7, 8),
    tags: [tag(1, 'Perfect: V to I')],
    numerals: [numeral(0, 'V'), numeral(1, 'I')],
    words: [] as ScoreWord[],
  },
  interrupted: {
    section: barsOf(GOING, 7, 10),
    tags: [tag(1, 'Interrupted: V to vi')],
    numerals: [numeral(0, 'V'), numeral(1, 'vi')],
    words: [] as ScoreWord[],
  },
  // the cadence's numerals only, IV and I under the tag's bars (WEB-SPEC, Look)
  plagal: {
    section: join(barsOf(A, 7, 8), TAG),
    tags: [tag(3, 'Plagal: IV to I')],
    numerals: [numeral(2, 'IV'), numeral(3, 'I')],
    // "A-" and "men" under the tag's two notes in Tavi's part, after bars 7 and 8's three
    words: [
      { staff: 0, note: 3, text: 'A-' },
      { staff: 0, note: 4, text: 'men' },
    ] as ScoreWord[],
  },
} as const

export type Way = keyof typeof WAYS

/** A block of the form strip: its section, its first bar's number and its letter. */
export interface Block {
  readonly section: Section
  readonly first: number
  readonly letter: 'A' | 'B'
}

/** The form strip's four blocks: A A B A, eight bars each (FACTS 36, 50). */
export const BLOCKS: readonly Block[] = [
  { section: A, first: 1, letter: 'A' },
  { section: A, first: 9, letter: 'A' },
  { section: B, first: 17, letter: 'B' },
  { section: A, first: 25, letter: 'A' },
]

/** A block of the form strip by its number, 1 to 4. */
const blockOf = (k: number): Block => BLOCKS[k - 1] ?? BLOCKS[0]

/** A section's whole length in beats. */
const beatsIn = (s: Section): number => s.tavi.length * 4

/** Step 1's scene: A with the marks heard so far, its rows for tags and numerals kept from the start, so a tag fades in where it will stay. */
export const stepOneScene = (heard: ScoreMarks = {}): ScoreScene =>
  sceneOf(A, 1, { ...A_MARKS, tags: [], numerals: [], ...heard })

/** Step 2's scene: a way from bar 7, with its marks once heard. */
export function wayScene(way: Way, heard: boolean): ScoreScene {
  const w = WAYS[way]
  return sceneOf(w.section, 7, {
    tags: heard ? w.tags : [],
    numerals: heard ? w.numerals : [],
    words: w.words,
  })
}

/** Step 3's scene: a block's section, with A's breaths and house on an A. */
export function blockScene(block: number): ScoreScene {
  const b = blockOf(block)
  return sceneOf(b.section, b.first, b.letter === 'A' ? A_MARKS : {})
}

/** Step 4's scene: A with its breaths and the house, no row for a tag or a numeral, so its staffs draw larger than Step 1's. */
export const stepFourScene = (): ScoreScene => sceneOf(A, 1, A_MARKS)

/** What each state draws before any play. */
export function sceneOfState(n: StepState): ScoreScene {
  if (n === 2) return wayScene('perfect', false)
  if (n === 3) return blockScene(1)
  if (n === 4) return stepFourScene()
  return stepOneScene()
}

/** A leg through a whole scene. */
const whole = (beats: number, write = false): Leg => ({
  from: 0,
  beats,
  write,
})

/** Every play's plan: its state, the legs it draws, and what it sounds. */
export function planOf(id: ScorePlayId): ScorePlan {
  switch (id) {
    case 'phrase1':
    case 'phrase2': {
      const first = id === 'phrase1' ? 1 : 5
      const s = barsOf(A, first, first + 3)
      return {
        state: 1,
        legs: [{ from: (first - 1) * 4, beats: 16, write: false }],
        notes: bothNotes(s),
        seconds: secondsOf(s),
      }
    }
    case 'perfect':
    case 'interrupted':
    case 'plagal': {
      const w = WAYS[id]
      const notes =
        id === 'plagal'
          ? [...bothNotes(w.section), ...chordNotes(2 * BAR_SEC)].sort(
              (a, b) => a.t - b.t,
            )
          : bothNotes(w.section)
      return {
        state: 2,
        legs: [whole(beatsIn(w.section))],
        notes,
        seconds: secondsOf(w.section),
      }
    }
    case 'bridge': {
      // B written as it plays, then A, bars 17 to 32 (WEB-SPEC, Toys 3)
      const s = join(B, A)
      return {
        state: 3,
        legs: [
          { ...whole(32, true), block: 3 },
          { ...whole(32), block: 4 },
        ],
        notes: bothNotes(s),
        seconds: secondsOf(s),
      }
    }
    case 'block1':
    case 'block2':
    case 'block3':
    case 'block4': {
      const k = Number(id.slice(5))
      const b = blockOf(k)
      return {
        state: 3,
        legs: [{ ...whole(32, b.letter === 'B'), block: k }],
        notes: bothNotes(b.section),
        seconds: secondsOf(b.section),
      }
    }
    case 'both':
      return {
        state: 4,
        legs: [whole(32)],
        notes: bothNotes(A),
        seconds: secondsOf(A),
      }
    case 'tavi':
    case 'merc': {
      const k = id === 'tavi' ? 0 : 1
      return {
        state: 4,
        legs: [whole(32)],
        notes: partNotes(k === 0 ? A.tavi : A.merc),
        seconds: secondsOf(A),
        staffs: [k],
      }
    }
  }
}

// ---------------------------------------------------------------- words

/** The figure's words for each state (WEB-SPEC, Toys 2, spoken summaries). */
export const STATE_SAID: Readonly<Record<StepState, string>> = {
  1: "Bars 1 to 8 on two staffs, G major: Tavi's part in the treble clef, Merc's in the bass clef.",
  2: "Bars 7 and 8 on two staffs, G major: Tavi's part in the treble clef, Merc's in the bass clef.",
  3: 'The song is four sections of eight bars: A, A, B, A. Bars 1 to 8, A, on two staffs.',
  4: "Bars 1 to 8 on two staffs, G major: Tavi's part in the treble clef, Merc's in the bass clef.",
}

/** The pitch-line view's words. */
export const BANDS_SAID =
  "Both parts as bands: Tavi's from F sharp 4 to D 5, Merc's from D 3 to B 3."

/** The locked figure's words: the hero's strip. */
export const LOCKED_SAID =
  "The song in two parts, ten bars: Tavi's part above, Merc's below."

/** A block's words, as Step 3 shows it. */
export function blockSaid(block: number): string {
  const b = blockOf(block)
  const name = b.letter === 'B' ? 'B, the bridge' : 'A'
  return `Bars ${b.first} to ${b.first + 7}, ${name}, on two staffs.`
}

/** A way's words, as Step 2 shows it once heard. */
export function waySaid(way: Way): string {
  const t = WAYS[way].tags[0]?.text ?? ''
  if (way === 'interrupted') return `Bars 7 to 10, the way it kept going. ${t}.`
  if (way === 'plagal')
    return `Bars 7 and 8, then the Amen: both parts hold G while the soft tone plays IV, then I. ${t}.`
  return `Bars 7 and 8, the ending. ${t}.`
}
