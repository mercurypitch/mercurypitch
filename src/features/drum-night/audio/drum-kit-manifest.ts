// ============================================================
// Drum kit manifest — five licensed flavors behind one immutable asset map
// ============================================================
//
// First paint receives only the compact MP3 runtime projection. The canonical
// provenance and multi-format catalog stays an audited build artifact, while
// Opus metadata is loaded only after the gesture-owned capability probe.

import type { DrumVoiceId } from '@/lib/drum-voices'
import type * as CatalogSchema from './drum-kit-catalog-schema'
import { DRUM_KIT_CATALOG_SCHEMA_VERSION, DRUM_KIT_IDS, } from './drum-kit-catalog-schema'
import runtimeCatalog from './drum-kit-runtime.generated.json'

export * from './drum-kit-catalog-schema'

type DrumKitId = CatalogSchema.DrumKitId
type DrumKitEngine = CatalogSchema.DrumKitEngine
type DrumKitSampleStatus = CatalogSchema.DrumKitSampleStatus
type DrumKitSynthModel = CatalogSchema.DrumKitSynthModel
type DrumKitSampleResource = CatalogSchema.DrumKitSampleResource
type DrumKitVelocityCurves = CatalogSchema.DrumKitVelocityCurves
type DrumVelocityCurve = CatalogSchema.DrumVelocityCurve
type SampledDrumKitId = CatalogSchema.SampledDrumKitId

type RuntimeDrumKitSampleResource = Omit<
  CatalogSchema.DrumKitSampleResource,
  'formats'
>

interface RuntimeDrumKit {
  readonly version: string
  readonly sampleStatus: DrumKitSampleStatus
  readonly publishedEncodedBytes: number
  readonly resources: readonly RuntimeDrumKitSampleResource[]
  readonly velcurve?: DrumKitVelocityCurves
}

interface RuntimeDrumKitCatalog {
  readonly schemaVersion: 1
  readonly catalogSchemaVersion: number
  readonly kits: Readonly<
    Record<SampledDrumKitId | 'mercury-synth', RuntimeDrumKit>
  >
}

export interface DrumKitLicense {
  readonly name: string
  readonly spdx: string
  readonly url: string
  readonly attribution: string
  readonly noticePath: string | null
  /** Local full license text when redistribution requires shipping a copy. */
  readonly licenseTextPath: string | null
  readonly shareAlike: boolean
}

export interface DrumKitManifest {
  readonly id: DrumKitId
  readonly name: string
  readonly character: string
  readonly engine: DrumKitEngine
  readonly synthModel: DrumKitSynthModel | null
  readonly version: string
  readonly sampleStatus: DrumKitSampleStatus
  readonly license: DrumKitLicense
  readonly resources: readonly DrumKitSampleResource[]
  readonly publishedEncodedBytes: number
  readonly optionalDownload: boolean
  readonly velcurve?: DrumKitVelocityCurves
}

const RUNTIME_KIT_IDS = Object.freeze([
  'mercury-synth',
  'classic-gm',
  'studio',
  'live',
] as const)
const RUNTIME_RESOURCE_PATH =
  /^(classic-gm|studio|live)\/v[1-9]\d*\/[a-f0-9]{16}-[a-z0-9-]+\.mp3$/
const SHA256 = /^[a-f0-9]{64}$/
const SAMPLE_STATUSES: ReadonlySet<string> = new Set<DrumKitSampleStatus>([
  'ready',
  'reduced',
  'fallback',
])

function isSampleStatus(value: unknown): value is DrumKitSampleStatus {
  return typeof value === 'string' && SAMPLE_STATUSES.has(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowed.has(key))
}

