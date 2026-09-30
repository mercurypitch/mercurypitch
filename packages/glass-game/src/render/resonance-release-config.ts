// ============================================================
// Resonance Release configuration — staged surface fracture and accepted release accents.
// ============================================================
//
// Every timeline input is normalized and host-owned. Constants stay exported
// so the in-game trial can be tuned without changing encounter progression.

export type ResonancePoint = readonly [number, number, number]
export type ResonanceQuality = 'balanced' | 'high'
export type ResonancePresentationPhase =
  | 'idle'
  | 'charging'
  | 'releasing'
  | 'completed'
  | 'restored'

export interface ResonancePalette {
  readonly crack: number
  readonly crackGlow: number
  readonly heart: number
  readonly heartGlow: number
  readonly spray: number
  readonly droplets: readonly [number, number, number]
  readonly dust: number
}

export interface ResonanceCrackStage {
  readonly threshold: number
  readonly paths: number
  readonly segmentsPerPath: number
  readonly opacity: number
}

export interface ResonanceTremorConfig {
  readonly startProgress: number
  readonly maximumPositionMetres: number
  readonly maximumRotationRadians: number
  readonly frequencyHz: number
}

export interface ResonanceQualityConfig {
  readonly spraySegments: number
  readonly sprayRadialSegments: number
  readonly sphereWidthSegments: number
  readonly sphereHeightSegments: number
  readonly dropletCount: number
  readonly dustCount: number
  readonly maximumAccentTriangles: number
}

export interface ResonancePresentationConfig {
  readonly seed?: number
  readonly quality?: ResonanceQuality
  readonly intensity?: number
  readonly cohesion?: number
  readonly reducedMotion?: boolean
  readonly palette?: Partial<ResonancePalette>
  readonly crackStages?: readonly ResonanceCrackStage[]
  readonly tremor?: Partial<ResonanceTremorConfig>
}

export interface NormalizedResonancePresentationConfig {
  readonly seed: number
  readonly quality: ResonanceQuality
  readonly intensity: number
  readonly cohesion: number
  readonly reducedMotion: boolean
  readonly palette: ResonancePalette
  readonly crackStages: readonly ResonanceCrackStage[]
  readonly tremor: ResonanceTremorConfig
}

export interface ResonanceSprayPath {
  readonly radiusScale: number
  readonly points: readonly ResonancePoint[]
}

export interface ResonanceDroplet {
  readonly direction: ResonancePoint
  readonly origin: ResonancePoint
  readonly delay: number
  readonly duration: number
  readonly travel: number
  readonly curl: number
  readonly size: number
  readonly colorIndex: 0 | 1 | 2
}

export interface ResonanceDust {
  readonly origin: ResonancePoint
  readonly velocity: ResonancePoint
  readonly delay: number
  readonly duration: number
  readonly size: number
  readonly phase: number
}

export interface ResonanceAccentLayout {
  readonly spray: readonly ResonanceSprayPath[]
  readonly droplets: readonly ResonanceDroplet[]
  readonly dust: readonly ResonanceDust[]
}

export interface ResonanceResponseFactors {
  readonly chargeProgress: number
  readonly crackOpacity: number
  readonly tremorStrength: number
  readonly releaseProgress: number
  readonly releaseStrength: number
  readonly sprayStrength: number
  readonly dropletStrength: number
  readonly dustStrength: number
  readonly rewardProgress: number
}

export interface ResonanceAccentBudget {
  readonly sprayTriangles: number
  readonly particleTriangles: number
  readonly renderedTriangles: number
  readonly particles: number
}

export const RESONANCE_PEARL_PALETTE: ResonancePalette = {
  crack: 0xffd8ae,
  crackGlow: 0xfff0c6,
  heart: 0xb47583,
  heartGlow: 0xffcab1,
  spray: 0xd78da8,
  droplets: [0xffd58b, 0xe9a2bd, 0xd5acd9],
  dust: 0xc99b79,
}

export const RESONANCE_CRACK_STAGES: readonly ResonanceCrackStage[] = [
  { threshold: 0.18, paths: 1, segmentsPerPath: 5, opacity: 0.42 },
  { threshold: 0.4, paths: 2, segmentsPerPath: 6, opacity: 0.6 },
  { threshold: 0.64, paths: 2, segmentsPerPath: 7, opacity: 0.78 },
  { threshold: 0.84, paths: 3, segmentsPerPath: 8, opacity: 0.96 },
]

export const RESONANCE_TREMOR: ResonanceTremorConfig = {
  startProgress: 0.58,
  maximumPositionMetres: 0.0024,
  maximumRotationRadians: 0.008,
  frequencyHz: 7.6,
}

export const RESONANCE_QUALITY_CONFIG: Readonly<
  Record<ResonanceQuality, ResonanceQualityConfig>
