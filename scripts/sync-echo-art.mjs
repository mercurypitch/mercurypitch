#!/usr/bin/env node
// ============================================================
// Echo's art, from the A0 folder into the room
// ============================================================
//
// The Echo room's plates and sprites are painted and measured outside the
// repo (the A0 art folder: final/ for the webp files, geometry/ for where
// everything sits). This copies the files the room ships into
// src/features/echo/art/ and writes the numbers the room draws with:
//
//   src/features/echo/echo-geometry.ts         the plate, the ridge, Merc's
//                                              seat, the sky's floor, the
//                                              twinkles, the top light, the
//                                              strokes, the sprites, the
//                                              result slots, the cloud
//                                              layer's fades, the city
//                                              light's boxes and fades
//   src/features/echo/echo-celebration.ts      the celebration star
//   src/features/echo/echo-celebration-sparkles.ts  its small sparkles
//   src/features/echo/fixture/fixture-scenes.ts  the storyboard's frames,
//                                              pinned, for the dev-only
//                                              fixtures the fidelity
//                                              measure renders
//
// Re-run it whenever the art changes; nothing it writes is edited by hand.
// The tablet plates are not copied: the room wires them in a later change
// (ART-FIDELITY.md 3.7, PR 5).
//
//   node scripts/sync-echo-art.mjs <echo-a0 folder>

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const SOURCE = process.argv[2]
if (SOURCE === undefined || !existsSync(join(SOURCE, 'final'))) {
  console.error('usage: node scripts/sync-echo-art.mjs <echo-a0 folder>')
  process.exit(2)
}
const A0 = resolve(SOURCE)
const ART = join(ROOT, 'src/features/echo/art')
const GEOMETRY_OUT = join(ROOT, 'src/features/echo/echo-geometry.ts')
const CELEBRATION_OUT = join(ROOT, 'src/features/echo/echo-celebration.ts')
const SPARKLES_OUT = join(
  ROOT,
  'src/features/echo/echo-celebration-sparkles.ts',
)
const FIXTURE_OUT = join(ROOT, 'src/features/echo/fixture/fixture-scenes.ts')

const json = (path) => JSON.parse(readFileSync(join(A0, path), 'utf8'))
const GEO = json('geometry/echo-geometry.json')
const STROKES = json('geometry/echo-strokes.json')
const PINS = json('geometry/echo-storyboard-pins.json')
const CHOICES = json('geometry/fixture-choices.json')
const STAR = json('geometry/echo-celebration-star.json')
const CLOUDS = json('geometry/echo-cloud-layer.json')
const CITY = json('geometry/echo-citylight-layer.json')
const MASTER = json('masters/echo-world-phone-1290x3096.json')

// ---- numbers as the A0 tools compute them --------------------------------

/** Python's round(): halves go to the even neighbour. */
function pyRound(x) {
  const f = Math.floor(x)
  const d = x - f
  if (d > 0.5) return f + 1
  if (d < 0.5) return f
  return f % 2 === 0 ? f : f + 1
}

const BASE = { w: GEO.plate.w, h: GEO.plate.h }

/** a0lib.plate_box: where a screen's alignment puts the plate. */
function plateBox(screen) {
  const al = GEO.screens[String(screen)]
  const cw = Math.max(8, pyRound(al.w * al.scale))
  const ch = Math.max(8, pyRound((BASE.h * cw) / BASE.w))
  const ox = pyRound((al.w - cw) / 2 + al.tx)
  return { ox, oy: al.ty, cw, ch }
}

/** Storyboard px on a screen to plate fractions (a0lib.screen_to_plate). */
function toPlate(screen, x, y) {
  const box = plateBox(screen)
  return [(x - box.ox) / box.cw, (y - box.oy) / box.ch]
}

/** Storyboard px on a screen to a fraction of the screen width. */
const toW = (screen, px) => px / plateBox(screen).cw

const r4 = (x) => Math.round(x * 1e4) / 1e4
const r5 = (x) => Math.round(x * 1e5) / 1e5
const pt = ([u, v]) => [r4(u), r4(v)]

// ---- 1. the files ---------------------------------------------------------

const SHIPPED = readdirSync(join(A0, 'final'))
  .filter((name) => name.endsWith('.webp') && !name.includes('tablet'))
  .sort()
mkdirSync(ART, { recursive: true })
const files = []
for (const name of SHIPPED) {
  const from = join(A0, 'final', name)
  copyFileSync(from, join(ART, name))
  const bytes = readFileSync(from)
  const sha = createHash('sha256').update(bytes).digest('hex').slice(0, 16)
  const meta = await sharp(bytes).metadata()
  files.push({ name, bytes: bytes.length, w: meta.width, h: meta.height, sha })
}

// ---- 2. the sprites: canvas, tip-to-tip width, alpha centroid ------------

async function spriteFrame(name) {
  const { data, info } = await sharp(join(ART, name))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let minX = Infinity
  let maxX = -Infinity
  let sx = 0
  let sy = 0
  let n = 0
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] <= 127) continue
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      sx += x + 0.5
      sy += y + 0.5
      n += 1
    }
  }
  return {
    canvas: info.width,
    tip: maxX - minX + 1,
    cx: sx / n,
    cy: sy / n,
  }
}

const SIZES = ['phrase', 'result', 'finished']
const sprites = {}
for (const size of SIZES) {
  const star = await spriteFrame(`echo-star-${size}-base.webp`)
  const halo = await sharp(join(ART, `echo-halo-${size}.webp`)).metadata()
  const off = Math.max(
    Math.abs(star.cx - star.canvas / 2),
    Math.abs(star.cy - star.canvas / 2),
  )
  if (off > 1.5) {
    throw new Error(
      `${size} star: alpha centroid ${off.toFixed(2)} px off centre`,
    )
  }
  sprites[size] = { canvas: star.canvas, tip: star.tip, halo: halo.width }
}

