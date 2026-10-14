// ============================================================
// Ng slides' stand-in plates, drawn from the measured geometry
// ============================================================
//
// The bridge's paintings do not exist yet (the Codex account that paints
// them is out until 20 Oct 2026; ng-n0/N0-REPORT.md). Until they do, the
// room runs on these: plain shapes drawn from ng-geometry.json, at the
// same frames and pixel densities the paintings will have, so a painted
// plate replaces its stand-in file for file (sync-ng-art.mjs) and the
// room's code does not change.
//
// Nothing here imitates the paintings' brushwork. Each stand-in carries
// what the room's measure needs from its plate: the arch's rim on the
// fitted curve, the glass's zones by height (violet high, teal low when
// lit), the landings and piers, the bands of the river-back with warm
// windows and their reflections, the near bank's corners, the result's
// five arches at screen 4's places. Every random choice is seeded, so a
// re-run writes the same files.
//
// SVG strings rendered by sharp (librsvg). Coordinates are worked out in
// W units and turned into pixels here; no SVG transform is used, so a
// stroke width or a blur is always in plate pixels.

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

/** The arch's shape: 1 on the flat top, a smoothstep down to 0 at the foot. */
export function archG(u, f) {
  const x = Math.abs(u)
  if (x <= f) return 1
  if (x >= 1) return 0
  return 1 - smoothstep((x - f) / (1 - f))
}

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

function svgDoc(c, body, background) {
  const bg =
    background === null
      ? ''
      : `<rect width="${c.width}" height="${c.height}" fill="${background}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}" viewBox="0 0 ${c.width} ${c.height}">${bg}${body}</svg>`
}

