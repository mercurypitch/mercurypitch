// ============================================================
// The top lights: the room's shape, and the result's and demo-off's own
// ============================================================
//
// Storyboard screen 4 lights the top of the screen its own way: brighter
// than screens 1 to 3, lower, and left of the middle (screen 4 sits 17
// storyboard px off the plate's alignment, and its light stays with the
// screen). The room's light (TOP_LIGHT, fitted to screens 1 and 2) left the
// result 26 % dimmer at its peak and 15 storyboard px right (art round 6,
// decision 1a).
//
// Fitted the way the A0 tools fitted the room's (tools/toplight.py: one
// colour over what is under it, an elliptical Gaussian alpha) over the
// app's ?echoFixture=result with its top light hidden, warped onto
// screen 4 at the geometry file's alignment, with the centre free. Its
// fit and checks are in agent-out echo-art-r6-pr/measure/
// result-toplight-fit.json (tools/fit-result-toplight.py). Hand-written:
// the A0 geometry has no result light for the art sync to carry.
//
// Screen 3 (the demo's first take, demo-off) lights its top as a soft,
// dim vertical band, left of the middle, that thins the stars in it: the
// round 6 blind review found the room's light there brighter, rounder and
// about 13 px right. Fitted the same way over ?echoFixture=demo-off
// (measure/demo-off-toplight-fit.json).

/** A top light: a Gaussian of `rgb`, `alpha` at its centre, in W. */
export interface TopLightSpec {
  readonly rgb: readonly number[]
  readonly alpha: number
  /** Its centre's offset from the column's middle (0 if left out). */
  readonly centreXW?: number
  /** Its centre below the screen's top edge (negative: above it). */
  readonly centreYW: number
  readonly sigmaXW: number
  readonly sigmaYW: number
}

export const RESULT_TOP_LIGHT: TopLightSpec = {
  rgb: [42, 81, 182],
  alpha: 1,
  centreXW: -0.0572,
  centreYW: 0.04,
  sigmaXW: 0.0897,
  sigmaYW: 0.1447,
}

/** Whose top light is up. */
export type TopLightState = 'room' | 'demo-off' | 'result'

export const DEMO_OFF_TOP_LIGHT: TopLightSpec = {
  rgb: [22, 37, 75],
  alpha: 1,
  centreXW: -0.0381,
  centreYW: 0.1252,
  sigmaXW: 0.0678,
  sigmaYW: 0.1521,
}

/** One light gives way to the next as the state changes (the result's as
 * the lit plate comes up). */
export const TOP_LIGHT_FADE = 'opacity 600ms ease-out'