// ---- 3. the fallback: the world plate's band colours ---------------------

async function bandColours(name, bands) {
  const { data, info } = await sharp(join(ART, name))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const stops = []
  for (let b = 0; b < bands; b++) {
    const y0 = Math.floor((b * info.height) / bands)
    const y1 = Math.floor(((b + 1) * info.height) / bands)
    const sum = [0, 0, 0]
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 3
        sum[0] += data[i]
        sum[1] += data[i + 1]
        sum[2] += data[i + 2]
      }
    }
    const n = (y1 - y0) * info.width
    const at = Math.round(((b + 0.5) / bands) * 1000) / 10
    stops.push(`rgb(${sum.map((s) => Math.round(s / n)).join(', ')}) ${at}%`)
  }
  return `linear-gradient(to bottom, ${stops.join(', ')})`
}

const worldFallback = await bandColours('echo-world-860.webp', 12)
const resultFallback = await bandColours('echo-world-result-860.webp', 12)

// ---- 4. strokes -----------------------------------------------------------

function stroke(style) {
  const s = STROKES[style]
  const layer = (l) => ({
    rgb: l.rgb,
    opacity: l.opacity,
    widthW: l.width_W,
    sigmaW: l.blur_sigma_W,
  })
  return {
    core: layer(s.core),
    glow: layer(s.glow),
    fill:
      s.fill === undefined
        ? null
        : {
            rgb: s.fill.rgb,
            opacity: s.fill.opacity_at_rim,
            lambdaW: s.fill.lambda_W,
          },
    radiusW: s.radius_W === undefined ? null : r5(s.radius_W[0]),
  }
}

// ---- 5. the result slots: screen 4's five constellations -----------------

function resultSlots() {
  const p4 = PINS['4']
  const parent = p4.stars.map((_, i) => i)
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (const [a, b, f] of p4.links) if (f >= 0.9) parent[find(a)] = find(b)
  const groups = new Map()
  p4.stars.forEach((star, i) => {
    const key = find(i)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(toPlate(4, star.x, star.y))
  })
  const slots = [...groups.values()].map((points) => {
    const us = points.map((p) => p[0])
    const vs = points.map((p) => p[1])
    return {
      u0: r4(Math.min(...us)),
      u1: r4(Math.max(...us)),
      v0: r4(Math.min(...vs)),
      v1: r4(Math.max(...vs)),
      stars: points.length,
    }
  })
  // Reading order: top row left to right, then the next.
  return slots.sort((a, b) =>
    Math.abs(a.v0 - b.v0) > 0.04 ? a.v0 - b.v0 : a.u0 - b.u0,
  )
}

// ---- 6. the celebration star (art round 4, the spec's r3 block) ---------

/** '#rrggbb' to [r, g, b]. */
const hexRgb = (hex) =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
/** The colour a spec's model takes away ('- #rrggbb'): its reference. */
const hexIn = (text) => hexRgb(/-\s*(#[0-9a-f]{6})/iu.exec(text)[1])
const uvOf = ([u, v]) => ({ u: r5(u), v: r5(v) })
/** The number a spec's prose gives after `word` (the twinkle's seed). */
const numberAfter = (text, word) =>
  Number(new RegExp(`${word}\\s+(\\d+)`, 'u').exec(text)[1])

/** An sRGB channel (0..255) in linear light, and back. */
const lin = (c) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const unlin = (l) => {
  const v = Math.min(1, Math.max(0, l))
  return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)
}

/** A piecewise-linear profile ([r, alpha] pairs) at `r`, flat past its ends. */
function profileAt(profile, r) {
  if (r <= profile[0][0]) return profile[0][1]
  for (let i = 1; i < profile.length; i++) {
    const [r1, a1] = profile[i]
    if (r <= r1) {
      const [r0, a0] = profile[i - 1]
      return r1 === r0 ? a1 : a0 + ((a1 - a0) * (r - r0)) / (r1 - r0)
    }
  }
  return profile[profile.length - 1][1]
}

/** A glow's gradient: this many rings, then black at its edge. */
const LIGHT_RINGS = 24

/**
 * The glows' colours for `mix-blend-mode: screen`, fitted to the result
 * plate. A0 adds a glow's light in linear RGB over whatever lies under it,
 * (glow - reference) x alpha(r); CSS cannot add in linear light, and an
 * sRGB step worked out over the reference colour overshoots wherever the
 * plate is brighter than it (the starburst sits on a lit spire). So each
 * ring of a glow's radial gradient gets the screen colour s that, over the
 * plate's own pixels in that ring, comes closest to A0's sum: per channel,
 * s = sum((1 - b)(t - b)) / sum((1 - b)^2), b the backdrop and t the sum.
 * The glows are fitted in A0's order, each over the ones before it; a
 * layer with `over` (the starburst's mist, round 4) is laid over the
 * backdrop in its place in that order, so the glows after it are fitted
 * to what they light.
 */
async function fitLights(lights) {
  const { data, info } = await sharp(join(ART, 'echo-world-result-1290.webp'))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const centreOf = (l) => [
    l.u * width,
    height - (1 - l.v) * BASE.h * (width / BASE.w),
  ]
  const lit = new Float64Array(width * height * 3)
  for (let i = 0; i < lit.length; i++) lit[i] = lin(data[i])
  const fitted = []
  for (const l of lights) {
    const [cx, cy] = centreOf(l)
    if (l.over !== undefined) {
      // A layer laid over (source-over in sRGB, as A0's over()): it is no
      // glow to fit, but it is what the glows after it light.
      const reach = l.reachW * width
      const y0 = Math.max(0, Math.floor(cy - reach))
      const y1 = Math.min(height, Math.ceil(cy + reach))
      const x0 = Math.max(0, Math.floor(cx - reach))
      const x1 = Math.min(width, Math.ceil(cx + reach))
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const at = l.over((x + 0.5 - cx) / width, (y + 0.5 - cy) / width)
          const a = Math.min(1, Math.max(0, at))
          if (a <= 0) continue
          for (let c = 0; c < 3; c++) {
            const i = (y * width + x) * 3 + c
            lit[i] = lin(unlin(lit[i]) * (1 - a) + l.rgb[c] * a)
          }
        }
      }
      continue
    }
    const reach = l.reachW * width
    const delta = [0, 1, 2].map((c) =>
      Math.max(0, lin(l.rgb[c]) - lin(l.reference[c])),
    )
    const num = Array.from({ length: LIGHT_RINGS + 1 }, () => [0, 0, 0])
    const den = Array.from({ length: LIGHT_RINGS + 1 }, () => [0, 0, 0])
    const [x0, x1] = [
      Math.max(0, Math.floor(cx - reach)),
      Math.min(width, Math.ceil(cx + reach)),
    ]
    const [y0, y1] = [
      Math.max(0, Math.floor(cy - reach)),
      Math.min(height, Math.ceil(cy + reach)),
    ]
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
        if (r > reach) continue
        const alpha = l.alphaAt(r / width)
        const ring = Math.round((r / reach) * LIGHT_RINGS)
        for (let c = 0; c < 3; c++) {
          const i = (y * width + x) * 3 + c
          const b = unlin(lit[i]) / 255
          lit[i] += alpha * delta[c]
          const t = unlin(lit[i]) / 255
          num[ring][c] += (1 - b) * (t - b)
          den[ring][c] += (1 - b) ** 2
        }
      }
    }
    const screen = num.map((n, ring) =>
      n.map((v, c) => {
        if (ring === LIGHT_RINGS || den[ring][c] === 0) return 0
        return Math.round(255 * Math.min(1, Math.max(0, v / den[ring][c])))
      }),
    )
    fitted.push({ reachW: r5(l.reachW), screen })
  }
  return fitted
}

