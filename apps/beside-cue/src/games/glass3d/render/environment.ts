// What the glass and Merc are looking at.
// ============================================================
//
// Glass has almost no appearance of its own, and polished metal has
// none at all. Everything you read as "glass" — the bright edge, the
// pinched highlight, the dark core — and everything you read as
// "mercury" — the horizon bent around a droplet, the sliding hot spot —
// is something else in the room, reflected. Light either in an empty
// void and glass renders as a faint outline while metal renders as a
// black lump, which is exactly what the first builds looked like.
//
// So this module builds the room, and it is the ONLY definition of
// where the room's light comes from: `RIG` gives the three directions,
// the map below paints them, and both stages aim their SpotLights down
// the same vectors at their own distances. A punctual light and an
// environment that disagree is the specific failure that made Merc look
// unfinished — his reflected key was under the floor while his lit key
// came from above.
//
// On the equirect convention, because it is the trap here. three maps a
// direction to uv as
//
//     u = 0.5 + atan2(d.z, d.x) / 2pi
//     v = 0.5 + asin(d.y) / pi
//
// (`nodes/utils/EquirectUV.js`), and a DataTexture has `flipY = false`,
// so uv (0,0) is the FIRST row of the array. Row 0 is therefore
// straight DOWN and the last row is straight UP. Writing the map with
// the image-editor convention — row 0 at the top of the sky — silently
// hangs every light upside down. Nothing errors; the scene just reads
// wrong. `writeLight` takes a world direction instead of a uv
// rectangle so the question cannot come up again, and
// environment.test.ts pins the answer.
//
// On size, which is the other half of why the reflections were mush:
// three sizes the PMREM from the source, `cubeSize = width / 4`
// (`renderers/common/extras/PMREMGenerator.js`). The old map was 128
// wide, so every reflection in the game was being resolved on a 32x32
// cubemap — three's own documented minimum is 64x32 and its stated
// ideal for a 256 cube is 1024x512. That is the size below.

import type { SpotLight, Texture } from 'three'
import { BackSide, DataTexture, EquirectangularReflectionMapping, FloatType, LinearFilter, Mesh, MeshBasicMaterial, RGBAFormat, SphereGeometry, SRGBColorSpace, Vector3, } from 'three'

