// ============================================================
// Lip roll's stand-in plates, from the L0 measures and two Gemini picks
// ============================================================
//
// The bay's paintings do not exist yet (lip-l0/L0-REPORT.md 8). Until they
// do, the room runs on these, each at the frame and pixel density its
// painting will have, so a painted plate replaces its stand-in file for
// file (sync-lip-art.mjs) and the room's code does not change:
//
//   bay-back     drawn: the sky's band colours read off storyboard screen
//                1, the cliffs as dark shapes, the horizon, the far sea
//                and its moonlight (the moon is its own plate)
//   moon         drawn: the moon and its halo at screen 1's measured size,
//                on a clear ground, centred in its frame
//   wave-lit     Gemini's lip_wave_lit_a, stretched to wave B's height and
//                width, its glow graded zone by zone to screen 2's six
//                height zones (L0 2.3), cut along its water's edge
//   wave-unlit   the lit stand-in, graded by depth under the dotted line to
//                screen 1's five unlit zones (masked grading, ART-FIDELITY
//                5's method for the painting itself), its rim kept
//   sea-front    drawn: #07203e to #030e1c, ripple streaks, a foam line
//   bubble       drawn: a glass ring with a highlight
//   result       Gemini's lip_result_a (storyboard screen 4 without the
//                interface), extended above 0.16 H and below 0.84 H with
//                the screen's own band colours, its waves and lit sea
//                graded dark as the unlit wave is
//   result-lit   the same picture ungraded, cut to the band the room lights
//
// Pixel work is done on raw RGBA buffers (sharp in and out); colour moves
// are made in CIELAB, so a zone's mean lands on its target. Every random
// choice is seeded, so a re-run writes the same files.

import sharp from 'sharp'

/** A small, fast, seeded generator (mulberry32). */
export function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const smoothstep = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const lerp = (a, b, t) => a + (b - a) * t

/** The wave's shape: 1 on the flat top, a smoothstep down to 0 at the foot. */
export function waveG(u, f) {
  const x = Math.abs(u)
  if (x <= f) return 1
  if (x >= 1) return 0
  return 1 - smoothstep((x - f) / (1 - f))
}

export const hex = (h) =>
  [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16))

// ---- colour ---------------------------------------------------------------

const toLin = (c) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const toSrgb = (v) => {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
  return clamp(Math.round(c * 255), 0, 255)
}
const fLab = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29)
const fInv = (t) => (t > 6 / 29 ? t * t * t : (108 / 841) * (t - 4 / 29))
const WHITE = [0.95047, 1, 1.08883]

const LIN = Float64Array.from({ length: 256 }, (_, i) => toLin(i))

export function rgbToLab(r, g, b) {
  const R = LIN[r]
  const G = LIN[g]
  const B = LIN[b]
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / WHITE[0]
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / WHITE[2]
  const fx = fLab(x)
  const fy = fLab(y)
  const fz = fLab(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

export function labToRgb(L, a, b) {
  const fy = (L + 16) / 116
  const x = fInv(fy + a / 500) * WHITE[0]
  const y = fInv(fy)
  const z = fInv(fy - b / 200) * WHITE[2]
  const R = 3.2406 * x - 1.5372 * y - 0.4986 * z
  const G = -0.9689 * x + 1.8758 * y + 0.0415 * z
  const B = 0.0557 * x - 0.204 * y + 1.057 * z
  return [toSrgb(R), toSrgb(G), toSrgb(B)]
}

const hexLab = (h) => rgbToLab(...hex(h))

/** CIEDE2000 between two Lab colours. */
export function de2000(p, q) {
  const [L1, a1, b1] = p
  const [L2, a2, b2] = q
  const rad = Math.PI / 180
  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cm = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
  const ap1 = (1 + G) * a1
  const ap2 = (1 + G) * a2
  const Cp1 = Math.hypot(ap1, b1)
  const Cp2 = Math.hypot(ap2, b2)
  const hp = (b, ap) => {
    const h = Math.atan2(b, ap) / rad
    return h < 0 ? h + 360 : h
  }
  const h1 = hp(b1, ap1)
  const h2 = hp(b2, ap2)
  const dL = L2 - L1
  const dC = Cp2 - Cp1
  let dh = h2 - h1
  if (Cp1 * Cp2 === 0) dh = 0
  else if (dh > 180) dh -= 360
  else if (dh < -180) dh += 360
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh / 2) * rad)
  const Lm = (L1 + L2) / 2
  const Cpm = (Cp1 + Cp2) / 2
  let hm = h1 + h2
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(h1 - h2) > 180) hm += h1 + h2 < 360 ? 360 : -360
    hm /= 2
  }
  const T =
    1 -
    0.17 * Math.cos((hm - 30) * rad) +
    0.24 * Math.cos(2 * hm * rad) +
    0.32 * Math.cos((3 * hm + 6) * rad) -
    0.2 * Math.cos((4 * hm - 63) * rad)
  const dTheta = 30 * Math.exp(-(((hm - 275) / 25) ** 2))
  const RC = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7))
  const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2)
  const SC = 1 + 0.045 * Cpm
  const SH = 1 + 0.015 * Cpm * T
  const RT = -Math.sin(2 * dTheta * rad) * RC
  return Math.sqrt(
    (dL / SL) ** 2 +
      (dC / SC) ** 2 +
      (dH / SH) ** 2 +
      RT * (dC / SC) * (dH / SH),
  )
}