/** A polygon or polyline path from W-unit points. */
function pathOf(c, points, close = true) {
  const d = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${fmt(c.X(x))} ${fmt(c.Y(y))}`)
    .join('')
  return close ? `${d}Z` : d
}

const rgb = ([r, g, b]) =>
  `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
const scaled = (colour, k) => colour.map((v) => Math.min(255, v * k))

/** Encode an SVG as a webp file; `alpha` keeps transparency. */
export async function renderWebp(svg, out, { quality = 82, alpha = false }) {
  let image = sharp(Buffer.from(svg))
  if (!alpha) image = image.flatten({ background: '#000000' })
  await image
    .webp({ quality, alphaQuality: 90, effort: 6, smartSubsample: true })
    .toFile(out)
}

// ---- The arch -------------------------------------------------------------

/**
 * The glass's outline about its apex (x from the apex column, y storyboard
 * W): the outer surface along the fitted rim, a leg under each foot down
 * to its pedestal, and the opening's curve between the legs.
 */
export function glassOutline(geo) {
  const { a, aIn, deckY, h, f, pedTopY, legW, surface } = geo
  const hIn = h - geo.thickness
  const fIn = (f * a) / aIn
  const outer = (x) => deckY - h * archG(x / a, f) - surface
  const inner = (x) => deckY - hIn * archG(x / aIn, fIn)
  const n = 160
  const legOut = aIn + legW
  const pts = []
  for (let i = 0; i <= n; i++) {
    const x = -a + (2 * a * i) / n
    pts.push([x, outer(x)])
  }
  pts.push([a, deckY], [legOut, deckY], [legOut, pedTopY], [aIn, pedTopY])
  for (let i = 0; i <= n; i++) {
    const x = aIn - (2 * aIn * i) / n
    pts.push([x, inner(x)])
  }
  pts.push([-aIn, pedTopY], [-legOut, pedTopY], [-legOut, deckY], [-a, deckY])
  return { pts, outer, inner, legOut }
}

/** The rim line the sprite carries (the SVG target line is drawn by the room). */
function rimLine(geo) {
  const pts = []
  const n = 160
  for (let i = 0; i <= n; i++) {
    const x = -geo.a + (2 * geo.a * i) / n
    pts.push([x, geo.deckY - geo.h * archG(x / geo.a, geo.f) - geo.rimOffset])
  }
  return pts
}

function openingLine(geo, inner) {
  const pts = []
  const n = 120
  for (let i = 0; i <= n; i++) {
    const x = -geo.aIn + (2 * geo.aIn * i) / n
    pts.push([x, inner(x)])
  }
  return pts
}

/** The zones' gradient by height above the deck (t = 0 deck, 1 apex). */
function zoneGradient(id, c, geo, zones, k = 1) {
  const yAt = (t) => c.Y(geo.deckY - t * geo.h)
  const stops = zones
    .map(
      ({ t, colour }) =>
        `<stop offset="${fmt(((yAt(t) - yAt(1.06)) / (yAt(-0.4) - yAt(1.06))) * 100)}%" stop-color="${rgb(scaled(colour, k))}"/>`,
    )
    .reverse()
    .join('')
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${fmt(yAt(1.06))}" x2="0" y2="${fmt(yAt(-0.4))}">${stops}</linearGradient>`
}

/** Is a point inside the glass (for the lit glass's sparkles)? */
function inGlass(geo, outline, x, y) {
  const ax = Math.abs(x)
  if (ax > geo.a) return false
  if (y < outline.outer(x)) return false
  if (y <= geo.deckY) return ax >= geo.aIn || y <= outline.inner(x)
  return ax >= geo.aIn && ax <= outline.legOut && y <= geo.pedTopY
}

/**
 * The glass of one arch, as light added over the river-back (ng-n0 §6):
 * black where there is no glass. Unlit, a faint body and its edges; lit,
 * the zones' colours, a bright core under the rim and a scatter of sparks.
 */
export function glassSvg(frame, pxPerW, geo, look, mirror = null) {
  const c = canvas(frame, pxPerW)
  const lit = look === 'lit'
  const outline = glassOutline(geo)
  const flip = (pts) =>
    mirror === null ? pts : pts.map(([x, y]) => [x, 2 * mirror - y])
  const zones = lit ? geo.zonesLit : geo.zonesUnlit
  const k = mirror === null ? 1 : lit ? 0.6 : 0.7
  const defs = [
    mirror === null
      ? zoneGradient('zones', c, geo, zones, k)
      : zoneGradient(
          'zones',
          c,
          { ...geo, deckY: 2 * mirror - geo.deckY, h: -geo.h },
          zones,
          k,
        ),
    `<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${fmt(c.L(0.006))}"/></filter>`,
    `<filter id="spark" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${fmt(c.L(0.0025))}"/></filter>`,
  ]
  const body = []
  const glass = pathOf(c, flip(outline.pts))
  body.push(`<path d="${glass}" fill="url(#zones)"/>`)
  if (lit) {
    body.push(
      `<path d="${glass}" fill="url(#zones)" opacity="0.55" filter="url(#soft)"/>`,
    )
  }
  const rim = pathOf(c, flip(rimLine(geo)), false)
  const rimColour = lit ? [150, 170, 235] : geo.rimUnlit
  body.push(
    `<path d="${rim}" fill="none" stroke="${rgb(scaled(rimColour, k))}" stroke-width="${fmt(c.L(geo.rimWidth * (lit ? 1.6 : 1)))}" stroke-linecap="round"/>`,
    `<path d="${rim}" fill="none" stroke="${rgb(scaled(rimColour, k * 0.5))}" stroke-width="${fmt(c.L(0.012))}" filter="url(#soft)"/>`,
  )
  const opening = pathOf(c, flip(openingLine(geo, outline.inner)), false)
  body.push(
    `<path d="${opening}" fill="none" stroke="${rgb(scaled(lit ? [90, 150, 210] : [34, 46, 74], k))}" stroke-width="${fmt(c.L(0.003))}"/>`,
  )
  if (lit) {
    // The bright core under the rim (storyboard screen 2's lit glass).
    const core = rimLine({ ...geo, rimOffset: -0.02 })
    body.push(
      `<path d="${pathOf(c, flip(core), false)}" fill="none" stroke="${rgb(scaled([170, 150, 240], k))}" stroke-width="${fmt(c.L(0.02))}" opacity="0.55" filter="url(#soft)"/>`,
    )
    const rng = seeded(7)
    const sparks = []
    let tries = 0
    while (sparks.length < 70 && tries < 6000) {
      tries += 1
      const x = -geo.a + 2 * geo.a * rng()
      const y = geo.apexY - 0.02 + (geo.pedTopY - geo.apexY + 0.02) * rng()
      if (!inGlass(geo, outline, x, y)) continue
      const [px, py] = flip([[x, y]])[0]
      const r = c.L(0.0018 + 0.003 * rng())
      sparks.push(
        `<circle cx="${fmt(c.X(px))}" cy="${fmt(c.Y(py))}" r="${fmt(r)}" fill="rgb(220,245,255)" opacity="${fmt(0.45 + 0.5 * rng())}"/>`,
      )
    }
    body.push(`<g filter="url(#spark)">${sparks.join('')}</g>`)
    body.push(sparks.slice(0, 24).join(''))
  }
  let content = body.join('')
  if (mirror !== null) {
    // Water: streaked down, broken by ripples, fading with depth.
    const stripes = []
    for (let y = 0; y < c.height; y += c.L(0.009)) {
      stripes.push(
        `<rect x="0" y="${fmt(y)}" width="${c.width}" height="${fmt(c.L(0.004))}" fill="#000" opacity="0.5"/>`,
      )
    }
    defs.push(
      `<filter id="streak" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="${fmt(c.L(0.0018))} ${fmt(c.L(0.014))}"/></filter>`,
      `<linearGradient id="depth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#262626"/></linearGradient>`,
      `<mask id="water" maskUnits="userSpaceOnUse" x="0" y="0" width="${c.width}" height="${c.height}"><rect width="${c.width}" height="${c.height}" fill="url(#depth)"/>${stripes.join('')}</mask>`,
    )
    content = `<g mask="url(#water)"><g filter="url(#streak)">${content}</g></g>`
  }
  return svgDoc(c, `<defs>${defs.join('')}</defs>${content}`, '#000')
}

// ---- Stone: the landings between arches, and the end piers ---------------

function masonry(c, x0, x1, y0, y1, rng) {
  const lines = []
  const course = 0.034
  let row = 0
  for (let y = y0 + course; y < y1 - 0.004; y += course) {
    lines.push(
      `<line x1="${fmt(c.X(x0))}" y1="${fmt(c.Y(y))}" x2="${fmt(c.X(x1))}" y2="${fmt(c.Y(y))}" stroke="#141725" stroke-width="${fmt(c.L(0.0022))}"/>`,
    )
    const shift = row % 2 === 0 ? 0 : 0.03
    for (let x = x0 + 0.02 + shift + 0.02 * rng(); x < x1 - 0.01; x += 0.06) {
      lines.push(
        `<line x1="${fmt(c.X(x))}" y1="${fmt(c.Y(y - course))}" x2="${fmt(c.X(x))}" y2="${fmt(c.Y(y))}" stroke="#151826" stroke-width="${fmt(c.L(0.002))}"/>`,
      )
    }
    row += 1
  }
  return lines.join('')
}

/** A stone block from `top` to the waterline, its top edge lit. */
function stoneBlock(c, geo, x0, x1, top, rng, cap = true) {
  const { waterY } = geo
  const r = fmt(c.L(0.006))
  const parts = [
    `<rect x="${fmt(c.X(x0))}" y="${fmt(c.Y(top))}" width="${fmt(c.L(x1 - x0))}" height="${fmt(c.L(waterY - top))}" fill="url(#face)"/>`,
    masonry(c, x0, x1, top + 0.012, waterY - 0.014, rng),
    `<rect x="${fmt(c.X(x0))}" y="${fmt(c.Y(waterY - 0.014))}" width="${fmt(c.L(x1 - x0))}" height="${fmt(c.L(0.014))}" fill="#2a3350" opacity="0.8"/>`,
  ]
  if (cap) {
    parts.push(
      `<rect x="${fmt(c.X(x0 - 0.004))}" y="${fmt(c.Y(top - 0.009))}" width="${fmt(c.L(x1 - x0 + 0.008))}" height="${fmt(c.L(0.021))}" rx="${r}" fill="#454d69"/>`,
      `<line x1="${fmt(c.X(x0))}" y1="${fmt(c.Y(top + 0.012))}" x2="${fmt(c.X(x1))}" y2="${fmt(c.Y(top + 0.012))}" stroke="#7cc4d8" stroke-width="${fmt(c.L(0.0026))}" opacity="0.65"/>`,
    )
  }
  return parts.join('')
}

const STONE_DEFS = (c, geo) =>
  `<defs><linearGradient id="face" gradientUnits="userSpaceOnUse" x1="0" y1="${fmt(c.Y(geo.deckY))}" x2="0" y2="${fmt(c.Y(geo.waterY))}"><stop offset="0" stop-color="#2d3349"/><stop offset="1" stop-color="#191d2b"/></linearGradient></defs>`

/** A glass leg's pedestal: from the leg's foot down to the water. */
function pedestal(c, geo, x0, x1, rng) {
  return stoneBlock(c, geo, x0, x1, geo.pedTopY, rng, false)
}

/**
 * The landing between two arches, about the left arch's apex: the block
 * under the deck between the two legs, and each leg's pedestal.
 */
export function stoneSvg(frame, pxPerW, geo) {
  const c = canvas(frame, pxPerW)
  const rng = seeded(11)
  const { aIn, legOut, period } = geo
  return svgDoc(
    c,
    STONE_DEFS(c, geo) +
      pedestal(c, geo, aIn, legOut, rng) +
      pedestal(c, geo, period - legOut, period - aIn, rng) +
      stoneBlock(c, geo, legOut, period - legOut, geo.deckY, rng),
    null,
  )
}

/** The pier before the first arch, about its apex (the end pier is its mirror). */
export function pierSvg(frame, pxPerW, geo) {
  const c = canvas(frame, pxPerW)
  const rng = seeded(13)
  return svgDoc(
    c,
    STONE_DEFS(c, geo) +
      pedestal(c, geo, -geo.legOut, -geo.aIn, rng) +
      stoneBlock(c, geo, frame.left, -geo.legOut, geo.deckY, rng),
    null,
  )
}

// ---- The river-back: sky, far bank, mist, water ---------------------------

/** A far bank: hill line, houses with warm windows, trees, a spire. */
function farBank(c, rng, { x0, x1, hillY, bankBottom, spireX, windows }) {
  const out = []
  const hill = []
  const n = 120
  const phase = rng() * 10
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n
    const y =
      hillY +
      0.05 * Math.sin(x * 2.1 + phase) +
      0.025 * Math.sin(x * 5.3 + phase * 2)
    hill.push([x, y])
  }
  hill.push([x1, bankBottom], [x0, bankBottom])
  out.push(`<path d="${pathOf(c, hill)}" fill="#0b1127"/>`)
  const lights = []
  for (let x = x0 + 0.02; x < x1 - 0.05; x += 0.05 + 0.07 * rng()) {
    const groundY =
      hillY +
      0.05 * Math.sin(x * 2.1 + phase) +
      0.025 * Math.sin(x * 5.3 + phase * 2) +
      0.03 +
      0.08 * rng()
    if (rng() < 0.35) {
      // A cluster of trees.
      for (let k = 0; k < 4; k++) {
        out.push(
          `<ellipse cx="${fmt(c.X(x + 0.03 * rng()))}" cy="${fmt(c.Y(groundY - 0.03 - 0.03 * rng()))}" rx="${fmt(c.L(0.025 + 0.02 * rng()))}" ry="${fmt(c.L(0.03 + 0.03 * rng()))}" fill="#08101f"/>`,
        )
      }
      continue
    }
    const w = 0.04 + 0.05 * rng()
    const hh = 0.035 + 0.05 * rng()
    const top = groundY - hh
    out.push(
      `<path d="${pathOf(c, [
        [x, groundY],
        [x, top],
        [x + w / 2, top - 0.025 - 0.015 * rng()],
        [x + w, top],
        [x + w, groundY],
      ])}" fill="#111a33"/>`,
    )
    for (let k = 0; k < 2 + Math.floor(rng() * 3); k++) {
      if (rng() > windows) continue
      const wx = x + 0.008 + (w - 0.016) * rng()
      const wy = top + 0.01 + (hh - 0.02) * rng()
      lights.push([wx, wy])
    }
  }
  if (spireX !== null) {
    const base = hillY - 0.02
    out.push(
      `<path d="${pathOf(c, [
        [spireX - 0.02, base + 0.06],
        [spireX - 0.02, base - 0.07],
        [spireX, base - 0.19],
        [spireX + 0.02, base - 0.07],
        [spireX + 0.02, base + 0.06],
      ])}" fill="#121b36"/>`,
    )
    lights.push([spireX, base - 0.04])
  }
  for (const [wx, wy] of lights) {
    out.push(
      `<circle cx="${fmt(c.X(wx))}" cy="${fmt(c.Y(wy))}" r="${fmt(c.L(0.011))}" fill="#ffb555" opacity="0.35" filter="url(#glow)"/>`,
      `<rect x="${fmt(c.X(wx - 0.003))}" y="${fmt(c.Y(wy - 0.0045))}" width="${fmt(c.L(0.006))}" height="${fmt(c.L(0.009))}" fill="#ffc874"/>`,
    )
  }
  return { svg: out.join(''), lights }
}

