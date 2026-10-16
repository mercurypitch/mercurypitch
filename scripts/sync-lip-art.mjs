#!/usr/bin/env node
// ============================================================
// Lip roll's art, from the L0 folder into the room
// ============================================================
//
// The bay room's plates are painted and measured outside the repo (the L0
// folder: geometry/ for the measures, plates/ for the paintings; the
// Gemini picks beside it in gen-gemini-2026-10-14/lip/). This writes the
// files the room ships into src/features/lip-roll/art/ and the numbers it
// draws with into src/features/lip-roll/bay-geometry.ts.
//
// No painting is chosen yet (lip-l0/L0-REPORT.md 13). Every plate the
// folder's manifest does not list is made here as a stand-in
// (scripts/lip-art/stand-ins.mjs: drawn from the measures, or a Gemini
// pick graded to the storyboard's zones) at the frame and width the
// painting will have, and the spec marks it `standIn: true`. When a
// painting arrives, list it in plates/lip-plates.json and re-run: its file
// replaces the stand-in's, its frame the stand-in's frame, and the room's
// code does not change.
//
//   plates/lip-plates.json:
//   { "wave-lit": { "files": { "860": "wave-lit-860.webp",
//                              "1290": "wave-lit-1290.webp" },
//                   "frame": { "left": -0.5625, "top": -0.04,
//                              "width": 1.125, "height": 0.9228 } } }
//
// Re-run it whenever the art or the measures change; nothing it writes is
// edited by hand. The room's own wiring of each plate is in
// src/features/lip-roll/bay-art.ts; what each stand-in stands for is in
// src/features/lip-roll/STAND-INS.md.
//
//   node scripts/sync-lip-art.mjs <lip-l0 folder> [--gemini <folder>]

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, } from 'node:fs'
import { join, resolve } from 'node:path'
import { bayBackSvg, bubbleSvg, copyImage, cropRows, gradeUnlit, litZoneReport, MOON_HALO_SPREAD, moonSvg, renderSvg, resultEnvelope, resultImage, seaFrontSvg, waveG, waveLitImage, writeWebp, } from './lip-art/stand-ins.mjs'

const ROOT = process.cwd()
const SOURCE = process.argv[2]
if (
  SOURCE === undefined ||
  !existsSync(join(SOURCE, 'geometry/lip-geometry.json'))
) {
  console.error(
    'usage: node scripts/sync-lip-art.mjs <lip-l0 folder> [--gemini <folder>]',
  )
  process.exit(2)
}
const L0 = resolve(SOURCE)
const geminiFlag = process.argv.indexOf('--gemini')
const GEMINI =
  geminiFlag > 0
    ? resolve(process.argv[geminiFlag + 1])
    : resolve(L0, '../gen-gemini-2026-10-14/lip')
const ART = join(ROOT, 'src/features/lip-roll/art')
const GEOMETRY_OUT = join(ROOT, 'src/features/lip-roll/bay-geometry.ts')
const SPEC = JSON.parse(
  readFileSync(join(L0, 'geometry/lip-geometry.json'), 'utf8'),
)
const BOARD = JSON.parse(
  readFileSync(join(L0, 'geometry/lip-storyboard-geometry.json'), 'utf8'),
)
const PICK_MEASURE = JSON.parse(
  readFileSync(join(L0, 'measurements/gemini/lip_wave_lit_a.json'), 'utf8'),
)
const MANIFEST_PATH = join(L0, 'plates/lip-plates.json')
const MANIFEST = existsSync(MANIFEST_PATH)
  ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  : {}

const r4 = (v) => Math.round(v * 10_000) / 10_000
const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length

// ---- the measures ---------------------------------------------------------

const A = SPEC.wave_A_screen1
const B = SPEC.wave_B_screens23
const S1 = BOARD.screens['1']
const ASPECT = S1.aspect
const RESULT_ASPECT = r4(
  SPEC.result_view.horizon.y_W / SPEC.result_view.horizon.y_H,
)

/** Wave B (screens 2 and 3): the size the waves are painted and sung at. */
const wave = {
  h: B.h_W,
  a: B.a_W,
  f: B.f,
  crestY: r4(mean(B.screens.map((s) => s.crest_y_W))),
}
wave.rootY = r4(wave.crestY + wave.h)

/** Wave A (screen 1): the intro's camera shows wave B scaled to it. */
const intro = {
  crestX: A.intro.crest_x,
  crestY: A.intro.crest_y_W,
  sx: r4(A.a_W / B.a_W),
  sy: r4(A.h_W / B.h_W),
}