> = {
  balanced: {
    spraySegments: 28,
    sprayRadialSegments: 7,
    sphereWidthSegments: 10,
    sphereHeightSegments: 7,
    dropletCount: 8,
    dustCount: 36,
    maximumAccentTriangles: 10_000,
  },
  high: {
    spraySegments: 42,
    sprayRadialSegments: 9,
    sphereWidthSegments: 14,
    sphereHeightSegments: 9,
    dropletCount: 11,
    dustCount: 58,
    maximumAccentTriangles: 24_000,
  },
}

export const RESONANCE_DEFAULT_CONFIG = {
  seed: 20_260_929,
  quality: 'balanced',
  intensity: 1,
  cohesion: 0.8824,
  reducedMotion: false,
  palette: RESONANCE_PEARL_PALETTE,
  crackStages: RESONANCE_CRACK_STAGES,
  tremor: RESONANCE_TREMOR,
} as const satisfies NormalizedResonancePresentationConfig

export const RESONANCE_HIDDEN_SCALE = 0.00001

// Coordinates are normalized to the supplied vase bounds in the renderer.
// X/Z are fractions of vase height; Y is a fraction from bounds.min.y.
export const RESONANCE_SPRAY_PATHS: readonly ResonanceSprayPath[] = [
  {
    radiusScale: 0.015,
    points: [
      [-0.045, 0.86, 0.05],
      [-0.125, 0.98, 0.08],
      [-0.25, 1.07, 0.05],
      [-0.235, 1.155, -0.008],
      [-0.135, 1.175, -0.05],
    ],
  },
  {
    radiusScale: 0.0125,
    points: [
      [0.003, 0.855, 0.055],
      [0.02, 0.98, 0.085],
      [0.09, 1.095, 0.105],
      [0.038, 1.19, 0.08],
    ],
  },
  {
    radiusScale: 0.014,
    points: [
      [0.043, 0.86, 0.04],
      [0.135, 0.97, 0.06],
      [0.26, 1.05, 0.1],
      [0.245, 1.145, 0.145],
      [0.14, 1.17, 0.165],
    ],
  },
]

export function normalizeResonancePresentationConfig(
  config: ResonancePresentationConfig = {},
): NormalizedResonancePresentationConfig {
  const quality = config.quality ?? RESONANCE_DEFAULT_CONFIG.quality
  if (quality !== 'balanced' && quality !== 'high')
    throw new Error(`Unknown Resonance quality: ${String(quality)}`)
  const seed = config.seed ?? RESONANCE_DEFAULT_CONFIG.seed
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff)
    throw new Error('Resonance seed must be an unsigned 32-bit integer.')
  const palette = config.palette ?? {}
  const tremor = config.tremor ?? {}
  const crackStages = normalizeCrackStages(
    config.crackStages ?? RESONANCE_CRACK_STAGES,
  )
  return {
    seed,
    quality,
    intensity: bounded(config.intensity, 1, 0, 2.5, 'intensity'),
    cohesion: bounded(config.cohesion, 0.8824, 0.72, 1, 'cohesion'),
    reducedMotion: config.reducedMotion ?? false,
    palette: {
      crack: color(palette.crack, RESONANCE_PEARL_PALETTE.crack, 'crack'),
      crackGlow: color(
        palette.crackGlow,
        RESONANCE_PEARL_PALETTE.crackGlow,
        'crackGlow',
      ),
      heart: color(palette.heart, RESONANCE_PEARL_PALETTE.heart, 'heart'),
      heartGlow: color(
        palette.heartGlow,
        RESONANCE_PEARL_PALETTE.heartGlow,
        'heartGlow',
      ),
      spray: color(palette.spray, RESONANCE_PEARL_PALETTE.spray, 'spray'),
      droplets: colorTuple(
        palette.droplets,
        RESONANCE_PEARL_PALETTE.droplets,
        'droplets',
      ),
      dust: color(palette.dust, RESONANCE_PEARL_PALETTE.dust, 'dust'),
    },
    crackStages,
    tremor: {
      startProgress: bounded(
        tremor.startProgress,
        RESONANCE_TREMOR.startProgress,
        0,
        0.95,
        'tremor.startProgress',
      ),
      maximumPositionMetres: bounded(
        tremor.maximumPositionMetres,
        RESONANCE_TREMOR.maximumPositionMetres,
        0,
        0.008,
        'tremor.maximumPositionMetres',
      ),
      maximumRotationRadians: bounded(
        tremor.maximumRotationRadians,
        RESONANCE_TREMOR.maximumRotationRadians,
        0,
        0.02,
        'tremor.maximumRotationRadians',
      ),
      frequencyHz: bounded(
        tremor.frequencyHz,
        RESONANCE_TREMOR.frequencyHz,
        0.1,
        15,
        'tremor.frequencyHz',
      ),
    },
  }
}