/** A far stone bridge with lamps, across the far river. */
function farBridge(c, x0, x1, y, rng) {
  const out = []
  out.push(
    `<rect x="${fmt(c.X(x0))}" y="${fmt(c.Y(y))}" width="${fmt(c.L(x1 - x0))}" height="${fmt(c.L(0.05))}" fill="#151d38"/>`,
  )
  const lamps = []
  for (let x = x0 + 0.06; x < x1; x += 0.22) {
    out.push(
      `<ellipse cx="${fmt(c.X(x + 0.08))}" cy="${fmt(c.Y(y + 0.05))}" rx="${fmt(c.L(0.07))}" ry="${fmt(c.L(0.035))}" fill="#0a1024"/>`,
    )
    lamps.push([x, y - 0.012])
    out.push(
      `<rect x="${fmt(c.X(x - 0.0015))}" y="${fmt(c.Y(y - 0.03))}" width="${fmt(c.L(0.003))}" height="${fmt(c.L(0.03))}" fill="#1d2645"/>`,
      `<circle cx="${fmt(c.X(x))}" cy="${fmt(c.Y(y - 0.032))}" r="${fmt(c.L(0.012))}" fill="#ffb555" opacity="0.4" filter="url(#glow)"/>`,
      `<circle cx="${fmt(c.X(x))}" cy="${fmt(c.Y(y - 0.032))}" r="${fmt(c.L(0.0035))}" fill="#ffd28a"/>`,
    )
  }
  rng()
  return { svg: out.join(''), lamps: lamps.map(([x, yy]) => [x, yy - 0.02]) }
}