// ---- raw images -------------------------------------------------------------

/** An RGBA image: width, height and its bytes. */
export function blank(width, height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) }
}

export async function readImage(path, width, height) {
  const { data, info } = await sharp(path)
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data),
  }
}

export async function writeWebp(image, out, { alpha, quality = 80 }) {
  let pipe = sharp(Buffer.from(image.data.buffer), {
    raw: { width: image.width, height: image.height, channels: 4 },
  })
  if (!alpha) pipe = pipe.flatten({ background: '#000000' })
  await pipe
    .webp({ quality, alphaQuality: 90, effort: 6, smartSubsample: true })
    .toFile(out)
}

/** A pixel of `img` with its edges reflected (bilinear). */
function sampleReflect(img, x, y, out) {
  const { width: w, height: h, data } = img
  const refl = (v, n) => {
    const period = 2 * (n - 1)
    let m = ((v % period) + period) % period
    if (m > n - 1) m = period - m
    return m
  }
  const fx = refl(x, w)
  const fy = refl(y, h)
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const x1 = Math.min(w - 1, x0 + 1)
  const y1 = Math.min(h - 1, y0 + 1)
  const tx = fx - x0
  const ty = fy - y0
  for (let c = 0; c < 4; c++) {
    const a = data[(y0 * w + x0) * 4 + c]
    const b = data[(y0 * w + x1) * 4 + c]
    const d = data[(y1 * w + x0) * 4 + c]
    const e = data[(y1 * w + x1) * 4 + c]
    out[c] = lerp(lerp(a, b, tx), lerp(d, e, tx), ty)
  }
  return out
}

// ---- the wave -----------------------------------------------------------------

/**
 * The lit wave's six height zones on storyboard screen 2 (L0 2.3): t is 0
 * at the foam line and 1 on the path, column by column.
 */
export const LIT_ZONES = [
  { t: [-0.15, 0], hex: '#26afd3' },
  { t: [0, 0.2], hex: '#1ab3c5' },
  { t: [0.2, 0.4], hex: '#1085b1' },
  { t: [0.4, 0.6], hex: '#1180ca' },
  { t: [0.6, 0.8], hex: '#2573e2' },
  { t: [0.8, 1], hex: '#4a5ff2' },
]

/** The unlit wave by depth under the dotted line, W (screen 1, L0 2.3). */
export const UNLIT_ZONES = [
  { d: [-0.01, 0.03], hex: '#071f3f' },
  { d: [0.03, 0.06], hex: '#0c2747' },
  { d: [0.06, 0.1], hex: '#061b33' },
  { d: [0.1, 0.15], hex: '#06162a' },
  { d: [0.15, 0.22], hex: '#041122' },
  { d: [0.22, 0.4], hex: '#030e1c' },
]

/** A zone table's value at `v`, linear between zone centres. */
function zoneAt(zones, key, values, v) {
  const centres = zones.map((z) => (z[key][0] + z[key][1]) / 2)
  if (v <= centres[0]) return values[0]
  for (let i = 1; i < centres.length; i++) {
    if (v <= centres[i]) {
      const k = (v - centres[i - 1]) / (centres[i] - centres[i - 1])
      return values[i - 1].map((x, c) => lerp(x, values[i][c], k))
    }
  }
  return values[values.length - 1]
}

/**
 * Gemini's lit wave, as one plate: scaled to `px` px per W with its crest
 * (L0 7: x_c 0.501, half-width 0.4081, height 0.3334 of its width, crest
 * at 0.1861 of its height, foam at 0.6747) made wave B's, its edge 0.0102 W
 * under the dotted line, its glow graded to screen 2's zones, transparent
 * above its edge and fading out at the frame's sides.
 */