/** Screen 4 px in W (r3.units.screen4_px: "one is 0.003436 W"). */
const SCREEN4_PX_W = Number(
  /one is ([\d.]+) W/u.exec(STAR.r3.units.screen4_px)[1],
)
/** The starburst's right ray stops short of the result plate's lit spire. */
const RIGHT_RAY_MAX_PX = 2.5

/** The star's layers in the order the room paints them (CelebrationStar.tsx). */
const STAR_ORDER = [
  'glow',
  'hollow_fill',
  'inner_outline',
  'blotches',
  'outer_outline',
]

/**
 * Round 5's star: the outer outline lopsided (each corner's radius factor
 * and turn, counter-clockwise on screen from the top tip), the inner
 * outline's opacity and the blue blotches inside. A paint order the room
 * does not follow stops the sync.
 */
function starRound5(star) {
  const order = star.draw_order ?? STAR_ORDER.filter((l) => l !== 'blotches')
  const known = STAR_ORDER.filter((l) => order.includes(l))
  if (JSON.stringify(order) !== JSON.stringify(known)) {
    throw new Error(`the star's draw order ${order}: the room paints ${known}`)
  }
  const lop = star.outer_outline.lopsided
  const radiusCcw = lop?.radius_factors ?? Array(10).fill(1)
  const turnCcwDeg = lop?.turn_deg_ccw ?? Array(10).fill(0)
  if (radiusCcw.length !== 10 || turnCcwDeg.length !== 10) {
    throw new Error('the lopsided outline wants 10 factors and 10 turns')
  }
  return {
    lopsided: { radiusCcw, turnCcwDeg },
    innerAlpha: star.inner_outline.alpha ?? 1,
    blotches: (star.blotches?.items ?? []).map((b) => ({
      centreR: b.centre_R,
      sigmaR: b.sigma_R,
      alpha: b.alpha,
      rgb: hexRgb(b.hex),
    })),
  }
}

/** A ribbon's gain per link, one per pair of its points (round 5). */
function segmentGain(rb) {
  const links = rb.through_uv.length - 1
  const gain = rb.segment_gain ?? Array(links).fill(1)
  if (gain.length !== links) {
    throw new Error(`a ribbon of ${links} links has ${gain.length} gains`)
  }
  return gain
}

/**
 * Round 5's sparkles: screen 4's smaller lights along the chains, drawn as
 * the dots are, each revealed a delay after the dot it names (after_dot,
 * a dot's index, taken here to that dot's reveal rank).
 */
function sparkles(draw) {
  const items = draw.sparkles ?? []
  if ((draw.counts.sparkles ?? 0) !== items.length) {
    throw new Error(
      `${items.length} sparkles, the spec counts ${draw.counts.sparkles}`,
    )
  }
  const rankOf = new Map(draw.dots.map((d) => [d.i, d.reveal_rank]))
  return items.map((sp) => {
    if (!rankOf.has(sp.after_dot)) {
      throw new Error(
        `sparkle ${sp.j} follows dot ${sp.after_dot}: no such dot`,
      )
    }
    return {
      ...uvOf(sp.uv),
      rgb: hexRgb(sp.hex),
      coreFwhmW: sp.core_fwhm_W,
      coreAlpha: sp.core_alpha,
      glowFwhmW: sp.glow_fwhm_W,
      glowAlpha: sp.glow_alpha,
      afterRank: rankOf.get(sp.after_dot),
    }
  })
}

/** The sparkles' reveal and twinkle (r3.timing_ms, round 5). */
function sparkleTiming(timing) {
  const { sparkles: sp, idle } = timing
  if (sp === undefined) return null
  const { opacity, scale } = sp.each
  if (opacity[0] !== 0 || opacity[1] !== 1 || scale[1] !== 1) {
    throw new Error('a sparkle comes up from 0 to 1 and settles at scale 1')
  }
  return {
    delayMs: sp.delay_ms,
    durationMs: sp.each.duration_ms,
    fromScale: scale[0],
    idleOpacity: idle.sparkles_twinkle.opacity,
    idlePeriodMs: idle.sparkles_twinkle.period_ms,
    idleSeed: numberAfter(idle.sparkles_twinkle.per_sparkle, 'seed'),
  }
}

