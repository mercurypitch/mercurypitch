#!/usr/bin/env node
// ============================================================
// Ng slides' art, from the N0 folder into the room
// ============================================================
//
// The bridge room's plates are painted and measured outside the repo (the
// N0 folder: geometry/ for the measures, plates/ for the paintings). This
// writes the files the room ships into src/features/ng-slides/art/ and
// the numbers it draws with into src/features/ng-slides/bridge-geometry.ts.
//
// The paintings are not made yet (ng-n0/N0-REPORT.md: the painter is out
// until 20 Oct 2026). Every plate the folder does not have is drawn here
// as a stand-in from the measured geometry (scripts/ng-art/stand-ins.mjs)
// at the frame and width the painting will have, and the spec marks it
// `standIn: true`. When a painting arrives, list it in
// plates/ng-plates.json and re-run: its file replaces the stand-in's, its
// frame the stand-in's frame, and the room's code does not change.
//
//   plates/ng-plates.json:
//   { "glass-lit": { "files": { "860": "glass-lit-860.webp",
//                               "1290": "glass-lit-1290.webp" },
//                    "frame": { "left": -0.4257, "top": 0.9522,
//                               "width": 0.8514, "height": 0.603 } } }
//
// Re-run it whenever the art or the measures change; nothing it writes is
// edited by hand. The room's own wiring of each plate is in
// src/features/ng-slides/bridge-art.ts; what each stand-in stands for is
// in src/features/ng-slides/STAND-INS.md.
//
//   node scripts/sync-ng-art.mjs <ng-n0 folder>

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { glassSvg, nearLeftSvg, nearRightSvg, pierSvg, renderWebp, resultSvg, riverBackSvg, shimmerSvg, stoneSvg, } from './ng-art/stand-ins.mjs'

const ROOT = process.cwd()
const SOURCE = process.argv[2]
if (
  SOURCE === undefined ||
  !existsSync(join(SOURCE, 'geometry/ng-geometry.json'))
) {
  console.error('usage: node scripts/sync-ng-art.mjs <ng-n0 folder>')
  process.exit(2)
}
const N0 = resolve(SOURCE)
const ART = join(ROOT, 'src/features/ng-slides/art')
const GEOMETRY_OUT = join(ROOT, 'src/features/ng-slides/bridge-geometry.ts')
const GEO = JSON.parse(
  readFileSync(join(N0, 'geometry/ng-geometry.json'), 'utf8'),
)
const MANIFEST_PATH = join(N0, 'plates/ng-plates.json')
const MANIFEST = existsSync(MANIFEST_PATH)
  ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  : {}

const r4 = (v) => Math.round(v * 10_000) / 10_000
const hex = (h) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16))

// ---- the measures ---------------------------------------------------------

const arch = GEO.arch
const glass = arch.glass
const SB_ASPECT = GEO.frame.storyboard_aspect

/** The landing between two arches (option B: the storyboard's width). */
const LANDING = 0.1
/** The legs' inner and outer edges from the apex (screen 1's pedestals). */
const LEG_IN = r4(arch.x_c_screen1 - 0.43)
const LEG_OUT = r4(arch.x_c_screen1 - 0.36)
/** The glass's outer surface over the fitted rim, and its edge line. */
const OUTER = GEO.target_line.outer_line
const CORE = GEO.target_line.core
const RIM_OFFSET = r4(-OUTER.offset_W - CORE.centre_offset_W)
const SURFACE = r4(RIM_OFFSET + OUTER.fwhm_W / 2)

/** The background the glass was measured over (screen 1's opening, by zone). */
const OPENING = Object.values(arch.zones_unlit_screen1.opening_same_rows)
const ZONE_T = [-0.125, 0.1, 0.3, 0.5, 0.7, 0.925]

/** A zone's added light: its colour less the water seen through the glass. */
function added(zoneHexes, behindHexes) {
  return zoneHexes.map((zone, i) => {
    const behind = hex(behindHexes[i] ?? behindHexes[i - 1])
    return {
      t: ZONE_T[i],
      colour: hex(zone).map((v, k) => Math.max(0, v - behind[k])),
    }
  })
}

const zonesUnlit = added(Object.values(arch.zones_unlit_screen1.glass), OPENING)
const zonesLit = added(Object.values(arch.zones_lit.screen4), OPENING)

