// ============================================================
// Drum kit format selection — one codec decision for a complete sample plan
// ============================================================
//
// Opus support is proven with the same Web Audio decode path used by the kit
// player. The tiny probe stays encoded until gesture-owned activation, and a
// session never mixes Opus and MP3 resources after it has chosen a plan.

import type { DrumKitEncodedFormat, DrumKitResourceEncoding, } from './drum-kit-manifest'

export type {
  DrumKitEncodedFormat,
  DrumKitResourceEncoding,
} from './drum-kit-manifest'

export type DrumKitRuntimeFormat = Extract<DrumKitEncodedFormat, 'mp3' | 'opus'>

export interface DrumKitMultiFormatResource {
  readonly id: string
  readonly formats: Partial<
    Readonly<Record<DrumKitEncodedFormat, DrumKitResourceEncoding>>
  >
}

export interface PlannedDrumKitResource<
  Resource extends DrumKitMultiFormatResource = DrumKitMultiFormatResource,
> {
  readonly resource: Resource
  readonly encoding: DrumKitResourceEncoding
}

export interface DrumKitFormatPlan<
  Resource extends DrumKitMultiFormatResource = DrumKitMultiFormatResource,
> {
  readonly format: DrumKitRuntimeFormat
  readonly resources: readonly PlannedDrumKitResource<Resource>[]
}

export interface DrumKitAudioDecoder {
  decodeAudioData(encoded: ArrayBuffer): Promise<AudioBuffer>
}

export interface DrumKitFormatSession<
  Resource extends DrumKitMultiFormatResource = DrumKitMultiFormatResource,
> {
  select(resources: readonly Resource[]): Promise<DrumKitFormatPlan<Resource>>
  fallback(resources: readonly Resource[]): DrumKitFormatPlan<Resource>
}

export interface DrumKitFormatSessionOptions {
  /** Test seam; production must leave this unset and use the real decoder. */
  readonly probeOpus?: () => Promise<boolean>
  /** Test seam; production lazily imports the generated Opus projection. */
  readonly loadOpusFormats?: () => Promise<
    ReadonlyMap<string, DrumKitResourceEncoding>
  >
  /** Complete static resource closure used to reject stale or extra projections. */
  readonly knownResourceIds?: readonly string[]
}

interface GeneratedDrumKitOpusCatalog {
  readonly schemaVersion: 1
  readonly catalogSchemaVersion: 2
  readonly mimeType: 'audio/ogg; codecs=opus'
  readonly encodings: Readonly<
    Record<
      string,
      {
        readonly path: string
        readonly encodedBytes: number
        readonly sha256: string
      }
    >
  >
}

// 40 ms of mono silence encoded as Ogg Opus by the pinned FFmpeg n9.0.1
// toolchain. SHA-256: 8b3132747d25f5fbf33d736e7152a22aa1ec32d899ce1e3c970a1e56d845a68d.
// It is deliberately kept encoded at module evaluation time.
const OPUS_DECODE_PROBE_BASE64 =
  'T2dnUwACAAAAAAAAAAAAAAAAAAAAALybAEgBE09wdXNIZWFkAQF4AIC7AAAAAABPZ2dTAAAAAAAAAAAAAAAAAAABAAAASZW+VAEuT3B1c1RhZ3MGAAAAZmZtcGVnAQAAABQAAABlbmNvZGVyPUxhdmMgbGlib3B1c09nZ1MABPgHAAAAAAAAAAAAAAIAAABQSyycAx4eHrj//gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALj//gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALj//gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='

const opusProbeByDecoder = new WeakMap<object, Promise<boolean>>()
let generatedOpusFormats: Promise<
  ReadonlyMap<string, DrumKitResourceEncoding>
> | null = null

const OPUS_RESOURCE_ID =
  /^(classic-gm|studio|live):[a-z0-9-]+-l[1-9]\d*-rr[1-9]\d*$/
const OPUS_RESOURCE_PATH =
  /^(classic-gm|studio|live)\/v[1-9]\d*\/[a-f0-9]{16}-[a-z0-9-]+\.(?:opus|ogg)$/
const SHA256 = /^[a-f0-9]{64}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowed.has(key))
}