/** Warm lights' reflections: vertical streaks under the waterline. */
function reflections(c, lights, waterTop, rng, strength = 1) {
  return lights
    .map(([x, y]) => {
      const depth = waterTop + (waterTop - y) * 0.35
      const len = 0.06 + 0.12 * rng()
      return `<rect x="${fmt(c.X(x - 0.003))}" y="${fmt(c.Y(depth))}" width="${fmt(c.L(0.006))}" height="${fmt(c.L(len))}" fill="#ffaa4a" opacity="${fmt((0.25 + 0.2 * rng()) * strength)}" filter="url(#streak)"/>`
    })
    .join('')
}

function stars(c, rng, x0, x1, y0, y1, count) {
  const out = []
  for (let i = 0; i < count; i++) {
    out.push(
      `<circle cx="${fmt(c.X(x0 + (x1 - x0) * rng()))}" cy="${fmt(c.Y(y0 + (y1 - y0) * rng() ** 1.4))}" r="${fmt(c.L(0.0012 + 0.0016 * rng()))}" fill="#dfe8ff" opacity="${fmt(0.3 + 0.6 * rng())}"/>`,
    )
  }
  return out.join('')
}

function ripples(c, rng, x0, x1, y0, y1, count) {
  const out = []
  for (let i = 0; i < count; i++) {
    const x = x0 + (x1 - x0) * rng()
    const y = y0 + (y1 - y0) * rng()
    out.push(
      `<rect x="${fmt(c.X(x))}" y="${fmt(c.Y(y))}" width="${fmt(c.L(0.03 + 0.12 * rng()))}" height="${fmt(Math.max(1, c.L(0.0018)))}" fill="#6d84c2" opacity="${fmt(0.08 + 0.14 * rng())}"/>`,
    )
  }
  return out.join('')
}

