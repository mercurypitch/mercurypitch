// ============================================================
// Breath mark — a score's comma over the line, and the word "breathe"
// ============================================================
//
// One drawing for every figure that marks where to breathe (Lesson 6's
// slide guide after "star", Lesson 10's where its gap starts, Lesson 14's
// song line): a small tick that rises up and to the right from its foot, a
// score's comma, in the figure's own colour, with the word "breathe" over
// it or beside it, or no word where the marks stand too close for one (the
// whole song). A mark is drawn full once the voice has reached it, softer
// before. Where it stands is each figure's own business; this draws it.

import { rgba } from './notes'

/** The breath word's size, px. */
export const BREATH_WORD = 11
/** The word in the charts' mono at that size. */
export const BREATH_FONT = `500 ${BREATH_WORD}px "JetBrains Mono", monospace`
/** The word. */
export const BREATHE = 'breathe'

/** Where a breath mark stands: its tick's foot, and its word's anchor (null for none). */
export interface BreathPlace {
  readonly x: number
  /** The tick's foot: the tick rises 8 px from it, up and to the right. */
  readonly y: number
  /** The word's anchor: its foot, centred, or its top, `beside` the tick on its right. */
  readonly word: {
    readonly x: number
    readonly y: number
    readonly beside: boolean
  } | null
}

/** Draws a breath mark in `color`: full once the voice has reached it (`lit`), softer before. */
export function drawBreath(
  ctx: CanvasRenderingContext2D,
  m: BreathPlace,
  color: string,
  lit: boolean,
): void {
  ctx.font = BREATH_FONT
  ctx.lineCap = 'round'
  ctx.strokeStyle = rgba(color, lit ? 1 : 0.7)
  ctx.fillStyle = rgba(color, lit ? 1 : 0.7)
  ctx.lineWidth = lit ? 2.2 : 1.8
  ctx.beginPath()
  ctx.moveTo(m.x - 1.5, m.y)
  ctx.lineTo(m.x + 2.5, m.y - 8)
  ctx.stroke()
  if (m.word === null) return
  ctx.textAlign = m.word.beside ? 'left' : 'center'
  ctx.textBaseline = m.word.beside ? 'top' : 'bottom'
  ctx.fillText(BREATHE, m.word.x, m.word.y)
}
