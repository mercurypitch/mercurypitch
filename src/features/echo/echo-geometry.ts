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
// echo-strokes.json, the result slots from storyboard screen 4's pins and
// the celebration star from echo-celebration-star.json.
//
// The files this was written against:
//   echo-clouds-demo-off-1290.webp  1290x3096  71096 bytes  sha256 5a957b02ee541966
//   echo-clouds-demo-off-860.webp  860x2064  50814 bytes  sha256 16aad420c34f3afa
//   echo-clouds-mid-take-1290.webp  1290x3096  77424 bytes  sha256 5f7d46919bbd22ac
//   echo-clouds-mid-take-860.webp  860x2064  55688 bytes  sha256 7f3004876a05c515
//   echo-halo-finished.webp  274x274  5764 bytes  sha256 0a498016c1ce6e4b
//   echo-halo-phrase.webp  468x468  13892 bytes  sha256 8dbc17e0d7697260
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
//   echo-world-1290.webp  1290x3096  197930 bytes  sha256 09b323ae511192f7
//   echo-world-860.webp  860x2064  116556 bytes  sha256 51b57ec0a5482712
//   echo-world-result-1290.webp  1290x3096  271634 bytes  sha256 a24a96cc80c10e76
//   echo-world-result-860.webp  860x2064  157884 bytes  sha256 fd8f306b2c3b549e

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
  'linear-gradient(to bottom, rgb(7, 16, 36) 4.2%, rgb(8, 17, 36) 12.5%, rgb(9, 18, 37) 20.8%, rgb(8, 18, 39) 29.2%, rgb(9, 19, 41) 37.5%, rgb(10, 23, 48) 45.8%, rgb(16, 31, 63) 54.2%, rgb(42, 54, 107) 62.5%, rgb(45, 47, 75) 70.8%, rgb(37, 46, 79) 79.2%, rgb(24, 32, 63) 87.5%, rgb(22, 29, 56) 95.8%)'
/** The result plate's, the same way. */
export const RESULT_FALLBACK =
  'linear-gradient(to bottom, rgb(6, 15, 33) 4.2%, rgb(7, 15, 33) 12.5%, rgb(8, 16, 33) 20.8%, rgb(8, 19, 41) 29.2%, rgb(8, 22, 52) 37.5%, rgb(16, 35, 77) 45.8%, rgb(15, 33, 72) 54.2%, rgb(66, 71, 129) 62.5%, rgb(71, 69, 112) 70.8%, rgb(82, 82, 121) 79.2%, rgb(39, 49, 91) 87.5%, rgb(24, 36, 74) 95.8%)'

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
 * The result's celebration star, art round 4 (echo-celebration-star.json,
 * its r3 block): the star (a hollow double outline in its glow, the inner
 * one lumpy: its corners' radius factors counter-clockwise on screen from
 * the top tip), the 33 sparkle dots in reveal order, the three ribbons
 * (Catmull-Rom curves through their dots) and the starburst (a mist laid
 * over, a glow, rays and a core), places in plate fractions and sizes in
 * W, colours sRGB; and the timings, ms from the result's stars landing.
 * A glow is its reach (W) and its rings' screen colours, centre to edge,
 * fitted to the result plate (scripts/sync-echo-art.mjs fitLights).
 */
