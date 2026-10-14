// ============================================================
// Echo's painted world, in numbers (generated)
// ============================================================
//
// Written by scripts/sync-echo-art.mjs from the Echo A0 art's geometry
// files; do not edit by hand, re-run the script when the art changes.
// Places are fractions of the plate's base frame (1290 x 2795, the
// storyboard's 19.5:9), u across and v down. The shipped plate is that
// frame with 301 rows of sky painted above it. Sizes
// ending in W are fractions of the room's width. Merc's seat, the ridge
// and the sky's floor come from echo-geometry.json, the strokes from
// echo-strokes.json and the result slots from storyboard screen 4's pins.
// The celebration star is in echo-celebration.ts.
//
// The files this was written against:
//   echo-citylight-demo-off-1290.webp  447x180  19266 bytes  sha256 b04c467b763c4f28
//   echo-citylight-demo-off-860.webp  298x120  20042 bytes  sha256 850486a4c7b2196a
//   echo-citylight-intro-1290.webp  315x141  29900 bytes  sha256 bd01061fe9b0e47e
//   echo-citylight-intro-860.webp  210x94  21286 bytes  sha256 c3e3cddda1f0e80e
//   echo-citylight-mid-take-1290.webp  426x141  23898 bytes  sha256 f8ddfbfd0472f98b
//   echo-citylight-mid-take-860.webp  284x94  19986 bytes  sha256 46e1f139ff0b516e
//   echo-clouds-demo-off-1290.webp  1290x3096  70730 bytes  sha256 ef39b3c920ee786b
//   echo-clouds-demo-off-860.webp  860x2064  50536 bytes  sha256 d6cba0eac9b34b26
//   echo-clouds-mid-take-1290.webp  1290x3096  77070 bytes  sha256 e81e60762f595988
//   echo-clouds-mid-take-860.webp  860x2064  55332 bytes  sha256 dc10ed0f07e753b1
//   echo-halo-finished.webp  274x274  5764 bytes  sha256 0a498016c1ce6e4b
//   echo-halo-phrase.webp  468x468  17982 bytes  sha256 d08e3f9335d40979
//   echo-halo-result.webp  388x388  9134 bytes  sha256 7cfa74bb5bdbdba3
//   echo-star-finished-base.webp  92x92  2512 bytes  sha256 183621311ae6f401
//   echo-star-finished-bright.webp  92x92  2496 bytes  sha256 707ffd25ae6ddbaf
//   echo-star-finished-cyan.webp  92x92  2536 bytes  sha256 e81074de0f8f8eb9
//   echo-star-finished-violet.webp  92x92  2488 bytes  sha256 e80f61f56107e678
//   echo-star-phrase-base.webp  344x344  18098 bytes  sha256 7375c044593b781d
//   echo-star-phrase-bright.webp  344x344  18098 bytes  sha256 e098621fb300bad1
//   echo-star-phrase-cyan.webp  344x344  17814 bytes  sha256 da0b94254a80b88a
//   echo-star-phrase-violet.webp  344x344  18050 bytes  sha256 88dd0a092eca58d2
//   echo-star-result-base.webp  218x218  7976 bytes  sha256 7ff4c331f37a4e84
//   echo-star-result-bright.webp  218x218  8024 bytes  sha256 cbacf36fd4bda060
//   echo-star-result-cyan.webp  218x218  8034 bytes  sha256 9d1c9a455d56dca1
//   echo-star-result-violet.webp  218x218  8032 bytes  sha256 48f6c00e74c5a0bd
//   echo-world-1290.webp  1290x3096  198002 bytes  sha256 29541abefa16569a
//   echo-world-860.webp  860x2064  108638 bytes  sha256 70f3fd061e0aa9ff
//   echo-world-result-1290.webp  1290x3096  265960 bytes  sha256 979ac080042f107c
//   echo-world-result-860.webp  860x2064  154102 bytes  sha256 8ba042b7fc7deeec

export interface PlatePoint {
  readonly u: number
  readonly v: number
}

/** The base frame: the storyboard's screen, bottom-anchored. */
export const PLATE_BASE = { width: 1290, height: 2795 } as const
/** The shipped plate's rows: the base frame and the sky above it. */
export const PLATE_ROWS = 3096

/** The sky above the plate's top row, for a screen taller than it. */
export const SKY_TOP_RGB = [7, 15, 37] as const

/** The world plate's colours band by band, for its fallback. */
export const WORLD_FALLBACK =
  'linear-gradient(to bottom, rgb(7, 16, 36) 4.2%, rgb(8, 17, 36) 12.5%, rgb(9, 18, 37) 20.8%, rgb(8, 19, 39) 29.2%, rgb(9, 19, 41) 37.5%, rgb(10, 23, 48) 45.8%, rgb(16, 31, 63) 54.2%, rgb(42, 53, 107) 62.5%, rgb(44, 47, 75) 70.8%, rgb(37, 46, 79) 79.2%, rgb(24, 32, 63) 87.5%, rgb(22, 29, 56) 95.8%)'