/** Keep committed runtime paths fail-closed without pulling the audit parser into first paint. */
function assertRuntimeDrumKitCatalog(
  value: unknown,
): asserts value is RuntimeDrumKitCatalog {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.catalogSchemaVersion !== DRUM_KIT_CATALOG_SCHEMA_VERSION ||
    !isRecord(value.kits) ||
    !hasOnlyKeys(
      value,
      new Set(['schemaVersion', 'catalogSchemaVersion', 'kits']),
    ) ||
    !hasOnlyKeys(value.kits, new Set(RUNTIME_KIT_IDS))
  ) {
    throw new Error('Invalid Drum Night runtime catalog')
  }

  const resourceIds = new Set<string>()
  const resourcePaths = new Set<string>()
  for (const kitId of RUNTIME_KIT_IDS) {
    const kit = value.kits[kitId]
    if (
      !isRecord(kit) ||
      !hasOnlyKeys(
        kit,
        new Set([
          'version',
          'sampleStatus',
          'publishedEncodedBytes',
          'resources',
          'velcurve',
        ]),
      ) ||
      typeof kit.version !== 'string' ||
      !/^v[1-9]\d*$/.test(kit.version) ||
      !isSampleStatus(kit.sampleStatus) ||
      !Number.isSafeInteger(kit.publishedEncodedBytes) ||
      (kit.publishedEncodedBytes as number) < 0 ||
      !Array.isArray(kit.resources)
    ) {
      throw new Error(`Invalid Drum Night runtime kit: ${kitId}`)
    }
    if (kitId === 'mercury-synth') {
      if (
        kit.resources.length !== 0 ||
        kit.publishedEncodedBytes !== 0 ||
        kit.sampleStatus !== 'ready'
      ) {
        throw new Error('Mercury Synth runtime kit must remain zero-download')
      }
      continue
    }

    let encodedBytes = 0
    let derivedSampleStatus: DrumKitSampleStatus = 'ready'
    for (const resource of kit.resources) {
      if (
        !isRecord(resource) ||
        !hasOnlyKeys(
          resource,
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
            'readiness',
            'path',
            'mimeType',
            'encodedBytes',
            'sha256',
            'power',
            'playbackGain',
          ]),
        ) ||
        typeof resource.id !== 'string' ||
        !resource.id.startsWith(`${kitId}:`) ||
        resource.kitId !== kitId ||
        typeof resource.articulation !== 'string' ||
        !Array.isArray(resource.gmKeys) ||
        resource.gmKeys.length === 0 ||
        resource.gmKeys.some(
          (gmKey) => !Number.isInteger(gmKey) || gmKey < 35 || gmKey > 81,
        ) ||
        !Number.isInteger(resource.velocityMin) ||
        !Number.isInteger(resource.velocityMax) ||
        (resource.velocityMin as number) < 1 ||
        (resource.velocityMax as number) > 127 ||
        (resource.velocityMin as number) > (resource.velocityMax as number) ||
        !Number.isInteger(resource.roundRobin) ||
        (resource.roundRobin as number) < 1 ||
        (resource.chokeGroup !== null &&
          (typeof resource.chokeGroup !== 'string' ||
            resource.chokeGroup.trim() === '')) ||
        !Array.isArray(resource.chokes) ||
        resource.chokes.some(
          (choke) => typeof choke !== 'string' || choke.trim() === '',
        ) ||
        !isSampleStatus(resource.readiness) ||
        typeof resource.path !== 'string' ||
        !RUNTIME_RESOURCE_PATH.test(resource.path) ||
        !resource.path.startsWith(`${kitId}/${kit.version}/`) ||
        resource.mimeType !== 'audio/mpeg' ||
        !Number.isSafeInteger(resource.encodedBytes) ||
        (resource.encodedBytes as number) <= 0 ||
        typeof resource.sha256 !== 'string' ||
        !SHA256.test(resource.sha256) ||
        !resource.path
          .slice(resource.path.lastIndexOf('/') + 1)
          .startsWith(`${resource.sha256.slice(0, 16)}-`) ||
        (resource.power !== undefined &&
          (!Number.isFinite(resource.power) ||
            (resource.power as number) <= 0 ||
            (resource.power as number) > 1)) ||
        !Number.isFinite(resource.playbackGain) ||
        (resource.playbackGain as number) <= 0 ||
        resourceIds.has(resource.id) ||
        resourcePaths.has(resource.path)
      ) {
        throw new Error(
          `Invalid Drum Night runtime resource: ${String(resource.id)}`,
        )
      }
      resourceIds.add(resource.id)
      resourcePaths.add(resource.path)
      encodedBytes += resource.encodedBytes as number
      if (resource.readiness === 'fallback') {
        derivedSampleStatus = 'fallback'
      } else if (
        resource.readiness === 'reduced' &&
        derivedSampleStatus === 'ready'
      ) {
        derivedSampleStatus = 'reduced'
      }
    }
    if (encodedBytes !== kit.publishedEncodedBytes) {
      throw new Error(`Drum Night runtime byte total mismatch: ${kitId}`)
    }
    if (kit.sampleStatus !== derivedSampleStatus) {
      throw new Error(`Drum Night runtime sample status mismatch: ${kitId}`)
    }
  }
}

