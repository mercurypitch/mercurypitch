// ============================================================
// Pearl Current configuration — authored paths, tunable palette and bounded render budgets.
// ============================================================
//
// The network is the accepted Pearl Current study expressed without lab
// contracts or renderer state. Runtime response always comes from a host-owned
// normalized progress value; this module never invents an autoplay timeline.

export type PearlCurrentPoint = readonly [number, number, number]
export type PearlCurrentQuality = 'balanced' | 'high'
export type PearlCurrentResponse = 'rest' | 'charge' | 'release'
export type PearlCurrentStreamRole = 'root' | 'primary' | 'tributary'

export interface PearlCurrentPalette {
  readonly streams: readonly [number, number, number]
  readonly pearl: number
  readonly sheen: number
  readonly gold: number
  readonly glow: number
  readonly release: number
}

export interface PearlCurrentQualityConfig {
  readonly radialSegments: number
  readonly rootSegments: number
  readonly primarySegments: number
  readonly tributarySegments: number
  readonly sphereWidthSegments: number
  readonly sphereHeightSegments: number
  readonly movingBeads: number
  readonly maximumRenderedTriangles: number
  readonly maximumBeads: number
}

export interface PearlCurrentConfig {
  readonly seed?: number
  readonly quality?: PearlCurrentQuality
  readonly speed?: number
  readonly intensity?: number
  readonly fullness?: number
  readonly reducedMotion?: boolean
  readonly palette?: Partial<PearlCurrentPalette>
}

export interface NormalizedPearlCurrentConfig {
  readonly seed: number
  readonly quality: PearlCurrentQuality
  readonly speed: number
  readonly intensity: number
  readonly fullness: number
  readonly reducedMotion: boolean
  readonly palette: PearlCurrentPalette
}

export interface PearlCurrentStream {
  readonly id: string
  readonly role: PearlCurrentStreamRole
  readonly parentId?: string
  readonly radius: number
  readonly colorIndex: 0 | 1 | 2
  readonly points: readonly PearlCurrentPoint[]
  readonly length: number
  readonly startProgress: number
  readonly endProgress: number
}

export interface PearlCurrentDroplet {
  readonly streamId: string
  readonly pathT: number
  readonly phase: number
  readonly size: number
  readonly driftRate: number
}

export interface PearlCurrentJunction {
  readonly point: PearlCurrentPoint
  readonly progress: number
  readonly radius: number
}

export interface PearlCurrentTerminal {
  readonly streamId: string
  readonly point: PearlCurrentPoint
  readonly pathT: 0 | 1
  readonly radius: number
}

export interface PearlCurrentLayout {
  readonly streams: readonly PearlCurrentStream[]
  readonly droplets: readonly PearlCurrentDroplet[]
  readonly junctions: readonly PearlCurrentJunction[]
  readonly terminals: readonly PearlCurrentTerminal[]
}

export interface PearlCurrentRenderBudget {
  readonly tubeTriangles: number
  readonly beadTriangles: number
  readonly renderedTriangles: number
  readonly beads: number
}

export interface PearlCurrentResponseFactors {
  readonly chargeProgress: number
  readonly chargeStrength: number
  readonly releaseProgress: number
  readonly releaseStrength: number
}

export const PEARL_CURRENT_PEARL_PALETTE: PearlCurrentPalette = {
  streams: [0xf5f2ea, 0xaed8cc, 0xc6afdd],
  pearl: 0xfaf9f4,
  sheen: 0xd2c1e4,
  gold: 0xe6bd6a,
  glow: 0xffefbd,
  release: 0xc39cdb,
}

export const PEARL_CURRENT_DEFAULT_CONFIG = {
  seed: 20_260_929,
  quality: 'balanced',
  speed: 0.65,
  intensity: 1,
  fullness: 0.9824,
  reducedMotion: false,
  palette: PEARL_CURRENT_PEARL_PALETTE,
} as const satisfies NormalizedPearlCurrentConfig

export const PEARL_CURRENT_BOUNDS = {
  minimum: [-1.45, -0.5, -0.8] as PearlCurrentPoint,
  maximum: [1.45, -0.05, 0.8] as PearlCurrentPoint,
}

export const PEARL_CURRENT_MAX_RADIUS_SCALE = 1.23
export const PEARL_CURRENT_HIDDEN_SCALE = 0.00001

