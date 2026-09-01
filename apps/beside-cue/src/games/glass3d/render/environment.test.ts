// The room has to be a room, and it has to be the right way up.
// ============================================================
//
// Two defects shipped in the first environment map, and neither one
// threw, logged, or failed a type check. Merc just looked unfinished.
//
//   The map was 128 px wide. three sizes its PMREM from the source as
//   `cubeSize = width / 4`, so every reflection in the game was resolved
//   on a 32x32 cubemap. Nothing in three complains -- 128x32 is above
//   its stated 64x32 minimum -- you simply get mush.
//
//   The lights were painted with row 0 at the top, the way an image
//   editor shows a sky. three's equirect convention puts uv v = 0 at
//   `asin(d.y) = -pi/2`, and a DataTexture is not flipped, so row 0 is
//   straight DOWN. The key softbox was under the floor.
//
// Both are properties of a plain Float32Array, so both are testable
// without a GPU. `equirectUV` below is three's own mapping, transcribed
// from `nodes/utils/EquirectUV.js`; if three ever changes it, these
// tests are where the change should first be noticed.

import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { buildCabinetEnvironment, envDirection, RIG } from './environment'

/** three's mapping, in reverse: a direction to the uv it samples. */
const equirectUV = (d: Vector3): { u: number; v: number } => ({
  u: Math.atan2(d.z, d.x) / (Math.PI * 2) + 0.5,
  v: Math.asin(Math.min(1, Math.max(-1, d.y))) / Math.PI + 0.5,
})

interface Map2D {
  width: number
  height: number
  data: Float32Array
}

const read = (m: Map2D, u: number, v: number): [number, number, number] => {
  const x = Math.min(m.width - 1, Math.max(0, Math.round(u * (m.width - 1))))
  const y = Math.min(m.height - 1, Math.max(0, Math.round(v * (m.height - 1))))
  const i = (y * m.width + x) * 4
  return [m.data[i]!, m.data[i + 1]!, m.data[i + 2]!]
}

const luma = ([r, g, b]: [number, number, number]): number =>
  0.2126 * r + 0.7152 * g + 0.0722 * b

/** The uv a direction samples, as `read`'s two arguments. */
const uvOf = (dir: Vector3): [number, number] => {
  const { u, v } = equirectUV(dir.clone().normalize())
  return [u, v]
}

/** What the map shows when you look in `dir`. */
const lookAt = (m: Map2D, dir: Vector3): number => luma(read(m, ...uvOf(dir)))

const build = (): Map2D => {
  // A quarter-size map for the geometry tests: the shapes are angular,
  // so they land in the same directions at any resolution, and 256x128
  // keeps the suite quick. Resolution itself is asserted separately,
  // against the shipped default.
  const tex = buildCabinetEnvironment(256, 128)
  return {
    width: 256,
    height: 128,
    data: tex.image.data as Float32Array,
  }
}

describe('the cabinet environment', () => {
  it('is large enough for three to build a 256 PMREM from', () => {
    // `PMREMGenerator._setSizeFromTexture`: equirect sources give
    // `cubeSize = width / 4`. This is the assertion that would have
    // caught reflections being resolved at 32 px.
    const tex = buildCabinetEnvironment()
    const cubeSize = tex.image.width / 4
    expect(cubeSize).toBeGreaterThanOrEqual(256)
    expect(tex.image.width).toBe(tex.image.height * 2)
  })

  it('hangs the key light above the horizon, not below it', () => {
    // The inversion bug, stated as the thing a player would notice.
    const m = build()
    expect(RIG.key.y).toBeGreaterThan(0)
    const up = lookAt(m, RIG.key)
    const down = lookAt(m, RIG.key.clone().setY(-RIG.key.y))
    expect(up).toBeGreaterThan(down * 4)
  })

  it('puts each rig light where the map is brightest', () => {
    // Not just "above the horizon": the brightest direction in the whole
    // map has to BE the key, or the spotlights and their reflections are
    // describing two different rooms.
    const m = build()
    let best = { luma: -1, dir: new Vector3() }
    const dir = new Vector3()
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        const value = luma(read(m, x / (m.width - 1), y / (m.height - 1)))
        if (value > best.luma) {
          best = {
            luma: value,
            dir: envDirection(
              x / (m.width - 1),
              y / (m.height - 1),
              dir,
            ).clone(),
          }
        }
      }
    }
    // A softbox is a plateau, not a point: every texel inside its
    // half-extents carries full intensity, so "the brightest direction"
    // is a region, and the furthest corner of the key's is
    // hypot(0.2, 0.34) = 0.4 rad from centre. Asking for less than that
    // would be asking which corner argmax happened to visit first.
    expect(best.dir.angleTo(RIG.key)).toBeLessThan(0.4)
    // And it is the KEY's region, not some other light's. Hanging the
    // map upside down puts this at about 110 degrees.
    expect(best.dir.angleTo(RIG.key)).toBeLessThan(best.dir.angleTo(RIG.glint))
    expect(best.dir.angleTo(RIG.key)).toBeLessThan(best.dir.angleTo(RIG.back))
  })

  it('is brighter along each rig direction than beside it', () => {
    const m = build()
    const away = new Vector3(0.05, -0.6, 0.8).normalize()
    for (const [name, dir] of Object.entries(RIG)) {
      expect(
        lookAt(m, dir),
        `${name} should out-shine an empty direction`,
      ).toBeGreaterThan(lookAt(m, away))
    }
  })

  it('is never black, in any direction', () => {
    // A metal has no diffuse term. Where the environment is zero, the
    // droplet is zero -- so an empty patch of map is a hole in Merc.
    const m = build()
    let min = Infinity
    for (let i = 0; i < m.data.length; i += 4) {
      min = Math.min(min, m.data[i]! + m.data[i + 1]! + m.data[i + 2]!)
    }
    expect(min).toBeGreaterThan(0.01)
  })

  it('has a horizon for a mirror to wrap around', () => {
    // The waterline. It is the single strongest cue that a curved
    // surface is reflective, and it is what the old map had none of.
    //
    // The MEDIAN of each ring, not the mean: a ring at 30 degrees passes
    // through the glint and the bounce card, and averaging lets one
    // softbox claim the ring is bright when the other 15 samples are
    // void. The median asks the question actually being asked -- is the
    // background brighter here than above and below.
    const m = build()
    const ring = (y: number): number => {
      const samples: number[] = []
      for (let k = 0; k < 32; k++) {
        const a = (k / 32) * Math.PI * 2
        samples.push(lookAt(m, new Vector3(Math.cos(a), y, Math.sin(a))))
      }
      samples.sort((p, q) => p - q)
      return samples[Math.floor(samples.length / 2)]!
    }
    const atHorizon = ring(0)
    expect(atHorizon).toBeGreaterThan(ring(0.5) * 2)
    expect(atHorizon).toBeGreaterThan(ring(-0.5) * 2)
  })

  it('separates sky from floor', () => {
    // Up and down must not read the same, or the droplet has no sense of
    // which way is up. Both ends are dim by design, so the difference to
    // assert is colour, not brightness: the sky is cool air and the
    // floor is a warm bounce, and that is what tips a reflection over
    // from "grey lump" into "standing in a room".
    const m = build()
    const [zr, , zb] = read(m, ...uvOf(new Vector3(0, 1, 0)))
    const [nr, , nb] = read(m, ...uvOf(new Vector3(0, -1, 0)))
    expect(zb).toBeGreaterThan(zr)
    expect(nr).toBeGreaterThan(nb)
  })
})