export const CELEBRATION = {
  star: {
    u: 0.72625,
    v: 0.57463,
    tipW: 0.01581,
    outer: {
      valleyOverTip: 0.5,
      strokeW: 0.00412,
      top: [203, 232, 255],
      bottom: [113, 250, 255],
    },
    inner: {
      scale: 0.6,
      valleyOverTip: 0.5,
      strokeW: 0.00275,
      top: [226, 248, 255],
      bottom: [142, 255, 255],
      wobbleCcw: [
        1.162, 0.892, 1.054, 0.82, 1.126, 0.964, 1.18, 0.856, 1.072, 0.91,
      ],
    },
    fill: { rgb: [0, 149, 237], alpha: 0.78 },
    glow: {
      reachW: 0.11546,
      screen: [
        [7, 34, 123],
        [7, 34, 123],
        [7, 34, 124],
        [7, 34, 123],
        [6, 31, 111],
        [6, 28, 96],
        [5, 25, 88],
        [5, 25, 86],
        [6, 25, 87],
        [5, 22, 76],
        [4, 18, 62],
        [3, 15, 52],
        [3, 13, 44],
        [2, 11, 38],
        [2, 10, 34],
        [2, 8, 29],
        [2, 7, 24],
        [1, 5, 18],
        [1, 3, 12],
        [1, 2, 8],
        [0, 2, 6],
        [0, 1, 3],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
    },
  },
  dots: [
    {
      u: 0.76326,
      v: 0.60525,
      rgb: [122, 208, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00775,
      glowAlpha: 0.8,
      rank: 0,
    },
    {
      u: 0.78271,
      v: 0.59437,
      rgb: [149, 255, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00676,
      glowAlpha: 0.8,
      rank: 1,
    },
    {
      u: 0.76701,
      v: 0.61854,
      rgb: [120, 250, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00548,
      glowAlpha: 0.8,
      rank: 2,
    },
    {
      u: 0.75581,
      v: 0.60676,
      rgb: [133, 226, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00801,
      glowAlpha: 0.8,
      rank: 3,
    },
    {
      u: 0.82763,
      v: 0.59757,
      rgb: [100, 243, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00758,
      glowAlpha: 0.8,
      rank: 4,
    },
    {
      u: 0.83773,
      v: 0.60213,
      rgb: [132, 255, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00565,
      glowAlpha: 0.8,
      rank: 5,
    },
    {
      u: 0.78175,
      v: 0.58973,
      rgb: [115, 238, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00674,
      glowAlpha: 0.8,
      rank: 6,
    },
    {
      u: 0.74911,
      v: 0.60916,
      rgb: [121, 190, 235],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00635,
      glowAlpha: 0.8,
      rank: 7,
    },
    {
      u: 0.76948,
      v: 0.58959,
      rgb: [160, 255, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00553,
      glowAlpha: 0.8,
      rank: 8,
    },
    {
      u: 0.75739,
      v: 0.59144,
      rgb: [148, 221, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00669,
      glowAlpha: 0.8,
      rank: 9,
    },
    {
      u: 0.83845,
      v: 0.59362,
      rgb: [116, 241, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00714,
      glowAlpha: 0.8,
      rank: 10,
    },
    {
      u: 0.78608,
      v: 0.58235,
      rgb: [113, 193, 254],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00621,
      glowAlpha: 0.8,
      rank: 11,
    },
    {
      u: 0.76436,
      v: 0.57911,
      rgb: [96, 154, 239],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00414,
      glowAlpha: 0.8,
      rank: 12,
    },
    {
      u: 0.79337,
      v: 0.56975,
      rgb: [102, 181, 245],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00772,
      glowAlpha: 0.8,
      rank: 13,
    },
    {
      u: 0.78962,
      v: 0.5663,
      rgb: [146, 255, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00592,
      glowAlpha: 0.8,
      rank: 14,
    },
    {
      u: 0.80076,
      v: 0.56594,
      rgb: [89, 195, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00613,
      glowAlpha: 0.8,
      rank: 15,
    },
    {
      u: 0.69725,
      v: 0.59451,
      rgb: [128, 175, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00719,
      glowAlpha: 0.8,
      rank: 16,
    },
    {
      u: 0.68883,
      v: 0.5906,
      rgb: [111, 163, 247],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00568,
      glowAlpha: 0.8,
      rank: 17,
    },
    {
      u: 0.67646,
      v: 0.60233,
      rgb: [227, 254, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00712,
      glowAlpha: 0.8,
      rank: 18,
    },
    {
      u: 0.67649,
      v: 0.59811,
      rgb: [214, 255, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00633,
      glowAlpha: 0.8,
      rank: 19,
    },
    {
      u: 0.67254,
      v: 0.60676,
      rgb: [192, 201, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00714,
      glowAlpha: 0.8,
      rank: 20,
    },
    {
      u: 0.69405,
      v: 0.57156,
      rgb: [94, 166, 235],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00625,
      glowAlpha: 0.8,
      rank: 21,
    },
    {
      u: 0.67179,
      v: 0.58616,
      rgb: [132, 203, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.0057,
      glowAlpha: 0.8,
      rank: 22,
    },
    {
      u: 0.76168,
      v: 0.54849,
      rgb: [83, 152, 251],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00635,
      glowAlpha: 0.8,
      rank: 23,
    },
    {
      u: 0.66144,
      v: 0.58484,
      rgb: [159, 242, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00548,
      glowAlpha: 0.8,
      rank: 24,
    },
    {
      u: 0.67333,
      v: 0.572,
      rgb: [107, 182, 251],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00678,
      glowAlpha: 0.8,
      rank: 25,
    },
    {
      u: 0.65192,
      v: 0.59281,
      rgb: [144, 210, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00585,
      glowAlpha: 0.8,
      rank: 26,
    },
    {
      u: 0.64344,
      v: 0.60584,
      rgb: [150, 190, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00469,
      glowAlpha: 0.8,
      rank: 27,
    },
    {
      u: 0.64151,
      v: 0.59468,
      rgb: [112, 168, 251],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00601,
      glowAlpha: 0.8,
      rank: 28,
    },
    {
      u: 0.62643,
      v: 0.59476,
      rgb: [138, 201, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00621,
      glowAlpha: 0.8,
      rank: 29,
    },
    {
      u: 0.59749,
      v: 0.59571,
      rgb: [129, 192, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00611,
      glowAlpha: 0.8,
      rank: 30,
    },
    {
      u: 0.56639,
      v: 0.6027,
      rgb: [159, 179, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00498,
      glowAlpha: 0.8,
      rank: 31,
    },
    {
      u: 0.5633,
      v: 0.60946,
      rgb: [179, 175, 255],
      coreFwhmW: 0.00344,
      glowFwhmW: 0.00674,
      glowAlpha: 0.8,
      rank: 32,
    },
  ],
  ribbons: [
    {
      points: [
        [0.6264, 0.5948],
        [0.6415, 0.5947],
        [0.6519, 0.5928],
        [0.6614, 0.5848],
        [0.6718, 0.5862],
        [0.6888, 0.5906],
        [0.6973, 0.5945],
      ],
      fwhmW: 0.00378,
      rgb: [0, 225, 255],
      alpha: 0.15,
      wisp: { depth: 0.2, periodW: 0.02405, phase: 0 },
      taperW: 0.01031,
    },
    {
      points: [
        [0.6614, 0.5848],
        [0.6733, 0.572],
        [0.694, 0.5716],
      ],
      fwhmW: 0.00378,
      rgb: [0, 225, 255],
      alpha: 0.3,
      wisp: { depth: 0.2, periodW: 0.02405, phase: 1.3 },
      taperW: 0.01031,
    },
    {
      points: [
        [0.8008, 0.5659],
        [0.7896, 0.5663],
        [0.7934, 0.5698],
        [0.7861, 0.5824],
        [0.7817, 0.5897],
        [0.7827, 0.5944],
        [0.7633, 0.6053],
        [0.7558, 0.6068],
        [0.7491, 0.6092],
      ],
      fwhmW: 0.00378,
      rgb: [0, 225, 255],
      alpha: 0.3,
      wisp: { depth: 0.2, periodW: 0.02405, phase: 2.6 },
      taperW: 0.01031,
    },
  ],
  burst: {
    u: 0.78838,
    v: 0.60733,
    core: { fwhmW: 0.01203, rgb: [243, 254, 255] },
    mist: {
      offsetW: [0, -0.01031],
      sigmaW: 0.02405,
      alpha: 0.95,
      rgb: [0, 190, 203],
      rightCut: 0.3,
      streaks: { n: 7, depth: 0 },
    },
    glow: {
      reachW: 0.04377,
      screen: [
        [45, 232, 255],
        [45, 229, 255],
        [43, 222, 255],
        [40, 210, 255],
        [37, 192, 245],
        [33, 172, 232],
        [30, 153, 216],
        [27, 132, 184],
        [24, 112, 154],
        [21, 95, 125],
        [17, 78, 97],
        [14, 63, 77],
        [11, 50, 61],
        [9, 39, 46],
        [6, 30, 34],
        [5, 23, 26],
        [4, 18, 19],
        [2, 13, 14],
        [2, 10, 10],
        [1, 7, 7],
        [1, 5, 5],
        [0, 3, 3],
        [0, 2, 2],
        [0, 2, 2],
        [0, 0, 0],
      ],
    },
    rays: {
      lengthW: { up: 0.01031, down: 0.04124, left: 0.02405, right: 0.00859 },
      widthFwhmW: 0.00344,
      rgb: [195, 255, 255],
      diagonal: { lengthW: 0.01375, alpha: 0.7 },
    },
  },
  timing: {
    burst: {
      coreScale: [
        [0, 0],
        [220, 1.25],
        [520, 1],
      ],
      glowOpacity: [
        [0, 0],
        [300, 1],
      ],
      raysLength: [
        [0, 0],
        [260, 1],
      ],
    },
    mist: {
      opacity: [
        [0, 0],
        [380, 1],
      ],
      scale: [
        [0, 0.7],
        [380, 1],
      ],
    },
    dots: { firstMs: 200, staggerMs: 28, durationMs: 160, fromScale: 1.8 },
    ribbons: { fromMs: 420, durationMs: 700, staggerMs: 120 },
    star: {
      outer: [900, 1340],
      inner: [1100, 1420],
      fill: [1200, 1500],
      glow: [1200, 1700],
    },
    idleFromMs: 1800,
    idle: {
      dotOpacity: [0.7, 1],
      dotPeriodMs: [1600, 3200],
      dotSeed: 7,
      glowOpacity: [0.85, 1],
      glowPeriodMs: 3200,
      raysScale: [0.88, 1],
      raysPeriodMs: 2400,
      wispRadPerS: 0.8,
    },
  },
} as const

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