export const PEARL_CURRENT_QUALITY_CONFIG: Readonly<
  Record<PearlCurrentQuality, PearlCurrentQualityConfig>
> = {
  balanced: {
    radialSegments: 10,
    rootSegments: 32,
    primarySegments: 48,
    tributarySegments: 28,
    sphereWidthSegments: 10,
    sphereHeightSegments: 7,
    movingBeads: 24,
    maximumRenderedTriangles: 13_000,
    maximumBeads: 48,
  },
  high: {
    radialSegments: 12,
    rootSegments: 44,
    primarySegments: 64,
    tributarySegments: 38,
    sphereWidthSegments: 14,
    sphereHeightSegments: 9,
    movingBeads: 36,
    maximumRenderedTriangles: 25_000,
    maximumBeads: 60,
  },
}

interface Anchor {
  readonly id: string
  readonly point: PearlCurrentPoint
  readonly junction?: boolean
}

interface StreamBlueprint {
  readonly id: string
  readonly role: PearlCurrentStreamRole
  readonly parentId?: string
  readonly pointIds: readonly string[]
  readonly radius: number
  readonly colorIndex: 0 | 1 | 2
}

const ANCHORS: readonly Anchor[] = [
  { id: 'inlet', point: [-1.28, -0.35, -0.03] },
  { id: 'root-a', point: [-1.11, -0.3, 0.11] },
  { id: 'root-b', point: [-0.88, -0.33, 0.16] },
  { id: 'root-junction', point: [-0.62, -0.29, 0.02], junction: true },
  { id: 'near-a', point: [-0.35, -0.22, 0.22] },
  { id: 'near-b', point: [-0.03, -0.16, 0.42] },
  { id: 'near-c', point: [0.32, -0.18, 0.5] },
  { id: 'near-junction', point: [0.61, -0.22, 0.42], junction: true },
  { id: 'middle-a', point: [-0.31, -0.34, -0.04] },
  { id: 'middle-b', point: [0.02, -0.3, 0.03] },
  { id: 'middle-c', point: [0.36, -0.25, 0.1] },
  { id: 'middle-junction', point: [0.68, -0.27, -0.02], junction: true },
  { id: 'rear-a', point: [-0.36, -0.38, -0.22] },
  { id: 'rear-b', point: [-0.03, -0.36, -0.42] },
  { id: 'rear-c', point: [0.3, -0.32, -0.49] },
  { id: 'rear-junction', point: [0.57, -0.29, -0.42], junction: true },
  { id: 'near-rise-a', point: [0.84, -0.16, 0.52] },
  { id: 'near-rise-b', point: [1.09, -0.14, 0.36] },
  { id: 'near-rise-tip', point: [1.31, -0.18, 0.22] },
  { id: 'near-curl-a', point: [0.82, -0.28, 0.56] },
  { id: 'near-curl-b', point: [1.05, -0.34, 0.65] },
  { id: 'near-curl-tip', point: [1.27, -0.31, 0.57] },
  { id: 'middle-rise-a', point: [0.89, -0.2, 0.1] },
  { id: 'middle-rise-b', point: [1.08, -0.16, 0.27] },
  { id: 'middle-rise-tip', point: [1.3, -0.2, 0.34] },
  { id: 'middle-low-a', point: [0.91, -0.33, -0.03] },
  { id: 'middle-low-b', point: [1.12, -0.37, 0.1] },
  { id: 'middle-low-tip', point: [1.3, -0.32, 0] },
  { id: 'rear-rise-a', point: [0.79, -0.23, -0.49] },
  { id: 'rear-rise-b', point: [1.03, -0.17, -0.61] },
  { id: 'rear-rise-tip', point: [1.29, -0.22, -0.55] },
  { id: 'rear-low-a', point: [0.78, -0.34, -0.34] },
  { id: 'rear-low-b', point: [1.04, -0.39, -0.22] },
  { id: 'rear-low-tip', point: [1.28, -0.35, -0.32] },
]

