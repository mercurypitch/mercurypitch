// ============================================================
// Lesson 12 four words — diatonic, Roman numeral, diminished, augmented, each heard
// ============================================================
//
// Lesson 1's strip of figure, word, definition and play button
// (kit/words-strip.ts), each figure a small ring of twelve in the markup,
// seen from above as the stage's ring is, A at the front, its beads and
// rooms in chrome (WEB-SPEC, Toys 4). Diatonic plays C major's seven
// chords as the chips voice them, 0.6 s each with 0.1 s between; Roman
// numeral plays I, then V, as the loop voices them, 1.2 s each, 0.3 s
// apart; Diminished and Augmented play their three notes at 0.5 s each,
// then together for 1.2 s (FACTS 70; sounds.ts `WORD_SOUNDS`). In each
// figure a corner lights while its note sounds: Diatonic's three beads of
// each chord in turn, Roman numeral's I and then V, each in its own ring,
// and Diminished's and Augmented's three corners. None of them marks a
// tune, so none answers the cold open (FACTS, Illustrations without
// claims). Lighting is the only change, so under reduced motion the
// corners light in turn just the same. The four plays are the page's one
// sound (kit/now-playing.ts), in the soft tone: a press stops the sound
// before it, anywhere on the page, and a newer one stops them.

import { q, qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import { WORD, WORD_SOUNDS } from './sounds'

/** The four words, as their tickets' `data-word` and their buttons' `data-word-play` name them. */
export type WordId = keyof typeof WORD_SOUNDS
export const WORD_IDS = Object.keys(WORD_SOUNDS) as readonly WordId[]

/**
 * Each figure's beads that light, in the markup's order, by pitch class:
 * Diatonic's seven from A round to G, Roman numeral's I (C, E, G) and then
 * V (G, B, D), Diminished's B, D and F, Augmented's C, E and G sharp.
 */
export const WORD_BEADS: Readonly<Record<WordId, readonly number[]>> = {
  diatonic: [9, 11, 0, 2, 4, 5, 7],
  numeral: [0, 4, 7, 7, 11, 2],
  diminished: [11, 2, 5],
  augmented: [0, 4, 8],
}

/** A lit bead: white, with a chrome glow round it. */
const LIT_FILL = '#ffffff'
const LIT_GLOW = 'drop-shadow(0 0 4px rgba(195, 204, 214, 0.9))'

const pcOf = (midi: number): number => ((midi % 12) + 12) % 12

/**
 * The bead a word's note lights, by its place in WORD_BEADS: its pitch
 * class, and for Roman numeral the ring of the chord it belongs to, I's
 * before V's start and V's after it.
 */
export function beadOf(word: WordId, n: RunNote): number {
  const beads = WORD_BEADS[word]
  const from =
    word === 'numeral' && n.t >= WORD.pair + WORD.pairGap - 1e-9 ? 3 : 0
  return beads.indexOf(pcOf(n.midi), from)
}

/** A word's figure: each bead lit for its note's length, all out at rest. */
function figureOf(word: WordId) {
  // the beads that light are the figure's full ones; the faint black keys stay faint
  const beads = qa<SVGElement>(
    'g[fill="#c3ccd6"]:not([fill-opacity]) circle',
    q(`[data-word="${word}"] .stub svg`),
  )
  const rest = beads.map((b) => b.getAttribute('fill') ?? '')
  let timers: number[] = []
  const off = (i: number): void => {
    const b = beads[i]
    b.setAttribute('fill', rest[i])
    b.style.filter = ''
  }
  return {
    note(n: RunNote): void {
      const i = beadOf(word, n)
      const b = beads[i] as SVGElement | undefined
      if (b === undefined) return
      b.setAttribute('fill', LIT_FILL)
      b.style.filter = LIT_GLOW
      timers.push(window.setTimeout(() => off(i), n.dur * 1000))
    },
    rest(): void {
      timers.forEach((id) => window.clearTimeout(id))
      timers = []
      beads.forEach((_, i) => off(i))
    },
  }
}

const isWord = (w: string): w is WordId =>
  (WORD_IDS as readonly string[]).includes(w)

export function initWords(): void {
  const figures = Object.fromEntries(
    WORD_IDS.map((w) => [w, figureOf(w)]),
  ) as Record<WordId, ReturnType<typeof figureOf>>
  const runs: Partial<Record<WordId, Run>> = {}

  async function play(w: string, audible: boolean): Promise<void> {
    if (!isWord(w)) return
    const fig = figures[w]
    fig.rest()
    const r = playNotes(WORD_SOUNDS[w], {
      audible,
      kind: 'soft',
      onNote: (n) => fig.note(n),
    })
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
}