const SCENE_DEFS = (c) =>
  `<filter id="glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="${fmt(c.L(0.008))}"/></filter>` +
  `<filter id="streak" x="-50%" y="-20%" width="200%" height="140%"><feGaussianBlur stdDeviation="${fmt(c.L(0.002))} ${fmt(c.L(0.02))}"/></filter>` +
  `<filter id="mist" x="-10%" y="-100%" width="120%" height="300%"><feGaussianBlur stdDeviation="${fmt(c.L(0.03))}"/></filter>`

/**
 * The river-back panorama: storyboard bands (ng-n0 §3: sky to 0.115 H,
 * far bank to 0.30, mist to 0.38, water below), wide enough for the run's
 * scroll at a third of the bridge's speed.
 */
export function riverBackSvg(frame, pxPerW, bands) {
  const c = canvas(frame, pxPerW)
  const rng = seeded(3)
  const x0 = frame.left
  const x1 = frame.left + frame.width
  const sky = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#060a1f"/><stop offset="0.16" stop-color="#0d1536"/><stop offset="0.36" stop-color="#1a2550"/><stop offset="0.38" stop-color="#18234d"/><stop offset="1" stop-color="#05081a"/></linearGradient>`
  const water = `<linearGradient id="water" gradientUnits="userSpaceOnUse" x1="0" y1="${fmt(c.Y(bands.waterTop))}" x2="0" y2="${fmt(c.Y(frame.top + frame.height))}"><stop offset="0" stop-color="#1a2552"/><stop offset="0.35" stop-color="#101a3d"/><stop offset="1" stop-color="#070b1d"/></linearGradient>`
  const body = []
  body.push(`<rect width="${c.width}" height="${c.height}" fill="url(#sky)"/>`)
  body.push(stars(c, rng, x0, x1, frame.top, bands.bankTop + 0.1, 90))
  body.push(
    `<rect x="0" y="${fmt(c.Y(bands.waterTop))}" width="${c.width}" height="${fmt(c.height - c.Y(bands.waterTop))}" fill="url(#water)"/>`,
  )
  const bank = farBank(c, rng, {
    x0,
    x1,
    hillY: bands.bankTop + 0.19,
    bankBottom: bands.mistTop + 0.12,
    spireX: bands.spireX,
    windows: 0.75,
  })
  body.push(bank.svg)
  const bridge = farBridge(c, x0, x1, bands.mistTop + 0.07, rng)
  body.push(bridge.svg)
  body.push(
    `<rect x="0" y="${fmt(c.Y(bands.mistTop + 0.05))}" width="${c.width}" height="${fmt(c.L(bands.waterTop - bands.mistTop + 0.04))}" fill="#41538a" opacity="0.32" filter="url(#mist)"/>`,
  )
  body.push(
    reflections(c, [...bank.lights, ...bridge.lamps], bands.waterTop, rng),
  )
  body.push(
    ripples(
      c,
      rng,
      x0,
      x1,
      bands.waterTop + 0.02,
      frame.top + frame.height,
      260,
    ),
  )
  return svgDoc(
    c,
    `<defs>${sky}${water}${SCENE_DEFS(c)}</defs>${body.join('')}`,
    '#05081a',
  )
}