export function createResonanceAccentLayout(
  config: NormalizedResonancePresentationConfig,
): ResonanceAccentLayout {
  const quality = RESONANCE_QUALITY_CONFIG[config.quality]
  const droplets: ResonanceDroplet[] = []
  for (let index = 0; index < quality.dropletCount; index++) {
    const angle =
      hashUnit(config.seed ^ 0x9e37_79b9, index * 9 + 1) * Math.PI * 2
    const horizontal =
      0.28 + hashUnit(config.seed ^ 0x243f_6a88, index * 9 + 2) * 0.3
    const dx = Math.cos(angle) * horizontal
    const dz = Math.sin(angle) * horizontal
    const dy = 0.72 + hashUnit(config.seed ^ 0xb7e1_5163, index * 9 + 3) * 0.38
    const inverseLength = 1 / Math.hypot(dx, dy, dz)
    droplets.push({
      origin: [
        signedHash(config.seed ^ 0x94d0_49bb, index * 9 + 4) * 0.055,
        0.93 + hashUnit(config.seed ^ 0x3c6e_f372, index * 9 + 5) * 0.07,
        0.04 + hashUnit(config.seed ^ 0xa54f_f53a, index * 9 + 6) * 0.05,
      ],
      direction: [dx * inverseLength, dy * inverseLength, dz * inverseLength],
      delay: 0.015 + hashUnit(config.seed ^ 0x510e_527f, index * 9 + 7) * 0.11,
      duration: 0.28 + hashUnit(config.seed ^ 0x1f83_d9ab, index * 9 + 8) * 0.2,
      travel:
        (0.18 + hashUnit(config.seed ^ 0x5be0_cd19, index * 9 + 9) * 0.145) *
        (1.08 - config.cohesion * 0.12),
      curl: signedHash(config.seed ^ 0x6a09_e667, index * 9 + 10) * 0.065,
      size:
        0.013 + hashUnit(config.seed ^ 0xbb67_ae85, index * 9 + 11) * 0.0105,
      colorIndex: (index % 3) as 0 | 1 | 2,
    })
  }
  const dust: ResonanceDust[] = []
  for (let index = 0; index < quality.dustCount; index++) {
    const angle =
      hashUnit(config.seed ^ 0x3c6e_f372, index * 8 + 1) * Math.PI * 2
    const radius =
      0.06 + hashUnit(config.seed ^ 0xa54f_f53a, index * 8 + 2) * 0.25
    const speed =
      0.025 + hashUnit(config.seed ^ 0x9b05_688c, index * 8 + 4) * 0.06
    dust.push({
      origin: [
        Math.cos(angle) * radius,
        0.08 + hashUnit(config.seed ^ 0x510e_527f, index * 8 + 3) * 0.81,
        Math.sin(angle) * radius,
      ],
      velocity: [
        Math.cos(angle) * speed,
        0.018 + hashUnit(config.seed ^ 0x1f83_d9ab, index * 8 + 5) * 0.075,
        Math.sin(angle) * speed,
      ],
      delay: hashUnit(config.seed ^ 0x5be0_cd19, index * 8 + 6) * 0.13,
      duration:
        0.52 + hashUnit(config.seed ^ 0xcbbb_9d5d, index * 8 + 7) * 0.37,
      size: 0.0055 + hashUnit(config.seed ^ 0x629a_292a, index * 8 + 8) * 0.007,
      phase: hashUnit(config.seed ^ 0x9159_015a, index * 8 + 9) * Math.PI * 2,
    })
  }
  return { spray: RESONANCE_SPRAY_PATHS, droplets, dust }
}

