// ============================================================
// Lesson 23 four words — number, quality, perfect, inversion, each heard
// ============================================================
//
// Lesson 1's strip of figure, word, definition and play button
// (kit/words-strip.ts), each figure a small staff in the learner's clef,
// drawn by the staff toy's engraving (kit/staff-draw.ts), its notes written
// as they sound (WEB-SPEC, Toys 4; FACTS 69): Number plays C up to E as a
// pair, "3 letters" written under the two notes as the second is; Quality
// plays C up to E, then C up to E flat, "major" under the first pair and
// "minor" under the second, each written over the one before, since a
// figure 80 px wide holds two notes side by side; Perfect plays C up to G;
// and Inversion plays C up to E, then E up to the C an octave up, a third
// turned over, never the fifth, so no figure splits the octave at G before
// the reveal (FACTS 1a). Each pair is Lesson 6's, 1.55 s, two of them 0.5 s
// apart. A note lights in its singer's colour while it sounds, blue on the
// bass staff and orange on the treble, as on the stage; the figures follow
// Sing it's voice choice at once. None draws a pitch line or counts a
// semitone (FACTS 1a). The four plays are the page's one sound
// (kit/now-playing.ts), in the soft tone: a press stops the sound before
// it, anywhere on the page, and a newer one stops them.

import { q, qa, svg } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { pair, PAIR_SEC } from '@/features/lessons/kit/pair'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import type { Mark, Scene } from '@/features/lessons/kit/staff-draw'
import { drawScene, emptyScene, figureSize, } from '@/features/lessons/kit/staff-draw'
import type { IntervalPair } from '@/features/lessons/kit/staff-interval'
import { PAIRS_GAP } from '@/features/lessons/kit/staff-interval'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf } from '@/features/lessons/kit/staff-places'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import { note, voiced } from './sounds'
import { learnerClef } from './steps'

/** The four words, as their tickets' `data-word` and their buttons' `data-word-play` name them. */
export type WordId = 'number' | 'quality' | 'perfect' | 'inversion'
export const WORD_IDS: readonly WordId[] = [
  'number',
  'quality',
  'perfect',
  'inversion',
]

/** One pair a word plays, written for the higher voice, and the line under it, if any. */
export interface WordPair extends IntervalPair {
  readonly caption?: string
}

const C4 = note('C')
const E4 = note('E')

/** What each word plays (FACTS 69). */
export const WORD_PAIRS: Readonly<Record<WordId, readonly WordPair[]>> = {
  number: [{ lo: C4, hi: E4, caption: '3 letters' }],
  quality: [
    { lo: C4, hi: E4, caption: 'major' },
    { lo: C4, hi: note('E', -1), caption: 'minor' },
  ],
  perfect: [{ lo: C4, hi: note('G') }],
  inversion: [
    { lo: C4, hi: E4 },
    { lo: E4, hi: note('C', 0, 5) },
  ],
}

/** A word's notes on one clock: each pair Lesson 6's, two pairs 0.5 s apart, in the learner's octave. */
export function wordNotes(
  pairs: readonly WordPair[],
  clef: Clef,
): (RunNote & { readonly pair: number; readonly hi: boolean })[] {
  const down = clef === 'bass' ? 12 : 0
  return pairs.flatMap((p, i) => {
    const at = i * (PAIR_SEC + PAIRS_GAP)
    return pair(midiOf(p.lo) - down, midiOf(p.hi) - down).map((n, k) => ({
      t: Math.round((at + n.at) * 1000) / 1000,
      midi: n.midi,
      dur: n.dur,
      pair: i,
      hi: k === 1,
    }))
  })
}

/** The places a word's staff keeps room for: C3 to C4 on the bass staff and C4 to C5 on the treble, with their ledger lines. */
const ROOM: readonly [number, number] = [-2, 10]

const isWord = (w: string): w is WordId =>
  (WORD_IDS as readonly string[]).includes(w)

/** A word's figure: its staff in the learner's clef, the pair written so far, and its line. */
function figureOf(word: WordId) {
  const el = q<SVGSVGElement>(`[data-word-fig="${word}"]`)
  let clef: Clef = learnerClef()
  let marks: Mark[] = []
  let caption = ''
  let timers: number[] = []

  function draw(): void {
    const size = figureSize(el)
    // the line under the notes takes the figure's foot
    const staffH = caption === '' ? size.h : size.h - 18
    const scene: Scene = {
      ...emptyScene(clef, ROOM),
      cols: 2,
      small: true,
      marks,
    }
    drawScene(el, scene, { w: size.w, h: staffH })
    el.setAttribute('viewBox', `0 0 ${size.w} ${size.h}`)
    if (caption !== '')
      svg(
        'text',
        {
          x: size.w / 2,
          y: size.h - 4,
          'text-anchor': 'middle',
          class: 'wf-caption',
          text: caption,
        },
        el,
      )
  }

  function rest(): void {
    timers.forEach((id) => window.clearTimeout(id))
    timers = []
    marks = marks.map((m) => ({ ...m, tone: 'rest' }))
    draw()
  }

  draw()
  return {
    get clef(): Clef {
      return clef
    },
    setClef(c: Clef): void {
      clef = c
      marks = []
      caption = ''
      rest()
    },
    /** A note sounds: a pair's first note starts the pair afresh, its line with it. */
    note(n: RunNote & { pair: number; hi: boolean }, p: WordPair): void {
      const tone = clef === 'bass' ? 'blue' : 'orange'
      if (!n.hi) {
        marks = []
        caption = ''
      }
      marks = [
        ...marks.map((m) => ({ ...m, tone: 'rest' as const })),
        { note: voiced(n.hi ? p.hi : p.lo, clef), col: n.hi ? 1 : 0, tone },
      ]
      if (n.hi) caption = p.caption ?? ''
      draw()
      timers.push(
        window.setTimeout(() => {
          marks = marks.map((m) =>
            midiOf(m.note) === n.midi ? { ...m, tone: 'rest' } : m,
          )
          draw()
        }, n.dur * 1000),
      )
    },
    rest,
    clear(): void {
      marks = []
      caption = ''
      rest()
    },
    draw,
  }
}

export function initWords(): void {
  const figures = Object.fromEntries(
    WORD_IDS.map((w) => [w, figureOf(w)]),
  ) as Record<WordId, ReturnType<typeof figureOf>>
  const runs: Partial<Record<WordId, Run>> = {}

  async function play(w: string, audible: boolean): Promise<void> {
    if (!isWord(w)) return
    const fig = figures[w]
    fig.clear()
    const pairs = WORD_PAIRS[w]
    const notes = wordNotes(pairs, fig.clef)
    const r = playNotes(notes, {
      audible,
      kind: 'soft',
      onNote: (_n, i) => fig.note(notes[i], pairs[notes[i].pair]),
    })
    runs[w] = r
    // heard to its end, or ended by the Sound switch or a hidden page:
    // either way the figure rests, its last pair still written
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
  // the figures follow Sing it's voice choice at once, written afresh
  VoiceChoice.subscribe(() => {
    for (const w of WORD_IDS) {
      if (figures[w].clef === learnerClef()) continue
      runs[w]?.stop()
      delete runs[w]
      figures[w].setClef(learnerClef())
    }
  })
  // the figures redraw at their own size once laid out
  if (typeof ResizeObserver === 'function')
    for (const el of qa('[data-word-fig]'))
      new ResizeObserver(() => {
        const w = el.getAttribute('data-word-fig') ?? ''
        if (isWord(w)) figures[w].draw()
      }).observe(el)
}
