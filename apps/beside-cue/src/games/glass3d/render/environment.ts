// What the glass is looking at.
// ============================================================
//
// Glass has almost no appearance of its own. Everything you read as
// "glass" — the bright edge, the pinched highlight, the dark core — is
// something else in the room, bent. Light it in an empty void and it
// renders as a faint outline, which is exactly what the first build of
// the Cabinet looked like.
//
// So this module builds the room: an environment map with hard-edged
// bright shapes for the glass to reflect and refract, and a backdrop
// gradient for it to stand against. Neither is a photograph of a real
// studio; both are the same three brand colours arranged the way a
// product photographer would arrange lights around a wine glass.

import type { Texture } from 'three'
import { BackSide, DataTexture, EquirectangularReflectionMapping, FloatType, LinearFilter, Mesh, MeshBasicMaterial, RGBAFormat, SphereGeometry, SRGBColorSpace, } from 'three'

/** Smooth 0→1 across [a, b]; the softness on every light's edge. */
const band = (x: number, a: number, b: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** A soft-edged rectangle in (u, v), 0..1 at its centre. */
const panel = (
  u: number,
  v: number,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  feather = 0.05,
): number =>
  band(u, u0 - feather, u0 + feather) *
  (1 - band(u, u1 - feather, u1 + feather)) *
  band(v, v0 - feather, v0 + feather) *
  (1 - band(v, v1 - feather, v1 + feather))

/**
 * The lighting rig, as an equirectangular map.
 *
 * Float rather than bytes, and that is the whole point: a softbox at 9.0
 * blows out in a reflection the way a real one does, and a byte texture
 * clamps it to 1.0 where it reads as grey paper. This is 128x64 floats —
 * 128 KB of VRAM, generated in about a millisecond, and no HDR file to
 * ship or decode.
 *
 * Three shapes, matching the three lights the scene actually has:
 *   - a tall warm softbox up and to the left, the key;
 *   - a cool turquoise strip opposite it, so the unlit side of the glass
 *     has an edge instead of vanishing;
 *   - a soft band directly behind the glass, the backlight that a
 *     photographer would put through a diffuser to make the bowl glow.
 */
export const buildCabinetEnvironment = (): DataTexture => {
  const w = 128
  const h = 64
  const data = new Float32Array(w * h * 4)

  const WARM = [1.0, 0.82, 0.42]
  const COLD = [0.16, 0.62, 0.66]
  const PAPER = [1.0, 0.94, 0.86]

  for (let y = 0; y < h; y++) {
    const v = y / (h - 1) // 0 at the zenith, 1 at the nadir
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1)
      const i = (y * w + x) * 4

      const key = panel(u, v, 0.02, 0.26, 0.04, 0.46, 0.06) * 9
      const glint = panel(u, v, 0.6, 0.72, 0.08, 0.58, 0.05) * 3.2
      const back = panel(u, v, 0.38, 0.58, 0.24, 0.5, 0.12) * 2.2
      // A dim wash so nothing is mathematically black, falling off below
      // the horizon: a floor does not light a room from underneath.
      const wash = 0.05 * (1 - band(v, 0.45, 0.75))

      for (let c = 0; c < 3; c++) {
        data[i + c] =
          WARM[c]! * (key + wash) + COLD[c]! * glint + PAPER[c]! * back
      }
      data[i + 3] = 1
    }
  }

  const tex = new DataTexture(data, w, h, RGBAFormat, FloatType)
  tex.mapping = EquirectangularReflectionMapping
  // DataTexture defaults to NearestFilter, which turns every reflection
  // into visible 128x64 blocks on a mirror-smooth surface.
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.needsUpdate = true
  return tex
}

/**
 * The backdrop gradient: bright behind the glass, falling to near-black
 * at the top and bottom of frame.
 *
 * Cool and desaturated on purpose. The brand's ink is a warm near-black,
 * and a warm subject on a warm ground is the specific thing that reads as
 * "muddy brown" rather than as a lit room. Against a cold ground the one
 * custard spotlight is the only warm thing on screen, which is what the
 * whole scene is about.
 */
const buildBackdropGradient = (): DataTexture => {
  const h = 96
  const data = new Uint8Array(h * 4)
  const stops: [number, [number, number, number]][] = [
    [0.0, [8, 11, 13]],
    [0.44, [34, 50, 52]],
    [0.64, [14, 19, 20]],
    [1.0, [5, 6, 7]],
  ]

  for (let y = 0; y < h; y++) {
    const v = y / (h - 1)
    let lo = stops[0]!
    let hi = stops[stops.length - 1]!
    for (let s = 0; s < stops.length - 1; s++) {
      if (v >= stops[s]![0] && v <= stops[s + 1]![0]) {
        lo = stops[s]!
        hi = stops[s + 1]!
        break
      }
    }
    const span = Math.max(hi[0] - lo[0], 1e-6)
    const t = band((v - lo[0]) / span, 0, 1)
    for (let c = 0; c < 3; c++) {
      data[y * 4 + c] = Math.round(lo[1][c]! + (hi[1][c]! - lo[1][c]!) * t)
    }
    data[y * 4 + 3] = 255
  }

  const tex = new DataTexture(data, 1, h)
  tex.colorSpace = SRGBColorSpace
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.needsUpdate = true
  return tex
}

export interface Backdrop {
  mesh: Mesh
  dispose(): void
}

/**
 * The cyclorama: one big inverted sphere carrying that gradient.
 *
 * A `scene.background` colour would be cheaper, but it is not in the
 * scene — so a transmissive material refracting the world behind it
 * finds nothing there and the glass goes flat. This is geometry, so the
 * bowl actually bends it, and the vertical falloff gives the frame a
 * top and a bottom instead of one even field of colour.
 */
export const createBackdrop = (radius = 6): Backdrop => {
  const map = buildBackdropGradient()
  const geometry = new SphereGeometry(radius, 32, 16)
  const material = new MeshBasicMaterial({ map, side: BackSide })
  const mesh = new Mesh(geometry, material)
  // It is the void, not an object: never occlude, never be occluded.
  mesh.renderOrder = -1
  return {
    mesh,
    dispose(): void {
      geometry.dispose()
      material.dispose()
      ;(map as Texture).dispose()
    },
  }
}

/**
 * A white radial falloff, for anything that has to read as spilled light
 * rather than as an object.
 *
 * The distinction matters more than it sounds: an additively blended
 * disc of flat colour is a disc — it has a rim, and the eye finds the
 * rim instantly and calls it a plastic coaster. Light has no rim. Under
 * additive blending the black edge of this texture contributes nothing,
 * so the shape ends where the light ends.
 */
export const buildRadialFalloff = (size = 64): DataTexture => {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5
      const dy = (y + 0.5) / size - 0.5
      const r = Math.min(1, Math.hypot(dx, dy) * 2)
      // Squared falloff, which is both what light does and what stops
      // the bright core from spreading into a flat plate.
      const v = Math.round(255 * (1 - r) * (1 - r))
      const i = (y * size + x) * 4
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  const tex = new DataTexture(data, size, size)
  tex.colorSpace = SRGBColorSpace
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.needsUpdate = true
  return tex
}