/**
 * The celebration star as art round 5 left it (the spec's r3 block,
 * r3.draw, plate fractions and W): a hollow double-outline star in its
 * glow, its outer outline lopsided, its inner outline lumpy and blue
 * blotches inside; 33 sparkle dots in reveal order, each its own size and
 * brightness, three of them moved off the lit spire (r3.dot_moves, already
 * in their places); three thin wispy ribbons along the dot chains, each
 * link at its own gain; and the starburst, a cyan mist under a glow, four
 * rays and four diagonal ones, and a core; with r3.timing_ms. The
 * sparkles are sparkles(). The 12 Oct look (superseded_12oct) is not
 * read. A part of the spec the room does not draw stops the sync.
 */
async function celebration() {
  const { draw, timing_ms: timing } = STAR.r3
  const { star, dots, starburst, ribbons } = draw
  const sigma = (fwhm) => fwhm / 2.3548
  const burstReachW =
    3 * Math.max(...starburst.glow.map((g) => sigma(g.fwhm_W)))
  const starProfile = star.glow.alpha_by_radius_W
  const { mist } = starburst
  if ((star.hollow_fill.lumps?.depth ?? 0) !== 0) {
    throw new Error('the hollow fill has lumps: the room does not draw them')
  }
  const right = starburst.rays.length_W.right / SCREEN4_PX_W
  if (right > RIGHT_RAY_MAX_PX + 0.01) {
    throw new Error(
      `the right ray is ${right.toFixed(2)} screen 4 px: over ${RIGHT_RAY_MAX_PX}`,
    )
  }
  const [mistDx, mistDy] = mist.centre_offset_W
  /** The mist's alpha at (x, y) W from the starburst, y down (its spec's model). */
  const mistAt = (x, y) => {
    const dx = x - mistDx
    const dy = y - mistDy
    const t = Math.atan2(-dy, dx)
    return (
      mist.alpha *
      Math.exp(-(dx * dx + dy * dy) / (2 * mist.sigma_W ** 2)) *
      (1 - mist.right_cut * Math.max(Math.cos(t), 0) ** 2) *
      (1 -
        mist.streaks.depth * (0.5 + 0.5 * Math.cos(mist.streaks.n * t + 0.6)))
    )
  }
  // Out to 4 sigma: the mist is strong (alpha 0.95), and at 3 its edge
  // would still be a 1 % step.
  const mistReachW = Math.hypot(mistDx, mistDy) + 4 * mist.sigma_W
  const [starGlow, burstGlow] = await fitLights([
    {
      ...uvOf(star.centre_uv),
      reachW: starProfile[starProfile.length - 1][0],
      rgb: hexRgb(star.glow.glow_hex),
      reference: hexRgb(star.glow.sky_hex),
      alphaAt: (r) => profileAt(starProfile, r),
    },
    {
      ...uvOf(starburst.centre_uv),
      reachW: mistReachW,
      rgb: hexRgb(mist.hex),
      over: mistAt,
    },
    {
      ...uvOf(starburst.centre_uv),
      reachW: burstReachW,
      rgb: hexRgb(starburst.glow_hex),
      reference: hexIn(starburst.glow_model),
      alphaAt: (r) =>
        starburst.glow.reduce(
          (sum, g) =>
            sum + g.gain * Math.exp(-(r * r) / (2 * sigma(g.fwhm_W) ** 2)),
          0,
        ),
    },
  ])
  const outline = (o) => ({
    valleyOverTip: o.valley_over_tip,
    strokeW: o.stroke_W,
    top: hexRgb(o.top_hex),
    bottom: hexRgb(o.bottom_hex),
  })
  const twinkle = timing.idle.dots_twinkle
  const wobble = star.inner_outline.wobble?.radius_factors ?? Array(10).fill(1)
  if (wobble.length !== 10) {
    throw new Error('the inner outline wants 10 radius factors')
  }
  const round5 = starRound5(star)
  return {
    star: {
      ...uvOf(star.centre_uv),
      tipW: star.outer_outline.tip_radius_W,
      outer: {
        ...outline(star.outer_outline),
        lopsided: round5.lopsided,
      },
      inner: {
        scale: star.inner_outline.scale,
        ...outline(star.inner_outline),
        alpha: round5.innerAlpha,
        wobbleCcw: wobble,
      },
      blotches: round5.blotches,
      fill: {
        rgb: hexRgb(star.hollow_fill.hex),
        alpha: star.hollow_fill.alpha,
      },
      glow: starGlow,
    },
    dots: dots
      .map((d) => ({
        ...uvOf(d.uv),
        rgb: hexRgb(d.hex),
        coreFwhmW: d.core_fwhm_W,
        coreAlpha: d.core_alpha ?? 1,
        glowFwhmW: d.glow_fwhm_W,
        glowAlpha: d.glow_alpha,
        rank: d.reveal_rank,
      }))
      .sort((a, b) => a.rank - b.rank),
    ribbons: ribbons.map((rb) => ({
      points: rb.through_uv.map(pt),
      fwhmW: rb.stroke_fwhm_W,
      rgb: hexRgb(rb.hex),
      alpha: rb.alpha,
      segmentGain: segmentGain(rb),
      wisp: {
        depth: rb.wisp.depth,
        periodW: rb.wisp.period_W,
        phase: rb.wisp.phase_rad,
      },
      taperW: rb.taper_W,
    })),
    burst: {
      ...uvOf(starburst.centre_uv),
      core: { fwhmW: starburst.core.fwhm_W, rgb: hexRgb(starburst.core.hex) },
      mist: {
        offsetW: [r5(mistDx), r5(mistDy)],
        sigmaW: mist.sigma_W,
        alpha: mist.alpha,
        rgb: hexRgb(mist.hex),
        rightCut: mist.right_cut,
        streaks: { n: mist.streaks.n, depth: mist.streaks.depth },
      },
      glow: burstGlow,
      rays: {
        lengthW: starburst.rays.length_W,
        widthFwhmW: starburst.rays.width_fwhm_W,
        rgb: hexRgb(starburst.rays.hex),
        diagonal: {
          lengthW: starburst.rays.diagonal?.length_W ?? 0,
          alpha: starburst.rays.diagonal?.alpha ?? 0,
        },
      },
    },
    timing: {
      burst: {
        coreScale: timing.starburst.core_scale,
        glowOpacity: timing.starburst.glow_opacity,
        raysLength: timing.starburst.rays_length,
      },
      mist: {
        opacity: timing.mist.opacity,
        scale: timing.mist.scale,
      },
      dots: {
        firstMs: timing.dots.first_ms,
        staggerMs: timing.dots.stagger_ms,
        durationMs: timing.dots.each.duration_ms,
        fromScale: timing.dots.each.scale[0],
      },
      ribbons: {
        fromMs: timing.ribbons.from_ms,
        durationMs: timing.ribbons.duration_ms,
        staggerMs: timing.ribbons.stagger_ms,
      },
      sparkles: sparkleTiming(timing),
      star: {
        outer: timing.star.outer_outline_draw,
        inner: timing.star.inner_outline_draw,
        fill: timing.star.hollow_fill_opacity,
        glow: timing.star.glow_opacity,
      },
      idleFromMs: timing.idle_from_ms,
      idle: {
        dotOpacity: twinkle.opacity,
        dotPeriodMs: twinkle.period_ms,
        dotSeed: numberAfter(twinkle.per_dot, 'seed'),
        glowOpacity: timing.idle.star_glow_breathe.opacity,
        glowPeriodMs: timing.idle.star_glow_breathe.period_ms,
        raysScale: timing.idle.starburst_rays_shimmer.length_scale,
        raysPeriodMs: timing.idle.starburst_rays_shimmer.period_ms,
        wispRadPerS: timing.idle.ribbons_wisp_drift.phase_rad_per_s,
      },
    },
  }
}

