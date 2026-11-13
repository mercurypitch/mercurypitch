// ============================================================
// Staff key strip drawing — the white and black keys under the grand staff
// ============================================================
//
// The staff toy's key strip (staff.ts; Lesson 15's WEB-SPEC, Toys 1), drawn
// into the figure's SVG under the grand staff from the strip's layout
// (key-strip.ts): the white keys dim but for the lit ones, each C named and
// the lit key named too, where the key drawn is wide enough, and the black
// keys over them. A key is clipped to the strip's edges, a white key inset a
// little from its neighbours. Apart from the staff's own drawing
// (staff-draw.ts) so that file stays one a reader can hold.

import { svg } from './dom'
import type { Strip, StripKey, StripSpec } from './key-strip'
import { signName } from './notes'
import { writtenOf } from './staff-places'

/** Two decimals, enough for a pixel. */
const r = (v: number): string => v.toFixed(2)

/**
 * One key of the strip, clipped to the strip's edges (a white key inset a
 * little from its neighbours), dim or lit: the width drawn, or 0 where none
 * of it shows.
 */
function keyRect(
  k: StripKey,
  spec: StripSpec,
  lit: ReadonlySet<number>,
  g: Element,
): number {
  const inset = k.white ? 0.75 : 0
  const x = Math.max(spec.x0, k.x + inset)
  const right = Math.min(spec.x1, k.x + k.w - inset)
  if (right <= x) return 0
  const tone = k.white ? 'st-key is-white' : 'st-key is-black'
  svg(
    'rect',
    {
      x: r(x),
      y: r(k.y),
      width: r(right - x),
      height: r(k.h),
      rx: k.white ? 3 : 2,
      class: lit.has(k.midi) ? `${tone} is-lit` : tone,
    },
    g,
  )
  return right - x
}

/** A white key's name, for each C and the lit key, where the key drawn is wide enough. */
function keyName(
  k: StripKey,
  width: number,
  lit: ReadonlySet<number>,
  g: Element,
): void {
  const named = lit.has(k.midi) || k.midi % 12 === 0
  if (!named || width < 18) return
  svg(
    'text',
    {
      x: r(k.cx),
      y: r(k.y + k.h - 8),
      'text-anchor': 'middle',
      'font-size': r(Math.max(10, Math.min(13, k.w * 0.3))),
      class: 'st-key-name',
      text: signName(writtenOf(k.midi)),
    },
    g,
  )
}

/** The key strip: white keys dim but for the lit ones, each C named, the lit key named too. */
export function drawKeyStrip(
  strip: Strip,
  litKeys: readonly number[],
  parent: Element,
): void {
  const g = svg('g', { class: 'st-keys' }, parent)
  const lit = new Set(litKeys)
  const { spec, keys } = strip
  // the white keys first, so the black keys sit over them
  for (const k of keys)
    if (k.white) keyName(k, keyRect(k, spec, lit, g), lit, g)
  for (const k of keys) if (!k.white) keyRect(k, spec, lit, g)
}