const STREAMS: readonly StreamBlueprint[] = [
  {
    id: 'inlet',
    role: 'root',
    pointIds: ['inlet', 'root-a', 'root-b', 'root-junction'],
    radius: 0.044,
    colorIndex: 0,
  },
  {
    id: 'near',
    role: 'primary',
    parentId: 'inlet',
    pointIds: ['root-junction', 'near-a', 'near-b', 'near-c', 'near-junction'],
    radius: 0.038,
    colorIndex: 1,
  },
  {
    id: 'middle',
    role: 'primary',
    parentId: 'inlet',
    pointIds: [
      'root-junction',
      'middle-a',
      'middle-b',
      'middle-c',
      'middle-junction',
    ],
    radius: 0.042,
    colorIndex: 0,
  },
  {
    id: 'rear',
    role: 'primary',
    parentId: 'inlet',
    pointIds: ['root-junction', 'rear-a', 'rear-b', 'rear-c', 'rear-junction'],
    radius: 0.034,
    colorIndex: 2,
  },
  {
    id: 'near-rise',
    role: 'tributary',
    parentId: 'near',
    pointIds: ['near-junction', 'near-rise-a', 'near-rise-b', 'near-rise-tip'],
    radius: 0.023,
    colorIndex: 0,
  },
  {
    id: 'near-curl',
    role: 'tributary',
    parentId: 'near',
    pointIds: ['near-junction', 'near-curl-a', 'near-curl-b', 'near-curl-tip'],
    radius: 0.026,
    colorIndex: 1,
  },
  {
    id: 'middle-rise',
    role: 'tributary',
    parentId: 'middle',
    pointIds: [
      'middle-junction',
      'middle-rise-a',
      'middle-rise-b',
      'middle-rise-tip',
    ],
    radius: 0.024,
    colorIndex: 2,
  },
  {
    id: 'middle-low',
    role: 'tributary',
    parentId: 'middle',
    pointIds: [
      'middle-junction',
      'middle-low-a',
      'middle-low-b',
      'middle-low-tip',
    ],
    radius: 0.022,
    colorIndex: 1,
  },
  {
    id: 'rear-rise',
    role: 'tributary',
    parentId: 'rear',
    pointIds: ['rear-junction', 'rear-rise-a', 'rear-rise-b', 'rear-rise-tip'],
    radius: 0.024,
    colorIndex: 2,
  },
  {
    id: 'rear-low',
    role: 'tributary',
    parentId: 'rear',
    pointIds: ['rear-junction', 'rear-low-a', 'rear-low-b', 'rear-low-tip'],
    radius: 0.0225,
    colorIndex: 0,
  },
]

export function normalizePearlCurrentConfig(
  config: PearlCurrentConfig = {},
): NormalizedPearlCurrentConfig {
  const quality = config.quality ?? PEARL_CURRENT_DEFAULT_CONFIG.quality
  if (quality !== 'balanced' && quality !== 'high')
    throw new Error(`Unknown Pearl Current quality: ${String(quality)}`)
  const seed = config.seed ?? PEARL_CURRENT_DEFAULT_CONFIG.seed
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff)
    throw new Error('Pearl Current seed must be an unsigned 32-bit integer.')
  const palette = config.palette ?? {}
  return {
    seed,
    quality,
    speed: bounded(
      config.speed,
      PEARL_CURRENT_DEFAULT_CONFIG.speed,
      0,
      2,
      'speed',
    ),
    intensity: bounded(
      config.intensity,
      PEARL_CURRENT_DEFAULT_CONFIG.intensity,
      0,
      2.5,
      'intensity',
    ),
    fullness: bounded(
      config.fullness,
      PEARL_CURRENT_DEFAULT_CONFIG.fullness,
      0.82,
      1.1,
      'fullness',
    ),
    reducedMotion: config.reducedMotion ?? false,
    palette: {
      streams: colorTuple(
        palette.streams,
        PEARL_CURRENT_PEARL_PALETTE.streams,
        'streams',
      ),
      pearl: color(palette.pearl, PEARL_CURRENT_PEARL_PALETTE.pearl, 'pearl'),
      sheen: color(palette.sheen, PEARL_CURRENT_PEARL_PALETTE.sheen, 'sheen'),
      gold: color(palette.gold, PEARL_CURRENT_PEARL_PALETTE.gold, 'gold'),
      glow: color(palette.glow, PEARL_CURRENT_PEARL_PALETTE.glow, 'glow'),
      release: color(
        palette.release,
        PEARL_CURRENT_PEARL_PALETTE.release,
        'release',
      ),
    },
  }
}