const geo = {
  a: arch.a_W,
  h: arch.h_W,
  f: arch.f,
  deckY: arch.deck_y_W_storyboard,
  apexY: arch.apex_y_W_storyboard,
  thickness: glass.thickness_at_apex_W,
  pedTopY: glass.pedestal_top_y_W,
  waterY: glass.waterline_y_W,
  aIn: LEG_IN,
  legW: r4(LEG_OUT - LEG_IN),
  legOut: LEG_OUT,
  period: r4(2 * arch.a_W + LANDING),
  surface: SURFACE,
  rimOffset: RIM_OFFSET,
  rimWidth: OUTER.fwhm_W,
  rimUnlit: hex(OUTER.hex).map((v, k) =>
    Math.max(0, v - hex(OPENING[5] ?? OPENING[4])[k]),
  ),
  zonesUnlit,
  zonesLit,
}

// ---- the plates' frames (W units; arch sprites about the apex column) ----

const GLASS = {
  left: r4(-(geo.a + 0.03)),
  top: r4(geo.apexY - geo.surface - 0.03),
  width: r4(2 * (geo.a + 0.03)),
  height: r4(geo.pedTopY + 0.012 - (geo.apexY - geo.surface - 0.03)),
}
const REFLECTION = {
  left: GLASS.left,
  top: r4(geo.waterY + 0.03),
  width: GLASS.width,
  height: r4(2 * geo.waterY - GLASS.top + 0.045 - (geo.waterY + 0.03)),
}
const STONE_TOP = r4(geo.deckY - 0.012)
const STONE_HEIGHT = r4(geo.waterY + 0.006 - STONE_TOP)
const LANDING_FRAME = {
  left: r4(geo.aIn - 0.01),
  top: STONE_TOP,
  width: r4(geo.period - 2 * geo.aIn + 0.02),
  height: STONE_HEIGHT,
}
const PIER = {
  left: -1.26,
  top: STONE_TOP,
  width: r4(1.26 - geo.aIn + 0.01),
  height: STONE_HEIGHT,
}
const RIVER_BACK = { left: 0, top: 0.089, width: 2.64, height: 2.4 }
const RESULT = { left: 0, top: 0, width: 1, height: SB_ASPECT }
const RV = GEO.result_view_screen4
const resultView = {
  apexX: RV.apex_x,
  apexY: r4(RV.apex_y_H * SB_ASPECT),
  valleyY: r4(RV.valley_y_H * SB_ASPECT),
  mirrorY: r4(RV.mirror_axis_y_H * SB_ASPECT),
  halfWidth: r4(RV.period_W / 2),
  f: arch.f,
}
const RESULT_BAND = {
  left: 0,
  top: r4(resultView.apexY - 0.06),
  width: 1,
  height: r4(
    2 * resultView.mirrorY -
      resultView.apexY +
      0.05 -
      (resultView.apexY - 0.06),
  ),
}
/** Storyboard bands (ng-n0 §3), as fractions of its screen's height. */
const BANDS = {
  bankTop: r4(0.115 * SB_ASPECT),
  mistTop: r4(0.3 * SB_ASPECT),
  waterTop: r4(0.38 * SB_ASPECT),
  spireX: 1.18,
}
const RESULT_BANDS = {
  bankTop: r4(0.33 * SB_ASPECT),
  waterTop: r4(0.5 * SB_ASPECT),
  wallTop: r4(0.66 * SB_ASPECT),
}
/** The near bank, anchored to the room's bottom corners (W units). */
const NEAR_LEFT = { left: 0, top: 0, width: 0.42, height: 1.0 }
const NEAR_RIGHT = { left: 0, top: 0, width: 1, height: 0.4 }
const SHIMMER_PX = { width: 640, height: 200 }

// ---- the plate list ---------------------------------------------------------

/**
 * Each plate: its files' widths in px per W (or fixed px for the tile), and
 * how its stand-in is drawn. `alpha` keeps transparency; the glass and its
 * reflection are opaque, black where there is no glass (added light).
 */