/** The cloud layer: its opacity per state and its fades (echo-cloud-layer.json). */
function cloudLayer() {
  const fades = CLOUDS.fades_ms
  return {
    opacity: Object.fromEntries(
      Object.entries(CLOUDS.states).map(([state, s]) => [state, s.opacity]),
    ),
    inMs: fades.intro_end.duration_ms,
    crossMs: fades.between_layers.duration_ms,
    outMs: fades.to_no_layer.duration_ms,
  }
}

/** The shipped plate's box in px at a width: the base frame and its sky. */
const plateRows = (width) => ((BASE.h + MASTER.extension_rows) * width) / BASE.w

/**
 * A city-light crop as shipped: the room imports it by the name
 * echo-citylight-<state>-<plate width>.webp, so a spec that names it
 * otherwise, or a file whose size is not the spec's, stops the sync. Its
 * width in px, for the crop's `w` descriptor.
 */
function shippedCrop(state, f, plateWidth) {
  const name = `echo-citylight-${state}-${plateWidth}.webp`
  const file = files.find((c) => c.name === f.name)
  if (f.name !== name || file === undefined) {
    throw new Error(
      `the ${state} city light is ${f.name}: the room loads ${name}`,
    )
  }
  if (file.w !== f.w || file.h !== f.h) {
    throw new Error(
      `${name} is ${file.w}x${file.h}, the spec says ${f.w}x${f.h}`,
    )
  }
  return file.w
}

/**
 * The city light (echo-citylight-layer.json, art round 5): one small
 * transparent layer per state, laid over the plate and that state's
 * clouds at the state's opacity. Its box is in fractions of the shipped
 * plate's own box (sky rows included), the same at both widths; the sync
 * stops if the two widths disagree by half a px, or if the spec asks for a
 * blend or a drift the room does not draw.
 */
function cityLight() {
  if (CITY.drift.px_per_s !== 0) {
    throw new Error('the city light drifts: the room does not move it')
  }
  if (!CITY.blend.startsWith('source-over')) {
    throw new Error(`the city light's blend is ${CITY.blend}`)
  }
  const box = (f, width) => {
    const rows = plateRows(width)
    return [f.x / width, f.y / rows, f.w / width, f.h / rows]
  }
  const layers = {}
  for (const [state, crops] of Object.entries(CITY.files)) {
    const big = box(crops.phone_1290x3096, 1290)
    const small = box(crops.phone_860x2064, 860)
    const off = Math.max(...big.map((b, i) => Math.abs(b - small[i]) * 1290))
    if (off > 0.75) {
      throw new Error(`${state}'s city light: its widths are ${off} px apart`)
    }
    const [left, top, width, height] = big.map(r5)
    const px = [
      shippedCrop(state, crops.phone_860x2064, 860),
      shippedCrop(state, crops.phone_1290x3096, 1290),
    ]
    layers[state] = { left, top, width, height, px }
  }
  const fades = CITY.fades_ms
  return {
    opacity: Object.fromEntries(
      Object.entries(CITY.states).map(([state, s]) => [state, s.opacity]),
    ),
    layers,
    crossMs: fades.between_states.duration_ms,
    crossEase: fades.between_states.ease,
    outMs: fades.to_result.duration_ms,
    outEase: fades.to_result.ease,
  }
}

// ---- 7. the fixtures: the storyboard's frames, pinned --------------------

/** A fixture star: its pin less its anchor, in plate fractions. */
function fixtureStar(screen, pin, key) {
  const c = CHOICES.stars[key]
  const [u, v] = toPlate(screen, pin.x - c.anchor_dx, pin.y - c.anchor_dy)
  return {
    u: r4(u),
    v: r4(v),
    widthW: r5(toW(screen, c.width)),
    size: c.size,
    tint: c.tint,
  }
}