/** Validate the lazy projection before any Opus object key reaches fetch. */
export function parseDrumKitOpusCatalog(
  value: unknown,
): ReadonlyMap<string, DrumKitResourceEncoding> {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.catalogSchemaVersion !== 2 ||
    value.mimeType !== 'audio/ogg; codecs=opus' ||
    !isRecord(value.encodings) ||
    !hasOnlyKeys(
      value,
      new Set([
        'schemaVersion',
        'catalogSchemaVersion',
        'mimeType',
        'encodings',
      ]),
    )
  ) {
    throw new Error('Invalid Drum Night Opus catalog')
  }

  const result = new Map<string, DrumKitResourceEncoding>()
  const paths = new Set<string>()
  for (const [resourceId, rawEncoding] of Object.entries(value.encodings)) {
    const kitId = resourceId.slice(0, resourceId.indexOf(':'))
    if (
      !OPUS_RESOURCE_ID.test(resourceId) ||
      !isRecord(rawEncoding) ||
      !hasOnlyKeys(rawEncoding, new Set(['path', 'encodedBytes', 'sha256'])) ||
      typeof rawEncoding.path !== 'string' ||
      !OPUS_RESOURCE_PATH.test(rawEncoding.path) ||
      !rawEncoding.path.startsWith(`${kitId}/`) ||
      typeof rawEncoding.sha256 !== 'string' ||
      !SHA256.test(rawEncoding.sha256) ||
      !rawEncoding.path
        .slice(rawEncoding.path.lastIndexOf('/') + 1)
        .startsWith(`${rawEncoding.sha256.slice(0, 16)}-`) ||
      !Number.isSafeInteger(rawEncoding.encodedBytes) ||
      (rawEncoding.encodedBytes as number) <= 0 ||
      paths.has(rawEncoding.path)
    ) {
      throw new Error(`Invalid Drum Night Opus encoding: ${resourceId}`)
    }
    paths.add(rawEncoding.path)
    result.set(
      resourceId,
      Object.freeze({
        path: rawEncoding.path,
        mimeType: value.mimeType,
        encodedBytes: rawEncoding.encodedBytes as number,
        sha256: rawEncoding.sha256,
      }),
    )
  }
  return result
}

/** Load the compact Opus projection only after capability support is proven. */
export function loadDrumKitOpusFormats(): Promise<
  ReadonlyMap<string, DrumKitResourceEncoding>
> {
  generatedOpusFormats ??= import('./drum-kit-opus.generated.json').then(
    (module) =>
      parseDrumKitOpusCatalog(
        (module as { readonly default: GeneratedDrumKitOpusCatalog }).default,
      ),
  )
  return generatedOpusFormats
}

