// ============================================================
// Drum kit catalog schema — strict generated metadata contract and validation
// ============================================================
//
// Keep untrusted generated metadata behind this boundary. The runtime manifest
// may only expose resource paths after this validator accepts the whole catalog.

import type { DrumVoiceId } from '@/lib/drum-voices'

export const DRUM_KIT_CATALOG_SCHEMA_VERSION = 2

export const DRUM_KIT_IDS = Object.freeze([
  'mercury-synth',
  'circuit',
  'classic-gm',
  'studio',
  'live',
] as const)

export type DrumKitId = (typeof DRUM_KIT_IDS)[number]
export type SampledDrumKitId = Exclude<DrumKitId, 'mercury-synth' | 'circuit'>
export type DrumKitEngine = 'sampled' | 'synth'
export type DrumKitSynthModel = 'mercury' | 'circuit'

export const DRUM_KIT_ENCODED_FORMATS = Object.freeze([
  'mp3',
  'opus',
  'flac',
] as const)

export type DrumKitEncodedFormat = (typeof DRUM_KIT_ENCODED_FORMATS)[number]

export interface DrumKitResourceEncoding {
  readonly path: string
  readonly mimeType: 'audio/mpeg' | 'audio/ogg; codecs=opus' | 'audio/flac'
  readonly encodedBytes: number
  readonly sha256: string
}

export type DrumKitResourceFormats = Readonly<
  { readonly mp3: DrumKitResourceEncoding } & Partial<
    Record<Exclude<DrumKitEncodedFormat, 'mp3'>, DrumKitResourceEncoding>
  >
>

export type DrumVelocityCurve = readonly (readonly [
  velocity: number,
  output: number,
])[]

export interface DrumKitVelocityCurves {
  readonly default?: DrumVelocityCurve
  readonly articulations?: Readonly<
    Partial<Record<DrumVoiceId, DrumVelocityCurve>>
  >
}

export interface DrumKitSourceProvenance {
  readonly commit: string
  readonly path: string
  readonly sha256: string
  readonly transforms: string
}

export interface DrumKitSampleResource {
  readonly id: string
  readonly kitId: SampledDrumKitId
  readonly articulation: DrumVoiceId
  readonly gmKeys: readonly number[]
  readonly velocityMin: number
  readonly velocityMax: number
  readonly roundRobin: number
  readonly chokeGroup: string | null
  readonly chokes: readonly string[]
  /** Content-hashed object key relative to the configured kit asset base. */
  readonly path: string
  readonly mimeType: 'audio/mpeg'
  readonly encodedBytes: number
  readonly sha256: string
  /** Perceptual energy after playbackGain, normalized within an articulation. */
  readonly power?: number
  /** MP3 is mandatory after catalog normalization; other encodings are opt-in. */
  readonly formats: DrumKitResourceFormats
  /** Curator-measured linear gain applied before the live velocity curve. */
  readonly playbackGain: number
}

export interface GeneratedDrumKit {
  readonly version: string
  readonly publishedEncodedBytes: number
  readonly resources: readonly GeneratedDrumKitSampleResource[]
  readonly velcurve?: DrumKitVelocityCurves
}

export interface GeneratedDrumKitSampleResource extends Omit<
  DrumKitSampleResource,
  'formats'
> {
  readonly formats?: DrumKitSampleResource['formats']
  readonly source: DrumKitSourceProvenance
}

export interface GeneratedDrumKitCatalog {
  readonly schemaVersion: number
  readonly kits: Readonly<
    Record<SampledDrumKitId | 'mercury-synth', GeneratedDrumKit>
  >
}

const MAX_ENCODED_RESOURCE_BYTES = 2 * 1024 * 1024
const HASHED_RESOURCE_PATH =
  /^(classic-gm|studio|live)\/v[1-9]\d*\/[a-f0-9]{16}-[a-z0-9-]+\.mp3$/