const GENERATED_VALUE: unknown = runtimeCatalog
assertRuntimeDrumKitCatalog(GENERATED_VALUE)
const GENERATED = GENERATED_VALUE

function immutableResources(
  kitId: SampledDrumKitId,
): readonly DrumKitSampleResource[] {
  return Object.freeze(
    GENERATED.kits[kitId].resources.map((resource) => {
      return Object.freeze({
        ...resource,
        gmKeys: Object.freeze([...resource.gmKeys]),
        chokes: Object.freeze([...resource.chokes]),
        formats: Object.freeze({
          mp3: Object.freeze({
            path: resource.path,
            mimeType: resource.mimeType,
            encodedBytes: resource.encodedBytes,
            sha256: resource.sha256,
          }),
        }),
      })
    }),
  )
}

function immutableVelocityCurve(curve: DrumVelocityCurve): DrumVelocityCurve {
  return Object.freeze(
    curve.map(([velocity, output]) =>
      Object.freeze([velocity, output] as const),
    ),
  )
}

function immutableVelocityCurves(
  curves: DrumKitVelocityCurves | undefined,
): DrumKitVelocityCurves | undefined {
  if (curves === undefined) return undefined
  const articulations = Object.fromEntries(
    Object.entries(curves.articulations ?? {}).map(([articulation, curve]) => [
      articulation,
      immutableVelocityCurve(curve),
    ]),
  ) as Partial<Record<DrumVoiceId, DrumVelocityCurve>>
  return Object.freeze({
    ...(curves.default === undefined
      ? {}
      : { default: immutableVelocityCurve(curves.default) }),
    ...(Object.keys(articulations).length === 0
      ? {}
      : { articulations: Object.freeze(articulations) }),
  })
}

const LICENSES = Object.freeze({
  synth: Object.freeze({
    name: 'GNU Affero General Public License 3.0',
    spdx: 'AGPL-3.0-only',
    url: 'https://www.gnu.org/licenses/agpl-3.0.html',
    attribution: 'MercuryPitch synthesized percussion recipes.',
    noticePath: null,
    licenseTextPath: null,
    shareAlike: true,
  }),
  sonivox: Object.freeze({
    name: 'Apache License 2.0',
    spdx: 'Apache-2.0',
    url: 'https://www.apache.org/licenses/LICENSE-2.0',
    attribution:
      'SONiVOX EAS General MIDI SoundFont, copyright 2004–2006 Sonic Network Inc.',
    noticePath: 'classic-gm/LICENSE.md',
    licenseTextPath: 'classic-gm/APACHE-2.0.txt',
    shareAlike: false,
  }),
  virtuosity: Object.freeze({
    name: 'CC0 1.0 Universal',
    spdx: 'CC0-1.0',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution:
      'Virtuosity Drums by Versilian Studios, performed by Austin McMahon.',
    noticePath: 'studio/LICENSE.md',
    licenseTextPath: null,
    shareAlike: false,
  }),
  tchimera: Object.freeze({
    name: 'Creative Commons Attribution-ShareAlike 4.0 International',
    spdx: 'CC-BY-SA-4.0',
    url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attribution:
      'Tchimera Drum Kit recordings by Vincent “Tchackpoum” Sermone; MercuryPitch Live Kit derivative.',
    noticePath: 'live/LICENSE.md',
    licenseTextPath: null,
    shareAlike: true,
  }),
}) satisfies Readonly<Record<string, DrumKitLicense>>

