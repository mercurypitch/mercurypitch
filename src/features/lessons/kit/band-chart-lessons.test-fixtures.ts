// ============================================================
// Band chart figures — Lessons 3 and 5's charts, as their pages mount them
// ============================================================
//
// Four charts, each with the scene it shows mid-play: band-chart.test.ts
// writes out what each paints, mark by mark, as the chart painted it before
// it took rungs, and band-chart-rungs.test.ts paints each again with its
// band as one rung at 0 across the plot, which must make the same calls.

import type { Figure } from './band-chart.test-fixtures'

/**
 * Lesson 3's Sing it chart, mounted as lesson-03/sing-view.ts mounts it,
 * during a take: Merc's note glowing, the line climbing into the band and
 * past the top of the chart, and everything else a scene can hold.
 */
export const SING_3: Figure = {
  opts: { target: 57 },
  scene: (s) => {
    s.line = [
      { t: 0.2, c: -90 },
      { t: 0.8, c: -30 },
      { t: 1.2, c: null },
      { t: 1.6, c: 10 },
      { t: 2.4, c: 180 },
    ]
    s.head = { t: 2.4, c: 180 }
    s.playhead = 2.4
    s.glow = 1
    s.lit = true
    s.marks = [
      { t: 0, label: 'try' },
      { t: 3.8, label: 'compare' },
    ]
    s.label = { t: 1.6, c: 10, text: '10 cents' }
    s.handle = true
  },
}

/**
 * Lesson 3's octave toy, mounted as lesson-03/toy-octaves.ts mounts it, as
 * Tavi's reply lands: the notes axis from F3 to C5 with A3 and A4 named,
 * the echo an octave up glowing, and the bracket between the two.
 */
export const OCTAVES_3: Figure = {
  opts: {
    target: 57,
    axis: { notes: [53, 72], named: [57, 69] },
    echo: 1200,
  },
  scene: (s) => {
    s.line = [
      { t: 1.4, c: 1140 },
      { t: 1.8, c: 1192 },
      { t: 2.6, c: 1200 },
    ]
    s.head = { t: 2.6, c: 1200 }
    s.echoGlow = 1
    s.bracket = 'same note, an octave apart'
  },
}

/**
 * Lesson 5's hold, mounted as lesson-05/sing-view.ts mounts it: a fixed
 * frame of 10 seconds named under the plot, a hold settled in the band.
 */
export const HOLD_5: Figure = {
  opts: { target: 57, window: 10, timeTicks: true },
  scene: (s) => {
    s.line = [
      { t: 0.4, c: -70 },
      { t: 1.5, c: -25 },
      { t: 6, c: -8 },
    ]
    s.head = { t: 6, c: -8 }
    s.lit = true
    s.marks = [{ t: 1.5, label: 'settled' }]
  },
}

/**
 * Lesson 5's push, mounted as lesson-05/toy-push.ts mounts it: the level
 * strip under the plot, the line climbing above the band as the push grows.
 */
export const PUSH_5: Figure = {
  opts: { target: 57, strip: true },
  scene: (s) => {
    s.line = [
      { t: 0, c: 0 },
      { t: 2, c: 30 },
      { t: 4, c: 95 },
    ]
    s.head = { t: 4, c: 95 }
    s.level = [
      { t: 0, level: 0.3 },
      { t: 2, level: 0.6 },
      { t: 4, level: 0.9 },
    ]
  },
}