// ---- The near bank: the fixed frame over the bottom corners --------------

function lantern(c, x, y) {
  return [
    `<circle cx="${fmt(c.X(x))}" cy="${fmt(c.Y(y))}" r="${fmt(c.L(0.07))}" fill="#ffad4a" opacity="0.28" filter="url(#glow)"/>`,
    `<rect x="${fmt(c.X(x - 0.016))}" y="${fmt(c.Y(y - 0.024))}" width="${fmt(c.L(0.032))}" height="${fmt(c.L(0.046))}" rx="${fmt(c.L(0.004))}" fill="#2a2018"/>`,
    `<rect x="${fmt(c.X(x - 0.011))}" y="${fmt(c.Y(y - 0.018))}" width="${fmt(c.L(0.022))}" height="${fmt(c.L(0.034))}" fill="#ffc46b"/>`,
    `<path d="${pathOf(c, [
      [x - 0.022, y - 0.024],
      [x, y - 0.04],
      [x + 0.022, y - 0.024],
    ])}" fill="#1c1712"/>`,
  ].join('')
}

function foliage(c, rng, along, count) {
  const shades = ['#0b171b', '#0f2024', '#13292c', '#183234']
  const out = []
  for (let i = 0; i < count; i++) {
    const [x, y] = along(rng())
    out.push(
      `<ellipse cx="${fmt(c.X(x))}" cy="${fmt(c.Y(y))}" rx="${fmt(c.L(0.022 + 0.05 * rng()))}" ry="${fmt(c.L(0.016 + 0.03 * rng()))}" transform="rotate(${fmt(-40 + 80 * rng())} ${fmt(c.X(x))} ${fmt(c.Y(y))})" fill="${shades[Math.floor(rng() * shades.length)]}"/>`,
    )
    if (rng() < 0.25) {
      out.push(
        `<ellipse cx="${fmt(c.X(x + 0.01))}" cy="${fmt(c.Y(y - 0.006))}" rx="${fmt(c.L(0.012))}" ry="${fmt(c.L(0.005))}" fill="#2e5552" opacity="0.5"/>`,
      )
    }
  }
  return out.join('')
}