export async function waveLitImage(src, px, geo) {
  const { wave, frame, pick } = geo
  const kx = (wave.a * px) / (pick.a * pick.width)
  const ky = (wave.h * px) / (pick.h * pick.width)
  const sw = Math.round(pick.width * kx)
  const sh = Math.round(pick.height * ky)
  const source = await readImage(src, sw, sh)
  const crestX = pick.xc * sw
  const crestRow = pick.crestRow * sh
  const foam = pick.foamRow * sh
  const apx = wave.a * px
  const hpx = wave.h * px
  const edgeAt = (x) => crestRow + hpx * (1 - waveG((x - crestX) / apx, wave.f))
  // The picture's water: the wave down to its feet, then the foam line
  // (the near sea's top, a little under the wave's fitted root).
  const rootRow = crestRow + hpx
  const waterAt = (x) => {
    const g = waveG((x - crestX) / apx, wave.f)
    return edgeAt(x) + (foam - rootRow) * (1 - smoothstep(g / 0.15))
  }

  const out = blank(Math.round(frame.width * px), Math.round(frame.height * px))
  // The frame's crest point (the dotted line's) and the painted edge under it.
  const fx0 = -frame.left * px
  const fy0 = -frame.top * px
  const dy = geo.waterEdge * px
  const glow = 0.012 * px
  const feather = 0.08 * px
  // The storyboard's mound runs on to the foam line, FOAM_UNDER_ROOT under
  // the root; the picture's own lit sea fills it (not stretched: stretched,
  // its sparkles run into streaks), and only under that line does it fade.
  const rootOut = fy0 + dy + hpx
  const foamOut = rootOut + geo.foamUnderRoot * px
  const sourceRow = (yOut) => crestRow + (yOut - fy0 - dy)
  const fade = 0.06 * px
  // The picture's own edge is not the model's: on the flanks it runs up to
  // 0.08 W under it. Each column is pulled up so its painted edge meets the
  // model's, the pull easing out to nothing at the root.
  const lift = paintedLift(source, crestX, apx, edgeAt, rootRow, px)
  const rgba = [0, 0, 0, 0]
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const sx = crestX + (x + 0.5 - fx0)
      const sy0 = sourceRow(y + 0.5)
      const col = Math.max(0, Math.min(lift.length - 1, Math.floor(sx)))
      const span = Math.max(1, rootRow - edgeAt(sx))
      const sy = sy0 + lift[col] * clamp((rootRow - sy0) / span, 0, 1)
      sampleReflect(source, sx - 0.5, sy - 0.5, rgba)
      const above = waterAt(sx) - sy
      // Over the water only the glow's own light shows: its black is air.
      const light = Math.max(rgba[0], rgba[1], rgba[2])
      let alpha =
        above <= 0 ? 1 : (1 - smoothstep(above / glow)) * smoothstep(light / 70)
      const side = Math.min(x + 0.5, out.width - x - 0.5)
      alpha *= smoothstep(side / feather)
      // Under the root the wave's light pools in the sea: widest at the
      // root, narrowing and dimming down to the foam line, where the near
      // sea is the sea-front's and it fades out.
      const depth = (y + 0.5 - rootOut) / (foamOut - rootOut)
      if (depth > 0) {
        const u = Math.abs(sx - crestX) / apx
        const reach = 1.3 - 0.45 * Math.min(1, depth)
        alpha *= 1 - smoothstep((u - reach + 0.35) / 0.35)
        alpha *= 1 - 0.35 * smoothstep(depth)
      }
      const under = y + 0.5 - foamOut
      if (under > 0) alpha *= 1 - smoothstep(under / fade)
      const i = (y * out.width + x) * 4
      out.data[i] = rgba[0]
      out.data[i + 1] = rgba[1]
      out.data[i + 2] = rgba[2]
      out.data[i + 3] = Math.round(255 * alpha)
    }
  }
  // Graded on the plate, so the zones run from the storyboard's foam line.
  const edgeOut = (x) => fy0 + dy + hpx * (1 - waveG((x - fx0) / apx, wave.f))
  gradeLit(
    out,
    edgeOut,
    foamOut,
    hpx,
    (x) => Math.abs(x - fx0) < 0.9 * apx,
    fy0 + dy + (foam - crestRow) - 0.01 * px,
  )
  return out
}

/**
 * How far under the model's edge the picture paints its own, per source
 * column, px: the first row from the top lit past `LIGHT`, smoothed, kept
 * between 0 and 0.12 W, zero outside the wave's flanks.
 */
function paintedLift(img, crestX, apx, edgeAt, rootRow, px) {
  const LIGHT = 70
  const { width: w, height: h, data } = img
  const raw = new Float64Array(w)
  for (let x = 0; x < w; x++) {
    const u = Math.abs(x + 0.5 - crestX) / apx
    if (u >= 0.97) continue
    const model = edgeAt(x + 0.5)
    let row = -1
    for (let y = Math.max(0, Math.floor(model - 0.04 * px)); y < rootRow; y++) {
      const i = (y * w + x) * 4
      if (Math.max(data[i], data[i + 1], data[i + 2]) > LIGHT) {
        row = y
        break
      }
    }
    if (row >= 0) raw[x] = clamp(row - model, 0, 0.12 * px)
  }
  const out = new Float64Array(w)
  const r = Math.round(0.01 * px)
  for (let x = 0; x < w; x++) {
    const near = []
    for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) {
      near.push(raw[k])
    }
    near.sort((p, q) => p - q)
    out[x] = near[Math.floor(near.length / 2)]
  }
  return out
}

