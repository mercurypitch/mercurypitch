// ============================================================
// Lesson 27 three words — seventh chord, major seventh and minor seventh, each heard
// ============================================================
//
// Lesson 1's strip of figure, word, definition and play button
// (kit/words-strip.ts), each figure a small staff in the learner's clef,
// drawn by the staff toy's engraving (kit/staff-draw.ts), its notes written
// as they sound, as Lesson 23's are (WEB-SPEC, Toys 4; FACTS 41). Seventh
// chord plays C, E, G and B a note every 0.4 s, stacking into one column,
// then the four together for 1.2 s, 2.8 s; Major seventh and Minor seventh
// play Lesson 6's pair, C up to B and C up to B flat, the lower note first,
// 1.55 s. For the higher voice the words sound from C4, for the lower from
// C3. None is built on G, and none says what a seventh does to a chord's
// pull (FACTS 1a). A note lights in its singer's colour while it sounds,
// blue on the bass staff and orange on the treble; the figures follow Sing
// it's voice choice at once. The plays are the page's one sound
// (kit/now-playing.ts), in the soft tone: a single note at 0.13 and the
// chord's four at 0.056 each (FACTS 73). The words' polite line says each
// play once it is heard to its end.

import { q, qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { pair } from '@/features/lessons/kit/pair'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import type { Mark, Scene } from '@/features/lessons/kit/staff-draw'
import { drawScene, emptyScene, figureSize, } from '@/features/lessons/kit/staff-draw'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf } from '@/features/lessons/kit/staff-places'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import { lettersSaid } from './chord-words'
import { gainOf, note, voiced } from './sounds'
import { clefOf } from './steps'

/** The three words, as their tickets' `data-word` and their buttons' `data-word-play` name them. */
export type WordId = 'seventh' | 'major' | 'minor'
export const WORD_IDS: readonly WordId[] = ['seventh', 'major', 'minor']

const isWord = (w: string): w is WordId =>
  (WORD_IDS as readonly string[]).includes(w)

/** A note of a word's play: its column on the figure's staff, and the note it writes. */
export interface WordNote extends RunNote {
  readonly col: number
  readonly written: ReturnType<typeof note>
}

/** Seventh chord's arpeggio: a note every 0.4 s, each 0.4 s, then the four together, 1.2 s (FACTS 41). */
export const ARPEGGIO = { step: 0.4, chord: 1.2 } as const

/** What each word plays, written for the higher voice (FACTS 41, 72). */
const WORD_NOTES: Readonly<Record<WordId, readonly ReturnType<typeof note>[]>> =
  {
    seventh: [note('C'), note('E'), note('G'), note('B')],
    major: [note('C'), note('B')],
    minor: [note('C'), note('B', -1)],
  }

/** A word's notes on one clock, in `clef`'s voice: the arpeggio and its chord, or Lesson 6's pair. */
export function wordNotes(word: WordId, clef: Clef): WordNote[] {
  const written = WORD_NOTES[word].map((n) => voiced(n, clef))
  if (word !== 'seventh') {
    const [lo, hi] = written
    return pair(midiOf(lo), midiOf(hi)).map((n, i) => ({
      t: n.at,
      midi: n.midi,
      dur: n.dur,
      col: i,
      written: i === 0 ? lo : hi,
    }))
  }
  const together = written.length * ARPEGGIO.step
  return [
    ...written.map((n, i) => ({
      t: Math.round(i * ARPEGGIO.step * 1000) / 1000,
      midi: midiOf(n),
      dur: ARPEGGIO.step,
      col: 0,
      written: n,
    })),
    ...written.map((n) => ({
      t: together,
      midi: midiOf(n),
      dur: ARPEGGIO.chord,
      gain: gainOf(written.length),
      col: 0,
      written: n,
    })),
  ]
}

/** What the words' line says once a play is heard. */
export function wordSaid(word: WordId, clef: Clef): string {
  const written = WORD_NOTES[word].map((n) => voiced(n, clef))
  return word === 'seventh'
    ? `${lettersSaid(written)}, one by one, then together.`
    : `${lettersSaid(written).replace(' and ', ' up to ')}.`
}

/** The places a word's staff keeps room for: C3 to B3 on the bass staff and C4 to B4 on the treble. */
const ROOM: readonly [number, number] = [-2, 10]

/** A word's figure: its staff in the learner's clef, and the notes written so far. */
function figureOf(word: WordId) {
  const el = q<SVGSVGElement>(`[data-word-fig="${word}"]`)
  let clef: Clef = clefOf(VoiceChoice.voice)
  let marks: Mark[] = []
  let timers: number[] = []

  function draw(): void {
    const scene: Scene = {
      ...emptyScene(clef, ROOM),
      cols: word === 'seventh' ? 1 : 2,
      small: true,
      marks,
    }
    drawScene(el, scene, figureSize(el))
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
      rest()
    },
    /** A note sounds, written in its column and lit; the chord's notes light those written already. */
    note(n: WordNote): void {
      const tone = clef === 'bass' ? 'blue' : 'orange'
      const written = marks.findIndex(
        (m) => m.col === n.col && midiOf(m.note) === n.midi,
      )
      if (written >= 0)
        marks = marks.map((m, i) => (i === written ? { ...m, tone } : m))
      else marks = [...marks, { note: n.written, col: n.col, tone }]
      draw()
      timers.push(
        window.setTimeout(() => {
          marks = marks.map((m) =>
            midiOf(m.note) === n.midi && m.col === n.col
              ? { ...m, tone: 'rest' }
              : m,
          )
          draw()
        }, n.dur * 1000),
      )
    },
    rest,
    clear(): void {
      marks = []
      rest()
    },
    draw,
  }
}

export function initWords(): void {
  const root = q('#words')
  const said = q('[data-words-said]', root)
  const figures = Object.fromEntries(
    WORD_IDS.map((w) => [w, figureOf(w)]),
  ) as Record<WordId, ReturnType<typeof figureOf>>
  const runs: Partial<Record<WordId, Run>> = {}

  async function play(w: string, audible: boolean): Promise<void> {
    said.textContent = ''
    if (!isWord(w)) return
    const fig = figures[w]
    fig.clear()
    const notes = wordNotes(w, fig.clef)
    const r = playNotes(notes, {
      audible,
      kind: 'soft',
      onNote: (_n, i) => fig.note(notes[i]),
    })
    runs[w] = r
    // heard to its end, or ended by the Sound switch or a hidden page:
    // either way the figure rests, its notes still written
    const heard = await r.done
    if (runs[w] !== r) return
    delete runs[w]
    fig.rest()
    // a play cut short says nothing: the newer sound speaks for itself
    if (heard) said.textContent = wordSaid(w, fig.clef)
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
  // the figures follow Sing it's voice choice at once, written afresh
  VoiceChoice.subscribe((v) => {
    for (const w of WORD_IDS) {
      if (figures[w].clef === clefOf(v)) continue
      runs[w]?.stop()
      delete runs[w]
      figures[w].setClef(clefOf(v))
    }
  })
  // the figures redraw at their own size once laid out
  if (typeof ResizeObserver === 'function')
    for (const el of qa('[data-word-fig]', root))
      new ResizeObserver(() => {
        const w = el.getAttribute('data-word-fig') ?? ''
        if (isWord(w)) figures[w].draw()
      }).observe(el)
}