function encodedOpusProbe(): ArrayBuffer {
  const decodeBase64 = globalThis.atob
  if (typeof decodeBase64 !== 'function') {
    throw new Error('This runtime cannot create the Opus capability probe')
  }
  const binary = decodeBase64(OPUS_DECODE_PROBE_BASE64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

function decodedAudioIsUsable(decoded: AudioBuffer): boolean {
  return (
    Number.isFinite(decoded.duration) &&
    decoded.duration > 0 &&
    Number.isFinite(decoded.sampleRate) &&
    decoded.sampleRate > 0 &&
    Number.isInteger(decoded.numberOfChannels) &&
    decoded.numberOfChannels > 0
  )
}

/** Prove Ogg Opus support once for this concrete Web Audio decoder. */
export function probeDrumKitOpusSupport(
  decoder: DrumKitAudioDecoder,
): Promise<boolean> {
  const key = decoder as object
  const cached = opusProbeByDecoder.get(key)
  if (cached !== undefined) return cached

  const probe = Promise.resolve()
    .then(async () => {
      const decoded = await decoder.decodeAudioData(encodedOpusProbe())
      return decodedAudioIsUsable(decoded)
    })
    .catch(() => false)
  opusProbeByDecoder.set(key, probe)
  return probe
}

function completePlan<Resource extends DrumKitMultiFormatResource>(
  resources: readonly Resource[],
  format: DrumKitRuntimeFormat,
): DrumKitFormatPlan<Resource> | null {
  const planned: PlannedDrumKitResource<Resource>[] = []
  for (const resource of resources) {
    const encoding = resource.formats[format]
    if (encoding === undefined) return null
    planned.push(Object.freeze({ resource, encoding }))
  }
  return Object.freeze({ format, resources: Object.freeze(planned) })
}

function requiredMp3Plan<Resource extends DrumKitMultiFormatResource>(
  resources: readonly Resource[],
): DrumKitFormatPlan<Resource> {
  const plan = completePlan(resources, 'mp3')
  if (plan === null) {
    throw new Error('A sampled Drum Night kit is missing its MP3 fallback')
  }
  return plan
}

function opusProjectionMatches(
  encodings: ReadonlyMap<string, DrumKitResourceEncoding>,
  knownResourceIds: readonly string[] | undefined,
): boolean {
  if (knownResourceIds === undefined) return true
  const expected = new Set(knownResourceIds)
  return (
    expected.size === knownResourceIds.length &&
    encodings.size === expected.size &&
    [...encodings.keys()].every((resourceId) => expected.has(resourceId))
  )
}

function projectedOpusPlan<Resource extends DrumKitMultiFormatResource>(
  resources: readonly Resource[],
  encodings: ReadonlyMap<string, DrumKitResourceEncoding>,
): DrumKitFormatPlan<Resource> | null {
  const planned: PlannedDrumKitResource<Resource>[] = []
  for (const resource of resources) {
    const encoding = encodings.get(resource.id)
    if (encoding === undefined) return null
    planned.push(Object.freeze({ resource, encoding }))
  }
  return Object.freeze({ format: 'opus', resources: Object.freeze(planned) })
}

/** Select Opus only when the browser and every planned resource support it. */
export function selectCompleteDrumKitFormat<
  Resource extends DrumKitMultiFormatResource,
>(
  resources: readonly Resource[],
  opusSupported: boolean,
): DrumKitFormatPlan<Resource> {
  if (resources.length > 0 && opusSupported) {
    const opusPlan = completePlan(resources, 'opus')
    if (opusPlan !== null) return opusPlan
  }
  return requiredMp3Plan(resources)
}

/** Resolve the selected encoding itself, never the resource's MP3 alias. */
export function resolveDrumKitEncodingAssetUrl(
  encoding: DrumKitResourceEncoding,
  configuredBase = '/drum-night/kits/',
): string {
  const base = configuredBase.endsWith('/')
    ? configuredBase
    : `${configuredBase}/`
  if (base.startsWith('//') || base.includes('\\')) {
    throw new Error(
      'Drum kit media base cannot be protocol-relative or contain backslashes',
    )
  }
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(base)?.[1]?.toLowerCase()
  if (scheme !== undefined) {
    if (scheme !== 'https' && scheme !== 'http') {
      throw new Error('Drum kit media base must use HTTP or HTTPS')
    }
    return new URL(encoding.path, base).href
  }
  const normalizedBase = base.startsWith('/') ? base : `/${base}`
  return `${normalizedBase}${encoding.path}`
}

/**
 * Create a route/session owner for the capability result.
 *
 * FLAC is intentionally absent from runtime preference order until the shared
 * supporter entitlement port can authorise it; merely listing FLAC in a
 * catalog must never turn it into a default download.
 */
export function createDrumKitFormatSession<
  Resource extends DrumKitMultiFormatResource,
>(
  decoder: DrumKitAudioDecoder,
  options: DrumKitFormatSessionOptions = {},
): DrumKitFormatSession<Resource> {
  let opusSupport: Promise<boolean> | null = null
  let opusFormats: Promise<
    ReadonlyMap<string, DrumKitResourceEncoding>
  > | null = null
  const readOpusSupport = (): Promise<boolean> => {
    opusSupport ??= Promise.resolve()
      .then(() =>
        options.probeOpus === undefined
          ? probeDrumKitOpusSupport(decoder)
          : options.probeOpus(),
      )
      .catch(() => false)
    return opusSupport
  }
  const readOpusFormats = (): Promise<
    ReadonlyMap<string, DrumKitResourceEncoding>
  > => {
    opusFormats ??= Promise.resolve().then(
      options.loadOpusFormats ?? loadDrumKitOpusFormats,
    )
    return opusFormats
  }

  return Object.freeze({
    async select(
      resources: readonly Resource[],
    ): Promise<DrumKitFormatPlan<Resource>> {
      if (!(await readOpusSupport()) || resources.length === 0) {
        return requiredMp3Plan(resources)
      }

      const inlinePlan = completePlan(resources, 'opus')
      if (inlinePlan !== null) return inlinePlan

      try {
        const encodings = await readOpusFormats()
        if (!opusProjectionMatches(encodings, options.knownResourceIds)) {
          return requiredMp3Plan(resources)
        }
        return (
          projectedOpusPlan(resources, encodings) ?? requiredMp3Plan(resources)
        )
      } catch {
        return requiredMp3Plan(resources)
      }
    },
    fallback(resources: readonly Resource[]): DrumKitFormatPlan<Resource> {
      return requiredMp3Plan(resources)
    },
  })
}