const HASHED_FORMAT_PATH = Object.freeze({
  mp3: /^(classic-gm|studio|live)\/v[1-9]\d*\/[a-f0-9]{16}-[a-z0-9-]+\.mp3$/,
  opus: /^(classic-gm|studio|live)\/v[1-9]\d*\/[a-f0-9]{16}-[a-z0-9-]+\.(?:opus|ogg)$/,
  flac: /^(classic-gm|studio|live)\/v[1-9]\d*\/[a-f0-9]{16}-[a-z0-9-]+\.flac$/,
}) satisfies Readonly<Record<DrumKitEncodedFormat, RegExp>>
const FORMAT_MIME_TYPES = Object.freeze({
  mp3: 'audio/mpeg',
  opus: 'audio/ogg; codecs=opus',
  flac: 'audio/flac',
}) satisfies Readonly<
  Record<DrumKitEncodedFormat, DrumKitResourceEncoding['mimeType']>
>
const SHA256 = /^[a-f0-9]{64}$/
const RESOURCE_ID = /^(classic-gm|studio|live):[a-z0-9-]+-l[1-9]\d*-rr[1-9]\d*$/
const MIN_PLAYBACK_GAIN = 10 ** (-12 / 20)
const MAX_PLAYBACK_GAIN = 10 ** (12 / 20)
const PLAYBACK_GAIN_ROUNDING_TOLERANCE = 1e-8

const DRUM_VOICE_IDS: ReadonlySet<string> = new Set<DrumVoiceId>([
  'kick',
  'snare',
  'sidestick',
  'clap',
  'hh-closed',
  'hh-pedal',
  'hh-open',
  'tom-low',
  'tom-mid',
  'tom-high',
  'crash',
  'ride',
])

const GENERATED_KIT_IDS = Object.freeze([
  'mercury-synth',
  'classic-gm',
  'studio',
  'live',
] as const)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  label: string,
): void {
  const unexpected = Object.keys(value).find((key) => !allowed.has(key))
  if (unexpected !== undefined) {
    throw new Error(`Unexpected Drum Night ${label} field: ${unexpected}`)
  }
}

function assertVelocityCurve(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.length < 2 || value.length > 127) {
    throw new Error(`Invalid Drum Night velocity curve: ${label}`)
  }
  let previousVelocity = 0
  let previousOutput = -1
  for (const point of value) {
    if (
      !Array.isArray(point) ||
      point.length !== 2 ||
      !Number.isInteger(point[0]) ||
      point[0] < 1 ||
      point[0] > 127 ||
      !Number.isFinite(point[1]) ||
      point[1] < 0 ||
      point[1] > 1 ||
      point[0] <= previousVelocity ||
      point[1] < previousOutput
    ) {
      throw new Error(`Invalid Drum Night velocity curve: ${label}`)
    }
    previousVelocity = point[0]
    previousOutput = point[1]
  }
  if (value[0]?.[0] !== 1 || value.at(-1)?.[0] !== 127) {
    throw new Error(`Invalid Drum Night velocity curve endpoints: ${label}`)
  }
}

function assertVelocityCurves(value: unknown, kitId: string): void {
  if (!isRecord(value)) {
    throw new Error(`Invalid Drum Night velocity curves: ${kitId}`)
  }
  const keys = Object.keys(value)
  if (keys.some((key) => key !== 'default' && key !== 'articulations')) {
    throw new Error(`Invalid Drum Night velocity curves: ${kitId}`)
  }
  if (value.default !== undefined) {
    assertVelocityCurve(value.default, `${kitId}:default`)
  }
  if (value.articulations !== undefined) {
    if (!isRecord(value.articulations)) {
      throw new Error(`Invalid Drum Night velocity curves: ${kitId}`)
    }
    for (const [articulation, curve] of Object.entries(value.articulations)) {
      if (!DRUM_VOICE_IDS.has(articulation)) {
        throw new Error(
          `Invalid Drum Night velocity curve articulation: ${articulation}`,
        )
      }
      assertVelocityCurve(curve, `${kitId}:${articulation}`)
    }
  }
  if (value.default === undefined && value.articulations === undefined) {
    throw new Error(`Empty Drum Night velocity curves: ${kitId}`)
  }
}