export function resonanceResponseFactors(
  config: NormalizedResonancePresentationConfig,
  phase: ResonancePresentationPhase,
  chargeProgress: number,
  releaseProgress: number,
): ResonanceResponseFactors {
  const charge = unit(chargeProgress, 'chargeProgress')
  const release = unit(releaseProgress, 'releaseProgress')
  const strength = Math.min(1, config.intensity / 1.35)
  if (phase === 'charging') {
    const eased = smoothstep(charge)
    const tremor = smoothstep(
      Math.max(0, charge - config.tremor.startProgress) /
        (1 - config.tremor.startProgress),
    )
    return {
      chargeProgress: charge,
      crackOpacity: strength * (0.3 + eased * 0.7),
      tremorStrength: strength * tremor,
      releaseProgress: 0,
      releaseStrength: 0,
      sprayStrength: 0,
      dropletStrength: 0,
      dustStrength: 0,
      rewardProgress: 0,
    }
  }
  if (phase === 'releasing') {
    const attack = smoothstep(Math.min(1, release / 0.075))
    return {
      chargeProgress: 0,
      crackOpacity: Math.max(0, 1 - release / 0.12) * strength,
      tremorStrength: 0,
      releaseProgress: release,
      releaseStrength: strength * attack * Math.pow(1 - release, 0.34),
      sprayStrength:
        strength * attack * Math.pow(1 - Math.min(1, release / 0.54), 0.62),
      dropletStrength:
        strength * attack * Math.pow(1 - Math.min(1, release / 0.62), 0.48),
      dustStrength: strength * attack * Math.pow(1 - release, 1.18),
      rewardProgress: smoothstep(Math.min(1, release / 0.72)),
    }
  }
  if (phase === 'completed') {
    return {
      chargeProgress: 0,
      crackOpacity: 0,
      tremorStrength: 0,
      releaseProgress: 1,
      releaseStrength: 0,
      sprayStrength: 0,
      dropletStrength: 0,
      dustStrength: 0,
      rewardProgress: 1,
    }
  }
  if (phase !== 'idle' && phase !== 'restored')
    throw new Error(`Unknown Resonance presentation phase: ${String(phase)}`)
  return {
    chargeProgress: 0,
    crackOpacity: 0,
    tremorStrength: 0,
    releaseProgress: 0,
    releaseStrength: 0,
    sprayStrength: 0,
    dropletStrength: 0,
    dustStrength: 0,
    rewardProgress: 0,
  }
}

export function resonanceAccentBudget(
  layout: ResonanceAccentLayout,
  quality: ResonanceQuality,
): ResonanceAccentBudget {
  const selected = RESONANCE_QUALITY_CONFIG[quality]
  const sprayTriangles =
    layout.spray.length *
    selected.spraySegments *
    selected.sprayRadialSegments *
    2
  const sphereTriangles =
    selected.sphereWidthSegments * 2 * (selected.sphereHeightSegments - 1)
  const particles = layout.droplets.length + layout.dust.length
  const particleTriangles = particles * sphereTriangles
  return {
    sprayTriangles,
    particleTriangles,
    renderedTriangles: sprayTriangles + particleTriangles,
    particles,
  }
}

function normalizeCrackStages(
  stages: readonly ResonanceCrackStage[],
): readonly ResonanceCrackStage[] {
  if (stages.length < 1 || stages.length > 6)
    throw new Error(
      'Resonance crackStages must contain between one and six stages.',
    )
  let previous = -1
  return stages.map((stage, index) => {
    const threshold = unit(stage.threshold, `crackStages[${index}].threshold`)
    if (threshold <= previous)
      throw new Error(
        'Resonance crack stage thresholds must be strictly increasing.',
      )
    previous = threshold
    if (!Number.isInteger(stage.paths) || stage.paths < 1 || stage.paths > 4)
      throw new Error(
        'Resonance crack stage paths must be an integer from one to four.',
      )
    if (
      !Number.isInteger(stage.segmentsPerPath) ||
      stage.segmentsPerPath < 3 ||
      stage.segmentsPerPath > 12
    )
      throw new Error(
        'Resonance crack segmentsPerPath must be an integer from three to twelve.',
      )
    return {
      threshold,
      paths: stage.paths,
      segmentsPerPath: stage.segmentsPerPath,
      opacity: unit(stage.opacity, `crackStages[${index}].opacity`),
    }
  })
}

function bounded(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  const candidate = value ?? fallback
  if (!Number.isFinite(candidate))
    throw new Error(`Resonance ${label} must be finite.`)
  return Math.min(maximum, Math.max(minimum, candidate))
}

function unit(value: number, label: string): number {
  if (!Number.isFinite(value))
    throw new Error(`Resonance ${label} must be finite.`)
  return Math.min(1, Math.max(0, value))
}

function color(
  value: number | undefined,
  fallback: number,
  label: string,
): number {
  const candidate = value ?? fallback
  if (!Number.isInteger(candidate) || candidate < 0 || candidate > 0xffffff)
    throw new Error(`Resonance ${label} must be a 24-bit RGB integer.`)
  return candidate
}

function colorTuple(
  value: readonly [number, number, number] | undefined,
  fallback: readonly [number, number, number],
  label: string,
): readonly [number, number, number] {
  if (value === undefined) return fallback
  return [
    color(value[0], fallback[0], `${label}[0]`),
    color(value[1], fallback[1], `${label}[1]`),
    color(value[2], fallback[2], `${label}[2]`),
  ]
}

function smoothstep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value))
  return clamped * clamped * (3 - 2 * clamped)
}

function signedHash(seed: number, index: number): number {
  return hashUnit(seed, index) * 2 - 1
}

function hashUnit(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index, 0x9e37_79b1)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x21f0_aaad)
  value = Math.imul(value ^ (value >>> 15), 0x735a_2d97)
  value ^= value >>> 15
  return (value >>> 0) / 0x1_0000_0000
}
