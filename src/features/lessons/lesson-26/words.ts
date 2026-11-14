// ============================================================
// Lesson 26 three words — Part, Chord note, Passing note, each a figure that draws its play
// ============================================================
//
// Lesson 5's word tickets (WEB-SPEC, Toys 3): each a small figure of beads
// with no rows and no numbers, which draws its play as it sounds (FACTS 37
// to 39, 76). Part: do re mi re do on C4, then the tune again with mi fa so
// fa mi above it, 3.0 s each. Chord note: C3, E3 and G3 held 3.0 s, three
// long beads stacked, and E4 joining at 1.5 s above them, glowing gold, the
// series' colour for what lines up. Passing note: E4, F4 and G4 a second
// each over the same chord, stepping up, F hollow, since it passes. None
// sounds a copy moved four semitones or names a third's size, so none
// waits for the cold open's choice. At rest each figure shows its beads
// faint; a play clears them and draws each as its note starts, lit while
// it sounds. Each is the page's one sound (kit/words-strip.ts).

import { q, svg } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { CHORD_GAIN } from '@/features/lessons/kit/sound'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import { ABOVE3, ABOVE5, C4, CHORD, PAIR_SEC, SHORT_BEAT, spoken, timed, TUNE5, } from './parts'

/** The three words, as their tickets' `data-word` and their buttons' `data-word-play` name them. */
export type WordId = 'part' | 'chord' | 'passing'
export const WORD_IDS: readonly WordId[] = ['part', 'chord', 'passing']

const isWord = (w: string): w is WordId =>
  (WORD_IDS as readonly string[]).includes(w)

/** A note of a word's play, and the bead it draws on the figure. */
export interface WordNote extends RunNote {
  readonly bead: number
}

/** A bead on a figure of 96 by 96: its box, and how it shows. */
export interface WordBead {
  readonly x: number
  readonly y: number
  readonly w: number
  /** A passing note's: an outline. */
  readonly hollow?: boolean
  /** A chord note sung over the chord: gold while it sounds. */
  readonly gold?: boolean
}

const H = 8

/** Five columns across the figure, for do re mi re do. */
const COLS = [6, 24, 42, 60, 78] as const

/** The y of a note `s` semitones over the figure's lowest, `k` px a semitone, from `foot`. */
const yOf = (s: number, k: number, foot = 84): number => foot - s * k

/** Part: the tune's five beads, then the part's five above them. */
const PART_BEADS: readonly WordBead[] = [
  ...TUNE5.at.map((a, i) => ({ x: COLS[i], y: yOf(a, 6), w: 12 })),
  ...ABOVE5.map((a, i) => ({ x: COLS[i], y: yOf(a, 6), w: 12 })),
]

/** The chord's three long beads, held across the figure, C3 at its foot. */
const chordBeads = (k: number): WordBead[] =>
  CHORD.map((m) => ({ x: 6, y: yOf(m - CHORD[0], k), w: 84 }))

/** Chord note: the chord, and E4 joining halfway, gold. */
const CHORD_BEADS: readonly WordBead[] = [
  ...chordBeads(3.6),
  { x: 48, y: yOf(C4 + 4 - CHORD[0], 3.6), w: 42, gold: true },
]

/** Passing note: the chord, and E4, F4 and G4 stepping up over it, F hollow. */
const PASSING_BEADS: readonly WordBead[] = [
  ...chordBeads(3.6),
  ...ABOVE3.map((a, i) => ({
    x: 6 + i * 30,
    y: yOf(C4 + a - CHORD[0], 3.6),
    w: 24,
    hollow: i === 1,
    gold: i !== 1,
  })),
]

export const WORD_BEADS: Readonly<Record<WordId, readonly WordBead[]>> = {
  part: PART_BEADS,
  chord: CHORD_BEADS,
  passing: PASSING_BEADS,
}

/** The chord held under a word's play, its three notes on beads 0 to 2. */
const held = (dur: number): WordNote[] =>
  CHORD.map((midi, bead) => ({ t: 0, midi, dur, gain: CHORD_GAIN, bead }))

