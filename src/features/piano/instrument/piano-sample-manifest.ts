// ============================================================
// Piano sample manifest — pinned, licensed Salamander compact-bank contract
// ============================================================
//
// The source recording is CC BY 3.0. The npm packages contain an MP3
// adaptation, so the attribution deliberately identifies both the original
// author and our four-layer selection. Package metadata may describe wrapper
// code as MIT; that never replaces the samples' CC BY license.

export const SALAMANDER_SAMPLE_LICENSE = Object.freeze({
  name: 'Creative Commons Attribution 3.0 Unported',
  spdx: 'CC-BY-3.0',
  url: 'https://creativecommons.org/licenses/by/3.0/',
  author: 'Alexander Holm',
  sourceUrl: 'https://archive.org/details/SalamanderGrandPianoV3',
  repackAuthor: 'Jan Forst',
  repackSourceUrl: 'https://github.com/darosh/samples-piano-mp3',
  attribution:
    'Salamander Grand Piano V3 by Alexander Holm, MP3 adaptation distributed by Jan Forst, licensed under CC BY 3.0.',
  changes:
    'MercuryPitch selects velocity layers 4, 8, 12, and 16 from the MP3 adaptation and remaps them to compact sample zones.',
})

const PACKAGE_BASE_URLS = Object.freeze({
  velocity4:
    'https://cdn.jsdelivr.net/npm/@audio-samples/piano-mp3-velocity4@1.0.5/audio/',
  velocity8:
    'https://cdn.jsdelivr.net/npm/@audio-samples/piano-mp3-velocity8@1.0.5/audio/',
  velocity12:
    'https://cdn.jsdelivr.net/npm/@audio-samples/piano-mp3-velocity12@1.0.5/audio/',
  velocity16:
    'https://cdn.jsdelivr.net/npm/@audio-samples/piano-mp3-velocity16@1.0.5/audio/',
  release:
    'https://cdn.jsdelivr.net/npm/@audio-samples/piano-mp3-release@1.0.5/audio/',
  pedals:
    'https://cdn.jsdelivr.net/npm/@audio-samples/piano-mp3-pedals@1.0.5/audio/',
})

export const SALAMANDER_ATTACK_VELOCITY_LAYERS = Object.freeze([
  4, 8, 12, 16,
] as const)

export type SalamanderAttackVelocityLayer =
  (typeof SALAMANDER_ATTACK_VELOCITY_LAYERS)[number]

export type PianoSampleResourceKind = 'attack' | 'release' | 'pedal'

export interface PianoSampleResource {
  readonly id: string
  readonly kind: PianoSampleResourceKind
  readonly url: string
  readonly rootMidi?: number
  readonly midi?: number
  readonly velocityLayer?: SalamanderAttackVelocityLayer
  readonly pedal?: 'down-1' | 'down-2' | 'up-1' | 'up-2'
}

export interface PianoSamplePackage {
  readonly id: string
  readonly version: string
  readonly baseUrl: string
  /** Published package size; informational rather than a response trust boundary. */
  readonly publishedEncodedBytes: number
  readonly sampleCount: number
}

export interface PianoSampleManifest {
  readonly id: string
  readonly version: string
  readonly name: string
  readonly sourceFormat: 'audio/mpeg'
  readonly originalCaptureSampleRate: 48_000
  readonly originalCaptureBitDepth: 24
  readonly keyRange: Readonly<{ low: 21; high: 108 }>
  readonly license: typeof SALAMANDER_SAMPLE_LICENSE
  readonly packages: readonly PianoSamplePackage[]
  readonly resources: readonly PianoSampleResource[]
  readonly publishedEncodedBytes: number
}

const ATTACK_ROOT_MIDIS = Object.freeze(
  Array.from({ length: 30 }, (_, index) => 21 + index * 3),
)

function noteName(midi: number): string {
  const pitchClasses = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ] as const
  return `${pitchClasses[midi % 12]}${Math.floor(midi / 12) - 1}`
}

function attackResource(
  rootMidi: number,
  velocityLayer: SalamanderAttackVelocityLayer,
): PianoSampleResource {
  const packageKey = `velocity${velocityLayer}` as const
  const filename = `${noteName(rootMidi)}v${velocityLayer}.mp3`.replace(
    '#',
    '%23',
  )
  return Object.freeze({
    id: `attack:${rootMidi}:v${velocityLayer}`,
    kind: 'attack',
    rootMidi,
    velocityLayer,
    url: `${PACKAGE_BASE_URLS[packageKey]}${filename}`,
  })
}

function releaseResource(midi: number): PianoSampleResource {
  return Object.freeze({
    id: `release:${midi}`,
    kind: 'release',
    midi,
    url: `${PACKAGE_BASE_URLS.release}rel${midi - 20}.mp3`,
  })
}

function pedalResource(
  pedal: NonNullable<PianoSampleResource['pedal']>,
  filename: string,
): PianoSampleResource {
  return Object.freeze({
    id: `pedal:${pedal}`,
    kind: 'pedal',
    pedal,
    url: `${PACKAGE_BASE_URLS.pedals}${filename}`,
  })
}

