// ============================================================
// The study text — the owner-approved shader, recovered from the shipped one
// ============================================================
//
// The shipped scene shader differs from the pass 4 study text in one
// deliberate way that draws the same pixels: the loops that call the
// distance field or a whole sample start at uZero, a uniform the renderer
// sets to 0, so Direct3D's compiler keeps them loops (scene-shader.ts).
// asStudied() undoes exactly that, so scene-shader.test.ts still holds the
// shader to the approved hashes and any other change fails them.

/** The uniform's declaration, as the shipped text has it. */
export const ZERO_UNIFORM =
  'uniform int uZero;     // always 0: a loop start the compiler cannot fold\n'

/** A loop start that reads uZero, and the literal one the study wrote. */
export const ZERO_START = 'int i = uZero;'
const STUDY_START = 'int i = 0;'

/** How many times `needle` occurs in `haystack`. */
export const occurrences = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1

/** The study text the shipped fragment shader was made from. */
export function asStudied(source: string): string {
  return source.replace(ZERO_UNIFORM, '').replaceAll(ZERO_START, STUDY_START)
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