function assertResourceEncoding(
  value: unknown,
  format: DrumKitEncodedFormat,
  kitId: SampledDrumKitId,
  version: string,
  resourceId: string,
): asserts value is DrumKitResourceEncoding {
  if (!isRecord(value)) {
    throw new Error(`Invalid Drum Night ${format} encoding: ${resourceId}`)
  }
  assertExactKeys(
    value,
    new Set(['path', 'mimeType', 'encodedBytes', 'sha256']),
    `${format} encoding`,
  )
  const path = value.path
  const sha256 = value.sha256
  const encodedBytes = value.encodedBytes
  const expectedPathPrefix = `${kitId}/${version}/`
  if (
    typeof path !== 'string' ||
    !HASHED_FORMAT_PATH[format].test(path) ||
    !path.startsWith(expectedPathPrefix) ||
    typeof sha256 !== 'string' ||
    !SHA256.test(sha256) ||
    !path
      .slice(path.lastIndexOf('/') + 1)
      .startsWith(`${sha256.slice(0, 16)}-`) ||
    value.mimeType !== FORMAT_MIME_TYPES[format] ||
    !Number.isSafeInteger(encodedBytes) ||
    (encodedBytes as number) <= 0 ||
    (encodedBytes as number) > MAX_ENCODED_RESOURCE_BYTES
  ) {
    throw new Error(`Invalid Drum Night ${format} encoding: ${resourceId}`)
  }
}

function assertResourceFormats(
  resource: GeneratedDrumKitSampleResource,
  kitId: SampledDrumKitId,
  version: string,
  schemaVersion: number,
  resourcePaths: Set<string>,
): void {
  const formats = resource.formats
  if (formats === undefined) {
    if (schemaVersion === DRUM_KIT_CATALOG_SCHEMA_VERSION) {
      throw new Error(`Missing Drum Night MP3 format: ${resource.id}`)
    }
    return
  }
  if (!isRecord(formats)) {
    throw new Error(`Invalid Drum Night formats: ${resource.id}`)
  }
  for (const format of Object.keys(formats)) {
    if (!DRUM_KIT_ENCODED_FORMATS.includes(format as DrumKitEncodedFormat)) {
      throw new Error(`Unsupported Drum Night sample format: ${format}`)
    }
  }
  const mp3 = formats.mp3
  if (mp3 === undefined) {
    throw new Error(`Missing Drum Night MP3 format: ${resource.id}`)
  }
  assertResourceEncoding(mp3, 'mp3', kitId, version, resource.id)
  if (
    mp3.path !== resource.path ||
    mp3.mimeType !== resource.mimeType ||
    mp3.encodedBytes !== resource.encodedBytes ||
    mp3.sha256 !== resource.sha256
  ) {
    throw new Error(`Drum Night MP3 alias mismatch: ${resource.id}`)
  }
  for (const format of DRUM_KIT_ENCODED_FORMATS) {
    const encoding = formats[format]
    if (encoding === undefined) continue
    assertResourceEncoding(encoding, format, kitId, version, resource.id)
    if (format !== 'mp3' && resourcePaths.has(encoding.path)) {
      throw new Error(`Duplicate Drum Night kit format: ${resource.id}`)
    }
    resourcePaths.add(encoding.path)
  }
}

function assertCatalogToolchain(value: unknown): void {
  if (!isRecord(value)) {
    throw new Error('Invalid Drum Night catalog toolchain')
  }
  assertExactKeys(
    value,
    new Set([
      'ffmpeg',
      'fluidsynth',
      'fluidsynthChorus',
      'fluidsynthReverb',
      'fluidsynthGain',
      'fluidsynthRenderSampleRate',
      'fluidsynthRenderFormat',
    ]),
    'catalog toolchain',
  )
  if (
    typeof value.ffmpeg !== 'string' ||
    value.ffmpeg.trim() === '' ||
    typeof value.fluidsynth !== 'string' ||
    value.fluidsynth.trim() === '' ||
    typeof value.fluidsynthChorus !== 'boolean' ||
    typeof value.fluidsynthReverb !== 'boolean' ||
    !Number.isFinite(value.fluidsynthGain) ||
    (value.fluidsynthGain as number) <= 0 ||
    !Number.isSafeInteger(value.fluidsynthRenderSampleRate) ||
    (value.fluidsynthRenderSampleRate as number) <= 0 ||
    typeof value.fluidsynthRenderFormat !== 'string' ||
    value.fluidsynthRenderFormat.trim() === ''
  ) {
    throw new Error('Invalid Drum Night catalog toolchain')
  }
}

