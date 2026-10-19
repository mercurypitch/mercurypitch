// ============================================================
// Lesson 2 keys geometry — the keyboard, the tile row and the glide between
// ============================================================
//
// Where every key and tile sits, as numbers (DECISIONS 83, measured at 390 x
// 844). On a phone the keyboard is the octave A3 to A4 edge to edge: on a
// 356 px figure eight white keys of 44.5 px, the black keys 84 px deep and
// 27.6 px wide, as Lesson 1's proportions draw them. Each black key takes
// taps over a 44 px zone centred on it, its full depth; black keys sit a
// white key apart, so two zones never overlap (0.5 px clear at 356). Each
// white key takes taps across its full width below the black keys, and
// wherever no black key's zone reaches. Narrower than 352 px the keyboard
// shows the white keys that fit at 44 px and pans one key at a time.
//
// Straightened, every semitone is one equal tile: thirteen across the figure
// for A3 to A4 (27.4 px on a phone, a picture that takes no taps; about
// 47 px on the desktop stage, which do), or step 5's close-up of B3 to F4,
// seven at 50.9 px. A key glides from its keyboard rectangle to its tile.

import { clamp, easeInOut, lerp } from '@/features/lessons/kit/dom'
import { isBlack } from '@/features/lessons/kit/notes'
import type { Keyboard, KeyHit } from '@/features/lessons/kit/spiral-keys'
import { KEY_SLOP, keyboardLayout, LO, N, } from '@/features/lessons/kit/spiral-keys'

export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** A3 and A4, and B3 and F4, as semitones from A2 (the kit's LO). */
export const A3_S = 12
export const A4_S = 24
export const B3_S = 14
export const F4_S = 20

/** A3's place among the white keys, counted from A2. */
const A3_WHITE = 7

/** The smallest tap target on the page. */
export const TARGET = 44

/** White keys a phone keyboard shows at once: as many as fit at 44 px, up to the octave's eight. */
export function phoneWhites(W: number): number {
  return clamp(Math.floor(W / TARGET), 1, 8)
}

/** How far the phone keyboard can pan from A3, in white keys (0 once all eight fit). */
export function phonePanMax(W: number): number {
  return 8 - phoneWhites(W)
}

/** The keyboard on a W by H canvas: A2 to A5 on a wide stage, the octave from A3 edge to edge on a phone. */
export function keysLayout(
  W: number,
  H: number,
  narrow: boolean,
  pan: number,
): Keyboard {
  return narrow
    ? keyboardLayout(W, H, true, A3_WHITE + pan, {
        margin: 0,
        visible: phoneWhites(W),
      })
    : keyboardLayout(W, H, false, 0)
}

/** The notes the keyboard draws, semitones from A2: every key, or a phone's octave. */
export function keyNotes(narrow: boolean): readonly [number, number] {
  return narrow ? [A3_S, A4_S] : [0, N - 1]
}

/** Where a key is drawn on the keyboard (a white key's 0.75 px gap each side, as the kit draws it). */
export function keyRect(kb: Keyboard, s: number): Rect {
  const kp = kb.keyPos(s)
  if (kp.white)
    return {
      x: kb.xOfW(kp.wi) + 0.75,
      y: kb.kbTop,
      w: kb.ww - 1.5,
      h: kb.kbH,
    }
  return { x: kp.x - kb.bW / 2, y: kb.kbTop, w: kb.bW, h: kb.bH }
}

/**
 * Where a key takes taps. A white key: its full width and depth. A black
 * key: a zone `zone` px wide centred on it, its full depth. The kit's tap
 * test reaches KEY_SLOP past each target's top and bottom, so a black zone
 * is handed over that much shorter at each end and ends exactly at the key.
 */
export function keyTarget(kb: Keyboard, s: number, zone: number): KeyHit {
  const kp = kb.keyPos(s)
  if (kp.white)
    return {
      s,
      x: kb.xOfW(kp.wi),
      y: kb.kbTop,
      w: kb.ww,
      h: kb.kbH,
      white: true,
    }
  const w = Math.max(zone, kb.bW)
  return {
    s,
    x: kp.x - w / 2,
    y: kb.kbTop + KEY_SLOP,
    w,
    h: kb.bH - 2 * KEY_SLOP,
    white: false,
  }
}

/** The row of equal tiles: one per semitone from `from` to `to`, across the canvas. */
export interface TileRow {
  /** The first and last tile on the canvas, semitones from A2. */
  readonly from: number
  readonly to: number
  /** The left edge of the first tile, and each tile's width. */
  readonly x0: number
  readonly tileW: number
  readonly top: number
  readonly h: number
}

/** The tile row on a W by H canvas, `margin` px in from each side. */
export function tileRow(
  W: number,
  H: number,
  from: number,
  to: number,
  margin: number,
): TileRow {
  const count = to - from + 1
  return {
    from,
    to,
    x0: margin,
    tileW: (W - 2 * margin) / count,
    top: H * 0.47,
    h: H * 0.29,
  }
}

/** A tile's left edge: the row runs on past the canvas for the notes outside it. */
export const tileX = (row: TileRow, s: number): number =>
  row.x0 + (s - row.from) * row.tileW

/** Where a tile is drawn (a 0.75 px gap each side, so neighbours touch). */
export function tileRect(row: TileRow, s: number): Rect {
  return {
    x: tileX(row, s) + 0.75,
    y: row.top,
    w: row.tileW - 1.5,
    h: row.h,
  }
}

/** Where a tile takes taps: its full width, so two never overlap. */
export function tileTarget(row: TileRow, s: number): KeyHit {
  return {
    s,
    x: tileX(row, s),
    y: row.top,
    w: row.tileW,
    h: row.h,
    white: !isBlack(LO + s),
  }
}

/** True when the tiles are wide enough to take taps. */
export const tilesTakeTaps = (row: TileRow): boolean => row.tileW >= TARGET

export function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    w: lerp(a.w, b.w, t),
    h: lerp(a.h, b.h, t),
  }
}

/** A key on its way to its tile: `straight` 0 is the keyboard, 1 the row (eased). */
export function glideRect(
  kb: Keyboard,
  row: TileRow,
  s: number,
  straight: number,
): Rect {
  return lerpRect(keyRect(kb, s), tileRect(row, s), easeInOut(straight))
}

/** Where a note's bead sits: on its key, on its tile, or between. */
export function beadPoint(
  kb: Keyboard,
  row: TileRow,
  s: number,
  straight: number,
): { x: number; y: number } {
  const kp = kb.keyPos(s)
  const t = easeInOut(straight)
  return {
    x: lerp(kp.x, tileX(row, s) + row.tileW / 2, t),
    y: lerp(kp.y, row.top + row.h * 0.7, t),
  }
}