export const DRUM_KIT_MANIFESTS: Readonly<Record<DrumKitId, DrumKitManifest>> =
  Object.freeze({
    'mercury-synth': Object.freeze({
      id: 'mercury-synth',
      name: 'Mercury Synth',
      character: 'Electronic, immediate, and always available',
      engine: 'synth',
      synthModel: 'mercury',
      version: GENERATED.kits['mercury-synth'].version,
      sampleStatus: 'ready',
      license: LICENSES.synth,
      resources: Object.freeze([]),
      publishedEncodedBytes: 0,
      optionalDownload: false,
    }),
    circuit: Object.freeze({
      id: 'circuit',
      name: 'Circuit',
      character: 'Owned circuit-inspired percussion with bounded variation',
      engine: 'synth',
      synthModel: 'circuit',
      version: 'v1',
      sampleStatus: 'ready',
      license: LICENSES.synth,
      resources: Object.freeze([]),
      publishedEncodedBytes: 0,
      optionalDownload: false,
    }),
    'classic-gm': Object.freeze({
      id: 'classic-gm',
      name: 'Classic GM',
      character: 'Familiar General MIDI playback for imported arrangements',
      engine: 'sampled',
      synthModel: null,
      version: GENERATED.kits['classic-gm'].version,
      sampleStatus: GENERATED.kits['classic-gm'].sampleStatus,
      license: LICENSES.sonivox,
      resources: immutableResources('classic-gm'),
      publishedEncodedBytes: GENERATED.kits['classic-gm'].publishedEncodedBytes,
      optionalDownload: true,
      velcurve: immutableVelocityCurves(GENERATED.kits['classic-gm'].velcurve),
    }),
    studio: Object.freeze({
      id: 'studio',
      name: 'Studio',
      character: 'Focused contemporary acoustic kit with natural dynamics',
      engine: 'sampled',
      synthModel: null,
      version: GENERATED.kits.studio.version,
      sampleStatus: GENERATED.kits.studio.sampleStatus,
      license: LICENSES.virtuosity,
      resources: immutableResources('studio'),
      publishedEncodedBytes: GENERATED.kits.studio.publishedEncodedBytes,
      optionalDownload: true,
      velcurve: immutableVelocityCurves(GENERATED.kits.studio.velcurve),
    }),
    live: Object.freeze({
      id: 'live',
      name: 'Live',
      character: 'Roomier acoustic kit with broad round-robin movement',
      engine: 'sampled',
      synthModel: null,
      version: GENERATED.kits.live.version,
      sampleStatus: GENERATED.kits.live.sampleStatus,
      license: LICENSES.tchimera,
      resources: immutableResources('live'),
      publishedEncodedBytes: GENERATED.kits.live.publishedEncodedBytes,
      optionalDownload: true,
      velcurve: immutableVelocityCurves(GENERATED.kits.live.velcurve),
    }),
  })

export const DRUM_KIT_CATALOG = Object.freeze(
  DRUM_KIT_IDS.map((kitId) => DRUM_KIT_MANIFESTS[kitId]),
)

export function drumKitManifest(kitId: DrumKitId): DrumKitManifest {
  return DRUM_KIT_MANIFESTS[kitId]
}

/** Resolve an articulation override before the kit-wide velocity curve. */
export function resolveDrumKitVelocityCurve(
  curves: DrumKitVelocityCurves | undefined,
  articulation: DrumVoiceId,
): DrumVelocityCurve | undefined {
  return curves?.articulations?.[articulation] ?? curves?.default
}

export function drumKitVelocityCurveFor(
  kitId: DrumKitId,
  articulation: DrumVoiceId,
): DrumVelocityCurve | undefined {
  return resolveDrumKitVelocityCurve(
    DRUM_KIT_MANIFESTS[kitId].velcurve,
    articulation,
  )
}

export function drumKitResourcesForHit(
  kitId: DrumKitId,
  gmKey: number,
  velocity: number,
): readonly DrumKitSampleResource[] {
  if (DRUM_KIT_MANIFESTS[kitId].engine === 'synth') return Object.freeze([])
  const normalizedVelocity = Number.isFinite(velocity)
    ? Math.min(127, Math.max(1, Math.round(velocity)))
    : 1
  return DRUM_KIT_MANIFESTS[kitId].resources.filter(
    (resource) =>
      resource.gmKeys.includes(gmKey) &&
      normalizedVelocity >= resource.velocityMin &&
      normalizedVelocity <= resource.velocityMax,
  )
}

export function resolveDrumKitAssetUrl(
  resource: DrumKitSampleResource,
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
    const resolved = new URL(resource.path, base)
    return resolved.href
  }
  const normalizedBase = base.startsWith('/') ? base : `/${base}`
  return `${normalizedBase}${resource.path}`
}
