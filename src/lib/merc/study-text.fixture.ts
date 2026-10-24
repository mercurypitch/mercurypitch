// ============================================================
// The study text — the owner-approved shader, recovered from the shipped one
// ============================================================
//
// The shipped scene shader differs from the pass 4 study text in two
// deliberate ways that draw the same pixels (scene-shader.ts): the loops
// that call the distance field or a whole sample start at uZero, a uniform
// the renderer sets to 0, and the colours of the light he casts are the
// uLight slots, which the renderer sets from a light set (constants.ts
// LIGHT). asStudied() undoes exactly that, writing each slot out as the
// set's colour, so scene-shader.test.ts still holds the shader to the
// approved hashes and merc-warm.test.ts holds Tavi to hers: any other change
// fails them.

import type { MercLight } from './constants'
import { LIGHT, LIGHT_SLOTS } from './constants'

/** The uniforms' declarations, as the shipped text has them. */
export const ZERO_UNIFORM =
  'uniform int uZero;     // always 0: a loop start the compiler cannot fold\n'
export const LIGHT_UNIFORM =
  'uniform vec3 uLight[18]; // the light he casts, linear (constants.ts LIGHT_SLOTS)\n'

/** A loop start that reads uZero, and the literal one the study wrote. */
export const ZERO_START = 'int i = uZero;'
const STUDY_START = 'int i = 0;'

/** How many times `needle` occurs in `haystack`. */
export const occurrences = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1

/** A colour as the study wrote it: `vec3(0.3, 0.85, 1.0)`. */
export const vec3Text = (c: readonly number[]): string =>
  `vec3(${c.map((x) => (Number.isInteger(x) ? x.toFixed(1) : String(x))).join(', ')})`

/** The study text the shipped fragment shader was made from, lit by `light`. */
export function asStudied(source: string, light: MercLight = LIGHT): string {
  let out = source
    .replace(ZERO_UNIFORM, '')
    .replace(LIGHT_UNIFORM, '')
    .replaceAll(ZERO_START, STUDY_START)
  LIGHT_SLOTS.forEach((slot, k) => {
    out = out.replaceAll(`uLight[${k}]`, vec3Text(light[slot]))
  })
  return out
}

/** One GLSL for loop: its init clause and its body. */
export interface GlslLoop {
  readonly init: string
  readonly body: string
}

/** Where the bracket at `from` is closed: `pair` is the bracket, e.g. '()'. */
function closing(source: string, from: number, pair: string): number {
  let depth = 0
  let at = from
  for (; at < source.length; at++) {
    if (source[at] === pair[0]) depth++
    if (source[at] === pair[1]) depth--
    if (depth === 0) break
  }
  return at
}

/** Every for loop in `source`, nested ones too, in the order they start. */
export function glslLoops(source: string): GlslLoop[] {
  const loops: GlslLoop[] = []
  for (const m of source.matchAll(/\bfor\s*\(([^;]*);/g)) {
    const head = closing(source, source.indexOf('(', m.index), '()')
    const open = source.indexOf('{', head)
    if (source.slice(head + 1, open).trim() !== '') {
      throw new Error(`a for loop without braces: ${m[0]}`)
    }
    const end = closing(source, open, '{}')
    loops.push({ init: m[1].trim(), body: source.slice(open + 1, end) })
  }
  return loops
}
