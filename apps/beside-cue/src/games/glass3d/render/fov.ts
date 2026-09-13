// Holding a composition's width on a narrow screen.
// ============================================================
//
// three's `fov` is VERTICAL, so a phone held upright keeps the vertical
// angle a scene was composed with and throws most of the horizontal one
// away. At a phone's aspect a 40-degree lens leaves about 19 degrees of
// width, which is how Merc ended up half outside the Hallway's frame on
// maff's iPhone (2026-09-03) while it looked fine on a laptop.
//
// So the vertical angle is derived from the horizontal one the scene was
// composed at, and only ever widened: a screen wider than the design
// aspect keeps exactly the framing it had. The cap is there because the
// arithmetic alone asks for a hundred degrees on a tall phone, and a
// hundred-degree lens is a different film.
//
// The Hallway, the chambers and the Line each carried this rule inline;
// the Cabinet had none, and is the one still framed for a laptop (P8).
// One copy now, used by all four.

export interface Lens {
  /** The vertical angle the scene was composed through, degrees. */
  designFovDeg: number
  /** The screen shape it was composed on, width over height. */
  designAspect: number
  /** Past this the correction stops being a correction. */
  maxFovDeg: number
}

/** The vertical field of view, in degrees, for a screen of `aspect`. */
export const holdHorizontalFov = (aspect: number, lens: Lens): number => {
  if (!(aspect > 0) || !Number.isFinite(aspect)) return lens.designFovDeg
  const halfWidth =
    Math.tan((lens.designFovDeg * Math.PI) / 360) * lens.designAspect
  const wanted = (Math.atan(halfWidth / aspect) * 360) / Math.PI
  return Math.min(lens.maxFovDeg, Math.max(lens.designFovDeg, wanted))
}
