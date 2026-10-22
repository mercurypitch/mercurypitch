// ============================================================
// Lesson 8 four words — beat, tempo, bar and backbeat, each heard
// ============================================================
//
// Lesson 1's strip of figure, word, definition and button
// (kit/words-strip.ts), as Lesson 7's four words take it, with four new
// figures (WEB-SPEC, Toys 3; FACTS 73): four dots for beat; the same dots
// twice, far apart then close, for tempo; two groups of four with a bar
// line after each, its first beat larger, for bar; one bar's grid with the
// kick on 1 and 3 and the claps on 2 and 4 in gold, for backbeat. Each dot
// lights as its beat sounds, which is all that moves, under reduced motion
// too. Every word sounds through the beat clock, booked on the audio clock,
// and is the page's one sound (kit/now-playing.ts): a new press of anything
// else on the page stops it, and a press of the word still sounding is
// ignored, as on Lessons 1 and 7.

import type { Run, Spot } from '@/features/lessons/kit/beat-clock'
import { bars, BeatClock } from '@/features/lessons/kit/beat-clock'
import { bookHit } from '@/features/lessons/kit/beat-machine'
import type { MachineHit } from '@/features/lessons/kit/beat-patterns'
import { q, svg } from '@/features/lessons/kit/dom'
import { COLOR, rgba } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { WordPlay } from '@/features/lessons/kit/words-strip'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import { WORD_SOUNDS } from './patterns'

/** One dot that lights while its beat sounds. */
interface Lamp {
  on(): void
  off(): void
}

const DOT_FILL = rgba(COLOR.chrome, 0.22)
const DOT_EDGE = rgba(COLOR.chrome, 0.7)
const GOLD = '#ffd84d'
const RULE = rgba(COLOR.chrome, 0.38)
const CELL = rgba(COLOR.chrome, 0.16)

/** A dot at (x, y), in its own colour, lit white while it sounds. */
function dot(
  host: SVGSVGElement,
  x: number,
  y: number,
  r: number,
  fill = DOT_FILL,
  edge = DOT_EDGE,
): Lamp {
  const c = svg(
    'circle',
    { cx: x, cy: y, r, fill, stroke: edge, 'stroke-width': 1.5 },
    host,
  )
  return {
    on() {
      c.setAttribute('fill', COLOR.ink)
      c.setAttribute('stroke', '#ffffff')
    },
    off() {
      c.setAttribute('fill', fill)
      c.setAttribute('stroke', edge)
    },
  }
}

const stub = (word: string): SVGSVGElement =>
  q<SVGSVGElement>(`[data-word="${word}"] .stub svg`)

const XS = [11, 25, 39, 53]

/** Beat: four dots, evenly spaced. */
function beatLamps(): Lamp[] {
  const host = stub('beat')
  return XS.map((x) => dot(host, x, 60, 5))
}

/** Tempo: the four dots far apart, then the same four close together. */
function tempoLamps(): Lamp[] {
  const host = stub('tempo')
  const far = XS.map((x) => dot(host, x, 40, 4.5))
  const close = [20, 28, 36, 44].map((x) => dot(host, x, 82, 3.5))
  return [...far, ...close]
}

/** Bar: two bars of four, a bar line after each, beat 1 larger. */
function barLamps(): Lamp[] {
  const host = stub('bar')
  const lamps: Lamp[] = []
  for (const y of [40, 82]) {
    ;[8, 21, 34, 47].forEach((x, i) =>
      lamps.push(dot(host, x, y, i === 0 ? 5.5 : 3.5)),
    )
    svg(
      'line',
      {
        x1: 58,
        y1: y - 11,
        x2: 58,
        y2: y + 11,
        stroke: RULE,
        'stroke-width': 1.5,
      },
      host,
    )
  }
  return lamps
}

/** Backbeat: one bar's grid, the kick on 1 and 3, the claps on 2 and 4 in gold. */
function backbeatLamps(): Lamp[] {
  const host = stub('backbeat')
  const rows = [46, 74]
  for (const y of rows)
    for (const x of XS)
      svg(
        'rect',
        {
          x: x - 6.5,
          y: y - 11,
          width: 13,
          height: 22,
          rx: 3,
          fill: 'none',
          stroke: CELL,
        },
        host,
      )
  const gold = rgba(GOLD, 0.35)
  return XS.map((x, i) =>
    i % 2 === 0
      ? dot(host, x, rows[0], 4.5)
      : dot(host, x, rows[1], 4.5, gold, GOLD),
  )
}

export function initWords(): void {
  const lamps: Partial<Record<string, readonly Lamp[]>> = {
    beat: beatLamps(),
    tempo: tempoLamps(),
    bar: barLamps(),
    backbeat: backbeatLamps(),
  }
  const runs: Partial<Record<string, Run>> = {}
  const dark = (word: string): void => lamps[word]?.forEach((l) => l.off())

  const play: WordPlay = async (word, audible) => {
    const sound = WORD_SOUNDS[word]
    const own = lamps[word]
    if (sound === undefined || own === undefined) return
    // each beat's length, read in order as the clock times them
    let beat = 0
    const r = BeatClock.start<MachineHit>({
      bar: bars(sound.bars),
      bpm: () => 60 / sound.beatSec(beat++),
      audible,
      book: bookHit,
      onBeat: (spot: Spot) => {
        own.forEach((l) => l.off())
        own[spot.beats]?.on()
      },
    })
    runs[word] = r
    // false once stopped, by a newer sound or by the page
    await r.done
    if (runs[word] === r) delete runs[word]
    dark(word)
  }

  bindWordPlays(document, play, {
    owner: NowPlaying,
    stop: (word) => {
      runs[word]?.stop()
      dark(word)
    },
  })
}