/** The left corner: a wall with two lanterns and the foliage below it. */
export function nearLeftSvg(frame, pxPerW, bottom) {
  const c = canvas(frame, pxPerW)
  const rng = seeded(21)
  const body = [
    `<rect x="${fmt(c.X(0))}" y="${fmt(c.Y(frame.top + 0.06))}" width="${fmt(c.L(0.075))}" height="${fmt(c.L(0.36))}" fill="#21263a"/>`,
    `<rect x="${fmt(c.X(0))}" y="${fmt(c.Y(frame.top + 0.05))}" width="${fmt(c.L(0.085))}" height="${fmt(c.L(0.016))}" fill="#3a415c"/>`,
    lantern(c, 0.04, frame.top + 0.03),
    lantern(c, 0.03, frame.top + 0.27),
    foliage(
      c,
      rng,
      (s) => {
        const y = frame.top + 0.1 + (bottom - frame.top - 0.1) * s
        const reach = 0.05 + 0.27 * s ** 1.6
        return [reach * rng(), y]
      },
      140,
    ),
    foliage(c, rng, (s) => [0.4 * s, bottom - 0.12 * rng()], 50),
  ]
  return svgDoc(c, `<defs>${SCENE_DEFS(c)}</defs>${body.join('')}`, null)
}

/** The right corner and the band of leaves along the bottom. */
export function nearRightSvg(frame, pxPerW, bottom) {
  const c = canvas(frame, pxPerW)
  const rng = seeded(23)
  const body = [
    foliage(
      c,
      rng,
      (s) => [
        1 - 0.24 * s * rng(),
        frame.top + 0.05 + (bottom - frame.top - 0.05) * s,
      ],
      90,
    ),
    foliage(
      c,
      rng,
      (s) => [frame.left + (1 - frame.left) * s, bottom - 0.16 * rng() ** 2],
      110,
    ),
  ]
  return svgDoc(c, `<defs>${SCENE_DEFS(c)}</defs>${body.join('')}`, null)
}

/** The water's shimmer: faint streaks on a tile that repeats sideways. */
export function shimmerSvg(width, height) {
  const rng = seeded(31)
  const c = { width, height }
  const out = []
  for (let i = 0; i < 46; i++) {
    const x = width * rng()
    const y = height * rng()
    const w = 16 + 90 * rng()
    const op = fmt(0.18 + 0.3 * rng())
    for (const dx of [0, -width]) {
      out.push(
        `<rect x="${fmt(x + dx)}" y="${fmt(y)}" width="${fmt(w)}" height="1.6" rx="0.8" fill="#c8dcff" opacity="${op}"/>`,
      )
    }
  }
  return svgDoc(c, out.join(''), null)
}

// ---- The result: five arches across the river ---------------------------

function resultArches(c, view, look) {
  const lit = look === 'lit'
  const out = []
  const { apexX, apexY, valleyY, mirrorY, halfWidth, f } = view
  const h = valleyY - apexY
  for (const x0 of apexX) {
    const rim = []
    const n = 60
    for (let i = 0; i <= n; i++) {
      const x = x0 - halfWidth + (2 * halfWidth * i) / n
      rim.push([x, valleyY - h * archG((x - x0) / halfWidth, f)])
    }
    const innerH = h * 0.62
    const innerA = halfWidth * 0.72
    const inner = []
    for (let i = n; i >= 0; i--) {
      const x = x0 - innerA + (2 * innerA * i) / n
      inner.push([
        x,
        mirrorY -
          (mirrorY - valleyY) -
          innerH * archG((x - x0) / innerA, f * 1.3),
      ])
    }
    const shape = [
      ...rim,
      [x0 + halfWidth, mirrorY],
      [x0 + innerA, mirrorY],
      ...inner.map(([x, y]) => [x, Math.min(y, mirrorY)]),
      [x0 - innerA, mirrorY],
      [x0 - halfWidth, mirrorY],
    ]
    const mirrored = shape.map(([x, y]) => [x, 2 * mirrorY - y])
    const fill = lit ? 'url(#litArch)' : 'url(#darkArch)'
    out.push(
      `<path d="${pathOf(c, shape)}" fill="${fill}"/>`,
      `<path d="${pathOf(c, mirrored)}" fill="${fill}" opacity="${lit ? 0.55 : 0.4}" filter="url(#streak)"/>`,
      `<path d="${pathOf(c, rim, false)}" fill="none" stroke="${lit ? '#d6c8ff' : '#7f9ccf'}" stroke-width="${fmt(c.L(lit ? 0.005 : 0.003))}"/>`,
    )
    if (lit) {
      out.push(
        `<path d="${pathOf(c, shape)}" fill="url(#litArch)" opacity="0.6" filter="url(#glow)"/>`,
      )
    }
  }
  return out.join('')
}