function smoothPath(points, n = 5) {
  const half = Math.floor(n / 2)
  const out = points.map((p, i) => {
    let sx = 0
    let sy = 0
    for (let k = -half; k <= half; k++) {
      const q = points[Math.max(0, Math.min(points.length - 1, i + k))]
      sx += q[0]
      sy += q[1]
    }
    return [sx / n, sy / n]
  })
  out[0] = [points[0][0], points[0][1]]
  out[out.length - 1] = [points.at(-1)[0], points.at(-1)[1]]
  return out
}

function fixtures() {
  const p1 = PINS['1']
  const p2 = PINS['2']
  const intro = {
    screen: 1,
    plate: 'world',
    clouds: null,
    cityLight: 'intro',
    celebration: false,
    merc: 'sing',
    rings: p1.rings.map((r) => {
      const [u, v] = toPlate(1, r.x, r.y)
      return { u: r4(u), v: r4(v), rW: r5(toW(1, 14.2)), style: 'waiting' }
    }),
    stars: [],
    lines: [],
    ribbon: null,
  }
  const lines = []
  for (const key of ['finishedTL', 'finishedTR']) {
    const st = p2[key].stars
    for (const [a, b, f] of p2[key].links) {
      if (f < 0.9) continue
      lines.push({
        a: pt(toPlate(2, st[a].x, st[a].y)),
        b: pt(toPlate(2, st[b].x, st[b].y)),
        style: 'finished',
      })
    }
  }
  const ps = p2.phraseStars
  lines.push({
    a: pt(toPlate(2, ps[0].x, ps[0].y)),
    b: pt(toPlate(2, ps[1].x, ps[1].y)),
    style: 'phrase',
  })
  const stars = []
  for (const key of ['finishedTL', 'finishedTR']) {
    p2[key].stars.forEach((pin, i) =>
      stars.push(fixtureStar(2, pin, `${key}${i}`)),
    )
  }
  ps.forEach((pin, i) => stars.push(fixtureStar(2, pin, `phrase${i}`)))
  const ar = p2.activeRing
  const [au, av] = toPlate(2, ar.x, ar.y)
  const midTake = {
    screen: 2,
    plate: 'world',
    clouds: 'mid-take',
    cityLight: 'mid-take',
    celebration: false,
    merc: 'listen',
    rings: [
      {
        u: r4(au),
        v: r4(av),
        rW: r5(toW(2, STROKES.ring_active.radius_px[0])),
        style: 'active',
      },
    ],
    stars,
    lines,
    ribbon: {
      points: smoothPath(p2.ribbon.map((p) => [p[0], p[1]])).map(([x, y]) =>
        pt(toPlate(2, x, y)),
      ),
      // The fixture convention: the shipped widths over the screen's own
      // world scale (mock_fixture.py, draw_ribbon).
      scale: r4(1 / GEO.screens['2'].scale),
      filling: true,
    },
  }
  // Screen 3, the demo's "not like this": the first note's star lit, the
  // flat second note's ring dark, the third's waiting, and the voice's
  // amber ribbon off the note. The room has no dark-filled ring of its own,
  // so the flat one takes the missed style at screen 3's radius.
  const p3 = PINS['3']
  const [darkRing, waitingRing] = [...p3.rings].sort((a, b) => b.r_px - a.r_px)
  const ring3 = (pin, style, key) => {
    const [u, v] = toPlate(3, pin.x, pin.y)
    return {
      u: r4(u),
      v: r4(v),
      rW: r5(toW(3, STROKES[key].radius_px[0])),
      style,
    }
  }
  const demoOff = {
    screen: 3,
    plate: 'world',
    clouds: 'demo-off',
    cityLight: 'demo-off',
    celebration: false,
    merc: 'listen',
    rings: [
      ring3(darkRing, 'missed', 'ring_dark_demo'),
      ring3(waitingRing, 'waiting', 'ring_waiting_screen3'),
    ],
    stars: p3.stars.map((pin, i) => fixtureStar(3, pin, `demo${i}`)),
    lines: [],
    ribbon: {
      points: smoothPath(p3.amberRibbon.map((p) => [p[0], p[1]])).map(
        ([x, y]) => pt(toPlate(3, x, y)),
      ),
      scale: r4(1 / GEO.screens['3'].scale),
      filling: false,
    },
  }
  const p4 = PINS['4']
  const resultLines = p4.links
    .filter(([, , f]) => f >= 0.9)
    .map(([a, b]) => ({
      a: pt(toPlate(4, p4.stars[a].x, p4.stars[a].y)),
      b: pt(toPlate(4, p4.stars[b].x, p4.stars[b].y)),
      style: 'result',
    }))
  const mr = p4.missedRing
  const [mu, mv] = toPlate(4, mr.x, mr.y)
  const result = {
    screen: 4,
    plate: 'result',
    clouds: null,
    cityLight: null,
    celebration: true,
    merc: 'celebrate',
    rings: [
      {
        u: r4(mu),
        v: r4(mv),
        rW: r5(toW(4, STROKES.ring_missed.radius_px[0])),
        style: 'missed',
      },
    ],
    stars: p4.stars.map((pin, i) => fixtureStar(4, pin, `result${i}`)),
    lines: resultLines,
    ribbon: null,
  }
  return { intro, 'mid-take': midTake, 'demo-off': demoOff, result }
}

// ---- 8. write ---------------------------------------------------------------

const celebrationSpec = await celebration()
const provenance = files
  .map(
    (f) => `//   ${f.name}  ${f.w}x${f.h}  ${f.bytes} bytes  sha256 ${f.sha}`,
  )
  .join('\n')

const ridge = GEO.ridge.polyline.map(pt)
const floor = GEO.openSkyFloor.u.map((u, i) => [u, GEO.openSkyFloor.v[i]])
const twinkles = GEO.twinkles.map((t) => ({
  u: t.u,
  v: t.v,
  peakL: t.peak_L,
}))