export function createPearlCurrentLayout(
  config: NormalizedPearlCurrentConfig,
): PearlCurrentLayout {
  const points = new Map<string, PearlCurrentPoint>()
  ANCHORS.forEach((anchor, index) => {
    points.set(anchor.id, [
      anchor.point[0] +
        signedHash(config.seed, index * 3 + 1) *
          (anchor.junction === true ? 0.006 : 0.012),
      anchor.point[1] +
        signedHash(config.seed, index * 3 + 2) *
          (anchor.junction === true ? 0.0025 : 0.004),
      anchor.point[2] +
        signedHash(config.seed, index * 3 + 3) *
          (anchor.junction === true ? 0.008 : 0.014),
    ])
  })

  const staged: Array<PearlCurrentStream & { readonly endDistance: number }> =
    []
  const byId = new Map<string, (typeof staged)[number]>()
  for (const blueprint of STREAMS) {
    const streamPoints = blueprint.pointIds.map((id) => {
      const point = points.get(id)
      if (!point) throw new Error(`Pearl Current anchor is missing: ${id}`)
      return point
    })
    const parent =
      blueprint.parentId === undefined
        ? undefined
        : byId.get(blueprint.parentId)
    if (blueprint.parentId !== undefined && parent === undefined)
      throw new Error(`Pearl Current parent is missing: ${blueprint.parentId}`)
    const startDistance = parent?.endDistance ?? 0
    const length = polylineLength(streamPoints)
    const stream = {
      id: blueprint.id,
      role: blueprint.role,
      parentId: blueprint.parentId,
      radius: blueprint.radius * config.fullness,
      colorIndex: blueprint.colorIndex,
      points: streamPoints,
      length,
      startProgress: startDistance,
      endProgress: startDistance + length,
      endDistance: startDistance + length,
    }
    staged.push(stream)
    byId.set(stream.id, stream)
  }
  const maximumDistance = Math.max(
    ...staged.map((stream) => stream.endDistance),
  )
  const streams: PearlCurrentStream[] = staged.map((stream) => ({
    id: stream.id,
    role: stream.role,
    parentId: stream.parentId,
    radius: stream.radius,
    colorIndex: stream.colorIndex,
    points: stream.points,
    length: stream.length,
    startProgress: stream.startProgress / maximumDistance,
    endProgress: stream.endProgress / maximumDistance,
  }))
  const streamById = new Map(streams.map((stream) => [stream.id, stream]))
  const parents = new Set(
    streams.flatMap((stream) =>
      stream.parentId === undefined ? [] : [stream.parentId],
    ),
  )
  const junctions = streams
    .filter((stream) => parents.has(stream.id))
    .map((stream): PearlCurrentJunction => {
      const children = streams.filter(
        (candidate) => candidate.parentId === stream.id,
      )
      return {
        point: stream.points.at(-1)!,
        progress: stream.endProgress,
        radius:
          Math.max(stream.radius, ...children.map((child) => child.radius)) *
          1.48,
      }
    })
  const terminals: PearlCurrentTerminal[] = [
    {
      streamId: streams[0]!.id,
      point: streams[0]!.points[0]!,
      pathT: 0,
      radius: streams[0]!.radius * 1.08,
    },
    ...streams
      .filter((stream) => !parents.has(stream.id))
      .map((stream) => ({
        streamId: stream.id,
        point: stream.points.at(-1)!,
        pathT: 1 as const,
        radius: stream.radius * 1.14,
      })),
  ]

  const quality = PEARL_CURRENT_QUALITY_CONFIG[config.quality]
  const totalLength = streams.reduce((sum, stream) => sum + stream.length, 0)
  const droplets: PearlCurrentDroplet[] = []
  for (let index = 0; index < quality.movingBeads; index++) {
    let stream = streams[index % streams.length]!
    if (index >= streams.length) {
      let cursor = hashUnit(config.seed ^ 0x73a4_1f2d, index + 1) * totalLength
      for (const candidate of streams) {
        cursor -= candidate.length
        if (cursor <= 0) {
          stream = candidate
          break
        }
      }
    }
    if (!streamById.has(stream.id))
      throw new Error(
        `Pearl Current droplet references an unknown stream: ${stream.id}`,
      )
    const sizeScale =
      stream.role === 'tributary' ? 0.82 : stream.role === 'root' ? 1.08 : 1
    droplets.push({
      streamId: stream.id,
      pathT: 0.06 + hashUnit(config.seed ^ 0x9e37_79b9, index * 5 + 1) * 0.88,
      phase: hashUnit(config.seed ^ 0x85eb_ca6b, index * 5 + 2) * Math.PI * 2,
      size:
        (0.013 + hashUnit(config.seed ^ 0xc2b2_ae35, index * 5 + 3) * 0.008) *
        sizeScale,
      driftRate:
        0.014 + hashUnit(config.seed ^ 0x27d4_eb2f, index * 5 + 4) * 0.012,
    })
  }
  return { streams, droplets, junctions, terminals }
}