const PLATES = [
  {
    name: 'riverback',
    frame: RIVER_BACK,
    widths: [645],
    svg: (f, px) => riverBackSvg(f, px, BANDS),
  },
  {
    name: 'glass-unlit',
    frame: GLASS,
    widths: [860, 1290],
    svg: (f, px) => glassSvg(f, px, geo, 'unlit'),
  },
  {
    name: 'glass-lit',
    frame: GLASS,
    widths: [860, 1290],
    svg: (f, px) => glassSvg(f, px, geo, 'lit'),
  },
  {
    name: 'reflection-unlit',
    frame: REFLECTION,
    widths: [430],
    svg: (f, px) => glassSvg(f, px, geo, 'unlit', geo.waterY),
  },
  {
    name: 'reflection-lit',
    frame: REFLECTION,
    widths: [430],
    svg: (f, px) => glassSvg(f, px, geo, 'lit', geo.waterY),
  },
  {
    name: 'landing',
    frame: LANDING_FRAME,
    widths: [860, 1290],
    alpha: true,
    svg: (f, px) => stoneSvg(f, px, geo),
  },
  {
    name: 'pier',
    frame: PIER,
    widths: [860, 1290],
    alpha: true,
    svg: (f, px) => pierSvg(f, px, geo),
  },
  {
    name: 'near-left',
    frame: NEAR_LEFT,
    widths: [860, 1290],
    alpha: true,
    svg: (f, px) => nearLeftSvg(f, px, f.height),
  },
  {
    name: 'near-right',
    frame: NEAR_RIGHT,
    widths: [860, 1290],
    alpha: true,
    svg: (f, px) => nearRightSvg(f, px, f.height),
  },
  {
    name: 'result',
    frame: RESULT,
    widths: [860, 1290],
    svg: (f, px) => resultSvg(f, px, resultView, 'unlit', RESULT_BANDS),
  },
  {
    name: 'result-lit',
    frame: RESULT_BAND,
    widths: [860, 1290],
    band: true,
    svg: (f, px) => resultSvg(RESULT, px, resultView, 'lit', RESULT_BANDS),
  },
]

const fileOf = (name, width, single) =>
  single ? `bridge-${name}.webp` : `bridge-${name}-${width}.webp`

/** One plate: the painting's files when the manifest lists it, else the stand-in. */
async function syncPlate(plate) {
  const painted = MANIFEST[plate.name]
  const single = plate.widths.length === 1
  if (painted !== undefined) {
    for (const width of plate.widths) {
      const from = join(N0, 'plates', painted.files[String(width)])
      copyFileSync(from, join(ART, fileOf(plate.name, width, single)))
    }
    return { frame: painted.frame, standIn: false }
  }
  for (const width of plate.widths) {
    const out = join(ART, fileOf(plate.name, width, single))
    const svg = plate.svg(plate.frame, width)
    if (plate.band === true) {
      // The lit result: the whole picture drawn lit, cut to the band the
      // room reveals, so it registers with the unlit plate pixel for pixel.
      const full = await sharp(Buffer.from(svg))
        .flatten({ background: '#000' })
        .png()
        .toBuffer()
      await sharp(full)
        .extract({
          left: 0,
          top: Math.round(plate.frame.top * width),
          width: Math.round(plate.frame.width * width),
          height: Math.round(plate.frame.height * width),
        })
        .webp({ quality: 82, effort: 6, smartSubsample: true })
        .toFile(out)
      continue
    }
    await renderWebp(svg, out, { alpha: plate.alpha === true })
  }
  return { frame: plate.frame, standIn: true }
}

async function syncShimmer() {
  const painted = MANIFEST.shimmer
  const out = join(ART, 'bridge-shimmer.webp')
  if (painted !== undefined) {
    copyFileSync(join(N0, 'plates', painted.files.tile), out)
    return { px: painted.px, standIn: false }
  }
  await renderWebp(shimmerSvg(SHIMMER_PX.width, SHIMMER_PX.height), out, {
    alpha: true,
  })
  return { px: SHIMMER_PX, standIn: true }
}

// ---- the spec -------------------------------------------------------------

const frameTs = (f) =>
  `{ left: ${r4(f.left)}, top: ${r4(f.top)}, width: ${r4(f.width)}, height: ${r4(f.height)} }`

function plateTs(plate, synced) {
  return [
    `  '${plate.name}': {`,
    `    frame: ${frameTs(synced.frame)},`,
    `    widths: [${plate.widths.join(', ')}],`,
    `    standIn: ${synced.standIn},`,
    '  },',
  ].join('\n')
}

