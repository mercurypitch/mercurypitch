// ============================================================
// Lesson 10 four words — third, triad, quality, natural minor, each heard
// ============================================================
//
// Lesson 1's strip of figure, word, definition and play button
// (kit/words-strip.ts), each figure in the chord beads' chrome on faint
// semitone rows (WEB-SPEC, Toys 4). Third plays C4 then E4, 0.6 s and 0.8
// s, 0.15 s apart; Triad plays C4, E4 and G4 at 0.55 s each, then together
// for 1.2 s; Quality plays C major, then C minor, each together for 1.4 s,
// 0.4 s apart; Natural minor plays C4 to C5 in C natural minor, 0.45 s a
// note and the last 0.9 s (FACTS 74; sounds.ts). In each figure a part
// lights while its note sounds: Third's and Triad's beads, Quality's two
// words as each chord sounds, and Natural minor's eight stairs in turn.
// None of them answers a predict: no note is gold, no bead moves and no
// major scale stands beside the minor one (FACTS, Illustrations without
// claims). Lighting is the only change, so under reduced motion they light
// in turn just the same. The four plays are the page's one sound
// (kit/now-playing.ts), in the soft tone: a press stops the sound before
// it, anywhere on the page, and a newer one stops them.

import { q, qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import type { WordId } from './sounds'
import { WORD_IDS, WORD_QUALITY, wordSounds } from './sounds'

/** A lit bead or word: white, with a chrome glow round it. */
const LIT_FILL = '#ffffff'
const LIT_GLOW = 'drop-shadow(0 0 4px rgba(195, 204, 214, 0.9))'
/** A lit stair: its fill at full strength, where its group sets it at 0.4. */
const STAIR_LIT = '1'

/** One part of a figure that lights while its note sounds. */
interface Lamp {
  on(): void
  off(): void
}

/** A bead or a word: lit white with a glow, then back to the fill the markup gave it. */
function glowLamp(el: SVGElement): Lamp {
  const rest = el.getAttribute('fill') ?? ''
  return {
    on() {
      el.setAttribute('fill', LIT_FILL)
      el.style.filter = LIT_GLOW
    },
    off() {
      el.setAttribute('fill', rest)
      el.style.filter = ''
    },
  }
}

/** A stair: its fill at full strength while lit. */
function stairLamp(el: SVGElement): Lamp {
  return {
    on() {
      el.setAttribute('fill-opacity', STAIR_LIT)
    },
    off() {
      el.removeAttribute('fill-opacity')
    },
  }
}

const stub = (word: WordId): SVGSVGElement =>
  q<SVGSVGElement>(`[data-word="${word}"] .stub svg`)

/** Which lamp a word's note lights. */
type LampOf = (n: RunNote, i: number, notes: readonly RunNote[]) => number

/** A bead for each pitch, low to high, in the markup's order. */
const byPitch: LampOf = (n, _, notes) =>
  [...new Set(notes.map((x) => x.midi))].sort((a, b) => a - b).indexOf(n.midi)

/** Each word's lamps, and which one each of its notes lights. */
function lampsOf(word: WordId): { lamps: Lamp[]; lampOf: LampOf } {
  if (word === 'quality')
    return {
      lamps: ['major', 'minor'].map((w) =>
        glowLamp(q<SVGElement>(`[data-quality="${w}"]`, stub(word))),
      ),
      // the major chord first, then the minor one
      lampOf: (n) => (n.t < WORD_QUALITY.each ? 0 : 1),
    }
  if (word === 'natural-minor')
    return {
      lamps: qa<SVGElement>('rect', stub(word)).map(stairLamp),
      lampOf: (_, i) => i,
    }
  return {
    lamps: qa<SVGElement>('circle', stub(word)).map(glowLamp),
    lampOf: byPitch,
  }
}

/** A word's figure: each lamp lit for its note's length, all out at rest. */
function figureOf(word: WordId) {
  const { lamps, lampOf } = lampsOf(word)
  let timers: number[] = []
  return {
    note(n: RunNote, i: number, notes: readonly RunNote[]): void {
      const lamp = lamps[lampOf(n, i, notes)]
      if (lamp === undefined) return
      lamp.on()
      timers.push(window.setTimeout(() => lamp.off(), n.dur * 1000))
    },
    rest(): void {
      timers.forEach((id) => window.clearTimeout(id))
      timers = []
      lamps.forEach((l) => l.off())
    },
  }
}

const isWord = (w: string): w is WordId =>
  (WORD_IDS as readonly string[]).includes(w)

export function initWords(): void {
  const sounds = wordSounds()
  const figures = Object.fromEntries(
    WORD_IDS.map((w) => [w, figureOf(w)]),
  ) as Record<WordId, ReturnType<typeof figureOf>>
  const runs: Partial<Record<WordId, Run>> = {}

  async function play(w: string, audible: boolean): Promise<void> {
    if (!isWord(w)) return
    const notes = sounds[w]
    const fig = figures[w]
    fig.rest()
    const r = playNotes(notes, {
      audible,
      kind: 'soft',
      onNote: (n, i) => fig.note(n, i, notes),
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