/** Each lit zone's mean moved onto screen 2's, in Lab, three times over. */
function gradeLit(img, edgeAt, foam, hpx, inWave, setBelow = Infinity) {
  const { width: w, height: h, data } = img
  const targets = LIT_ZONES.map((z) => hexLab(z.hex))
  const tOf = (x, y) => {
    const edge = edgeAt(x + 0.5)
    if (y + 0.5 < edge) return null
    return (foam - (y + 0.5)) / Math.max(foam - edge, 0.1 * hpx)
  }
  // Measured inside the wave's flanks only, on the plate's opaque pixels.
  const judged = (x) => inWave(x + 0.5)
  // Under `setBelow` the picture's water is dark sea, too dark to move:
  // there the zone's colour is set, with the water's own light about its
  // row's mean kept as texture (its sparkles and ripples).
  const rowL = new Float64Array(h)
  for (let y = Math.max(0, Math.floor(setBelow)); y < h; y++) {
    let sum = 0
    let n = 0
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4
      sum += rgbToLab(data[i], data[i + 1], data[i + 2])[0]
      n += 1
    }
    rowL[y] = n > 0 ? sum / n : 0
  }
  for (let pass = 0; pass < 3; pass++) {
    const sums = LIT_ZONES.map(() => [0, 0, 0, 0])
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = tOf(x, y)
        if (t === null || !judged(x)) continue
        const z = LIT_ZONES.findIndex((q) => t >= q.t[0] && t < q.t[1])
        if (z < 0) continue
        const i = (y * w + x) * 4
        if (data[i + 3] < 64) continue
        const lab = rgbToLab(data[i], data[i + 1], data[i + 2])
        sums[z][0] += lab[0]
        sums[z][1] += lab[1]
        sums[z][2] += lab[2]
        sums[z][3] += 1
      }
    }
    const shifts = sums.map((s, z) =>
      s[3] === 0 ? [0, 0, 0] : targets[z].map((v, c) => v - s[c] / s[3]),
    )
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const edge = edgeAt(x + 0.5)
        // Above the edge the glow takes the top zone's move, fading out.
        const t =
          y + 0.5 < edge
            ? 1
            : (foam - (y + 0.5)) / Math.max(foam - edge, 0.1 * hpx)
        const shift = zoneAt(LIT_ZONES, 't', shifts, clamp(t, -0.15, 1))
        const i = (y * w + x) * 4
        const lab = rgbToLab(data[i], data[i + 1], data[i + 2])
        if (pass === 0 && y + 0.5 >= setBelow) {
          const target = zoneAt(LIT_ZONES, 't', targets, clamp(t, -0.15, 1))
          const texture = clamp(1.4 * (lab[0] - rowL[y]), -12, 40)
          const set = labToRgb(target[0] + texture, target[1], target[2])
          data[i] = set[0]
          data[i + 1] = set[1]
          data[i + 2] = set[2]
          continue
        }
        // Black stays black: the move is weighted by how much light is there.
        const k = smoothstep(lab[0] / 12)
        const rgb = labToRgb(
          lab[0] + k * shift[0],
          lab[1] + k * shift[1],
          lab[2] + k * shift[2],
        )
        data[i] = rgb[0]
        data[i + 1] = rgb[1]
        data[i + 2] = rgb[2]
      }
    }
  }
}

/** The lit zones' means on a plate, for the report (Lab, and dE to target). */
export function litZoneReport(img, edgeAt, foam, hpx, inWave) {
  const { width: w, height: h, data } = img
  const sums = LIT_ZONES.map(() => [0, 0, 0, 0])
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = edgeAt(x + 0.5)
      if (y + 0.5 < edge || !inWave(x + 0.5)) continue
      const t = (foam - (y + 0.5)) / Math.max(foam - edge, 0.1 * hpx)
      const z = LIT_ZONES.findIndex((q) => t >= q.t[0] && t < q.t[1])
      const i = (y * w + x) * 4
      if (z < 0 || data[i + 3] < 64) continue
      const lab = rgbToLab(data[i], data[i + 1], data[i + 2])
      for (let c = 0; c < 3; c++) sums[z][c] += lab[c]
      sums[z][3] += 1
    }
  }
  return sums.map((s, z) => {
    if (s[3] === 0) return { zone: LIT_ZONES[z].t, n: 0 }
    const mean = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]
    return {
      zone: LIT_ZONES[z].t,
      n: s[3],
      dE: Math.round(de2000(mean, hexLab(LIT_ZONES[z].hex)) * 100) / 100,
    }
  })
}

/**
 * Masked grading toward the unlit zones: each pixel's colour set by its
 * depth under `lineAt` (W), keeping a little of its own light as texture.
 * `inside(x, y)` says which pixels are water to grade.
 */