export function pearlCurrentRenderBudget(
  layout: PearlCurrentLayout,
  quality: PearlCurrentQuality,
): PearlCurrentRenderBudget {
  const selected = PEARL_CURRENT_QUALITY_CONFIG[quality]
  const tubeSegments = layout.streams.reduce(
    (sum, stream) => sum + pearlCurrentSegmentsFor(stream.role, selected),
    0,
  )
  const tubeTriangles = tubeSegments * selected.radialSegments * 2
  const beads =
    layout.droplets.length +
    layout.terminals.length +
    layout.junctions.length +
    layout.streams.length
  const sphereTriangles =
    selected.sphereWidthSegments * 2 * (selected.sphereHeightSegments - 1)
  const beadTriangles = beads * sphereTriangles
  return {
    tubeTriangles,
    beadTriangles,
    renderedTriangles: tubeTriangles + beadTriangles,
    beads,
  }
}

export function pearlCurrentResponseFactors(
  response: PearlCurrentResponse,
  progress: number,
  strength: number,
): PearlCurrentResponseFactors {
  const authoritativeProgress = unit(progress, 'progress')
  const boundedStrength = unit(strength, 'strength')
  if (response === 'charge') {
    return {
      chargeProgress: smoothstep(authoritativeProgress),
      chargeStrength:
        boundedStrength * (0.32 + smoothstep(authoritativeProgress) * 0.68),
      releaseProgress: 0,
      releaseStrength: 0,
    }
  }
  if (response === 'release') {
    const eased = smoothstep(authoritativeProgress)
    const attack = smoothstep(Math.min(1, authoritativeProgress / 0.08))
    return {
      chargeProgress: 0,
      chargeStrength: 0,
      releaseProgress: eased,
      releaseStrength:
        boundedStrength * attack * Math.pow(1 - authoritativeProgress, 1.35),
    }
  }
  if (response !== 'rest')
    throw new Error(`Unknown Pearl Current response: ${String(response)}`)
  return {
    chargeProgress: 0,
    chargeStrength: 0,
    releaseProgress: 0,
    releaseStrength: 0,
  }
}

export function pearlCurrentSegmentsFor(
  role: PearlCurrentStreamRole,
  quality: PearlCurrentQualityConfig,
): number {
  if (role === 'root') return quality.rootSegments
  if (role === 'primary') return quality.primarySegments
  return quality.tributarySegments
}

export function pearlCurrentChargeRadius(
  radius: number,
  strength: number,
): number {
  return (
    Math.max(0, radius) * (1.34 + unit(strength, 'strength') * 0.16) + 0.007
  )
}

function polylineLength(points: readonly PearlCurrentPoint[]): number {
  let length = 0
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]!
    const point = points[index]!
    length += Math.hypot(
      point[0] - previous[0],
      point[1] - previous[1],
      point[2] - previous[2],
    )
  }
  return length
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
    throw new Error(`Pearl Current ${label} must be finite.`)
  return Math.min(maximum, Math.max(minimum, candidate))
}

function unit(value: number, label: string): number {
  if (!Number.isFinite(value))
    throw new Error(`Pearl Current ${label} must be finite.`)
  return Math.min(1, Math.max(0, value))
}

function color(
  value: number | undefined,
  fallback: number,
  label: string,
): number {
  const candidate = value ?? fallback
  if (!Number.isInteger(candidate) || candidate < 0 || candidate > 0xffffff)
    throw new Error(`Pearl Current ${label} must be a 24-bit RGB integer.`)
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
  return value * value * (3 - 2 * value)
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
