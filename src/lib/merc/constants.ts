// ============================================================
// Merc constants — the authored shape, palette, light, quality and framing
// ============================================================
//
// Every number here was fitted to the concept paintings in the pass 4 study
// and approved by the owner. The shape constants are baked into the shader
// source as #defines, so changing one changes the GLSL text (and the hash
// that scene-shader.test.ts pins). The palette and the look are uniforms.

export type Vec3 = readonly [number, number, number]
export type Vec4 = readonly [number, number, number, number]

export const STATES = [
  'drop',
  'idle',
  'listen',
  'sing',
  'lock',
  'climb',
  'celebrate',
  'point',
  'sleep',
  'hop',
] as const

export type MercState = (typeof STATES)[number]

export function isMercState(name: string): name is MercState {
  return (STATES as readonly string[]).includes(name)
}

// Rest shape, in world units (body base on the floor at y = 0, about 1.14 tall).
export const SHAPE = {
  // Heights are from the floor. bodyY0 is where the colour and the squash
  // count from (h = 0); restH is the crown tip. Pass 4 seated the body 0.07
  // lower on its feet, as painted, so every body height moved down by that.
  bodyY0: -0.015,
  restH: 1.225,
  // One oval belly and a round-cone crown, blended. Fitted to the concept's
  // front outline (three figures, 0.2 px rms at 183 px tall): the belly is a
  // plain ellipse, so the bottom is a single smooth curve with no flat disc.
  bulbY: 0.4105,
  bulbR: [0.4955, 0.3751, 0.4756] as Vec3,
  coneY: 0.5912,
  coneR1: 0.3972,
  coneR2: 0.1589,
  coneH: 0.4747,
  tipPinch: 0.065,
  bodyK: 0.2327,
  // The painted base is flatter than the oval: the underside is cut level,
  // smoothly, a little above the oval's pole (base widths match the three
  // figures down to the feet).
  flatY: 0.0644,
  flatK: 0.05,
  // Feet: jelly beans tucked under the body, each 0.22 of the width across,
  // longer front to back, toes out a little and fuller at the outer end; the
  // body's edge passes in front of their tops.
  footC: [0.225, 0.05, 0.2] as Vec3,
  footR: [0.102, 0.05, 0.12] as Vec3,
  footK: 0.016,
  footToe: 10,
  nub: [0.3, 0.545, 0.05] as Vec3,
  // Eyes: size and place measured on the painted front figures (each eye
  // 0.17 of the width across and 0.32 of the height tall, centres 0.19 out
  // and 0.6 down).
  eyeX: 0.176,
  eyeY: 0.588,
  // The domes stand proud of the body by about 0.03 with steep sides, so a
  // turned view shows their edge, as in the three-quarter paintings.
  eyeR: [0.0901, 0.1909, 0.039] as Vec3,
  // How far each eye's top leans in toward the middle, in degrees.
  eyeTilt: 3.0,
  eyeEmbed: 0.008,
  // The eye's top is drawn this much narrower (its bottom fuller): the
  // painted eye is an ellipse a touch fuller at the bottom (top quarter about
  // 0.9 the width of the bottom quarter).
  eyeEgg: -0.06,
  mouthY: 0.407,
  coreY: 0.285,
} as const

export type GradientStop = readonly [height: number, hex: string]

export interface MercPalette {
  /** Body colour by height (0 = body bottom, 1 = crown tip), sRGB. */
  readonly stops: readonly GradientStop[]
  /** The bead feet: deep, light. */
  readonly bead: readonly [deep: string, light: string]
}

// The painted concept art: violet crown, a saturated indigo then azure middle,
// teal base, blue feet. Pass 4 fitted these stops by least squares to the
// centre column of the three front figures. The owner picked this palette;
// the study's lighter "svg" palette is not carried over.
export const PALETTE: MercPalette = {
  stops: [
    [0.0, '#04ecd8'],
    [0.136, '#04ecd8'],
    [0.232, '#129e9b'],
    [0.328, '#1a73b1'],
    [0.424, '#0062d0'],
    [0.52, '#016be5'],
    [0.616, '#105eec'],
    [0.712, '#2747f0'],
    [0.808, '#5133f3'],
    [0.904, '#8841f5'],
    [1.0, '#be6cf5'],
  ],
  bead: ['#0566aa', '#16b2e4'],
}

