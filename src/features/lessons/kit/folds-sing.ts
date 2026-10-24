// ============================================================
// Singing folds — the vocal folds' vibration, its blur and its two stills
// ============================================================
//
// Lesson 3's Fig. 1 sings with these, and Lesson 9's folds strip will.
// Slowed, the folds' middle parts and closes once a cycle (`foldBulge`, on
// a slow clock's phase); at real speed, too fast to see, they blur between
// the two (`drawFoldBlur`); under reduced motion they are two stills, OPEN
// and CLOSED (`drawFoldStills`). Stretch runs from 0, slack, at 110 Hz to
// 1, tight, at 440 Hz, Lesson 3's Stretch range (`foldStretch`).
//
// A leaf of its own, beside the folds' drawing (kit/folds.ts) rather than in
// it: that module sits in the chunk Lessons 3 and 5 share at first paint,
// and Lesson 5 never sings its folds, so these painters there would reach
// its first paint unused (319 bytes, measured). Only the pages that call
// them import this module.

import { clamp, TAU } from './dom'
import type { FoldShape } from './folds'
import { drawFoldPair, drawFoldText, foldShapeAt } from './folds'

/** The folds' stretch at `hz`: 0 slack at 110 Hz (A2), 1 tight at 440 Hz (A4), held at both ends. */
export const foldStretch = (hz: number): number =>
  clamp(Math.log2(hz / 110) / 2, 0, 1)

/** The most singing folds at stretch `s` part along their middle: 6 slack, 4.2 tight. */
export const foldVibration = (s: number): number => 6 * (1 - 0.3 * s)

/**
 * How far singing folds at stretch `s` part along their middle at `phase`
 * (0 to 1) of a slowed cycle: open through its first half, shut through the
 * second.
 */
export const foldBulge = (s: number, phase: number): number =>
  foldVibration(s) * Math.max(0, Math.sin(TAU * phase))

/** Singing folds at real speed, too fast to see: the blur between closed and open. */
export function drawFoldBlur(
  ctx: CanvasRenderingContext2D,
  shape: FoldShape,
  s: number,
): void {
  drawFoldPair(ctx, { ...shape, bulge: foldVibration(s) }, 0.35)
  drawFoldPair(ctx, shape, 0.75)
}

/**
 * Singing folds under reduced motion: two stills at stretch `s`, OPEN and
 * CLOSED, side by side across a plot `w` wide and `h` high, each named
 * beneath it.
 */
export function drawFoldStills(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: number,
): void {
  const vib = foldVibration(s)
  for (const [i, word] of ['OPEN', 'CLOSED'].entries()) {
    const shape = foldShapeAt(h * 0.86, s, w * (0.3 + 0.42 * i))
    shape.bulge = i === 0 ? vib : 0
    drawFoldPair(ctx, shape)
    drawFoldText(ctx, word, shape.cx, shape.y0 + shape.len + 18, 'center')
  }
}
