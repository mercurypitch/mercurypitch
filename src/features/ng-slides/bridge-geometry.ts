// ============================================================
// Ng slides' bridge: where everything sits (generated)
// ============================================================
//
// Written by scripts/sync-ng-art.mjs from the N0 measures
// (ng-n0/geometry/ng-geometry.json, N0, 14 Oct 2026). Do not edit by hand:
// re-run the script. W units (the screen's width); y as the storyboard
// frame draws it (aspect 2.578); the room crops the frame's extra height
// equally from the sky and the water (bridge-layout.ts). Arch sprites are
// placed about their apex column. `standIn: true` marks a plate drawn from
// these numbers until its painting arrives (STAND-INS.md).

export const STORYBOARD_ASPECT = 2.578

/** The arch (screen 1's fitted rim) and the stone it stands on. */
export const ARCH = {
  h: 0.3932,
  a: 0.3957,
  f: 0.1429,
  deckY: 1.3932,
  apexY: 0.9999,
  pedestalTopY: 1.5429,
  waterY: 1.6267,
  legIn: 0.2702,
  legOut: 0.3402,
  semitone: 0.0562,
} as const

/** The landing between arches (option B) and the arches' period. */
export const LANDING_W = 0.1
export const PERIOD_W = 0.8914

/** Where the playhead stands, and the first apex on the intro (screen 1). */
export const PLAYHEAD_X = 0.35
export const INTRO_APEX_X = 0.7002

/** The target line's core, under the fitted rim. */
export const TARGET_LINE = {
  width: 0.0069,
  colour: '#e7eff9',
  offset: 0.0023,
} as const

/** The first arch's note names (screen 1). */
export const NOTE_NAMES = {
  root: { dx: -0.3317, dy: 0.0196, colour: '#84baf6' },
  top: { dx: 0.0093, dy: -0.0733, colour: '#9dc2f9' },
  capHeight: 0.0428,
} as const

/** The voice's ribbon: its half-height width (screen 2), W. */
export const RIBBON_FWHM_W = 0.0313

/** The river-back scrolls at this share of the bridge's speed. */
export const PARALLAX = 0.3333

/** The pulled-back view (screen 4): five arches across the river. */
export const RESULT_VIEW = {
  apexX: [0.12, 0.296, 0.484, 0.676, 0.865],
  apexY: 1.3535,
  valleyY: 1.4411,
  mirrorY: 1.5241,
  halfWidth: 0.0935,
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

export type BridgePlate =
  | 'riverback'
  | 'glass-unlit'
  | 'glass-lit'
  | 'reflection-unlit'
  | 'reflection-lit'
  | 'landing'
  | 'pier'
  | 'near-left'
  | 'near-right'
  | 'result'
  | 'result-lit'

/** Every plate the room draws, as the sync script found or drew it. */
export const PLATES: Readonly<Record<BridgePlate, PlateFrame>> = {
  riverback: {
    frame: { left: 0, top: 0.089, width: 2.64, height: 2.4 },
    widths: [645],
    standIn: true,
  },
  'glass-unlit': {
    frame: { left: -0.4257, top: 0.9522, width: 0.8514, height: 0.6027 },
    widths: [860, 1290],
    standIn: true,
  },
  'glass-lit': {
    frame: { left: -0.4257, top: 0.9522, width: 0.8514, height: 0.6027 },
    widths: [860, 1290],
    standIn: true,
  },
  'reflection-unlit': {
    frame: { left: -0.4257, top: 1.6567, width: 0.8514, height: 0.6895 },
    widths: [430],
    standIn: true,
  },
  'reflection-lit': {
    frame: { left: -0.4257, top: 1.6567, width: 0.8514, height: 0.6895 },
    widths: [430],
    standIn: true,
  },
  landing: {
    frame: { left: 0.2602, top: 1.3812, width: 0.371, height: 0.2515 },
    widths: [860, 1290],
    standIn: true,
  },
  pier: {
    frame: { left: -1.26, top: 1.3812, width: 0.9998, height: 0.2515 },
    widths: [860, 1290],
    standIn: true,
  },
  'near-left': {
    frame: { left: 0, top: 0, width: 0.42, height: 1 },
    widths: [860, 1290],
    standIn: true,
  },
  'near-right': {
    frame: { left: 0, top: 0, width: 1, height: 0.4 },
    widths: [860, 1290],
    standIn: true,
  },
  result: {
    frame: { left: 0, top: 0, width: 1, height: 2.578 },
    widths: [860, 1290],
    standIn: true,
  },
  'result-lit': {
    frame: { left: 0, top: 1.2935, width: 1, height: 0.4512 },
    widths: [860, 1290],
    standIn: true,
  },
}

/** The water's shimmer: one tile, repeated sideways. */
export const SHIMMER = { width: 640, height: 200, standIn: true } as const