// Uniform array length for the gradient: the stops, padded past 1.
export const GRAD_N = 12

// The painted light (pass 4), fitted to the concept's three front figures.
// Uniforms, so setLook can tune it live.
//   edge:     lightening toward the outline: strength up top, strength low
//             down, falloff power across, how far down the gradient it reads
//             low down
//   edge2:    how far down the gradient it reads up top, its whitening low
//             down, the crown and shoulder streaks' tilt (outward going down)
//   crown, shoulder: the near-white streak inside each flank: height (0 =
//             bottom, 1 = tip), offset across (0 = facing the camera, 1 = the
//             outline), spread in height, spread across
//   k:        crown streak, shoulder streak, edge whitening up top, left key
//   tint:     the streaks' colour
//   tint2:    what the edge light whitens toward low down (white up top)
export interface MercLook {
  readonly edge: Vec4
  readonly edge2: Vec4
  readonly crown: Vec4
  readonly shoulder: Vec4
  readonly k: Vec4
  readonly tint: string
  readonly tint2: string
}

export const LOOK: MercLook = {
  edge: [0.6, 1, 1.6, 0.225],
  edge2: [-0.2525, 0.35, 0.4, 0.4],
  crown: [0.85, 0.67, 0.0575, 0.07],
  shoulder: [0.62, 0.77, 0.0725, 0.06],
  k: [1.25, 1.45, 0.55, 0.8],
  tint: '#f6f2ff',
  tint2: '#64cbfa',
}

export interface MercQualitySpec {
  /** Render size as a fraction of the canvas's CSS size times pixel ratio. */
  readonly scale: number
  /** Samples per pixel: 1, 4 (rotated grid) or 9 (3x3). */
  readonly spp: number
  /** Raymarch step budget. */
  readonly steps: number
  /** 1: one-sample tiers antialias the silhouette from the march's near miss. */
  readonly edgeAA: number
}

export type MercQuality = 'low' | 'medium' | 'high' | 'ultra'

// Desktop GPU time at 1024 px (pass 4): Medium 0.25-0.29 ms, High 0.75-1.09 ms.
export const QUALITY: Readonly<Record<MercQuality, MercQualitySpec>> = {
  low: { scale: 0.5, spp: 1, steps: 48, edgeAA: 1 },
  medium: { scale: 0.75, spp: 1, steps: 64, edgeAA: 1 },
  high: { scale: 1.0, spp: 4, steps: 96, edgeAA: 0 },
  ultra: { scale: 1.0, spp: 9, steps: 128, edgeAA: 0 },
}

export function isMercQuality(name: string): name is MercQuality {
  return Object.hasOwn(QUALITY, name)
}

export interface MercView {
  readonly yaw: number
  readonly pitch: number
  readonly dist: number
  readonly target: Vec3
  /** Vertical field of view, degrees. */
  readonly fov: number
}

export type MercViewName = 'front' | 'hero' | 'threequarter' | 'side'

// Framing: idle Merc fills about 56 % of the frame height and stands low, so
// the top of a hop, a climb or a celebration jump still has headroom.
export const VIEWS: Readonly<Record<MercViewName, MercView>> = {
  front: { yaw: 0, pitch: 0.13, dist: 4.2, target: [0, 0.67, 0], fov: 30 },
  // The hero: a slight orbit with Merc turned to face it, so the face sits
  // in the middle of the frame like the art's front-facing hero.
  hero: { yaw: 0.34, pitch: 0.15, dist: 4.1, target: [0, 0.63, 0], fov: 30 },
  // Study views, for comparing with the turnaround sheets.
  threequarter: {
    yaw: 0.79,
    pitch: 0.13,
    dist: 4.2,
    target: [0, 0.67, 0],
    fov: 30,
  },
  side: { yaw: 1.5708, pitch: 0.13, dist: 4.2, target: [0, 0.67, 0], fov: 30 },
}

// The opaque stage's background, sRGB (the app's #0d1117).
export const BG: Vec3 = [13 / 255, 17 / 255, 23 / 255]

// Bloom: a tight level at a quarter of the render size and a wider, fainter
// one at an eighth. Strength rises with the lock glow.
export const BLOOM = { tight: 0.7, wide: 1.1, overBody: 0.92 } as const

// Silver rim: width in world units (about 1.75 px on a 360 px tile), strength.
export const RIM = { width: 0.013, strength: 0.5 } as const