const geometry = `// ============================================================
// Echo's painted world, in numbers (generated)
// ============================================================
//
// Written by scripts/sync-echo-art.mjs from the Echo A0 art's geometry
// files; do not edit by hand, re-run the script when the art changes.
// Places are fractions of the plate's base frame (${BASE.w} x ${BASE.h}, the
// storyboard's 19.5:9), u across and v down. The shipped plate is that
// frame with ${MASTER.extension_rows} rows of sky painted above it. Sizes
// ending in W are fractions of the room's width. Merc's seat, the ridge
// and the sky's floor come from echo-geometry.json, the strokes from
// echo-strokes.json and the result slots from storyboard screen 4's pins.
// The celebration star is in echo-celebration.ts.
//
// The files this was written against:
${provenance}

export interface PlatePoint {
  readonly u: number
  readonly v: number
}

/** The base frame: the storyboard's screen, bottom-anchored. */
export const PLATE_BASE = { width: ${BASE.w}, height: ${BASE.h} } as const
/** The shipped plate's rows: the base frame and the sky above it. */
export const PLATE_ROWS = ${BASE.h + MASTER.extension_rows}

/** The sky above the plate's top row, for a screen taller than it. */
export const SKY_TOP_RGB = [${MASTER.top_row_mean_rgb.map((c) => Math.round(c)).join(', ')}] as const

/** The world plate's colours band by band, for its fallback. */
export const WORLD_FALLBACK = '${worldFallback}'
/** The result plate's, the same way. */
export const RESULT_FALLBACK = '${resultFallback}'

/** The foreground roof's ridge: left edge, finial, right edge. */
export const RIDGE: readonly (readonly [number, number])[] = ${JSON.stringify(ridge)}

/** Where Merc sits on the ridge. */
export const MERC_SEAT: PlatePoint = { u: ${GEO.mercSeat.u}, v: ${GEO.mercSeat.v} }

/**
 * The lowest place a star can sit without covering town or cloud, column
 * by column: [u, v] pairs.
 */
export const OPEN_SKY_FLOOR: readonly (readonly [number, number])[] = ${JSON.stringify(floor)}

/** The floor of the phrase's band: no ring or star lower than this. */
export const PHRASE_FLOOR_V = ${GEO.phraseFloor_v}

/** Faint painted stars that twinkle, with the painted star's peak L*. */
export const TWINKLES: readonly (PlatePoint & { readonly peakL: number })[] = ${JSON.stringify(twinkles)}

/**
 * The light under the island: a Gaussian of this colour, alpha at its
 * centre, centred across the screen and above its top edge (in W).
 */
export const TOP_LIGHT = {
  rgb: [${GEO.topLight.rgb.join(', ')}],
  alpha: ${GEO.topLight.alpha},
  centreYW: ${GEO.topLight.yc_W},
  sigmaXW: ${GEO.topLight.sx_W},
  sigmaYW: ${GEO.topLight.sy_W},
} as const

export interface StrokeLayer {
  readonly rgb: readonly number[]
  readonly opacity: number
  /** Width at the centre line, W. */
  readonly widthW: number
  /** The Gaussian blur on it, W. */
  readonly sigmaW: number
}

export interface StrokeStyle {
  readonly core: StrokeLayer
  readonly glow: StrokeLayer
  /** A ring's inner light, falling off by e every lambdaW inward; or null. */
  readonly fill: {
    readonly rgb: readonly number[]
    readonly opacity: number
    readonly lambdaW: number
  } | null
  /** A ring's radius, W; null for a line. */
  readonly radiusW: number | null
}

export const STROKES = {
  ringWaiting: ${JSON.stringify(stroke('ring_waiting'))},
  ringActive: ${JSON.stringify(stroke('ring_active'))},
  ringMissed: ${JSON.stringify(stroke('ring_missed'))},
  linePhrase: ${JSON.stringify(stroke('line_phrase'))},
  lineFinished: ${JSON.stringify(stroke('line_finished'))},
  lineResult: ${JSON.stringify(stroke('line_result'))},
} as const satisfies Record<string, StrokeStyle>

export type StarSize = 'phrase' | 'result' | 'finished'

/**
 * Each size's sprites: the star's canvas and its tip-to-tip width at alpha
 * over half (px), and the halo's canvas, padded equally round the star's
 * with the same centre. Every star's alpha centroid is its canvas centre.
 */
export const SPRITES: Readonly<
  Record<StarSize, { readonly canvas: number; readonly tip: number; readonly halo: number }>
> = ${JSON.stringify(sprites)}

/**
 * Each size's star, tip to tip, as the storyboard paints it on average (the
 * fixture choices' class widths: phrase and finished stars on screen 2,
 * result stars on screen 4), W.
 */
export const STAR_WIDTH_W: Readonly<Record<StarSize, number>> = ${JSON.stringify(
  {
    phrase: r5(toW(2, CHOICES.class_width_storyboard_px.phrase)),
    result: r5(toW(4, CHOICES.class_width_storyboard_px.result)),
    finished: r5(toW(2, CHOICES.class_width_storyboard_px.finished)),
  },
)}

/** Screen 4's five constellations, in reading order: their stars' extent. */
export const RESULT_SLOTS: readonly {
  readonly u0: number
  readonly u1: number
  readonly v0: number
  readonly v1: number
  readonly stars: number
}[] = ${JSON.stringify(resultSlots())}

/**
 * The cloud layer (echo-cloud-layer.json): its opacity per state, and its
 * fades in, between two states' layers, and out, ms.
 */
export const CLOUD_LAYER = ${JSON.stringify(cloudLayer())} as const

/**
 * The city light (echo-citylight-layer.json): the town's cyan light, one
 * small layer per state, over the state's clouds and under everything
 * drawn. Its opacity per state; each layer's box in fractions of the
 * shipped plate's box (left, top, width, height) and its files' widths
 * in px at the 860 and 1290 plates; the crossfade as the state changes and
 * the fade to the result, ms and CSS easing.
 */
export const CITY_LIGHT = ${JSON.stringify(cityLight())} as const
`

