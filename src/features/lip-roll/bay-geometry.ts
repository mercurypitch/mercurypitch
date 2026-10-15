// ============================================================
// Lip roll's bay: where everything sits (generated)
// ============================================================
//
// Written by scripts/sync-lip-art.mjs from the L0 measures
// (lip-l0/geometry/lip-geometry.json, 14 Oct 2026). Do not edit by hand:
// re-run the script. W units (the screen's width); y as the storyboard
// frame draws it (aspect 2.6206; screen 4's 2.629). The waves are
// painted and sung at wave B's size (screens 2 and 3); the intro shows
// them scaled to wave A's (screen 1) and the count-in zooms in. Wave
// sprites are placed about their crest. `standIn: true` marks a plate
// made from these numbers until its painting arrives (STAND-INS.md).

export const STORYBOARD_ASPECT = 2.6206
export const RESULT_ASPECT = 2.629

/** Wave B: the octave's height, the half-width, the top's share, the crest's and root's y. */
export const WAVE = {
  h: 0.3708,
  a: 0.4125,
  f: 0.0769,
  crestY: 1.0002,
  rootY: 1.371,
} as const

/** The intro (screen 1): wave B scaled to wave A, the first crest's place. */
export const INTRO = {
  crestX: 0.6838,
  crestY: 0.9366,
  sx: 0.9552,
  sy: 0.7209,
} as const

/** The landing between waves (option B) and the waves' period. */
export const LANDING_W = 0.1
export const PERIOD_W = 0.925

/** Where the playhead stands. */
export const PLAYHEAD_X = 0.35

/** The dotted crest: each dot's size, their spacing along the line, the water's edge under them. */
export const DOTS = {
  diameter: 0.0134,
  spacing: 0.0339,
  colour: '#f7fcfe',
  waterEdge: 0.0102,
} as const

/** The bay-back's horizon on the intro (screen 1) and in the run (screens 2 and 3); the moon on screen 1, and on screens 2 and 3. */
export const BAY = {
  horizon: 0.8215,
  horizonRun: 0.9277,
  moon: { cx: 0.6767, cy: 0.43, d: 0.1168 },
  moonScreens: [
    { cx: 0.5934, cy: 0.575, d: 0.1046 },
    { cx: 0.5164, cy: 0.4754, d: 0.1035 },
  ],
} as const

/** The pulled-back view (screen 4): three waves across the bay. */
export const RESULT_VIEW = {
  waves: [
    { x: 0.1698, crestY: 1.1549, h: 0.195, a: 0.2001, f: 0.0107 },
    { x: 0.5172, crestY: 1.176, h: 0.253, a: 0.2286, f: 0 },
    { x: 0.8695, crestY: 1.2424, h: 0.1882, a: 0.1811, f: 0.0129 },
  ],
  horizon: 1.1097,
} as const

/** A plate: its frame (W units) and its files' widths in px per W. */
export interface PlateFrame {
  readonly frame: {
    readonly left: number
    readonly top: number
    readonly width: number
    readonly height: number
  }
  readonly widths: readonly number[]
  readonly standIn: boolean
}

export type BayPlate =
  | 'back'
  | 'moon'
  | 'wave-lit'
  | 'wave-unlit'
  | 'sea-front'
  | 'result'
  | 'result-lit'

/** Every plate the room draws, as the sync script found or made it. */
export const PLATES: Readonly<Record<BayPlate, PlateFrame>> = {
  back: {
    frame: { left: -0.02, top: -0.14, width: 1.724, height: 2.7606 },
    widths: [645],
    standIn: true,
  },
  moon: {
    frame: { left: 0.4074, top: 0.1607, width: 0.5386, height: 0.5386 },
    widths: [645],
    standIn: true,
  },
  'wave-lit': {
    frame: { left: -0.5625, top: -0.04, width: 1.125, height: 0.9228 },
    widths: [860, 1290],
    standIn: true,
  },
  'wave-unlit': {
    frame: { left: -0.5625, top: -0.04, width: 1.125, height: 0.9228 },
    widths: [860, 1290],
    standIn: true,
  },
  'sea-front': {
    frame: { left: 0, top: 1.7594, width: 1, height: 0.8612 },
    widths: [860, 1290],
    standIn: true,
  },
  result: {
    frame: { left: 0, top: 0, width: 1, height: 2.629 },
    widths: [860, 1290],
    standIn: true,
  },
  'result-lit': {
    frame: { left: 0, top: 1.0516, width: 1, height: 1.2093 },
    widths: [860, 1290],
    standIn: true,
  },
}

/** One glass bubble, drawn by the room along the voice. */
export const BUBBLE = { px: 64, standIn: true } as const