const LANDING = 0.1
const PERIOD = r4(2 * wave.a + LANDING)

const dotScreens = ['1', '2', '3'].map((s) => BOARD.screens[s].dot_measures)
const dots = {
  diameter: r4(mean(dotScreens.map((d) => d.diameter_W_est))),
  spacing: r4(mean(dotScreens.map((d) => d.spacing_W_median))),
  colour: S1.dot_measures.peak_hex,
  waterEdge: S1.water_edge.edge_under_dot_W_median,
}

const bay = {
  aspect: ASPECT,
  horizon: SPEC.bay['1'].horizon.y_W,
  horizonRun: r4(mean([SPEC.bay['2'].horizon.y_W, SPEC.bay['3'].horizon.y_W])),
  moon: {
    cx: SPEC.bay['1'].moon.cx,
    cy: SPEC.bay['1'].moon.cy_W,
    d: SPEC.bay['1'].moon.diameter_W,
    halo: SPEC.bay['1'].moon.halo_radius_W,
    core: SPEC.bay['1'].moon.core_hex,
  },
  // Where screens 2 and 3 put the moon: the run's sky aims for them.
  moonScreens: ['2', '3'].map((s) => ({
    cx: SPEC.bay[s].moon.cx,
    cy: SPEC.bay[s].moon.cy_W,
    d: SPEC.bay[s].moon.diameter_W,
  })),
}

const RV = SPEC.result_view
const resultView = {
  aspect: RESULT_ASPECT,
  waves: RV.waves.map((w) => ({
    x: w.x_c,
    crestY: w.crest_y_W,
    h: w.h_W,
    a: w.a_W,
    f: w.f,
  })),
  horizon: RV.horizon.y_W,
  // Gemini's lip_result_a is screen 4 from 0.16 to 0.84 H (L0 7).
  pickTop: r4(0.16 * RESULT_ASPECT),
  pickHeight: r4(0.68 * RESULT_ASPECT),
  // Screen 4's own top and bottom bands, sampled clear of the interface.
  skyTop: '#040c1a',
  seaBottom: '#05101f',
}

// ---- the plates' frames (W units) ------------------------------------------

const BP = B.plates
/** The bay-back: L0's frame, with 0.14 W more sky over it (see STAND-INS.md). */
const BAY_BACK = {
  left: -0.02,
  top: -0.14,
  width: BP['bay-back'].frame.width,
  height: r4(BP['bay-back'].frame.height + 0.14),
}
/** The moon: its halo's reach each way about screen 1's moon (moonSvg). */
const MOON_R = r4(bay.moon.halo * MOON_HALO_SPREAD)
const MOON = {
  left: r4(bay.moon.cx - MOON_R),
  top: r4(bay.moon.cy - MOON_R),
  width: r4(2 * MOON_R),
  height: r4(2 * MOON_R),
}
const WAVE_FRAME = BP['wave-unlit'].frame_about_crest
const SEA_FRONT = BP['sea-front'].frame
const RESULT = { left: 0, top: 0, width: 1, height: RESULT_ASPECT }
const RESULT_BAND = BP['result-lit'].frame

/** Gemini's wave as L0 measured it (lip_score.py wave). */
const pick = {
  width: PICK_MEASURE.size[0],
  height: PICK_MEASURE.size[1],
  xc: PICK_MEASURE.fit.x_c,
  a: PICK_MEASURE.fit.a_imgW,
  h: PICK_MEASURE.fit.h_imgW,
  crestRow: PICK_MEASURE.fit.crest_row_H,
  foamRow: PICK_MEASURE.foam_row_H,
}

/**
 * Screen 2's foam line, W under the wave's root: the lit wave is a mound
 * of water from the path down to it (L0 2.3, the lit zones' t = 0).
 */
const FOAM_UNDER_ROOT = r4(
  BOARD.screens['2'].lit_zones.foam_y_H_median * ASPECT - wave.rootY,
)

const waveGeo = {
  wave,
  frame: WAVE_FRAME,
  pick,
  waterEdge: dots.waterEdge,
  foamUnderRoot: FOAM_UNDER_ROOT,
}

/** The wave's dotted line in a wave plate's pixels (the unlit grade's depth). */
const lineInPlate = (px) => {
  const cx = -WAVE_FRAME.left * px
  const cy = -WAVE_FRAME.top * px
  return (x) => cy + wave.h * px * (1 - waveG((x - cx) / (wave.a * px), wave.f))
}

