// ============================================================
// Merc sim math — the scalar helpers and tuples every sim module shares
// ============================================================
//
// Ported from the pass 4 study as written. smooth() is the study's
// smoothstep, operation for operation; the sim's bit-exact replay depends on
// it staying that way.

/** Three numbers: a point, or a vec3 uniform's worth. */
export type Q3 = [number, number, number]
/** Four numbers: a vec4 uniform's worth. */
export type Q4 = [number, number, number, number]

export const TAU = Math.PI * 2

export const clamp = (x: number, a: number, b: number): number =>
  Math.min(b, Math.max(a, x))

export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k

export const smooth = (a: number, b: number, x: number): number => {
  const k = clamp((x - a) / (b - a), 0, 1)
  return k * k * (3 - 2 * k)
}
