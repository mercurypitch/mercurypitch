// ============================================================
// Lesson 15 four words — staff, clef, ledger line, grand staff, each heard
// ============================================================
//
// Lesson 1's strip of figure, word, definition and play button
// (kit/words-strip.ts), each figure a small staff drawn by the staff toy's
// engraving (kit/staff-draw.ts), lit as its notes sound (WEB-SPEC, Toys 4;
// FACTS 63): Staff is five lines and four spaces with no clef, and the
// climb lights its nine places in turn, 5.3 s; Clef is a treble clef on a
// staff whose G line goes gold while G4 sounds for 1.0 s; Ledger line is
// the treble staff's bottom with middle C on its ledger line, lit while C4
// sounds for 1.0 s; Grand staff is two small staves with a brace, C3, C4
// and C5 lighting in turn, 0.8 s each with 0.2 s between, C4 on the ledger
// line between them. The figures are too small for a second drawing, so
// none has the pitch line; the steps play their notes again beside its
// switch. The strip sits below the recall, after the reveal, so no
// definition answers the predict (FACTS 1a). The four plays are the page's
// one sound (kit/now-playing.ts), in the soft tone: a press stops the
// sound before it, anywhere on the page, and a newer one stops them.

import { q, qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import type { PlayNote } from '@/features/lessons/kit/staff'
import type { Mark, Scene } from '@/features/lessons/kit/staff-draw'
import { drawScene, emptyScene } from '@/features/lessons/kit/staff-draw'
import { midiOf } from '@/features/lessons/kit/staff-places'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import { CLIMB, evenly, note } from './sounds'

/** The four words, as their tickets' `data-word` and their buttons' `data-word-play` name them. */
export type WordId = 'staff' | 'clef' | 'ledger' | 'grand'
export const WORD_IDS: readonly WordId[] = ['staff', 'clef', 'ledger', 'grand']

/** What each word plays (FACTS 63). */
export const WORD_SOUNDS: Readonly<Record<WordId, readonly PlayNote[]>> = {
  staff: evenly(CLIMB, 0.5, 0.6),
  clef: [{ t: 0, dur: 1, note: note('G4'), gold: 'treble' }],
  ledger: [{ t: 0, dur: 1, note: note('C4') }],
  grand: evenly(['C3', 'C4', 'C5'], 0.8, 1),
}

/** Each word's figure: its staff, and the notes it shows at rest. */
const FIGURES: Readonly<
  Record<WordId, { scene: Scene; rest: readonly Mark[] }>
> = {
  staff: {
    scene: { ...emptyScene('treble', [0, 8]), noClef: true, small: true },
    rest: [],
  },
  clef: { scene: { ...emptyScene('treble', [0, 8]), small: true }, rest: [] },
  ledger: {
    scene: { ...emptyScene('treble', [-2, 8]), small: true },
    rest: [{ note: note('C4'), tone: 'rest' }],
  },
  grand: {
    scene: { ...emptyScene('grand', [0, 20]), cols: 3, small: true },
    rest: ['C3', 'C4', 'C5'].map((n, col) => ({
      note: note(n),
      col,
      tone: 'rest',
    })),
  },
}

const isWord = (w: string): w is WordId =>
  (WORD_IDS as readonly string[]).includes(w)

/** A word's figure, drawn at rest or with the note sounding lit. */
function figureOf(word: WordId) {
  const el = q<SVGSVGElement>(`[data-word-fig="${word}"]`)
  const { scene, rest } = FIGURES[word]
  let timers: number[] = []
  const draw = (lit: PlayNote | null): void => {
    const marks: Mark[] =
      lit === null
        ? [...rest]
        : word === 'grand'
          ? rest.map((m) =>
              midiOf(m.note) === midiOf(lit.note) ? { ...m, tone: 'lit' } : m,
            )
          : [{ note: lit.note, tone: 'lit' }]
    drawScene(el, {
      ...scene,
      marks,
      gold: lit?.gold ?? null,
    })
  }
  draw(null)
  return {
    note(n: PlayNote): void {
      draw(n)
      timers.push(window.setTimeout(() => draw(null), n.dur * 1000))
    },
    rest(): void {
      timers.forEach((id) => window.clearTimeout(id))
      timers = []
      draw(null)
    },
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
    fig.rest()
    const notes = WORD_SOUNDS[w]
    const r = playNotes(
      notes.map((n) => ({ t: n.t, midi: midiOf(n.note), dur: n.dur })),
      { audible, kind: 'soft', onNote: (_n, i) => fig.note(notes[i]) },
    )
    runs[w] = r
    // heard to its end, or ended by the Sound switch or a hidden page:
    // either way the figure rests; a run the owner stopped has let go
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
  // the figures redraw at their own size once laid out
  if (typeof ResizeObserver === 'function')
    for (const el of qa('[data-word-fig]'))
      new ResizeObserver(() => {
        const w = el.getAttribute('data-word-fig') ?? ''
        if (isWord(w) && runs[w] === undefined) figures[w].rest()
      }).observe(el)
}