// ---- the plate list ---------------------------------------------------------

const waveCache = new Map()
async function litWave(px) {
  if (!waveCache.has(px)) {
    waveCache.set(
      px,
      await waveLitImage(join(GEMINI, 'lip_wave_lit_a.jpg'), px, waveGeo),
    )
  }
  return waveCache.get(px)
}

const resultCache = new Map()
async function litResult(px) {
  if (!resultCache.has(px)) {
    resultCache.set(
      px,
      await resultImage(join(GEMINI, 'lip_result_a.jpg'), px, resultView),
    )
  }
  return resultCache.get(px)
}

const PLATES = [
  {
    name: 'back',
    frame: BAY_BACK,
    widths: [645],
    make: async (f, px) => renderSvg(bayBackSvg(f, px, bay)),
  },
  {
    name: 'moon',
    frame: MOON,
    widths: [645],
    alpha: true,
    make: async (f, px) => renderSvg(moonSvg(f, px, bay.moon)),
  },
  {
    name: 'wave-lit',
    frame: WAVE_FRAME,
    widths: [860, 1290],
    alpha: true,
    make: async (_f, px) => litWave(px),
  },
  {
    name: 'wave-unlit',
    frame: WAVE_FRAME,
    widths: [860, 1290],
    alpha: true,
    make: async (_f, px) => {
      const img = copyImage(await litWave(px))
      const line = lineInPlate(px)
      gradeUnlit(
        img,
        px,
        line,
        (x, y) => img.data[(y * img.width + x) * 4 + 3] > 0,
      )
      return img
    },
  },
  {
    name: 'sea-front',
    frame: SEA_FRONT,
    widths: [860, 1290],
    alpha: true,
    make: async (f, px) => renderSvg(seaFrontSvg(f, px)),
  },
  {
    name: 'result',
    frame: RESULT,
    widths: [860, 1290],
    make: async (_f, px) => {
      const img = copyImage(await litResult(px))
      const edge = resultEnvelope(resultView)
      const line = (x) => edge(x / px) * px
      gradeUnlit(img, px, line, (x, y) => y + 0.5 >= line(x + 0.5) - 0.03 * px)
      return img
    },
  },
  {
    name: 'result-lit',
    frame: RESULT_BAND,
    widths: [860, 1290],
    make: async (f, px) =>
      cropRows(
        await litResult(px),
        Math.round(f.top * px),
        Math.round(f.height * px),
      ),
  },
]

const BUBBLE_PX = 64

const fileOf = (name, width, single) =>
  single ? `bay-${name}.webp` : `bay-${name}-${width}.webp`

/** One plate: the painting's files when the manifest lists it, else the stand-in. */
async function syncPlate(plate) {
  const painted = MANIFEST[plate.name]
  const single = plate.widths.length === 1
  if (painted !== undefined) {
    for (const width of plate.widths) {
      const from = join(L0, 'plates', painted.files[String(width)])
      copyFileSync(from, join(ART, fileOf(plate.name, width, single)))
    }
    return { frame: painted.frame, standIn: false }
  }
  for (const width of plate.widths) {
    const out = join(ART, fileOf(plate.name, width, single))
    const image = await plate.make(plate.frame, width)
    await writeWebp(image, out, { alpha: plate.alpha === true })
  }
  return { frame: plate.frame, standIn: true }
}

async function syncBubble() {
  const painted = MANIFEST.bubble
  const out = join(ART, 'bay-bubble.webp')
  if (painted !== undefined) {
    copyFileSync(join(L0, 'plates', painted.files.sprite), out)
    return { px: painted.px, standIn: false }
  }
  await writeWebp(await renderSvg(bubbleSvg(BUBBLE_PX)), out, { alpha: true })
  return { px: BUBBLE_PX, standIn: true }
}