const ATTACK_RESOURCES = Object.freeze(
  SALAMANDER_ATTACK_VELOCITY_LAYERS.flatMap((velocityLayer) =>
    ATTACK_ROOT_MIDIS.map((rootMidi) =>
      attackResource(rootMidi, velocityLayer),
    ),
  ),
)

const RELEASE_RESOURCES = Object.freeze(
  Array.from({ length: 88 }, (_, index) => releaseResource(21 + index)),
)

export const SALAMANDER_PEDAL_RESOURCES = Object.freeze([
  pedalResource('down-1', 'pedalD1.mp3'),
  pedalResource('down-2', 'pedalD2.mp3'),
  pedalResource('up-1', 'pedalU1.mp3'),
  pedalResource('up-2', 'pedalU2.mp3'),
])

const PACKAGES = Object.freeze([
  Object.freeze({
    id: '@audio-samples/piano-mp3-velocity4',
    version: '1.0.5',
    baseUrl: PACKAGE_BASE_URLS.velocity4,
    publishedEncodedBytes: 5_020_000,
    sampleCount: 30,
  }),
  Object.freeze({
    id: '@audio-samples/piano-mp3-velocity8',
    version: '1.0.5',
    baseUrl: PACKAGE_BASE_URLS.velocity8,
    publishedEncodedBytes: 5_360_000,
    sampleCount: 30,
  }),
  Object.freeze({
    id: '@audio-samples/piano-mp3-velocity12',
    version: '1.0.5',
    baseUrl: PACKAGE_BASE_URLS.velocity12,
    publishedEncodedBytes: 5_400_000,
    sampleCount: 30,
  }),
  Object.freeze({
    id: '@audio-samples/piano-mp3-velocity16',
    version: '1.0.5',
    baseUrl: PACKAGE_BASE_URLS.velocity16,
    publishedEncodedBytes: 5_580_000,
    sampleCount: 30,
  }),
  Object.freeze({
    id: '@audio-samples/piano-mp3-release',
    version: '1.0.5',
    baseUrl: PACKAGE_BASE_URLS.release,
    publishedEncodedBytes: 866_460,
    sampleCount: 88,
  }),
  Object.freeze({
    id: '@audio-samples/piano-mp3-pedals',
    version: '1.0.5',
    baseUrl: PACKAGE_BASE_URLS.pedals,
    publishedEncodedBytes: 206_340,
    sampleCount: 4,
  }),
] satisfies readonly PianoSamplePackage[])

const ALL_RESOURCES = Object.freeze([
  ...ATTACK_RESOURCES,
  ...RELEASE_RESOURCES,
  ...SALAMANDER_PEDAL_RESOURCES,
])

const RESOURCES_BY_ID = new Map(
  ALL_RESOURCES.map((resource) => [resource.id, resource] as const),
)
const ALLOWED_URLS = new Set(ALL_RESOURCES.map((resource) => resource.url))

export const SALAMANDER_COMPACT_PIANO_MANIFEST: PianoSampleManifest =
  Object.freeze({
    id: 'org.alexander-holm.salamander-grand-v3.mercury-compact',
    version: '1.0.0',
    name: 'Salamander Grand Piano — Mercury Compact',
    sourceFormat: 'audio/mpeg',
    originalCaptureSampleRate: 48_000,
    originalCaptureBitDepth: 24,
    keyRange: Object.freeze({ low: 21, high: 108 }),
    license: SALAMANDER_SAMPLE_LICENSE,
    packages: PACKAGES,
    resources: ALL_RESOURCES,
    publishedEncodedBytes: PACKAGES.reduce(
      (total, samplePackage) => total + samplePackage.publishedEncodedBytes,
      0,
    ),
  })

function clampMidi(midi: number): number {
  if (!Number.isFinite(midi)) return 60
  return Math.min(108, Math.max(21, Math.round(midi)))
}

export function resolveSalamanderRootMidi(midi: number): number {
  const normalized = clampMidi(midi)
  return Math.min(108, Math.max(21, 21 + Math.round((normalized - 21) / 3) * 3))
}

export function resolveSalamanderVelocityLayer(
  velocity: number,
): SalamanderAttackVelocityLayer {
  const normalized = Number.isFinite(velocity)
    ? Math.min(1, Math.max(0, velocity))
    : 0
  const index = Math.min(
    SALAMANDER_ATTACK_VELOCITY_LAYERS.length - 1,
    Math.floor(normalized * SALAMANDER_ATTACK_VELOCITY_LAYERS.length),
  )
  return SALAMANDER_ATTACK_VELOCITY_LAYERS[index]
}

export function salamanderAttackResource(
  midi: number,
  velocityLayer: SalamanderAttackVelocityLayer,
): PianoSampleResource {
  const resource = RESOURCES_BY_ID.get(
    `attack:${resolveSalamanderRootMidi(midi)}:v${velocityLayer}`,
  )
  if (resource === undefined) throw new Error('Missing Salamander attack zone')
  return resource
}

export function salamanderReleaseResource(midi: number): PianoSampleResource {
  const resource = RESOURCES_BY_ID.get(`release:${clampMidi(midi)}`)
  if (resource === undefined) throw new Error('Missing Salamander release zone')
  return resource
}

export function isAllowedSalamanderSampleUrl(url: string): boolean {
  return ALLOWED_URLS.has(url)
}
