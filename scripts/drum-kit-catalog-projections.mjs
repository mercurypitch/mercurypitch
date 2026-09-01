// ============================================================
// Drum kit catalog projections — compact runtime views of canonical metadata
// ============================================================
//
// The canonical v2 catalog remains the provenance and publishing source of
// truth. These deterministic projections keep audit-only metadata out of the
// application bundle while preserving exact MP3 and Opus resource closure.

import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

export const DRUM_KIT_RUNTIME_PROJECTION_SCHEMA_VERSION = 1
export const DRUM_KIT_OPUS_PROJECTION_SCHEMA_VERSION = 1
export const DRUM_KIT_CANONICAL_SCHEMA_VERSION = 2
export const DRUM_KIT_OPUS_PROJECTION_MIME_TYPE = 'audio/ogg; codecs=opus'

const GENERATED_KIT_IDS = Object.freeze([
  'mercury-synth',
  'classic-gm',
  'studio',
  'live',
])
const SAMPLED_KIT_IDS = new Set(['classic-gm', 'studio', 'live'])
const SAMPLE_STATUSES = new Set(['ready', 'reduced', 'fallback'])
const SHA256 = /^[a-f0-9]{64}$/
const GENERATED_JSON_CONFIG_TARGET = fileURLToPath(
  new URL(
    '../src/features/drum-night/audio/drum-kit-runtime.generated.json',
    import.meta.url,
  ),
)
let generatedJsonOptions

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertExactKitClosure(kits) {
  if (!isRecord(kits)) throw new Error('Drum Night catalog has no kit map')
  const actual = Object.keys(kits).sort()
  const expected = [...GENERATED_KIT_IDS].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('Drum Night projection kit closure does not match')
  }
}

function assertEncoding(encoding, format, resourceId) {
  const expectedMimeType =
    format === 'mp3' ? 'audio/mpeg' : DRUM_KIT_OPUS_PROJECTION_MIME_TYPE
  if (
    !isRecord(encoding) ||
    typeof encoding.path !== 'string' ||
    encoding.path.length === 0 ||
    encoding.mimeType !== expectedMimeType ||
    !Number.isSafeInteger(encoding.encodedBytes) ||
    encoding.encodedBytes <= 0 ||
    typeof encoding.sha256 !== 'string' ||
    SHA256.test(encoding.sha256) !== true
  ) {
    throw new Error(
      `Invalid Drum Night ${format.toUpperCase()} projection encoding: ${resourceId}`,
    )
  }
  return encoding
}

function assertMp3Alias(resource, mp3) {
  if (
    resource.path !== mp3.path ||
    resource.mimeType !== mp3.mimeType ||
    resource.encodedBytes !== mp3.encodedBytes ||
    resource.sha256 !== mp3.sha256
  ) {
    throw new Error(`Drum Night MP3 projection alias drifted: ${resource.id}`)
  }
}

function projectRuntimeResource(resource, expectedKitId) {
  if (
    !isRecord(resource) ||
    typeof resource.id !== 'string' ||
    resource.id.length === 0 ||
    resource.kitId !== expectedKitId ||
    typeof resource.articulation !== 'string' ||
    !Array.isArray(resource.gmKeys) ||
    !Number.isInteger(resource.velocityMin) ||
    !Number.isInteger(resource.velocityMax) ||
    !Number.isInteger(resource.roundRobin) ||
    (resource.chokeGroup !== null && typeof resource.chokeGroup !== 'string') ||
    !Array.isArray(resource.chokes) ||
    !SAMPLE_STATUSES.has(resource.readiness) ||
    !Number.isFinite(resource.playbackGain) ||
    !isRecord(resource.source) ||
    !isRecord(resource.formats)
  ) {
    throw new Error(
      `Invalid Drum Night runtime projection resource: ${String(resource?.id)}`,
    )
  }
  const mp3 = assertEncoding(resource.formats.mp3, 'mp3', resource.id)
  assertMp3Alias(resource, mp3)
  if (
    resource.power !== undefined &&
    (!Number.isFinite(resource.power) || resource.power <= 0)
  ) {
    throw new Error(`Invalid Drum Night projected power: ${resource.id}`)
  }
  return {
    id: resource.id,
    kitId: resource.kitId,
    articulation: resource.articulation,
    gmKeys: resource.gmKeys,
    velocityMin: resource.velocityMin,
    velocityMax: resource.velocityMax,
    roundRobin: resource.roundRobin,
    chokeGroup: resource.chokeGroup,
    chokes: resource.chokes,
    readiness: resource.readiness,
    path: resource.path,
    mimeType: resource.mimeType,
    encodedBytes: resource.encodedBytes,
    sha256: resource.sha256,
    ...(resource.power === undefined ? {} : { power: resource.power }),
    playbackGain: resource.playbackGain,
  }
}