function assertCatalogAudioFormat(
  value: unknown,
  format: 'mp3' | 'opus',
): void {
  if (!isRecord(value)) {
    throw new Error(`Invalid Drum Night catalog ${format} audio metadata`)
  }
  assertExactKeys(
    value,
    new Set(
      format === 'mp3'
        ? ['mimeType', 'sampleRate', 'channels', 'bitrate']
        : [
            'mimeType',
            'sampleRate',
            'channels',
            'bitrate',
            'vbr',
            'application',
            'frameDurationMs',
          ],
    ),
    `catalog ${format} audio metadata`,
  )
  if (
    value.mimeType !== FORMAT_MIME_TYPES[format] ||
    !Number.isSafeInteger(value.sampleRate) ||
    (value.sampleRate as number) <= 0 ||
    !Number.isSafeInteger(value.channels) ||
    (value.channels as number) < 1 ||
    (value.channels as number) > 2 ||
    typeof value.bitrate !== 'string' ||
    !/^[1-9]\d*k$/.test(value.bitrate) ||
    (format === 'opus' &&
      (typeof value.vbr !== 'boolean' ||
        value.application !== 'audio' ||
        !Number.isFinite(value.frameDurationMs) ||
        (value.frameDurationMs as number) <= 0))
  ) {
    throw new Error(`Invalid Drum Night catalog ${format} audio metadata`)
  }
}

function assertCatalogAudio(value: unknown, schemaVersion: number): void {
  if (!isRecord(value)) {
    throw new Error('Invalid Drum Night catalog audio metadata')
  }
  assertExactKeys(
    value,
    new Set(['mimeType', 'sampleRate', 'channels', 'bitrate', 'formats']),
    'catalog audio metadata',
  )
  if (
    value.mimeType !== 'audio/mpeg' ||
    !Number.isSafeInteger(value.sampleRate) ||
    (value.sampleRate as number) <= 0 ||
    !Number.isSafeInteger(value.channels) ||
    (value.channels as number) < 1 ||
    (value.channels as number) > 2 ||
    typeof value.bitrate !== 'string' ||
    !/^[1-9]\d*k$/.test(value.bitrate)
  ) {
    throw new Error('Invalid Drum Night catalog audio metadata')
  }
  if (value.formats === undefined) {
    if (schemaVersion === DRUM_KIT_CATALOG_SCHEMA_VERSION) {
      throw new Error('Missing Drum Night catalog audio formats')
    }
    return
  }
  if (!isRecord(value.formats)) {
    throw new Error('Invalid Drum Night catalog audio formats')
  }
  assertExactKeys(
    value.formats,
    new Set(['mp3', 'opus']),
    'catalog audio formats',
  )
  assertCatalogAudioFormat(value.formats.mp3, 'mp3')
  if (value.formats.opus !== undefined) {
    assertCatalogAudioFormat(value.formats.opus, 'opus')
  }
}

function assertCatalogCalibration(value: unknown): void {
  if (!isRecord(value)) {
    throw new Error('Invalid Drum Night catalog calibration')
  }
  const fields = [
    'hardOnsetThresholdDb',
    'transientFloorDb',
    'transientRelativeDb',
    'maximumOnsetMs',
    'onsetPrerollMs',
    'transientWindowMs',
    'maximumPlaybackGainDb',
    'maximumLayerBoundaryDb',
    'maximumRoundRobinSpreadDb',
    'maximumFullScalePeakDb',
    'targetTransientPeakDb',
  ] as const
  assertExactKeys(value, new Set(fields), 'catalog calibration')
  if (fields.some((field) => !Number.isFinite(value[field]))) {
    throw new Error('Invalid Drum Night catalog calibration')
  }
}