export function gradeUnlit(img, px, lineAt, inside) {
  const { width: w, height: h, data } = img
  const targets = UNLIT_ZONES.map((z) => hexLab(z.hex))
  // The source's own mean lightness by depth, so texture is kept about it.
  const bins = 64
  const sumL = new Float64Array(bins)
  const count = new Float64Array(bins)
  const binOf = (d) =>
    clamp(Math.floor(((d + 0.01) / 0.41) * bins), 0, bins - 1)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue
      const i = (y * w + x) * 4
      const d = (y + 0.5 - lineAt(x + 0.5)) / px
      const b = binOf(d)
      sumL[b] += rgbToLab(data[i], data[i + 1], data[i + 2])[0]
      count[b] += 1
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue
      const i = (y * w + x) * 4
      const d = (y + 0.5 - lineAt(x + 0.5)) / px
      const b = binOf(d)
      const meanL = count[b] > 0 ? sumL[b] / count[b] : 0
      const lab = rgbToLab(data[i], data[i + 1], data[i + 2])
      const target = zoneAt(UNLIT_ZONES, 'd', targets, d)
      // A little of the water's own light, its sparkles held down.
      const texture = clamp(0.12 * (lab[0] - meanL), -2.5, 3.5)
      const rgb = labToRgb(target[0] + texture, target[1], target[2])
      data[i] = rgb[0]
      data[i + 1] = rgb[1]
      data[i + 2] = rgb[2]
    }
  }
}

// ---- drawn plates (SVG, rendered by sharp) ----------------------------------

const fmt = (v) => (Math.round(v * 100) / 100).toString()

/** A plate's canvas: W units in, pixels out. */
function canvas(frame, pxPerW) {
  const width = Math.round(frame.width * pxPerW)
  const height = Math.round(frame.height * pxPerW)
  const X = (x) => (x - frame.left) * pxPerW
  const Y = (y) => (y - frame.top) * pxPerW
  const L = (w) => w * pxPerW
  return { width, height, X, Y, L }
}

function svgDoc(c, body, defs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}" viewBox="0 0 ${c.width} ${c.height}"><defs>${defs}</defs>${body}</svg>`
}

export async function renderSvg(svg) {
  const { data, info } = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data),
  }
}

/**
 * The sky's band colours on screen 1, by storyboard y (W): sampled clear of
 * the moon and the cliffs, every 0.02 H (L0's screen 1, 311 x 815).
 */
const SKY = [
  [0.0, '#070f1d'],
  [0.105, '#0a1a2e'],
  [0.157, '#0e213b'],
  [0.21, '#11233d'],
  [0.262, '#122643'],
  [0.314, '#142846'],
  [0.367, '#1c3152'],
  [0.419, '#22395d'],
  [0.472, '#2a4168'],
  [0.524, '#1d3458'],
  [0.577, '#162e51'],
  [0.629, '#132c4f'],
  [0.681, '#0d213f'],
  [0.734, '#0c2342'],
  [0.786, '#1b3963'],
]
/** The far sea under the horizon, by y (W). */
const FAR_SEA = [
  [0.8215, '#2a4a74'],
  [0.84, '#133157'],
  [0.891, '#102c4f'],
  [0.943, '#193960'],
  [0.996, '#1e3f67'],
  [1.048, '#122f51'],
  [1.1, '#0b1f38'],
  [1.153, '#0f192f'],
  [1.5, '#0a1a30'],
  [2.0, '#071629'],
  [2.8, '#050f1f'],
]

function stops(c, list, y0, y1) {
  return list
    .map(([y, colour]) => {
      const at = clamp((c.Y(y) - c.Y(y0)) / (c.Y(y1) - c.Y(y0)), 0, 1)
      return `<stop offset="${fmt(at * 100)}%" stop-color="${colour}"/>`
    })
    .join('')
}

/**
 * A rocky land profile: its top at each x, W, seeded. Three octaves of
 * smoothed noise over `topAt`, sloping down to the horizon over `taper`
 * at both ends, so a headland stands on the water and is not a box.
 */
function profile(rng, x0, x1, topAt, roughness, horizon, taper = 0.09) {
  const octaves = [
    { step: 0.06, amp: 1 },
    { step: 0.02, amp: 0.45 },
    { step: 0.007, amp: 0.2 },
  ].map((o) => ({
    ...o,
    knots: Array.from(
      { length: Math.ceil((x1 - x0) / o.step) + 2 },
      () => rng() - 0.5,
    ),
  }))
  const noise = (x) =>
    octaves.reduce((sum, o) => {
      const p = (x - x0) / o.step
      const i = Math.floor(p)
      const t = smoothstep(p - i)
      return sum + o.amp * (o.knots[i] * (1 - t) + o.knots[i + 1] * t)
    }, 0)
  const points = []
  const n = Math.max(8, Math.ceil((x1 - x0) / 0.003))
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n
    const edge = smoothstep(Math.min(x - x0, x1 - x) / taper)
    const top = topAt(x) + noise(x) * roughness
    points.push([x, horizon - (horizon - top) * edge])
  }
  return points
}

