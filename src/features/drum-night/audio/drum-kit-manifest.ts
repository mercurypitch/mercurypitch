// ============================================================
// Drum kit manifest — four licensed flavors behind one immutable asset map
// ============================================================
//
// The generated resource catalog is small metadata, not audio. It is safe to
// inspect on first paint; only the player may resolve and fetch its MP3 paths.

import type { DrumVoiceId } from '@/lib/drum-voices'
import generatedCatalog from './drum-kit-resources.generated.json'

export const DRUM_KIT_IDS = Object.freeze([
  'mercury-synth',
  'classic-gm',
  'studio',
  'live',
] as const)

export type DrumKitId = (typeof DRUM_KIT_IDS)[number]
export type DrumKitEngine = 'sampled' | 'synth'

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

export interface DrumKitSourceProvenance {
  readonly commit: string
  readonly path: string
  readonly sha256: string
  readonly transforms: string
}

export interface DrumKitSampleResource {
  readonly id: string
  readonly kitId: Exclude<DrumKitId, 'mercury-synth'>
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
  /** Curator-measured linear gain applied before the live velocity curve. */
  readonly playbackGain: number
  readonly source: DrumKitSourceProvenance
}

export interface DrumKitManifest {
  readonly id: DrumKitId
  readonly name: string
  readonly character: string
  readonly engine: DrumKitEngine
  readonly version: string
  readonly license: DrumKitLicense
  readonly resources: readonly DrumKitSampleResource[]
  readonly publishedEncodedBytes: number
  readonly optionalDownload: boolean
}

interface GeneratedKit {
  readonly version: string
  readonly publishedEncodedBytes: number
  readonly resources: readonly DrumKitSampleResource[]
}

interface GeneratedCatalog {
  readonly schemaVersion: number
  readonly kits: Readonly<Record<DrumKitId, GeneratedKit>>
}

const GENERATED = generatedCatalog as unknown as GeneratedCatalog
const MAX_ENCODED_RESOURCE_BYTES = 2 * 1024 * 1024
const HASHED_RESOURCE_PATH =
  /^(classic-gm|studio|live)\/v[1-9]\d*\/[a-f0-9]{16}-[a-z0-9-]+\.mp3$/
const SHA256 = /^[a-f0-9]{64}$/
const RESOURCE_ID = /^(classic-gm|studio|live):[a-z0-9-]+-l[1-9]\d*-rr[1-9]\d*$/
const MIN_PLAYBACK_GAIN = 10 ** (-12 / 20)
const MAX_PLAYBACK_GAIN = 10 ** (12 / 20)
const PLAYBACK_GAIN_ROUNDING_TOLERANCE = 1e-8

function assertGeneratedCatalog(catalog: GeneratedCatalog): void {
  if (catalog.schemaVersion !== 1) {
    throw new Error('Unsupported Drum Night kit catalog schema')
  }
  const resourceIds = new Set<string>()
  const resourcePaths = new Set<string>()
  for (const kitId of DRUM_KIT_IDS) {
    const kit = catalog.kits[kitId]
    if (kit === undefined || !/^v[1-9]\d*$/.test(kit.version)) {
      throw new Error(`Invalid Drum Night kit metadata: ${kitId}`)
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
    for (const resource of kit.resources) {
      const expectedPathPrefix = `${kitId}/${kit.version}/`
      const expectedHashPrefix = resource.sha256.slice(0, 16)
      const fileName = resource.path.slice(resource.path.lastIndexOf('/') + 1)
      if (
        resource.kitId !== kitId ||
        !RESOURCE_ID.test(resource.id) ||
        !resource.id.startsWith(`${kitId}:`) ||
        !HASHED_RESOURCE_PATH.test(resource.path) ||
        !resource.path.startsWith(expectedPathPrefix) ||
        !fileName.startsWith(`${expectedHashPrefix}-`) ||
        !SHA256.test(resource.sha256) ||
        resource.mimeType !== 'audio/mpeg' ||
        !Number.isSafeInteger(resource.encodedBytes) ||
        resource.encodedBytes <= 0 ||
        resource.encodedBytes > MAX_ENCODED_RESOURCE_BYTES ||
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
        !Number.isFinite(resource.playbackGain) ||
        resource.playbackGain <
          MIN_PLAYBACK_GAIN - PLAYBACK_GAIN_ROUNDING_TOLERANCE ||
        resource.playbackGain >
          MAX_PLAYBACK_GAIN + PLAYBACK_GAIN_ROUNDING_TOLERANCE ||
        !SHA256.test(resource.source.sha256) ||
        resource.source.commit.trim() === '' ||
        resource.source.path.trim() === '' ||
        resource.source.transforms.trim() === ''
      ) {
        throw new Error(`Invalid Drum Night kit resource: ${resource.id}`)
      }
      if (resourceIds.has(resource.id) || resourcePaths.has(resource.path)) {
        throw new Error(`Duplicate Drum Night kit resource: ${resource.id}`)
      }
      resourceIds.add(resource.id)
      resourcePaths.add(resource.path)
      encodedBytes += resource.encodedBytes
    }
    if (encodedBytes !== kit.publishedEncodedBytes) {
      throw new Error(`Drum Night kit byte total mismatch: ${kitId}`)
    }
  }
}

assertGeneratedCatalog(GENERATED)

function immutableResources(
  kitId: Exclude<DrumKitId, 'mercury-synth'>,
): readonly DrumKitSampleResource[] {
  return Object.freeze(
    GENERATED.kits[kitId].resources.map((resource) =>
      Object.freeze({
        ...resource,
        gmKeys: Object.freeze([...resource.gmKeys]),
        chokes: Object.freeze([...resource.chokes]),
        source: Object.freeze({ ...resource.source }),
      }),
    ),
  )
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
      version: GENERATED.kits['mercury-synth'].version,
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
      version: GENERATED.kits['classic-gm'].version,
      license: LICENSES.sonivox,
      resources: immutableResources('classic-gm'),
      publishedEncodedBytes: GENERATED.kits['classic-gm'].publishedEncodedBytes,
      optionalDownload: true,
    }),
    studio: Object.freeze({
      id: 'studio',
      name: 'Studio',
      character: 'Focused contemporary acoustic kit with natural dynamics',
      engine: 'sampled',
      version: GENERATED.kits.studio.version,
      license: LICENSES.virtuosity,
      resources: immutableResources('studio'),
      publishedEncodedBytes: GENERATED.kits.studio.publishedEncodedBytes,
      optionalDownload: true,
    }),
    live: Object.freeze({
      id: 'live',
      name: 'Live',
      character: 'Roomier acoustic kit with broad round-robin movement',
      engine: 'sampled',
      version: GENERATED.kits.live.version,
      license: LICENSES.tchimera,
      resources: immutableResources('live'),
      publishedEncodedBytes: GENERATED.kits.live.publishedEncodedBytes,
      optionalDownload: true,
    }),
  })

export const DRUM_KIT_CATALOG = Object.freeze(
  DRUM_KIT_IDS.map((kitId) => DRUM_KIT_MANIFESTS[kitId]),
)

export function drumKitManifest(kitId: DrumKitId): DrumKitManifest {
  return DRUM_KIT_MANIFESTS[kitId]
}

export function drumKitResourcesForHit(
  kitId: DrumKitId,
  gmKey: number,
  velocity: number,
): readonly DrumKitSampleResource[] {
  if (kitId === 'mercury-synth') return Object.freeze([])
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