function projectKit(catalog, kitId, resourceIds, opusByResourceId) {
  const kit = catalog.kits[kitId]
  if (
    !isRecord(kit) ||
    typeof kit.version !== 'string' ||
    kit.version.length === 0 ||
    !SAMPLE_STATUSES.has(kit.sampleStatus) ||
    !Number.isSafeInteger(kit.publishedEncodedBytes) ||
    kit.publishedEncodedBytes < 0 ||
    !Array.isArray(kit.resources)
  ) {
    throw new Error(`Invalid Drum Night projection kit: ${kitId}`)
  }
  if (kitId === 'mercury-synth' && kit.resources.length !== 0) {
    throw new Error('The projected Mercury Synth kit must not contain samples')
  }
  const resources = kit.resources.map((resource) => {
    const projected = projectRuntimeResource(resource, kitId)
    if (resourceIds.has(projected.id) === true) {
      throw new Error(
        `Duplicate Drum Night projected resource: ${projected.id}`,
      )
    }
    resourceIds.add(projected.id)
    const opus = assertEncoding(resource.formats.opus, 'opus', projected.id)
    opusByResourceId.set(projected.id, {
      path: opus.path,
      encodedBytes: opus.encodedBytes,
      sha256: opus.sha256,
    })
    return projected
  })
  const publishedEncodedBytes = resources.reduce(
    (sum, resource) => sum + resource.encodedBytes,
    0,
  )
  if (publishedEncodedBytes !== kit.publishedEncodedBytes) {
    throw new Error(`Drum Night projected MP3 total drifted: ${kitId}`)
  }
  return {
    version: kit.version,
    sampleStatus: kit.sampleStatus,
    publishedEncodedBytes: kit.publishedEncodedBytes,
    resources,
    ...(kit.velcurve === undefined ? {} : { velcurve: kit.velcurve }),
  }
}

/** Derive both source-only runtime projections from the canonical v2 catalog. */
export function createDrumKitCatalogProjections(catalog) {
  if (
    !isRecord(catalog) ||
    catalog.schemaVersion !== DRUM_KIT_CANONICAL_SCHEMA_VERSION
  ) {
    throw new Error('Drum Night projections require canonical catalog schema 2')
  }
  assertExactKitClosure(catalog.kits)
  const resourceIds = new Set()
  const opusByResourceId = new Map()
  const kits = Object.fromEntries(
    GENERATED_KIT_IDS.map((kitId) => [
      kitId,
      projectKit(catalog, kitId, resourceIds, opusByResourceId),
    ]),
  )
  const sampledResourceCount = Object.entries(kits).reduce(
    (sum, [kitId, kit]) =>
      sum + (SAMPLED_KIT_IDS.has(kitId) ? kit.resources.length : 0),
    0,
  )
  if (
    opusByResourceId.size !== sampledResourceCount ||
    resourceIds.size !== sampledResourceCount
  ) {
    throw new Error('Drum Night MP3 and Opus projection closure differs')
  }
  const encodings = Object.fromEntries(
    [...opusByResourceId].sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  )
  return {
    runtime: {
      schemaVersion: DRUM_KIT_RUNTIME_PROJECTION_SCHEMA_VERSION,
      catalogSchemaVersion: catalog.schemaVersion,
      kits,
    },
    opus: {
      schemaVersion: DRUM_KIT_OPUS_PROJECTION_SCHEMA_VERSION,
      catalogSchemaVersion: catalog.schemaVersion,
      mimeType: DRUM_KIT_OPUS_PROJECTION_MIME_TYPE,
      encodings,
    },
  }
}

/** Serialize generated JSON with the same repository config as `pr:prepare`. */
export async function serializeDrumKitGeneratedJson(value) {
  generatedJsonOptions ??= resolveConfig(GENERATED_JSON_CONFIG_TARGET)
  const config = (await generatedJsonOptions) ?? {}
  return format(JSON.stringify(value), {
    ...config,
    filepath: GENERATED_JSON_CONFIG_TARGET,
    parser: 'json',
  })
}

/** Serialize projections exactly as the checked-in generated files. */
export async function serializeDrumKitCatalogProjections(catalog) {
  const projections = createDrumKitCatalogProjections(catalog)
  const [runtime, opus] = await Promise.all([
    serializeDrumKitGeneratedJson(projections.runtime),
    serializeDrumKitGeneratedJson(projections.opus),
  ])
  return {
    runtime,
    opus,
  }
}