/**
 * The bay-back: sky, thin clouds, the cliffs (screen 1's
 * profiles: a headland under 0.21 W, low land to 0.44 W, open sea to 0.88
 * W, a headland past it; further right, as the bay scrolls, low cliffs and
 * a second headland), the horizon's bright line, the far sea with its
 * moonlight path, down past the sea-front's top.
 */
export function bayBackSvg(frame, px, bay) {
  const c = canvas(frame, px)
  const rng = seeded(31)
  const H = bay.aspect
  const horizon = bay.horizon
  const moon = bay.moon
  const top = frame.top
  const bottom = frame.top + frame.height
  let body = ''
  body += `<rect x="0" y="0" width="${c.width}" height="${fmt(c.Y(horizon))}" fill="url(#sky)"/>`
  body += `<rect x="0" y="${fmt(c.Y(horizon))}" width="${c.width}" height="${fmt(c.Y(bottom) - c.Y(horizon))}" fill="url(#sea)"/>`
  // Stars, faint, in the upper sky.
  for (let i = 0; i < 70; i++) {
    const x = frame.left + rng() * frame.width
    const y = top + 0.02 + rng() * (0.36 - top)
    body += `<circle cx="${fmt(c.X(x))}" cy="${fmt(c.Y(y))}" r="${fmt(c.L(0.0012 + rng() * 0.0016))}" fill="#c8d4f0" opacity="${fmt(0.25 + rng() * 0.45)}"/>`
  }
  // Thin clouds across the moon's band (the moon is its own plate,
  // moonSvg, drawn over this one by the room).
  for (let i = 0; i < 14; i++) {
    const x = frame.left + rng() * frame.width
    const y = 0.33 + rng() * 0.32
    const rx = 0.08 + rng() * 0.16
    body += `<ellipse cx="${fmt(c.X(x))}" cy="${fmt(c.Y(y))}" rx="${fmt(c.L(rx))}" ry="${fmt(c.L(rx * (0.12 + rng() * 0.1)))}" fill="#3a4f78" opacity="${fmt(0.16 + rng() * 0.16)}" filter="url(#soft)"/>`
  }
  // The cliffs: dark land standing on the horizon.
  const land = (points, fill) => {
    const d = [
      `M${fmt(c.X(points[0][0]))} ${fmt(c.Y(horizon + 0.004))}`,
      ...points.map(([x, y]) => `L${fmt(c.X(x))} ${fmt(c.Y(y))}`),
      `L${fmt(c.X(points[points.length - 1][0]))} ${fmt(c.Y(horizon + 0.004))}Z`,
    ].join('')
    // Moonlight catches each ridge: a thin pale rim along its top.
    const rim = points
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${fmt(c.X(x))} ${fmt(c.Y(y))}`)
      .join('')
    return `<path d="${d}" fill="${fill}"/><path d="${rim}" fill="none" stroke="#3a5a8a" stroke-opacity="0.45" stroke-width="${fmt(c.L(0.003))}" filter="url(#soft2)"/>`
  }
  const yH = (h) => h * H
  // A far ridge behind the cliffs, lower and lighter, all along the bay.
  body += land(
    profile(
      rng,
      frame.left,
      frame.left + frame.width,
      () => yH(0.285),
      0.025,
      horizon,
      0.02,
    ),
    '#0d1c36',
  )
  body += land(
    profile(
      rng,
      frame.left,
      0.215,
      (x) => yH(0.19 + 0.04 * smoothstep((x - 0.02) / 0.19)),
      0.05,
      horizon,
    ),
    '#060f20',
  )
  body += land(
    profile(rng, 0.2, 0.445, () => yH(0.236), 0.02, horizon, 0.03),
    '#08142a',
  )
  body += land(
    profile(
      rng,
      0.885,
      1.12,
      (x) => yH(0.25 - 0.025 * smoothstep((x - 0.885) / 0.1)),
      0.05,
      horizon,
    ),
    '#060f20',
  )
  body += land(
    profile(rng, 1.11, 1.36, () => yH(0.262), 0.02, horizon, 0.03),
    '#0a162c',
  )
  body += land(
    profile(
      rng,
      1.42,
      frame.left + frame.width,
      (x) => yH(0.24 - 0.03 * smoothstep((x - 1.42) / 0.12)),
      0.05,
      horizon,
    ),
    '#060f20',
  )
  // Warm specks at the cliffs' feet, as screen 1 has.
  for (const x of [0.05, 0.09, 0.13, 0.17, 0.95, 1.02]) {
    body += `<circle cx="${fmt(c.X(x))}" cy="${fmt(c.Y(horizon - 0.006))}" r="${fmt(c.L(0.002))}" fill="#e6a050" opacity="0.7"/>`
  }
  // The horizon's bright line.
  body += `<rect x="0" y="${fmt(c.Y(horizon - 0.002))}" width="${c.width}" height="${fmt(c.L(0.004))}" fill="#4a6a9a" opacity="0.55" filter="url(#soft2)"/>`
  // The moonlight path: short bright streaks under the moon.
  for (let i = 0; i < 160; i++) {
    const depth = rng() ** 1.6
    const y = horizon + 0.006 + depth * 0.5
    const spread = 0.02 + depth * 0.09
    const x = moon.cx + (rng() - 0.5) * 2 * spread
    const w = 0.01 + rng() * 0.04 * (1 - depth * 0.5)
    body += `<rect x="${fmt(c.X(x - w / 2))}" y="${fmt(c.Y(y))}" width="${fmt(c.L(w))}" height="${fmt(Math.max(1, c.L(0.0018)))}" fill="#b8c8ec" opacity="${fmt((0.55 - depth * 0.4) * (0.5 + rng() * 0.5))}"/>`
  }
  // Ripple streaks across the far sea.
  for (let i = 0; i < 260; i++) {
    const y = horizon + 0.01 + rng() * (bottom - horizon)
    const x = frame.left + rng() * frame.width
    const w = 0.02 + rng() * 0.08
    body += `<rect x="${fmt(c.X(x))}" y="${fmt(c.Y(y))}" width="${fmt(c.L(w))}" height="${fmt(Math.max(1, c.L(0.0016)))}" fill="#3d5f8c" opacity="${fmt(0.12 + rng() * 0.18)}"/>`
  }
  const defs = [
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stops(c, SKY, top, horizon)}</linearGradient>`,
    `<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">${stops(c, FAR_SEA, horizon, bottom)}</linearGradient>`,
    `<filter id="soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${fmt(c.L(0.012))}"/></filter>`,
    `<filter id="soft2" x="0" y="-200%" width="100%" height="500%"><feGaussianBlur stdDeviation="${fmt(c.L(0.002))}"/></filter>`,
  ].join('')
  return svgDoc(c, body, defs)
}

