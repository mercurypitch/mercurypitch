// ============================================================
// Lesson 16 three words — Sight-singing, Tonic triad and Audiation
// ============================================================
//
// The kit's words strip, a ticket a word with its figure and play, with the
// page's sound owner (WEB-SPEC, Toys 4). Each figure is a small staff in
// the learner's clef, the stored voice's, the bass when none, redrawn when
// a voice is chosen, its written notes resting grey and lighting as they
// play (FACTS 67):
//
// - Sight-singing: do in the soft tone for 1.0 s, 0.4 s of quiet, then do
//   to so sung in Merc's "ooh", 0.6 s a note, 4.4 s, by Merc, or by Tavi
//   for a stored higher voice, whose name its button then carries; so no
//   voice on the page sings a written note before its note is heard, as in
//   the cold open's second try (FACTS 1a, 8).
// - Tonic triad: do, mi, so in the soft tone, 0.5 s each with onsets 0.6 s
//   apart, 1.7 s.
// - Audiation: do for 0.6 s, a silent beat of 1.0 s with re lit, then re
//   for 0.6 s, 2.2 s.
//
// No figure has the pitch-line switch, as Lesson 15's word figures have
// none: the steps play the same notes beside it.

import { q, qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import type { Mark } from '@/features/lessons/kit/staff-draw'
import { drawScene, emptyScene } from '@/features/lessons/kit/staff-draw'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf, placeOf } from '@/features/lessons/kit/staff-places'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import { doToSo, EVERY_SEC, NOTE_SEC } from './sounds'
import { learnerClef } from './steps'

/** The three words, as their tickets' `data-word` and their buttons' `data-word-play` name them. */
export type WordId = 'sight' | 'triad' | 'audiation'
export const WORD_IDS: readonly WordId[] = ['sight', 'triad', 'audiation']

const isWord = (w: string): w is WordId =>
  (WORD_IDS as readonly string[]).includes(w)

/** Each word's written notes, by degree from do (do 0, so 4), one column each. */
export const WRITTEN: Readonly<Record<WordId, readonly number[]>> = {
  sight: [0, 1, 2, 3, 4],
  triad: [0, 2, 4],
  audiation: [0, 1],
}

/** Sight-singing's do alone, s, and the quiet before the voice, s (FACTS 67). */
export const FIRST_SEC = 1
export const QUIET_SEC = 0.4
/** Audiation's two notes, s, and the silent beat between them, s (FACTS 67). */
export const HEARD_SEC = 0.6
export const BEAT_SEC = 1

/** A written note lit from `from` to `to`, s, by its column. */
export interface Light {
  readonly col: number
  readonly from: number
  readonly to: number
}

/** What a word plays in `clef`'s octave, and how its figure lights. */
export interface WordPlay {
  readonly notes: readonly RunNote[]
  readonly lights: readonly Light[]
  /** The tone the notes take unless a note says its own. */
  readonly kind: 'soft' | 'merc'
}

const round = (s: number): number => Math.round(s * 1000) / 1000

/** Each word's play, in `clef`'s octave: do G3 for the bass, G4 for the treble (FACTS 67). */
export function wordPlay(w: WordId, clef: Clef): WordPlay {
  const midis = WRITTEN[w].map((d) => midiOf(doToSo(clef)[d]))
  if (w === 'sight') {
    const sung = FIRST_SEC + QUIET_SEC
    return {
      kind: 'merc',
      notes: [
        { t: 0, midi: midis[0], dur: FIRST_SEC, kind: 'soft' },
        ...midis.map((midi, i) => ({
          t: round(sung + i * EVERY_SEC),
          midi,
          dur: EVERY_SEC,
        })),
      ],
      lights: [
        { col: 0, from: 0, to: FIRST_SEC },
        ...midis.map((_m, col) => ({
          col,
          from: round(sung + col * EVERY_SEC),
          to: round(sung + (col + 1) * EVERY_SEC),
        })),
      ],
    }
  }
  if (w === 'triad')
    return {
      kind: 'soft',
      notes: midis.map((midi, i) => ({
        t: round(i * EVERY_SEC),
        midi,
        dur: NOTE_SEC,
      })),
      lights: midis.map((_m, col) => ({
        col,
        from: round(col * EVERY_SEC),
        to: round(col * EVERY_SEC + NOTE_SEC),
      })),
    }
  const re = HEARD_SEC + BEAT_SEC
  return {
    kind: 'soft',
    notes: [
      { t: 0, midi: midis[0], dur: HEARD_SEC },
      { t: re, midi: midis[1], dur: HEARD_SEC },
    ],
    lights: [
      { col: 0, from: 0, to: HEARD_SEC },
      { col: 1, from: HEARD_SEC, to: round(re + HEARD_SEC) },
    ],
  }
}

