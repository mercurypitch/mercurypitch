// ============================================================
// Lesson 22 ribbon — the app's mark for a vibrato note, by the app's own function
// ============================================================
//
// Step 4's second panel (WEB-SPEC, Toys 2, state 4): the wavy ribbon the
// app draws for a vibrato note, drawn by the app's own function,
// `vibratoShapePath` (src/lib/effect-renderer.ts), at the note's drawn
// width and the pitch canvas's note height, in chrome, a mark. That
// function swings once per 22 pixels of width, whatever the singer's rate,
// so Stretch, 120 to 330 px, takes the ribbon from 5 swings to 15 while the
// sung wave beside it keeps its 11 (FACTS 30, 68). The path it traces on a
// canvas is kept here as an SVG path's words, so the panel is the same
// shape the app paints. The app's effects come as one shared module, so
// the toy loads this one after first paint, as its own chunk.

import { vibratoShapePath } from '@/lib/effect-renderer'

/** Stretch's reach and its start, px: the ribbon's 10 swings (FACTS 68). */
export const STRETCH = { min: 120, max: 330, start: 220 } as const

/** The pitch canvas's note half-height, px (src/components/PitchCanvas.tsx `boxHalf`). */
export const NOTE_HALF = 11

/** The panel's drawing room: the widest note with room either side, and the ribbon's height with its swing. */
export const VIEW = { w: STRETCH.max + 30, h: 80 } as const

/** How many swings the app draws across a note `w` pixels wide: one per 22 px, at least one. */
export const ribbonSwings = (w: number): number =>
  Math.max(1, Math.floor(w / 22))

/** The ribbon for a note `w` pixels wide, centred in the panel's room, as an SVG path's words. */
export function ribbonPath(w: number): string {
  const words: string[] = []
  const at = (x: number, y: number): string =>
    `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`
  // the three calls the app's function makes, kept as words
  const pen = {
    moveTo: (x: number, y: number) => words.push(`M${at(x, y)}`),
    lineTo: (x: number, y: number) => words.push(`L${at(x, y)}`),
    closePath: () => words.push('Z'),
  }
  vibratoShapePath(
    pen as unknown as CanvasRenderingContext2D,
    (VIEW.w - w) / 2,
    VIEW.h / 2,
    w,
    NOTE_HALF,
  )
  return words.join('')
}