/**
 * The pulled-back view (storyboard screen 4): the same river from further
 * off, five arches at screen 4's places, mirrored at its axis. One
 * picture, drawn twice: unlit, then lit (the band the room reveals).
 */
export function resultSvg(frame, pxPerW, view, look, bands) {
  const c = canvas(frame, pxPerW)
  const rng = seeded(5)
  const sky = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070b21"/><stop offset="0.3" stop-color="#16214a"/><stop offset="0.48" stop-color="#1f2c5a"/><stop offset="0.5" stop-color="#18234d"/><stop offset="1" stop-color="#060a1b"/></linearGradient>`
  const darkArch = `<linearGradient id="darkArch" gradientUnits="userSpaceOnUse" x1="0" y1="${fmt(c.Y(view.apexY))}" x2="0" y2="${fmt(c.Y(view.mirrorY))}"><stop offset="0" stop-color="#3a4568"/><stop offset="1" stop-color="#2a3352"/></linearGradient>`
  const litArch = `<linearGradient id="litArch" gradientUnits="userSpaceOnUse" x1="0" y1="${fmt(c.Y(view.apexY))}" x2="0" y2="${fmt(c.Y(view.mirrorY))}"><stop offset="0" stop-color="#956ced"/><stop offset="0.35" stop-color="#716df1"/><stop offset="0.6" stop-color="#5aa5ee"/><stop offset="0.8" stop-color="#4bcfe5"/><stop offset="1" stop-color="#53c4db"/></linearGradient>`
  const body = [
    `<rect width="${c.width}" height="${c.height}" fill="url(#sky)"/>`,
    stars(c, rng, 0, 1, 0, bands.bankTop + 0.1, 70),
  ]
  const bank = farBank(c, rng, {
    x0: -0.05,
    x1: 1.05,
    hillY: bands.bankTop + 0.16,
    bankBottom: bands.waterTop + 0.02,
    spireX: 0.83,
    windows: 0.9,
  })
  body.push(bank.svg)
  const bridge = farBridge(c, -0.05, 0.55, bands.waterTop - 0.11, rng)
  body.push(bridge.svg)
  body.push(
    `<rect x="0" y="${fmt(c.Y(bands.waterTop - 0.08))}" width="${c.width}" height="${fmt(c.L(0.12))}" fill="#41538a" opacity="0.3" filter="url(#mist)"/>`,
    reflections(c, [...bank.lights, ...bridge.lamps], bands.waterTop, rng, 0.8),
    ripples(c, rng, 0, 1, bands.waterTop + 0.02, frame.height, 200),
    resultArches(c, view, look),
  )
  const near = seeded(29)
  body.push(
    `<rect x="0" y="${fmt(c.Y(bands.wallTop))}" width="${c.width}" height="${fmt(c.L(0.16))}" fill="#1b2031"/>`,
    `<rect x="0" y="${fmt(c.Y(bands.wallTop - 0.012))}" width="${c.width}" height="${fmt(c.L(0.016))}" fill="#363d57"/>`,
    lantern(c, 0.07, bands.wallTop - 0.05),
    lantern(c, 0.93, bands.wallTop - 0.05),
    foliage(
      c,
      near,
      (s) => [0.18 * s * near(), bands.wallTop - 0.2 + 0.5 * s],
      70,
    ),
    foliage(
      c,
      near,
      (s) => [1 - 0.18 * s * near(), bands.wallTop - 0.2 + 0.5 * s],
      70,
    ),
    foliage(c, near, (s) => [s, bands.wallTop + 0.12 + 0.3 * near()], 90),
  )
  return svgDoc(
    c,
    `<defs>${sky}${darkArch}${litArch}${SCENE_DEFS(c)}</defs>${body.join('')}`,
    '#05081a',
  )
}