const celebrationFile = `// ============================================================
// Echo's celebration star, in numbers (generated)
// ============================================================
//
// Written by scripts/sync-echo-art.mjs from the Echo A0 art's
// echo-celebration-star.json (its r3 block, which art round 5 carries);
// do not edit by hand, re-run the script when the art changes. Places are
// fractions of the plate's base frame (echo-geometry.ts PLATE_BASE), u
// across and v down; sizes ending in W are fractions of the room's width.
// The glows' screen colours are fitted to the result plate
// (echo-world-result-1290.webp ${files.find((f) => f.name === 'echo-world-result-1290.webp').sha}).

/**
 * The result's celebration star, art round 5 (echo-celebration-star.json,
 * its r3 block): the star (a hollow double outline in its glow; the outer
 * one lopsided and the inner one lumpy, each corner's radius factor (and
 * the outer's turn, degrees) counter-clockwise on screen from the top tip;
 * blue blotches inside, centres and sigmas in tip radii, x right and y
 * down), the 33 sparkle dots in reveal order, the three ribbons
 * (Catmull-Rom curves through their dots, a gain per link) and the
 * starburst (a mist laid over, a glow, rays and a core), places in plate
 * fractions and sizes in W, colours sRGB; and the timings, ms from the
 * result's stars landing. A glow is its reach (W) and its rings' screen
 * colours, centre to edge, fitted to the result plate
 * (scripts/sync-echo-art.mjs fitLights). The small sparkles are in
 * echo-celebration-sparkles.ts.
 */
export const CELEBRATION = ${JSON.stringify(celebrationSpec)} as const
`

const sparklesFile = `// ============================================================
// Echo's celebration sparkles, in numbers (generated)
// ============================================================
//
// Written by scripts/sync-echo-art.mjs from the Echo A0 art's
// echo-celebration-star.json (r3.draw.sparkles, art round 5); do not edit
// by hand, re-run the script when the art changes. Places are fractions of
// the plate's base frame (echo-geometry.ts PLATE_BASE), u across and v
// down; sizes ending in W are fractions of the room's width.

/**
 * Screen 4's smaller sparkles along the celebration's chains, each drawn as
 * a dot is (a soft glow, then a core, one colour) and revealed a delay
 * after the dot of reveal rank \`afterRank\` (CELEBRATION.timing.sparkles).
 */
export const CELEBRATION_SPARKLES = ${JSON.stringify(sparkles(STAR.r3.draw))} as const
`

const scenes = `// ============================================================
// Echo's fixtures: the storyboard's frames, pinned (generated)
// ============================================================
//
// Written by scripts/sync-echo-art.mjs from the A0 pins
// (echo-storyboard-pins.json) and fixture choices (fixture-choices.json),
// each screen's pins taken to the plate through that screen's own
// alignment (echo-geometry.json). Dev builds only: the fixture page
// (EchoFixture.tsx) is reached from the native entry behind
// import.meta.env.DEV, so no build a phone runs carries this. Do not edit
// by hand; re-run the script.

import type { StarSize } from '../echo-geometry'

export type FixtureTint = 'base' | 'violet' | 'cyan' | 'bright'

export interface FixtureScene {
  /** The storyboard screen it matches. */
  readonly screen: number
  /** The world plate, or the result's lit town. */
  readonly plate: 'world' | 'result'
  /** The state's cloud layer over the plate, or none. */
  readonly clouds: 'mid-take' | 'demo-off' | null
  /** The state's city light over the clouds, or none (the result). */
  readonly cityLight: 'intro' | 'mid-take' | 'demo-off' | null
  readonly celebration: boolean
  readonly merc: 'sing' | 'listen' | 'celebrate'
  readonly rings: readonly {
    readonly u: number
    readonly v: number
    readonly rW: number
    readonly style: 'waiting' | 'active' | 'missed'
  }[]
  readonly stars: readonly {
    readonly u: number
    readonly v: number
    readonly widthW: number
    readonly size: StarSize
    readonly tint: FixtureTint
  }[]
  readonly lines: readonly {
    readonly a: readonly [number, number]
    readonly b: readonly [number, number]
    readonly style: 'phrase' | 'finished' | 'result'
  }[]
  readonly ribbon: {
    readonly points: readonly (readonly [number, number])[]
    readonly scale: number
    /** On the note (cyan) or off it (amber). */
    readonly filling: boolean
  } | null
}

export const FIXTURE_SCENES: Readonly<Record<'intro' | 'mid-take' | 'demo-off' | 'result', FixtureScene>> = ${JSON.stringify(fixtures())}
`

mkdirSync(join(ROOT, 'src/features/echo/fixture'), { recursive: true })
writeFileSync(GEOMETRY_OUT, geometry)
writeFileSync(CELEBRATION_OUT, celebrationFile)
writeFileSync(SPARKLES_OUT, sparklesFile)
writeFileSync(FIXTURE_OUT, scenes)
execFileSync(
  join(ROOT, 'node_modules/.bin/prettier'),
  ['--write', GEOMETRY_OUT, CELEBRATION_OUT, SPARKLES_OUT, FIXTURE_OUT],
  {
    stdio: 'ignore',
  },
)

for (const f of files) {
  console.info(
    `${f.name.padEnd(36)} ${String(f.w).padStart(5)}x${String(f.h).padEnd(5)} ${String(f.bytes).padStart(8)} B  ${f.sha}`,
  )
}
const total = files.reduce((sum, f) => sum + f.bytes, 0)
console.info(`${files.length} files, ${(total / 1024).toFixed(1)} KB -> ${ART}`)
console.info(`wrote ${GEOMETRY_OUT}`)
console.info(`wrote ${CELEBRATION_OUT}`)
console.info(`wrote ${SPARKLES_OUT}`)
console.info(`wrote ${FIXTURE_OUT}`)