/** A play's length, s: its last note's end. */
export const playLength = (p: WordPlay): number =>
  round(Math.max(...p.notes.map((n) => n.t + n.dur)))

/** Who sings Sight-singing's do to so: Merc for the bass, Tavi for a stored higher voice (FACTS 67). */
export const singerOf = (clef: Clef): 'Merc' | 'Tavi' =>
  clef === 'treble' ? 'Tavi' : 'Merc'

/** The places a word's figure keeps room for in `clef`: the staff, and up to so (D4 sits above the bass staff). */
export const roomOf = (clef: Clef): readonly [number, number] => [
  0,
  Math.max(8, placeOf(doToSo(clef)[4], clef)),
]

/** A word's marks in `clef`, the columns in `lit` lit and the rest resting. */
export function wordMarks(
  w: WordId,
  clef: Clef,
  lit: ReadonlySet<number>,
): Mark[] {
  return WRITTEN[w].map((d, col) => ({
    note: doToSo(clef)[d],
    col,
    tone: lit.has(col) ? 'lit' : 'rest',
  }))
}

/** A word's figure: drawn at rest in the learner's clef, or lit through a play in the play's clef. */
function figureOf(w: WordId) {
  const el = q<SVGSVGElement>(`[data-word-fig="${w}"]`)
  let timers: number[] = []
  const lit = new Set<number>()
  const draw = (clef: Clef): void => {
    drawScene(el, {
      ...emptyScene(clef, roomOf(clef)),
      marks: wordMarks(w, clef, lit),
      cols: WRITTEN[w].length,
      small: true,
    })
  }
  return {
    draw,
    /** Lights `p`'s notes in `clef` from now, as it plays. */
    light(p: WordPlay, clef: Clef): void {
      for (const l of p.lights) {
        timers.push(
          window.setTimeout(() => {
            lit.add(l.col)
            draw(clef)
          }, l.from * 1000),
          window.setTimeout(() => {
            lit.delete(l.col)
            draw(clef)
          }, l.to * 1000),
        )
      }
    },
    rest(): void {
      timers.forEach((id) => window.clearTimeout(id))
      timers = []
      lit.clear()
      draw(learnerClef())
    },
  }
}

/** Sight-singing's button names its singer: "Play: do first, then Merc sings do to so". */
function nameSinger(clef: Clef): void {
  const b = document.querySelector('[data-word-play="sight"]')
  if (b === null) return
  for (const n of Array.from(b.childNodes))
    if (n.nodeType === Node.TEXT_NODE && /Merc|Tavi/.test(n.textContent ?? ''))
      n.textContent = (n.textContent ?? '').replace(/Merc|Tavi/, singerOf(clef))
}

export function initWords(): void {
  const figures = Object.fromEntries(
    WORD_IDS.map((w) => [w, figureOf(w)]),
  ) as Record<WordId, ReturnType<typeof figureOf>>
  const runs: Partial<Record<WordId, Run>> = {}

  async function play(w: string, audible: boolean): Promise<void> {
    if (!isWord(w)) return
    const fig = figures[w]
    fig.rest()
    // the clef at the tap: a voice chosen while it plays redraws it after
    const clef = learnerClef()
    const p = wordPlay(w, clef)
    const r = playNotes(p.notes, { audible, kind: p.kind })
    runs[w] = r
    fig.light(p, clef)
    await r.done
    if (runs[w] !== r) return
    delete runs[w]
    fig.rest()
  }

  bindWordPlays(q('#words'), play, {
    owner: NowPlaying,
    stop: (w) => {
      if (!isWord(w)) return
      runs[w]?.stop()
      delete runs[w]
      figures[w].rest()
    },
  })
  VoiceChoice.subscribe(() => {
    nameSinger(learnerClef())
    for (const w of WORD_IDS) if (runs[w] === undefined) figures[w].rest()
  })
  if (typeof ResizeObserver === 'function')
    for (const el of qa('[data-word-fig]'))
      new ResizeObserver(() => {
        const w = el.getAttribute('data-word-fig') ?? ''
        if (isWord(w) && runs[w] === undefined) figures[w].rest()
      }).observe(el)
}