/** The graded lit wave's zones against screen 2's, for the record. */
async function reportZones() {
  const px = 1290
  const img = await litWave(px)
  const cx = -WAVE_FRAME.left * px
  const top = -WAVE_FRAME.top * px + dots.waterEdge * px
  const edgeAt = (x) =>
    top + wave.h * px * (1 - waveG((x - cx) / (wave.a * px), wave.f))
  const foam = top + (wave.h + FOAM_UNDER_ROOT) * px
  const zones = litZoneReport(
    img,
    edgeAt,
    foam,
    wave.h * px,
    (x) => Math.abs(x - cx) < 0.9 * wave.a * px,
  )
  console.log(
    'wave-lit zones, dE2000 to screen 2:',
    zones.map((z) => `${z.zone.join('..')}: ${z.dE ?? '-'}`).join(', '),
  )
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

function geometryTs(synced, bubble) {
  const waveTs = (w) =>
    `{ x: ${w.x}, crestY: ${w.crestY}, h: ${w.h}, a: ${w.a}, f: ${w.f} }`
  const lines = [
    '// ============================================================',
    "// Lip roll's bay: where everything sits (generated)",
    '// ============================================================',
    '//',
    '// Written by scripts/sync-lip-art.mjs from the L0 measures',
    '// (lip-l0/geometry/lip-geometry.json, 14 Oct 2026). Do not edit by hand:',
    "// re-run the script. W units (the screen's width); y as the storyboard",
    `// frame draws it (aspect ${ASPECT}; screen 4's ${RESULT_ASPECT}). The waves are`,
    "// painted and sung at wave B's size (screens 2 and 3); the intro shows",
    "// them scaled to wave A's (screen 1) and the count-in zooms in. Wave",
    '// sprites are placed about their crest. `standIn: true` marks a plate',
    '// made from these numbers until its painting arrives (STAND-INS.md).',
    '',
    `export const STORYBOARD_ASPECT = ${ASPECT}`,
    `export const RESULT_ASPECT = ${RESULT_ASPECT}`,
    '',
    "/** Wave B: the octave's height, the half-width, the top's share, the crest's and root's y. */",
    'export const WAVE = {',
    `  h: ${wave.h},`,
    `  a: ${wave.a},`,
    `  f: ${wave.f},`,
    `  crestY: ${wave.crestY},`,
    `  rootY: ${wave.rootY},`,
    '} as const',
    '',
    "/** The intro (screen 1): wave B scaled to wave A, the first crest's place. */",
    'export const INTRO = {',
    `  crestX: ${intro.crestX},`,
    `  crestY: ${intro.crestY},`,
    `  sx: ${intro.sx},`,
    `  sy: ${intro.sy},`,
    '} as const',
    '',
    "/** The landing between waves (option B) and the waves' period. */",
    `export const LANDING_W = ${LANDING}`,
    `export const PERIOD_W = ${PERIOD}`,
    '',
    '/** Where the playhead stands. */',
    'export const PLAYHEAD_X = 0.35',
    '',
    "/** The dotted crest: each dot's size, their spacing along the line, the water's edge under them. */",
    'export const DOTS = {',
    `  diameter: ${dots.diameter},`,
    `  spacing: ${dots.spacing},`,
    `  colour: '${dots.colour}',`,
    `  waterEdge: ${dots.waterEdge},`,
    '} as const',
    '',
    "/** The bay-back's horizon on the intro (screen 1) and in the run (screens 2 and 3); the moon on screen 1, and on screens 2 and 3. */",
    'export const BAY = {',
    `  horizon: ${bay.horizon},`,
    `  horizonRun: ${bay.horizonRun},`,
    `  moon: { cx: ${bay.moon.cx}, cy: ${bay.moon.cy}, d: ${bay.moon.d} },`,
    `  moonScreens: [${bay.moonScreens.map((m) => `{ cx: ${m.cx}, cy: ${m.cy}, d: ${m.d} }`).join(', ')}],`,
    '} as const',
    '',
    '/** The pulled-back view (screen 4): three waves across the bay. */',
    'export const RESULT_VIEW = {',
    `  waves: [${resultView.waves.map(waveTs).join(', ')}],`,
    `  horizon: ${resultView.horizon},`,
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
    'export type BayPlate =',
    ...PLATES.map((p, i) => `  ${i === 0 ? '' : '| '}'${p.name}'`),
    '',
    '/** Every plate the room draws, as the sync script found or made it. */',
    'export const PLATES: Readonly<Record<BayPlate, PlateFrame>> = {',
    ...PLATES.map((p) => plateTs(p, synced[p.name])),
    '}',
    '',
    '/** One glass bubble, drawn by the room along the voice. */',
    `export const BUBBLE = { px: ${bubble.px}, standIn: ${bubble.standIn} } as const`,
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
  const bubble = await syncBubble()
  if (MANIFEST['wave-lit'] === undefined) await reportZones()
  writeFileSync(GEOMETRY_OUT, geometryTs(synced, bubble))
  execFileSync('npx', ['prettier', '--write', GEOMETRY_OUT], {
    stdio: 'ignore',
  })
  console.log(`wrote ${GEOMETRY_OUT}`)
}

await main()