/** Smooth 0→1 across [a, b]; the softness on every light's edge. */
const band = (x: number, a: number, b: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

type RGB = readonly [number, number, number]

/** The brand's three lights, as colour. */
const WARM: RGB = [1.0, 0.82, 0.42]
const COLD: RGB = [0.16, 0.62, 0.66]
const PAPER: RGB = [1.0, 0.94, 0.86]
/** The ground the room stands on, and the air above it. */
const FLOOR: RGB = [0.86, 0.8, 0.72]
const SKY: RGB = [0.6, 0.75, 0.85]

/**
 * Where the room's light comes from, as unit directions from the
 * subject. Both stages place their SpotLights along these, so the
 * environment and the punctual lights are the same rig described twice
 * rather than two rigs that have to be kept in step by hand.
 */
export const RIG = {
  /** The key: high, camera-left, slightly in front. */
  key: new Vector3(-0.41, 0.82, 0.39).normalize(),
  /** The cold glint, opposite the key, so the shadow side has an edge. */
  glint: new Vector3(0.68, 0.48, -0.55).normalize(),
  /** The backlight, low and behind, that draws the bright outline. */
  back: new Vector3(-0.27, 0.38, -0.88).normalize(),
} as const

/**
 * Hang a SpotLight on one of the rig's directions.
 *
 * `distance` stays each stage's own: the Cabinet is 22 cm of glassware
 * and the Hallway is a room, so the same direction is a metre away in
 * one and three in the other, and the candela figures were authored
 * against those distances. Only the direction is shared -- which is the
 * part that has to match the map, because it is the part a reflection
 * shows.
 */
export const aimFromRig = (
  light: SpotLight,
  dir: Vector3,
  target: Vector3,
  distance: number,
): void => {
  light.position.copy(dir).multiplyScalar(distance).add(target)
  light.target.position.copy(target)
}

/**
 * One soft-edged rectangle of light, hung in a direction.
 *
 * `halfWidth` and `halfHeight` are half-angles in radians — a softbox
 * subtends an angle, it does not occupy a fixed patch of uv, and near
 * the poles those two are very different things.
 */
export interface EnvLight {
  dir: Vector3
  halfWidth: number
  halfHeight: number
  /** Edge softness, radians. Small reads as a hard-edged panel. */
  feather: number
  color: RGB
  intensity: number
}

/**
 * How much of `l` reaches `dir`, 0..1.
 *
 * Pulled out of the write loop so a test can compute the same answer for
 * every texel by brute force and compare -- which is how the loop's
 * bounding-box arithmetic gets checked, since that is where the wrap bug
 * lived and no amount of staring at the map would have shown it.
 */
export const lightShape = (dir: Vector3, l: EnvLight): number => {
  const along = dir.dot(l.dir)
  if (along <= 0) return 0
  const right = _right.crossVectors(
    Math.abs(l.dir.y) > 0.999 ? _worldZ : _worldY,
    l.dir,
  )
  if (right.lengthSq() < 1e-12) return 0
  right.normalize()
  const up = _up.crossVectors(l.dir, right).normalize()
  const ax = Math.abs(Math.atan2(dir.dot(right), along))
  const by = Math.abs(Math.atan2(dir.dot(up), along))
  return (
    (1 - band(ax, l.halfWidth, l.halfWidth + l.feather)) *
    (1 - band(by, l.halfHeight, l.halfHeight + l.feather))
  )
}

const _right = /*@__PURE__*/ new Vector3()
const _up = /*@__PURE__*/ new Vector3()

const light = (
  dir: Vector3,
  halfWidth: number,
  halfHeight: number,
  feather: number,
  color: RGB,
  intensity: number,
): EnvLight => ({ dir, halfWidth, halfHeight, feather, color, intensity })

/**
 * The rig as light shapes.
 *
 * The three named panels sit exactly on `RIG`. What is new beside them
 * is a bounce card and three kickers, and they are what a mirror
 * actually needs: a droplet lit by three panels alone has three
 * highlights and is black everywhere between them. The bounce fills the
 * underside the way a white card on the table does, and the kickers are
 * the pinpoints that make a curved metal surface read as wet rather
 * than as painted.
 */
export const cabinetLights = (): EnvLight[] => [
  // The key softbox: tall, warm, and feathered wide on purpose. Its
  // core clips to white in a mirror -- that is what a softbox does --
  // so the custard only survives in the falloff around it. At a tight
  // edge that falloff is a couple of pixels and Merc comes back
  // colourless; at 0.1 rad the warm shoulder is wide enough to read as
  // the room's one warm light.
  light(RIG.key.clone(), 0.2, 0.34, 0.1, WARM, 9),
  // The cold glint: a narrow strip, so it reads as an edge rather than
  // as a second key.
  light(RIG.glint.clone(), 0.07, 0.3, 0.028, COLD, 3.2),
  // The backlight, and it is a CARD, not a panel: big enough that its
  // edges are off frame behind the subject, reaching from well above
  // the horizon to well below it.
  //
  // This is the shape that draws the bright outline down the side of a
  // wine glass, and it has to be this big to do it. At the silhouette a
  // glass reflects almost straight backwards -- away from the lens --
  // so the rim samples a whole cone of directions behind the bowl at
  // once, most of them below the horizon. The map this replaced lit
  // that cone by accident: its key was hung upside down and landed
  // behind and beneath the glass, which is exactly where a
  // photographer's white card goes. Fixing the orientation took the
  // rim away with it. This puts a card there on purpose.
  light(RIG.back.clone(), 0.62, 0.6, 0.18, PAPER, 3.4),
  // The bounce card: low, camera-right, broad and dim.
  light(
    new Vector3(0.55, -0.18, 0.81).normalize(),
    0.5,
    0.26,
    0.22,
    PAPER,
    0.5,
  ),
  // Kickers. Tiny — about a degree across — so they add sparkle without
  // adding meaningful irradiance to anything. Deliberately dimmer than
  // the key: a pinpoint brighter than the softbox would be physically
  // ordinary (a bare bulb IS brighter than a diffuser) but it would make
  // some incidental speck the brightest thing in the room, and the room
  // is supposed to have one key. Past about 2.0 everything reads as
  // white through ACES anyway, so the sparkle costs nothing here.
  //
  // They also have to sit in the gaps. A kicker laid on top of the back
  // card adds its intensity to the card's and hands the room a second,
  // brighter key by accident -- which is what the first arrangement did,
  // and what environment.test.ts caught.
  light(new Vector3(0.62, 0.62, 0.48).normalize(), 0.02, 0.02, 0.012, WARM, 7),
  light(
    new Vector3(0.3, 0.9, 0.31).normalize(),
    0.016,
    0.016,
    0.01,
    PAPER,
    5.5,
  ),
  light(new Vector3(0.86, 0.2, 0.47).normalize(), 0.014, 0.014, 0.01, COLD, 5),
]

/** The room's exposure, exported so a reference build can match it. */
export const envExposure = (): number => EXPOSURE

/** Width of the equirect map. `/4` is the PMREM cube size — see header. */
const ENV_WIDTH = 1024
const ENV_HEIGHT = ENV_WIDTH / 2

/**
 * How much light is in the room, as one number over the whole map.
 *
 * The panels below are sized as real softboxes — a key that subtends
 * about 23 by 39 degrees. The map they replaced had a "key" spanning a
 * quarter of the sky and nearly half the elevation, which is not a
 * softbox, it is a wall; measured over solid angle it put three times
 * as much light in the room as this rig does. Structure was the fix and
 * darkness was not, so the shapes stay small and the whole map is
 * exposed back up to the light level the scene was authored against.
 *
 * Multiplying the map rather than raising `scene.environmentIntensity`
 * because Merc carries his own `envMap`, and a material with one reads
 * `material.envMapIntensity` INSTEAD of the scene's — so the scene knob
 * would light the glass and skip him. Exposure belongs to the room.
 */
const EXPOSURE = 2.6

/** The direction a texel centre looks at, under three's convention. */
export const envDirection = (
  u: number,
  v: number,
  out = new Vector3(),
): Vector3 => {
  const lat = (v - 0.5) * Math.PI
  const lon = (u - 0.5) * Math.PI * 2
  const c = Math.cos(lat)
  return out.set(c * Math.cos(lon), Math.sin(lat), c * Math.sin(lon))
}

/**
 * Paint one light into the buffer.
 *
 * Only the texels the light can reach are visited: the rest of the
 * sphere is untouched, which is what keeps a 1024x512 map affordable to
 * build on a phone. The row range comes from the light's latitude, and
 * the column range from its angular radius divided by the cosine of the
 * row's latitude — the same span covers more longitude the closer to a
 * pole you get.
 */
const writeLight = (
  data: Float32Array,
  w: number,
  h: number,
  l: EnvLight,
): void => {
  // The corner of the box is the furthest a texel can be and still be
  // lit at all.
  const reach = Math.hypot(l.halfWidth + l.feather, l.halfHeight + l.feather)

  const lat0 = Math.asin(Math.min(1, Math.max(-1, l.dir.y)))
  const vMin = Math.max(0, (lat0 - reach) / Math.PI + 0.5)
  const vMax = Math.min(1, (lat0 + reach) / Math.PI + 0.5)
  const y0 = Math.floor(vMin * (h - 1))
  const y1 = Math.ceil(vMax * (h - 1))

  const dir = new Vector3()
  for (let y = y0; y <= y1; y++) {
    const v = y / (h - 1)
    const lat = (v - 0.5) * Math.PI
    // How much longitude `reach` is worth at this latitude.
    const span = Math.min(Math.PI, reach / Math.max(Math.cos(lat), 1e-3))
    const lon0 = Math.atan2(l.dir.z, l.dir.x)
    const cols = Math.ceil((span / (Math.PI * 2)) * w) + 1

    const centre = Math.round((lon0 / (Math.PI * 2) + 0.5) * (w - 1))

    // Once the span covers the whole circle -- which it does on every row
    // near a pole, where a fixed angle is worth all 360 degrees of
    // longitude -- walking centre-cols..centre+cols steps PAST the row's
    // start and visits three texels a second time. Walk the row once
    // instead.
    //
    // With today's lights that changed no pixel: the revisited texels sit
    // roughly opposite the light in longitude, where its falloff is
    // already zero, so the second visit added zero. It is wasted work and
    // a latent hazard rather than a bug -- a panel wide enough to still
    // be lit on the far side of a polar row WOULD get double the
    // intensity there, silently. The brute-force test in
    // environment.test.ts is what would catch that.
    const wraps = 2 * cols + 1 >= w
    const first = wraps ? 0 : centre - cols
    const last = wraps ? w - 1 : centre + cols
    for (let k = first; k <= last; k++) {
      // Longitude wraps: a light at u ~ 0 spills onto the far column.
      const x = wraps ? k : ((k % w) + w) % w
      const u = x / (w - 1)
      envDirection(u, v, dir)

      const shape = lightShape(dir, l)
      if (shape <= 0) continue

      const amount = shape * l.intensity * EXPOSURE
      const i = (y * w + x) * 4
      data[i]! += l.color[0] * amount
      data[i + 1]! += l.color[1] * amount
      data[i + 2]! += l.color[2] * amount
    }
  }
}

const _worldY = /*@__PURE__*/ new Vector3(0, 1, 0)
const _worldZ = /*@__PURE__*/ new Vector3(0, 0, 1)

/**
 * The lighting rig, as an equirectangular map.
 *
 * Float rather than bytes, and that is the whole point: a softbox at 9.0
 * blows out in a reflection the way a real one does, and a byte texture
 * clamps it to 1.0 where it reads as grey paper.
 *
 * The base layer under the panels is a sky, a floor and a horizon, and
 * it is not decoration. A metal reflecting black IS black — it has no
 * diffuse term to fall back on — so an environment that is empty
 * between its lights gives a droplet a black body with three bright
 * dabs on it. A graded sky gives the curvature somewhere to go, and the
 * bright line at the horizon is the single strongest cue that a surface
 * is a mirror: it is the waterline you see wrapped around every chrome
 * ball ever photographed.
 */
export const buildCabinetEnvironment = (
  width = ENV_WIDTH,
  height = ENV_HEIGHT,
): DataTexture => {
  const data = new Float32Array(width * height * 4)

  // Base pass: one value per row, because sky, floor and horizon depend
  // only on how far up you are looking.
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1)
    const up = Math.sin((v - 0.5) * Math.PI)

    // Dim toward the zenith, brighter toward the horizon -- the way a
    // room is, and nowhere ever zero.
    const skyAmount = (0.11 - 0.096 * Math.pow(Math.max(up, 0), 0.6)) * EXPOSURE
    const floorAmount =
      (0.075 - 0.059 * Math.pow(Math.max(-up, 0), 0.7)) * EXPOSURE
    const blend = band(up, -0.02, 0.02)
    // The band where they meet, and it does more work than anything else
    // in this map. A glass rim reflects almost horizontally in every
    // direction at once, so what draws the bright outline down the side
    // of the bowl is not any one panel -- it is whether there is a lit
    // RING all the way round. Three small softboxes leave that ring
    // dark and the bowl comes back as a flat olive shape with no edge.
    //
    // Wide rather than narrow for a second reason: on a droplet the
    // horizon lands across the middle of the face, and a hot thin line
    // there reads as a stripe painted on Merc rather than as the room
    // behind the camera.
    //
    // 0.40, up from 0.22 (maff, 2026-09-04: "some kind of shade cutting
    // directly the merc in half, he is lighter on upper part of his body
    // and lower is dimmed"). 0.22 was already the widened value and it
    // was still not wide enough: against a sky and floor of 0.1-0.26 a
    // peak of 2.86 is a fifteen-to-one ring, and Merc is metal at
    // roughness 0.06, so he mirrors it. What he showed was not shading
    // at all -- it was the edge of that ring, drawn across him at a
    // height that has nothing to do with his shape, which is why it read
    // as a seam rather than as a highlight.
    //
    // Confirmed by experiment rather than argument: widening this one
    // number to 1.5 removed the line completely and changed nothing else
    // in the frame. 0.40 is where the line stops reading as an edge and
    // the wine glass still keeps the lit rim down its bowl, checked in
    // both stages side by side.
    const horizon = 1.1 * EXPOSURE * Math.exp(-((up / 0.4) * (up / 0.4)))

    const r =
      FLOOR[0] * floorAmount * (1 - blend) +
      SKY[0] * skyAmount * blend +
      PAPER[0] * horizon
    const g =
      FLOOR[1] * floorAmount * (1 - blend) +
      SKY[1] * skyAmount * blend +
      PAPER[1] * horizon
    const b =
      FLOOR[2] * floorAmount * (1 - blend) +
      SKY[2] * skyAmount * blend +
      PAPER[2] * horizon

    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 1
    }
  }

  for (const l of cabinetLights()) writeLight(data, width, height, l)

  const tex = new DataTexture(data, width, height, RGBAFormat, FloatType)
  tex.mapping = EquirectangularReflectionMapping
  // DataTexture defaults to NearestFilter, which turns every reflection
  // into visible blocks on a mirror-smooth surface.
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