/** What each word plays, on one clock (FACTS 76). */
export function wordNotes(word: WordId): WordNote[] {
  switch (word) {
    case 'part': {
      const tune = timed(TUNE5.at, TUNE5.beats, SHORT_BEAT)
      const again = timed(TUNE5.at, TUNE5.beats, SHORT_BEAT, 3)
      const part = timed(ABOVE5, TUNE5.beats, SHORT_BEAT, 3)
      return [
        ...tune.map((n, i) => ({ ...n, bead: i })),
        ...again.map((n, i) => ({ ...n, bead: i })),
        ...part.map((n, i) => ({ ...n, bead: 5 + i })),
      ].sort((a, b) => a.t - b.t)
    }
    case 'chord':
      return [...held(3), { t: 1.5, midi: C4 + 4, dur: 1.5, bead: 3 }]
    case 'passing':
      return [
        ...held(3),
        ...ABOVE3.map((a, i) => ({
          t: i * PAIR_SEC,
          midi: C4 + a,
          dur: PAIR_SEC,
          bead: 3 + i,
        })),
      ]
  }
}

/** What the words' line says once a play is heard, in words. */
export const WORD_SAID: Readonly<Record<WordId, string>> = {
  part: 'Do re mi re do on C 4, then the same tune with mi fa so fa mi above it: a second part.',
  chord: `${spoken(CHORD[0])}, ${spoken(CHORD[1])} and ${spoken(CHORD[2])} together, then E 4 joining: a note of the chord.`,
  passing:
    'E 4, F 4 and G 4 over the C major chord: F, drawn hollow, passes between two chord notes.',
}

/**
 * How a bead shows: faint at rest, not yet drawn while a play waits for its
 * note, lit (gold for a chord note over the chord) while it sounds, and
 * drawn once it has.
 */
export type BeadState = 'rest' | 'off' | 'lit' | 'gold' | 'drawn'

/** A word's figure: its beads, faint at rest, drawn and lit as a play sounds. */
function figureOf(word: WordId) {
  const el = q<SVGSVGElement>(`[data-word-fig="${word}"]`)
  el.setAttribute('viewBox', '0 0 96 96')
  const beads = WORD_BEADS[word].map((b) =>
    svg(
      'rect',
      {
        x: b.x,
        y: b.y - H / 2,
        width: b.w,
        height: H,
        rx: H / 2,
        class: b.hollow === true ? 'w-bead hollow' : 'w-bead',
      },
      el,
    ),
  )
  let timers: number[] = []

  const set = (i: number, state: BeadState): void => {
    beads[i].dataset.state = state
  }

  return {
    /** Every bead faint, as at first paint and after a play. */
    rest(): void {
      timers.forEach((id) => window.clearTimeout(id))
      timers = []
      beads.forEach((_, i) => set(i, 'rest'))
    },
    /** No bead yet: a play draws each as its note starts. */
    clear(): void {
      beads.forEach((_, i) => set(i, 'off'))
    },
    /** A note starts: its bead draws, lit, gold for a chord note sung over the chord, until it ends. */
    note(n: WordNote): void {
      set(n.bead, WORD_BEADS[word][n.bead].gold === true ? 'gold' : 'lit')
      timers.push(window.setTimeout(() => set(n.bead, 'drawn'), n.dur * 1000))
    },
  }
}

export function initWords(): void {
  const root = q('#words')
  const said = q('[data-words-said]', root)
  const figures = Object.fromEntries(
    WORD_IDS.map((w) => [w, figureOf(w)]),
  ) as Record<WordId, ReturnType<typeof figureOf>>
  for (const w of WORD_IDS) figures[w].rest()
  const runs: Partial<Record<WordId, Run>> = {}

  async function play(w: string, audible: boolean): Promise<void> {
    said.textContent = ''
    if (!isWord(w)) return
    const fig = figures[w]
    fig.clear()
    const notes = wordNotes(w)
    const r = playNotes(notes, {
      audible,
      kind: 'soft',
      onNote: (_n, i) => fig.note(notes[i]),
    })
    runs[w] = r
    const heard = await r.done
    if (runs[w] !== r) return
    delete runs[w]
    fig.rest()
    // a play cut short says nothing: the newer sound speaks for itself
    if (heard) said.textContent = WORD_SAID[w]
  }

  bindWordPlays(root, play, {
    owner: NowPlaying,
    stop: (w) => {
      if (!isWord(w)) return
      runs[w]?.stop()
      delete runs[w]
      figures[w].rest()
    },
  })
}