/** The moon's halo reaches this far, over the halo radius L0 measured. */
export const MOON_HALO_SPREAD = 2.2

/**
 * The moon: its halo, then its disc, at screen 1's measured size and
 * colour, centred in `frame` (MOON_HALO_SPREAD halo radii each way), on a
 * clear ground. The room slides it with the sky and shrinks it a little
 * in the run (bay-sky.ts), so it is a plate of its own.
 */
export function moonSvg(frame, px, moon) {
  const c = canvas(frame, px)
  const cx = frame.left + frame.width / 2
  const cy = frame.top + frame.height / 2
  const body =
    `<circle cx="${fmt(c.X(cx))}" cy="${fmt(c.Y(cy))}" r="${fmt(c.L(moon.halo * MOON_HALO_SPREAD))}" fill="url(#halo)"/>` +
    `<circle cx="${fmt(c.X(cx))}" cy="${fmt(c.Y(cy))}" r="${fmt(c.L(moon.d / 2))}" fill="url(#moon)"/>`
  const defs = [
    `<radialGradient id="halo"><stop offset="0%" stop-color="#9fb0d8" stop-opacity="0.5"/><stop offset="45%" stop-color="#5a6f9e" stop-opacity="0.22"/><stop offset="100%" stop-color="#2a4168" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="moon" cx="45%" cy="42%"><stop offset="0%" stop-color="#eef1f8"/><stop offset="70%" stop-color="${moon.core}"/><stop offset="100%" stop-color="#a9b6d2"/></radialGradient>`,
  ].join('')
  return svgDoc(c, body, defs)
}

/**
 * The sea-front: one tile a screen wide, its top the foam line, the near
 * water under it. Transparent only above the foam.
 */
export function seaFrontSvg(frame, px) {
  const c = canvas(frame, px)
  const rng = seeded(47)
  let body = `<rect x="0" y="0" width="${c.width}" height="${c.height}" fill="url(#near)"/>`
  // The foam line, soft and broken, wrapping at the tile's edges.
  for (let i = 0; i < 40; i++) {
    const x = rng()
    const w = 0.02 + rng() * 0.07
    const y = 0.03 + (rng() - 0.5) * 0.02
    for (const shift of [0, -1, 1]) {
      body += `<rect x="${fmt(c.L(x + shift))}" y="${fmt(c.L(y))}" width="${fmt(c.L(w))}" height="${fmt(c.L(0.004 + rng() * 0.003))}" rx="${fmt(c.L(0.002))}" fill="#9fd4ee" opacity="${fmt(0.12 + rng() * 0.22)}" filter="url(#foam)"/>`
    }
  }
  // Ripple streaks, shorter and dimmer with depth.
  for (let i = 0; i < 420; i++) {
    const depth = rng()
    const y = 0.02 + depth * (frame.height - 0.03)
    const x = rng()
    const w = 0.02 + rng() * 0.09 * (1 - depth * 0.5)
    for (const shift of [0, -1]) {
      body += `<rect x="${fmt(c.L(x + shift))}" y="${fmt(c.L(y))}" width="${fmt(c.L(w))}" height="${fmt(Math.max(1, c.L(0.0018)))}" fill="#2f5a8c" opacity="${fmt((0.32 - depth * 0.22) * (0.5 + rng() * 0.5))}"/>`
    }
  }
  const defs = [
    // Its top fades in over 0.06 W: the far sea runs into it with no seam.
    `<linearGradient id="near" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#07203e" stop-opacity="0"/><stop offset="${fmt((0.06 / frame.height) * 100)}%" stop-color="#07203e" stop-opacity="1"/><stop offset="100%" stop-color="#030e1c"/></linearGradient>`,
    `<filter id="foam" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="${fmt(c.L(0.0015))}"/></filter>`,
  ].join('')
  return svgDoc(c, body, defs)
}