/** Validate generated metadata before any resource path reaches the player. */
export function assertGeneratedDrumKitCatalog(
  value: unknown,
): asserts value is GeneratedDrumKitCatalog {
  if (!isRecord(value)) {
    throw new Error('Invalid Drum Night kit catalog')
  }
  assertExactKeys(
    value,
    new Set([
      'schemaVersion',
      'generatedBy',
      'toolchain',
      'audio',
      'calibration',
      'kits',
    ]),
    'catalog',
  )
  if (
    value.schemaVersion !== 1 &&
    value.schemaVersion !== DRUM_KIT_CATALOG_SCHEMA_VERSION
  ) {
    throw new Error(
      `Unsupported Drum Night kit catalog schema: ${String(value.schemaVersion)}`,
    )
  }
  if (
    value.generatedBy !== 'scripts/curate-drum-night-kits.mjs' ||
    value.toolchain === undefined ||
    value.audio === undefined ||
    value.calibration === undefined
  ) {
    throw new Error('Invalid Drum Night catalog metadata')
  }
  assertCatalogToolchain(value.toolchain)
  assertCatalogAudio(value.audio, value.schemaVersion)
  assertCatalogCalibration(value.calibration)
  const kits = value.kits
  if (!isRecord(kits)) {
    throw new Error('Invalid Drum Night kit catalog')
  }
  const generatedKitIds = new Set<string>(GENERATED_KIT_IDS)
  const unexpectedKit = Object.keys(kits).find(
    (kitId) => !generatedKitIds.has(kitId),
  )
  if (unexpectedKit !== undefined) {
    throw new Error(`Unexpected Drum Night generated kit: ${unexpectedKit}`)
  }
  const missingKit = GENERATED_KIT_IDS.find(
    (kitId) => kits[kitId] === undefined,
  )
  if (missingKit !== undefined) {
    throw new Error(`Missing Drum Night generated kit: ${missingKit}`)
  }
  const catalog = value as unknown as GeneratedDrumKitCatalog
  const resourceIds = new Set<string>()
  const resourcePaths = new Set<string>()
  for (const kitId of GENERATED_KIT_IDS) {
    const kit = catalog.kits[kitId]
    if (
      !isRecord(kit) ||
      typeof kit.version !== 'string' ||
      !/^v[1-9]\d*$/.test(kit.version) ||
      !Array.isArray(kit.resources)
    ) {
      throw new Error(`Invalid Drum Night kit metadata: ${kitId}`)
    }
    assertExactKeys(
      kit,
      new Set(['version', 'publishedEncodedBytes', 'resources', 'velcurve']),
      `kit ${kitId}`,
    )
    if (catalog.schemaVersion === 1 && kit.velcurve !== undefined) {
      throw new Error(`Drum Night v2 field in schema 1 kit: ${kitId}`)
    }
    if (kit.velcurve !== undefined) {
      assertVelocityCurves(kit.velcurve, kitId)
    }
    if (
      !Number.isSafeInteger(kit.publishedEncodedBytes) ||
      kit.publishedEncodedBytes < 0
    ) {
      throw new Error(`Invalid Drum Night kit byte count: ${kitId}`)
    }
    if (kitId === 'mercury-synth') {
      if (kit.resources.length !== 0 || kit.publishedEncodedBytes !== 0) {
        throw new Error('Mercury Synth must remain a zero-download kit')
      }
      continue
    }
    let encodedBytes = 0
    for (const rawResource of kit.resources) {
      if (!isRecord(rawResource)) {
        throw new Error(`Invalid Drum Night kit resource: ${kitId}`)
      }
      assertExactKeys(
        rawResource,
        new Set([
          'id',
          'kitId',
          'articulation',
          'gmKeys',
          'velocityMin',
          'velocityMax',
          'roundRobin',
          'chokeGroup',
          'chokes',
          'path',
          'mimeType',
          'encodedBytes',
          'sha256',
          'power',
          'formats',
          'playbackGain',
          'source',
        ]),
        `resource ${String(rawResource.id)}`,
      )
      const resource = rawResource as unknown as GeneratedDrumKitSampleResource
      const expectedPathPrefix = `${kitId}/${kit.version}/`
      const expectedHashPrefix =
        typeof resource.sha256 === 'string' ? resource.sha256.slice(0, 16) : ''
      const fileName =
        typeof resource.path === 'string'
          ? resource.path.slice(resource.path.lastIndexOf('/') + 1)
          : ''
      if (
        resource.kitId !== kitId ||
        typeof resource.id !== 'string' ||
        !RESOURCE_ID.test(resource.id) ||
        !resource.id.startsWith(`${kitId}:`) ||
        !DRUM_VOICE_IDS.has(resource.articulation) ||
        typeof resource.path !== 'string' ||
        !HASHED_RESOURCE_PATH.test(resource.path) ||
        !resource.path.startsWith(expectedPathPrefix) ||
        !fileName.startsWith(`${expectedHashPrefix}-`) ||
        !SHA256.test(resource.sha256) ||
        resource.mimeType !== 'audio/mpeg' ||
        !Number.isSafeInteger(resource.encodedBytes) ||
        resource.encodedBytes <= 0 ||
        resource.encodedBytes > MAX_ENCODED_RESOURCE_BYTES ||
        !Array.isArray(resource.gmKeys) ||
        resource.gmKeys.length === 0 ||
        resource.gmKeys.some(
          (gmKey) => !Number.isInteger(gmKey) || gmKey < 35 || gmKey > 81,
        ) ||
        !Number.isInteger(resource.velocityMin) ||
        !Number.isInteger(resource.velocityMax) ||
        resource.velocityMin < 1 ||
        resource.velocityMax > 127 ||
        resource.velocityMin > resource.velocityMax ||
        !Number.isInteger(resource.roundRobin) ||
        resource.roundRobin < 1 ||
        (resource.chokeGroup !== null &&
          (typeof resource.chokeGroup !== 'string' ||
            resource.chokeGroup.trim() === '')) ||
        !Array.isArray(resource.chokes) ||
        resource.chokes.some(
          (choke) => typeof choke !== 'string' || choke.trim() === '',
        ) ||
        new Set(resource.chokes).size !== resource.chokes.length ||
        (resource.power !== undefined &&
          (!Number.isFinite(resource.power) ||
            resource.power <= 0 ||
            resource.power > 1)) ||
        !Number.isFinite(resource.playbackGain) ||
        resource.playbackGain <
          MIN_PLAYBACK_GAIN - PLAYBACK_GAIN_ROUNDING_TOLERANCE ||
        resource.playbackGain >
          MAX_PLAYBACK_GAIN + PLAYBACK_GAIN_ROUNDING_TOLERANCE ||
        !isRecord(resource.source) ||
        typeof resource.source.sha256 !== 'string' ||
        !SHA256.test(resource.source.sha256) ||
        typeof resource.source.commit !== 'string' ||
        typeof resource.source.path !== 'string' ||
        typeof resource.source.transforms !== 'string' ||
        resource.source.commit.trim() === '' ||
        resource.source.path.trim() === '' ||
        resource.source.transforms.trim() === ''
      ) {
        throw new Error(`Invalid Drum Night kit resource: ${resource.id}`)
      }
      assertExactKeys(
        resource.source,
        new Set(['commit', 'path', 'sha256', 'transforms']),
        `source ${resource.id}`,
      )
      if (
        catalog.schemaVersion === 1 &&
        (resource.power !== undefined || resource.formats !== undefined)
      ) {
        throw new Error(
          `Drum Night v2 field in schema 1 resource: ${resource.id}`,
        )
      }
      if (resourceIds.has(resource.id) || resourcePaths.has(resource.path)) {
        throw new Error(`Duplicate Drum Night kit resource: ${resource.id}`)
      }
      resourceIds.add(resource.id)
      resourcePaths.add(resource.path)
      assertResourceFormats(
        resource,
        kitId,
        kit.version,
        catalog.schemaVersion,
        resourcePaths,
      )
      encodedBytes += resource.encodedBytes
    }
    if (encodedBytes !== kit.publishedEncodedBytes) {
      throw new Error(`Drum Night kit byte total mismatch: ${kitId}`)
    }
  }
}
