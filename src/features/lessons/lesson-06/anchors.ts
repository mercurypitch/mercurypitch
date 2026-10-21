// ============================================================
// Lesson 6 anchor board — five intervals, each by a tune you know
// ============================================================
//
// LESSON.md's table on a card in Step 5's text column (WEB-SPEC, Toys 5):
// each row names its interval, its label and its semitones beside a small
// figure of two beads on semitone rows, and plays the tune's own snippet
// (Play the tune) or the bare pair (Play the interval), in the soft tone
// (FACTS 68). A row lights while it sounds, and it is the page's one sound
// (kit/now-playing.ts): a new tap, on the board or anywhere on the page,
// stops the last. The rows' words are the markup's; this draws the figures
// and plays.

import { q, qa, svg } from '@/features/lessons/kit/dom'
import { COLOR, rgba } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { Sound } from '@/features/lessons/kit/sound'
import type { Anchor, Playing } from './examples'
import { ANCHORS, playNotes } from './examples'

export interface AnchorBoard {
  /** Stops whatever the board is playing. */
  stop(): void
}

/** The figure's thirteen rows, an octave, 3 px apart. */
const ROWS = 13
const ROW_GAP = 3
const TOP = 4

/** Two beads, the pair centred on the rows: the second above the first for a rise, below for a fall. */
function drawFigure(host: SVGSVGElement, a: Anchor): void {
  for (let k = 0; k < ROWS; k++) {
    const y = TOP + k * ROW_GAP
    svg(
      'line',
      { x1: 2, y1: y, x2: 54, y2: y, stroke: rgba(COLOR.chrome, 0.12) },
      host,
    )
  }
  const [first, second] = a.interval.map((e) => e.midi)
  const lo = Math.min(first, second)
  const lift = (ROWS - 1 - a.semitones) / 2
  const yOf = (midi: number): number =>
    TOP + (ROWS - 1 - (midi - lo) - lift) * ROW_GAP
  const [y1, y2] = [yOf(first), yOf(second)]
  svg(
    'line',
    {
      x1: 14,
      y1,
      x2: 42,
      y2,
      stroke: rgba(COLOR.chrome, 0.45),
      'stroke-width': 1.5,
    },
    host,
  )
  for (const [x, y] of [
    [14, y1],
    [42, y2],
  ])
    svg(
      'circle',
      {
        cx: x,
        cy: y,
        r: 4.5,
        fill: rgba(COLOR.chrome, 0.3),
        stroke: COLOR.chrome,
        'stroke-width': 1.2,
      },
      host,
    )
}

export function initAnchors(): AnchorBoard {
  const board = q('#anchorBoard')
  let playing: Playing | null = null
  let lit: { row: HTMLElement; button: HTMLButtonElement } | null = null

  function stop(): void {
    playing?.stop()
    playing = null
    lit?.row.classList.remove('is-on')
    lit?.button.classList.remove('is-on')
    lit = null
    NowPlaying.release(stop)
  }

  for (const a of ANCHORS) {
    const row = q(`[data-anchor="${a.id}"]`, board)
    drawFigure(q<SVGSVGElement>('.anchor-fig', row), a)
    for (const button of qa<HTMLButtonElement>('[data-anchor-play]', row)) {
      button.addEventListener('click', () => {
        stop()
        NowPlaying.claim(stop)
        const events =
          button.dataset.anchorPlay === 'tune' ? a.tune : a.interval
        const run = playNotes(events, { audible: Sound.canPlay() })
        playing = run
        lit = { row, button }
        row.classList.add('is-on')
        button.classList.add('is-on')
        void run.done.then(() => {
          if (playing === run) stop()
        })
      })
    }
  }
  return { stop }
}
