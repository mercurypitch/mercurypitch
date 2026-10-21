// ============================================================
// Lesson 6 four words — interval, step, leap and transpose, each heard
// ============================================================
//
// Lesson 1's strip of figure, word, definition and play button, with four
// new figures (WEB-SPEC, Toys 3; FACTS 66), pitch as height in each: two
// beads with the distance between them marked for interval (C4 up to G4);
// two beads on neighbouring letter rows for step (A4 down to G4); two beads
// with empty rows between for leap (D4 up to G4); and a short line with its
// moved copy for transpose (C4 C4 G4 G4, then F♯4 F♯4 C♯5 C♯5). Each bead
// lights while its note sounds, in the soft tone. A word is the page's one
// sound (kit/now-playing.ts): a new press, of a word or anything else on
// the page, stops the last, and a press of the word sounding plays it again
// from its start.

import { q, qa, svg } from '@/features/lessons/kit/dom'
import { COLOR, rgba } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { Sound } from '@/features/lessons/kit/sound'
import type { NoteEvent, Playing } from './examples'
import { playNotes, WORD_SOUNDS } from './examples'

/** One bead that lights while its note sounds. */
interface Lamp {
  on(): void
  off(): void
}

const BEAD_FILL = rgba(COLOR.chrome, 0.22)
const BEAD_EDGE = rgba(COLOR.chrome, 0.7)
const ROW = rgba(COLOR.chrome, 0.16)
const JOIN = rgba(COLOR.chrome, 0.38)

/** A bead at (x, y), lit white while it sounds. */
function bead(host: SVGSVGElement, x: number, y: number, r = 7): Lamp {
  const c = svg(
    'circle',
    {
      cx: x,
      cy: y,
      r,
      fill: BEAD_FILL,
      stroke: BEAD_EDGE,
      'stroke-width': 1.5,
    },
    host,
  )
  return {
    on() {
      c.setAttribute('fill', COLOR.ink)
      c.setAttribute('stroke', '#ffffff')
    },
    off() {
      c.setAttribute('fill', BEAD_FILL)
      c.setAttribute('stroke', BEAD_EDGE)
    },
  }
}

const line = (
  host: SVGSVGElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  extra: Record<string, string | number> = {},
): void => {
  svg('line', { x1, y1, x2, y2, stroke, 'stroke-width': 1.5, ...extra }, host)
}

/** Faint letter rows, as on a staff: one row per letter. */
function rows(host: SVGSVGElement, ys: readonly number[]): void {
  for (const y of ys) line(host, 2, y, 62, y, ROW, { 'stroke-width': 1 })
}

const stub = (word: string): SVGSVGElement =>
  q<SVGSVGElement>(`[data-word="${word}"] .stub svg`)

/** Interval: C4 and G4, the distance between them marked beside them. */
function intervalLamps(): Lamp[] {
  const host = stub('interval')
  line(host, 14, 90, 40, 34, JOIN)
  // the distance: a bracket from one bead's height to the other's
  line(host, 54, 34, 54, 90, COLOR.chrome)
  line(host, 50, 34, 58, 34, COLOR.chrome)
  line(host, 50, 90, 58, 90, COLOR.chrome)
  line(host, 21, 90, 50, 90, ROW, { 'stroke-dasharray': '2 3' })
  line(host, 47, 34, 50, 34, ROW, { 'stroke-dasharray': '2 3' })
  return [bead(host, 14, 90), bead(host, 40, 34)]
}

/** Four letter rows, one a letter, which step and leap both draw on. */
const LETTER_ROWS = [32, 52, 72, 92]

/** Step: A4 down to G4, on neighbouring rows. */
function stepLamps(): Lamp[] {
  const host = stub('step')
  rows(host, LETTER_ROWS)
  line(host, 20, 32, 44, 52, JOIN)
  return [bead(host, 20, 32), bead(host, 44, 52)]
}

/** Leap: D4 up to G4, the rows for E and F empty between them. */
function leapLamps(): Lamp[] {
  const host = stub('leap')
  rows(host, LETTER_ROWS)
  line(host, 20, 92, 44, 32, JOIN)
  return [bead(host, 20, 92), bead(host, 44, 32)]
}

/** Transpose: C C G G, and the same shape six semitones higher. */
function transposeLamps(): Lamp[] {
  const host = stub('transpose')
  const xs = [9, 23, 41, 55]
  // 4 px a semitone: G is 28 px above C, the copy 24 px above the line
  const low = [100, 100, 72, 72]
  const high = low.map((y) => y - 24)
  const lamps: Lamp[] = []
  for (const ys of [low, high]) {
    for (let i = 0; i < 3; i++)
      line(host, xs[i], ys[i], xs[i + 1], ys[i + 1], JOIN)
    xs.forEach((x, i) => lamps.push(bead(host, x, ys[i], 5.5)))
  }
  return lamps
}

export function initWords(): void {
  const lamps: Record<string, Lamp[]> = {
    interval: intervalLamps(),
    step: stepLamps(),
    leap: leapLamps(),
    transpose: transposeLamps(),
  }
  let playing: Playing | null = null
  let lit: { button: HTMLButtonElement; lamps: readonly Lamp[] } | null = null
  // each lit bead's own end, cleared with the word, so none outlives it
  let offs: number[] = []

  /** Stops the word sounding: its notes, its lit beads and its button. */
  function stop(): void {
    playing?.stop()
    playing = null
    offs.forEach((id) => window.clearTimeout(id))
    offs = []
    lit?.button.classList.remove('is-on')
    lit?.lamps.forEach((l) => l.off())
    lit = null
    NowPlaying.release(stop)
  }

  qa<HTMLButtonElement>('[data-word-play]').forEach((b) =>
    b.addEventListener('click', () => {
      const word = b.dataset.wordPlay ?? ''
      const events: readonly NoteEvent[] | undefined = WORD_SOUNDS[word]
      const own = lamps[word] as Lamp[] | undefined
      if (events === undefined || own === undefined) return
      stop()
      NowPlaying.claim(stop)
      lit = { button: b, lamps: own }
      b.classList.add('is-on')
      const run = playNotes(events, {
        audible: Sound.canPlay(),
        onNote: (e, i) => {
          own.forEach((l) => l.off())
          own[i]?.on()
          offs.push(window.setTimeout(() => own[i]?.off(), e.dur * 1000))
        },
      })
      playing = run
      void run.done.then(() => {
        if (playing === run) stop()
      })
    }),
  )
}