function geometryTs(synced, shimmer) {
  const lines = [
    '// ============================================================',
    "// Ng slides' bridge: where everything sits (generated)",
    '// ============================================================',
    '//',
    '// Written by scripts/sync-ng-art.mjs from the N0 measures',
    `// (ng-n0/geometry/ng-geometry.json, ${GEO.status.split(':')[0]}). Do not edit by hand:`,
    "// re-run the script. W units (the screen's width); y as the storyboard",
    `// frame draws it (aspect ${SB_ASPECT}); the room crops the frame's extra height`,
    '// equally from the sky and the water (bridge-layout.ts). Arch sprites are',
    '// placed about their apex column. `standIn: true` marks a plate drawn from',
    '// these numbers until its painting arrives (STAND-INS.md).',
    '',
    `export const STORYBOARD_ASPECT = ${SB_ASPECT}`,
    '',
    "/** The arch (screen 1's fitted rim) and the stone it stands on. */",
    'export const ARCH = {',
    `  h: ${geo.h},`,
    `  a: ${geo.a},`,
    `  f: ${geo.f},`,
    `  deckY: ${geo.deckY},`,
    `  apexY: ${geo.apexY},`,
    `  pedestalTopY: ${geo.pedTopY},`,
    `  waterY: ${geo.waterY},`,
    `  legIn: ${geo.aIn},`,
    `  legOut: ${geo.legOut},`,
    `  semitone: ${arch.semitone_W},`,
    '} as const',
    '',
    "/** The landing between arches (option B) and the arches' period. */",
    `export const LANDING_W = ${LANDING}`,
    `export const PERIOD_W = ${geo.period}`,
    '',
    '/** Where the playhead stands, and the first apex on the intro (screen 1). */',
    'export const PLAYHEAD_X = 0.35',
    `export const INTRO_APEX_X = ${arch.x_c_screen1}`,
    '',
    "/** The target line's core, under the fitted rim. */",
    'export const TARGET_LINE = {',
    `  width: ${CORE.fwhm_W},`,
    `  colour: '${CORE.peak_hex}',`,
    `  offset: ${CORE.centre_offset_W},`,
    '} as const',
    '',
    "/** The first arch's note names (screen 1). */",
    'export const NOTE_NAMES = {',
    `  root: { dx: ${GEO.note_names.root.centre_from_apex_W[0]}, dy: ${GEO.note_names.root.centre_from_apex_W[1]}, colour: '${GEO.note_names.root.colour}' },`,
    `  top: { dx: ${GEO.note_names.top.centre_from_apex_W[0]}, dy: ${GEO.note_names.top.centre_from_apex_W[1]}, colour: '${GEO.note_names.top.colour}' },`,
    `  capHeight: ${GEO.note_names.cap_height_W},`,
    '} as const',
    '',
    "/** The voice's ribbon: its half-height width (screen 2), W. */",
    `export const RIBBON_FWHM_W = ${r4(GEO.ribbons.cyan_screen2.fwhm_px / 327)}`,
    '',
    "/** The river-back scrolls at this share of the bridge's speed. */",
    `export const PARALLAX = ${r4(GEO.river_back.parallax)}`,
    '',
    '/** The pulled-back view (screen 4): five arches across the river. */',
    'export const RESULT_VIEW = {',
    `  apexX: [${resultView.apexX.join(', ')}],`,
    `  apexY: ${resultView.apexY},`,
    `  valleyY: ${resultView.valleyY},`,
    `  mirrorY: ${resultView.mirrorY},`,
    `  halfWidth: ${resultView.halfWidth},`,
    '} as const',
    '',
    "/** A plate: its frame (W units) and its files' widths in px per W. */",
    'export interface PlateFrame {',
    '  readonly frame: {',
    '    readonly left: number',
    '    readonly top: number',
    '    readonly width: number',
    '    readonly height: number',
    '  }',
    '  readonly widths: readonly number[]',
    '  readonly standIn: boolean',
    '}',
    '',
    'export type BridgePlate =',
    ...PLATES.map((p, i) => `  ${i === 0 ? '' : '| '}'${p.name}'`),
    '',
    '/** Every plate the room draws, as the sync script found or drew it. */',
    'export const PLATES: Readonly<Record<BridgePlate, PlateFrame>> = {',
    ...PLATES.map((p) => plateTs(p, synced[p.name])),
    '}',
    '',
    "/** The water's shimmer: one tile, repeated sideways. */",
    `export const SHIMMER = { width: ${shimmer.px.width}, height: ${shimmer.px.height}, standIn: ${shimmer.standIn} } as const`,
    '',
  ]
  return lines.join('\n')
}

async function main() {
  mkdirSync(ART, { recursive: true })
  const synced = {}
  for (const plate of PLATES) {
    synced[plate.name] = await syncPlate(plate)
    console.log(
      `${plate.name}: ${synced[plate.name].standIn ? 'stand-in' : 'painted'}`,
    )
  }
  const shimmer = await syncShimmer()
  writeFileSync(GEOMETRY_OUT, geometryTs(synced, shimmer))
  execFileSync('npx', ['prettier', '--write', GEOMETRY_OUT], {
    stdio: 'ignore',
  })
  console.log(`wrote ${GEOMETRY_OUT}`)
}

await main()