/** One glass bubble: a thin bright ring, a faint fill, a highlight. */
export function bubbleSvg(size) {
  const r = size / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><radialGradient id="b" cx="50%" cy="50%" r="50%"><stop offset="60%" stop-color="#7fd8ff" stop-opacity="0.08"/><stop offset="88%" stop-color="#9fe6ff" stop-opacity="0.55"/><stop offset="100%" stop-color="#9fe6ff" stop-opacity="0"/></radialGradient></defs><circle cx="${r}" cy="${r}" r="${r - 1}" fill="url(#b)"/><ellipse cx="${fmt(r * 0.7)}" cy="${fmt(r * 0.62)}" rx="${fmt(r * 0.22)}" ry="${fmt(r * 0.14)}" fill="#ffffff" opacity="0.8" transform="rotate(-35 ${fmt(r * 0.7)} ${fmt(r * 0.62)})"/></svg>`
}

// ---- the result ---------------------------------------------------------------

/**
 * Screen 4 as Gemini drew it (rows 0.16 to 0.84 H of the screen), on the
 * whole frame: above it the sky darkens to screen 4's own top colour,
 * under it the sea darkens to its bottom colour, each band blended in
 * from the picture's own edge rows.
 */
export async function resultImage(src, px, view) {
  const width = Math.round(px)
  const height = Math.round(view.aspect * px)
  const top = Math.round(view.pickTop * px)
  const pickH = Math.round(view.pickHeight * px)
  const pick = await readImage(src, width, pickH)
  const out = blank(width, height)
  const rowMean = (y) => {
    const m = [0, 0, 0]
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) m[c] += pick.data[(y * width + x) * 4 + c]
    }
    return m.map((v) => v / width)
  }
  const topEdge = rowMean(0)
  const bottomEdge = rowMean(pickH - 1)
  const skyTop = hex(view.skyTop)
  const seaBottom = hex(view.seaBottom)
  const rng = seeded(59)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const py = y - top
      if (py >= 0 && py < pickH) {
        const j = (py * width + x) * 4
        out.data[i] = pick.data[j]
        out.data[i + 1] = pick.data[j + 1]
        out.data[i + 2] = pick.data[j + 2]
      } else {
        const above = py < 0
        const edgeRow = above ? 0 : pickH - 1
        const k = above
          ? smoothstep(-py / Math.max(1, top))
          : smoothstep((py - pickH) / Math.max(1, height - top - pickH))
        // The edge row's own texture fades out over the first 0.05 W.
        const tex =
          1 - smoothstep(Math.abs(above ? py : py - pickH) / (0.05 * px))
        const j = (edgeRow * width + x) * 4
        const base = above ? topEdge : bottomEdge
        const far = above ? skyTop : seaBottom
        for (let c = 0; c < 3; c++) {
          const mean = lerp(base[c], far[c], k)
          out.data[i + c] = clamp(
            Math.round(mean + tex * (pick.data[j + c] - base[c])),
            0,
            255,
          )
        }
      }
      out.data[i + 3] = 255
    }
  }
  // A few stars in the extended sky.
  for (let s = 0; s < 40; s++) {
    const x = Math.floor(rng() * width)
    const y = Math.floor(rng() * top * 0.9)
    const i = (y * width + x) * 4
    const v = 110 + Math.floor(rng() * 90)
    out.data[i] = Math.max(out.data[i], v)
    out.data[i + 1] = Math.max(out.data[i + 1], v)
    out.data[i + 2] = Math.max(out.data[i + 2], v + 30)
  }
  return out
}

/** The result's waves' top edge (W), the highest of the three at each x. */
export function resultEnvelope(view) {
  return (x) => {
    let best = Number.POSITIVE_INFINITY
    for (const w of view.waves) {
      const y = w.crestY + w.h * (1 - waveG((x - w.x) / w.a, w.f))
      best = Math.min(best, y)
    }
    return best
  }
}

export function copyImage(img) {
  return {
    width: img.width,
    height: img.height,
    data: new Uint8ClampedArray(img.data),
  }
}

export function cropRows(img, top, height) {
  const out = blank(img.width, height)
  out.data.set(
    img.data.subarray(top * img.width * 4, (top + height) * img.width * 4),
  )
  return out
}
