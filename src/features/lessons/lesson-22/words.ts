// ============================================================
// Lesson 22 four words — vibrato, rate, extent and straight note, each drawn as it sounds
// ============================================================
//
// Lesson 5's word tickets, with the page's sound owner (kit/words-strip.ts
// `bindWordPlays`; WEB-SPEC, Toys 4): each stub is a small band chart round
// its word's note, 35 cents either side, with no line at its centre, no
// cents ticks and no note named, as wide as its play. A press plays the
// word in Merc's "ooh", and its line draws itself in Merc's amber as it
// sounds, from the play's own schedule (sounds.ts `WORDS`; FACTS 70):
// Vibrato, A3 at six swings a second, ±30 cents, for 2.5 s; Rate, ±30 cents
// at five, then seven swings a second; Extent, six swings a second at ±20,
// then ±60 cents, past the band's edges, each pair 2.0 s a note with 0.4 s
// between; Straight note, D3 with no wave for 2.0 s, a level line through
// its band. Until its first press a band stands empty; then its line stays
// as it last drew, one cut short by another sound included. Under reduced
// motion a line lands whole as its play starts; what the viewer starts
// still sounds. The words are the page's one sound (kit/now-playing.ts): a
// press stops any sound before it, anywhere on the page, and a newer one
// stops the word. None plays a wave slower than five swings a second, and
// the straight note is on D, so no word answers either predict (FACTS 1a,
// 24).

import type { BandChart } from '@/features/lessons/kit/band-chart'
import { mountBandChart } from '@/features/lessons/kit/band-chart'
import { paintWave } from '@/features/lessons/kit/band-chart-wave'
import { q, qa } from '@/features/lessons/kit/dom'
import { addDrawer, wake, watch } from '@/features/lessons/kit/frame-loop'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import { playLines } from '@/features/lessons/kit/run'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import type { WordId } from './sounds'
import { WORDS } from './sounds'
import type { Drawn } from './vib-picture'
import { drawnTo } from './vib-picture'

/** A word chart's axis, cents either side of its note: room for Extent's ±60, past the band's edges. */
export const WORD_RANGE = 80

/** One word's figure: its chart, its play and its stop. */
interface Figure {
  readonly chart: BandChart
  /** Plays the word, drawing its line as it sounds; resolves when it ends. */
  play(audible: boolean): Promise<void>
  stop(): void
}

export interface Words {
  readonly charts: Readonly<Record<WordId, BandChart>>
}

const now = (): number => performance.now() / 1000

const isWord = (w: string): w is WordId => Object.hasOwn(WORDS, w)

/** One word's chart on its ticket's stub, and its play. */
function mountWord(id: WordId, stub: HTMLElement): Figure {
  const { midi, play: sound } = WORDS[id]
  let drawing: Drawn | null = null
  let run: Run | null = null

  // the play's clock runs before the chart's drawer, so a frame draws the moment it reaches
  addDrawer({
    active: watch(stub),
    wants: () => !reducedMotion() && drawing !== null && drawing.ended === null,
    draw: () => {
      paint()
    },
  })
  const chart = mountBandChart(stub, {
    target: midi,
    axis: { range: WORD_RANGE },
    window: sound.sec,
    ticks: [],
    centre: false,
    active: watch(stub),
    paintOver: paintWave,
  })

  function paint(): void {
    chart.scene.wave =
      drawing === null
        ? null
        : {
            stretches: sound.line,
            upTo: drawnTo(drawing, now(), reducedMotion()),
          }
  }

  return {
    chart,
    async play(audible) {
      const going = playLines(sound.lines, { audible })
      run = going
      const mine: Drawn = { sec: sound.sec, t0: now(), ended: null }
      drawing = mine
      paint()
      wake()
      const heard = await going.done
      if (run === going) run = null
      mine.ended = heard ? mine.sec : Math.min(mine.sec, now() - mine.t0)
      paint()
      wake()
    },
    stop() {
      run?.stop()
    },
  }
}

/** Mounts the four words' charts and binds their plays to the page's one sound. */
export function initWords(): Words {
  const root = q('#words')
  const figures = new Map<WordId, Figure>()
  for (const ticket of qa('[data-word]', root)) {
    const id = ticket.dataset.word ?? ''
    if (isWord(id)) figures.set(id, mountWord(id, q('.word-chart', ticket)))
  }
  const figure = (w: string): Figure => {
    const f = isWord(w) ? figures.get(w) : undefined
    if (f === undefined) throw new Error(`no word ${w}`)
    return f
  }
  bindWordPlays(root, (w, audible) => figure(w).play(audible), {
    owner: NowPlaying,
    stop: (w) => {
      figure(w).stop()
    },
  })
  return {
    charts: {
      vibrato: figure('vibrato').chart,
      rate: figure('rate').chart,
      extent: figure('extent').chart,
      straight: figure('straight').chart,
    },
  }
}