/** The result plate's, the same way. */
export const RESULT_FALLBACK =
  'linear-gradient(to bottom, rgb(6, 15, 33) 4.2%, rgb(7, 15, 32) 12.5%, rgb(8, 16, 33) 20.8%, rgb(8, 19, 41) 29.2%, rgb(8, 22, 51) 37.5%, rgb(16, 35, 77) 45.8%, rgb(14, 33, 72) 54.2%, rgb(66, 71, 129) 62.5%, rgb(71, 69, 112) 70.8%, rgb(82, 82, 121) 79.2%, rgb(39, 49, 91) 87.5%, rgb(24, 36, 74) 95.8%)'

/** The foreground roof's ridge: left edge, finial, right edge. */
export const RIDGE: readonly (readonly [number, number])[] = [
  [0, 0.7422],
  [0.5461, 0.7054],
  [1, 0.8354],
]

/** Where Merc sits on the ridge. */
export const MERC_SEAT: PlatePoint = { u: 0.27, v: 0.724 }

/**
 * The lowest place a star can sit without covering town or cloud, column
 * by column: [u, v] pairs.
 */
export const OPEN_SKY_FLOOR: readonly (readonly [number, number])[] = [
  [0.02, 0.4327],
  [0.04, 0.4349],
  [0.06, 0.4485],
  [0.08, 0.451],
  [0.1, 0.4828],
  [0.12, 0.4814],
  [0.14, 0.4882],
  [0.16, 0.4996],
  [0.18, 0.5229],
  [0.2, 0.5308],
  [0.22, 0.544],
  [0.24, 0.5444],
  [0.26, 0.5497],
  [0.28, 0.563],
  [0.3, 0.5637],
  [0.32, 0.5615],
  [0.34, 0.5601],
  [0.36, 0.5608],
  [0.38, 0.5587],
  [0.4, 0.563],
  [0.42, 0.5644],
  [0.44, 0.5633],
  [0.46, 0.5608],
  [0.48, 0.554],
  [0.5, 0.5526],
  [0.52, 0.5526],
  [0.54, 0.5537],
  [0.56, 0.5519],
  [0.58, 0.5476],
  [0.6, 0.5469],
  [0.62, 0.5422],
  [0.64, 0.5462],
  [0.66, 0.5444],
  [0.68, 0.5444],
  [0.7, 0.5447],
  [0.72, 0.5419],
  [0.74, 0.5411],
  [0.76, 0.5415],
  [0.78, 0.5401],
  [0.8, 0.5376],
  [0.82, 0.5372],
  [0.84, 0.5354],
  [0.86, 0.5308],
  [0.88, 0.5301],
  [0.9, 0.5311],
  [0.92, 0.5233],
  [0.94, 0.515],
  [0.96, 0.5136],
  [0.98, 0.5],
]

/** The floor of the phrase's band: no ring or star lower than this. */
export const PHRASE_FLOOR_V = 0.4485

/** Faint painted stars that twinkle, with the painted star's peak L*. */
export const TWINKLES: readonly (PlatePoint & { readonly peakL: number })[] = [
  { u: 0.2748, v: 0.4553, peakL: 99.9 },
  { u: 0.9531, v: 0.2277, peakL: 96.7 },
  { u: 0.519, v: 0.2127, peakL: 93 },
  { u: 0.4019, v: 0.2821, peakL: 92.1 },
  { u: 0.888, v: 0.4081, peakL: 92.7 },
  { u: 0.581, v: 0.3952, peakL: 91 },
  { u: 0.2888, v: 0.2277, peakL: 85.5 },
  { u: 0.9516, v: 0.1179, peakL: 83.8 },
]

/**
 * The light under the island: a Gaussian of this colour, alpha at its
 * centre, centred across the screen and above its top edge (in W).
 */
export const TOP_LIGHT = {
  rgb: [58, 115, 255],
  alpha: 1,
  centreYW: -0.1892,
  sigmaXW: 0.0905,
  sigmaYW: 0.2324,
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
  ringWaiting: {
    core: {
      rgb: [236, 239, 255],
      opacity: 1,
      widthW: 0.00461,
      sigmaW: 0.00114,
    },
    glow: {
      rgb: [107, 132, 255],
      opacity: 0.225,
      widthW: 0.03431,
      sigmaW: 0.01001,
    },
    fill: { rgb: [218, 231, 255], opacity: 1, lambdaW: 0.00335 },
    radiusW: 0.05032,
  },
  ringActive: {
    core: {
      rgb: [236, 238, 255],
      opacity: 1,
      widthW: 0.00491,
      sigmaW: 0.00086,
    },
    glow: {
      rgb: [106, 108, 255],
      opacity: 0.71,
      widthW: 0.01326,
      sigmaW: 0.01309,
    },
    fill: { rgb: [249, 255, 255], opacity: 1, lambdaW: 0.0033 },
    radiusW: 0.06158,
  },
  ringMissed: {
    core: {
      rgb: [207, 206, 255],
      opacity: 1,
      widthW: 0.00249,
      sigmaW: 0.00008,
    },
    glow: {
      rgb: [68, 79, 213],
      opacity: 0.227,
      widthW: 0.03571,
      sigmaW: 0.01012,
    },
    fill: { rgb: [234, 234, 255], opacity: 1, lambdaW: 0.00266 },
    radiusW: 0.03512,
  },
  linePhrase: {
    core: {
      rgb: [219, 228, 255],
      opacity: 1,
      widthW: 0.00535,
      sigmaW: 0.00002,
    },
    glow: { rgb: [53, 73, 255], opacity: 1, widthW: 0.01091, sigmaW: 0.00635 },
    fill: null,
    radiusW: null,
  },
  lineFinished: {
    core: { rgb: [161, 160, 255], opacity: 1, widthW: 0.003, sigmaW: 0.00082 },
    glow: {
      rgb: [57, 27, 255],
      opacity: 0.338,
      widthW: 0.00662,
      sigmaW: 0.00709,
    },
    fill: null,
    radiusW: null,
  },
  lineResult: {
    core: {
      rgb: [182, 200, 255],
      opacity: 1,
      widthW: 0.00367,
      sigmaW: 0.00037,
    },
    glow: {
      rgb: [53, 83, 255],
      opacity: 0.346,
      widthW: 0.01423,
      sigmaW: 0.00747,
    },
    fill: null,
    radiusW: null,
  },
} as const satisfies Record<string, StrokeStyle>

export type StarSize = 'phrase' | 'result' | 'finished'

/**
 * Each size's sprites: the star's canvas and its tip-to-tip width at alpha
 * over half (px), and the halo's canvas, padded equally round the star's
 * with the same centre. Every star's alpha centroid is its canvas centre.
 */
export const SPRITES: Readonly<
  Record<
    StarSize,
    { readonly canvas: number; readonly tip: number; readonly halo: number }
  >
> = {
  phrase: { canvas: 344, tip: 241, halo: 468 },
  result: { canvas: 218, tip: 152, halo: 388 },
  finished: { canvas: 92, tip: 61, halo: 274 },
}

/**
 * Each size's star, tip to tip, as the storyboard paints it on average (the
 * fixture choices' class widths: phrase and finished stars on screen 2,
 * result stars on screen 4), W.
 */
export const STAR_WIDTH_W: Readonly<Record<StarSize, number>> = {
  phrase: 0.17935,
  result: 0.07801,
  finished: 0.04638,
}

/** Screen 4's five constellations, in reading order: their stars' extent. */
export const RESULT_SLOTS: readonly {
  readonly u0: number
  readonly u1: number
  readonly v0: number
  readonly v1: number
  readonly stars: number
}[] = [
  { u0: 0.1218, u1: 0.3234, v0: 0.2958, v1: 0.3613, stars: 3 },
  { u0: 0.5963, u1: 0.7818, v0: 0.2956, v1: 0.364, stars: 3 },
  { u0: 0.3204, u1: 0.4471, v0: 0.3753, v1: 0.414, stars: 2 },
  { u0: 0.0714, u1: 0.2695, v0: 0.4388, v1: 0.4911, stars: 3 },
  { u0: 0.5536, u1: 0.7423, v0: 0.4513, v1: 0.522, stars: 3 },
]

/**
 * The cloud layer (echo-cloud-layer.json): its opacity per state, and its
 * fades in, between two states' layers, and out, ms.
 */
export const CLOUD_LAYER = {
  opacity: { intro: 0, 'mid-take': 1, 'demo-off': 1, result: 0 },
  inMs: 1600,
  crossMs: 1200,
  outMs: 800,
} as const

/**
 * The city light (echo-citylight-layer.json): the town's cyan light, one
 * small layer per state, over the state's clouds and under everything
 * drawn. Its opacity per state; each layer's box in fractions of the
 * shipped plate's box (left, top, width, height) and its files' widths
 * in px at the 860 and 1290 plates; the crossfade as the state changes and
 * the fade to the result, ms and CSS easing.
 */
export const CITY_LIGHT = {
  opacity: { intro: 1, 'mid-take': 1, 'demo-off': 1, result: 0 },
  layers: {
    intro: {
      left: 0.52558,
      top: 0.65019,
      width: 0.24419,
      height: 0.04554,
      px: [210, 315],
    },
    'mid-take': {
      left: 0.45116,
      top: 0.65019,
      width: 0.33023,
      height: 0.04554,
      px: [284, 426],
    },
    'demo-off': {
      left: 0.42326,
      top: 0.6376,
      width: 0.34651,
      height: 0.05814,
      px: [298, 447],
    },
  },
  crossMs: 1200,
  crossEase: 'ease-in-out',
  outMs: 800,
  outEase: 'ease-in',
} as const
