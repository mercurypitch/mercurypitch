// ============================================================
// Drum kit manifest tests — licenses, immutable assets, and hit resolution
// ============================================================

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertGeneratedDrumKitCatalog, DRUM_KIT_CATALOG, DRUM_KIT_CATALOG_SCHEMA_VERSION, DRUM_KIT_IDS, drumKitManifest, drumKitResourcesForHit, drumKitVelocityCurveFor, resolveDrumKitAssetUrl, resolveDrumKitVelocityCurve, } from './drum-kit-manifest'
import generatedCatalog from './drum-kit-resources.generated.json'

interface MutableGeneratedResource {
  encodedBytes: number
  formats?: Record<string, unknown>
  mimeType: string
  path: string
  power?: number
  sha256: string
  [key: string]: unknown
}

interface MutableGeneratedKit {
  resources: MutableGeneratedResource[]
  velcurve?: unknown
  [key: string]: unknown
}

interface MutableGeneratedCatalog {
  kits: Record<string, MutableGeneratedKit>
  schemaVersion: number
  [key: string]: unknown
}

function schemaTwoCatalog(): MutableGeneratedCatalog {
  const catalog = structuredClone(
    generatedCatalog,
  ) as unknown as MutableGeneratedCatalog
  catalog.schemaVersion = DRUM_KIT_CATALOG_SCHEMA_VERSION
  for (const kit of Object.values(catalog.kits)) {
    for (const resource of kit.resources) {
      resource.formats = {
        mp3: {
          path: resource.path,
          mimeType: resource.mimeType,
          encodedBytes: resource.encodedBytes,
          sha256: resource.sha256,
        },
      }
    }
  }
  return catalog
}

function schemaOneCatalog(): MutableGeneratedCatalog {
  const catalog = structuredClone(
    generatedCatalog,
  ) as unknown as MutableGeneratedCatalog
  catalog.schemaVersion = 1
  for (const kit of Object.values(catalog.kits)) {
    delete kit.velcurve
    for (const resource of kit.resources) {
      delete resource.formats
      delete resource.power
    }
  }
  return catalog
}

describe('Drum Night kit catalog', () => {
  it('offers five distinct flavors with two explicit zero-byte synth models', () => {
    expect(DRUM_KIT_IDS).toEqual([
      'mercury-synth',
      'circuit',
      'classic-gm',
      'studio',
      'live',
    ])
    expect(DRUM_KIT_CATALOG.map((kit) => kit.name)).toEqual([
      'Mercury Synth',
      'Circuit',
      'Classic GM',
      'Studio',
      'Live',
    ])
    expect(drumKitManifest('mercury-synth')).toMatchObject({
      engine: 'synth',
      synthModel: 'mercury',
      optionalDownload: false,
      publishedEncodedBytes: 0,
      resources: [],
    })
    expect(drumKitManifest('circuit')).toMatchObject({
      engine: 'synth',
      synthModel: 'circuit',
      optionalDownload: false,
      publishedEncodedBytes: 0,
      resources: [],
      license: { spdx: 'AGPL-3.0-only' },
    })
    expect(drumKitManifest('studio').synthModel).toBeNull()
    expect(drumKitManifest('classic-gm').publishedEncodedBytes).toBe(1_703_796)
    expect(drumKitManifest('studio').publishedEncodedBytes).toBe(2_318_633)
    expect(drumKitManifest('live').publishedEncodedBytes).toBe(2_625_351)
    expect(
      DRUM_KIT_CATALOG.reduce((sum, kit) => sum + kit.publishedEncodedBytes, 0),
    ).toBe(6_647_780)
  })

  it('accepts legacy metadata, validates v2 additions, and rejects future schemas', () => {
    expect(() =>
      assertGeneratedDrumKitCatalog(schemaOneCatalog()),
    ).not.toThrow()
    const catalog = schemaTwoCatalog()
    const studio = catalog.kits.studio
    studio.velcurve = {
      default: [
        [1, 0.05],
        [64, 0.45],
        [127, 1],
      ],
      articulations: {
        ride: [
          [1, 0.1],
          [127, 1],
        ],
      },
    }
    studio.resources[0].power = 0.35

    expect(() => assertGeneratedDrumKitCatalog(catalog)).not.toThrow()
    expect(() =>
      assertGeneratedDrumKitCatalog({ ...catalog, schemaVersion: 3 }),
    ).toThrow('Unsupported Drum Night kit catalog schema: 3')
  })

  it('allows schema 1 to omit v2 data but never to smuggle in v2 semantics', () => {
    const catalog = schemaOneCatalog()
    const resource = catalog.kits.studio.resources[0]
    resource.formats = {
      mp3: {
        path: resource.path,
        mimeType: resource.mimeType,
        encodedBytes: resource.encodedBytes,
        sha256: resource.sha256,
      },
    }

    expect(() => assertGeneratedDrumKitCatalog(catalog)).toThrow(
      'Drum Night v2 field in schema 1 resource',
    )
  })

  it('requires the v2 MP3 floor to match the retained compatibility alias', () => {
    const missing = schemaTwoCatalog()
    missing.kits.studio.resources[0].formats = {}
    expect(() => assertGeneratedDrumKitCatalog(missing)).toThrow(
      'Missing Drum Night MP3 format',
    )

    const mismatched = schemaTwoCatalog()
    const first = mismatched.kits.studio.resources[0]
    const mp3 = first.formats?.mp3 as Record<string, unknown>
    first.formats = { mp3: { ...mp3, encodedBytes: first.encodedBytes + 1 } }
    expect(() => assertGeneratedDrumKitCatalog(mismatched)).toThrow(
      'Drum Night MP3 alias mismatch',
    )
  })

  it('rejects unknown kits and fields instead of partially reading them', () => {
    const unexpectedCatalogField = schemaTwoCatalog()
    unexpectedCatalogField.futureMeaning = true
    expect(() => assertGeneratedDrumKitCatalog(unexpectedCatalogField)).toThrow(
      'Unexpected Drum Night catalog field: futureMeaning',
    )

    const unexpectedKit = schemaTwoCatalog()
    unexpectedKit.kits.future = {
      version: 'v1',
      publishedEncodedBytes: 0,
      resources: [],
    }
    expect(() => assertGeneratedDrumKitCatalog(unexpectedKit)).toThrow(
      'Unexpected Drum Night generated kit: future',
    )

    const unexpectedKitField = schemaTwoCatalog()
    unexpectedKitField.kits.studio.futureMeaning = true
    expect(() => assertGeneratedDrumKitCatalog(unexpectedKitField)).toThrow(
      'Unexpected Drum Night kit studio field: futureMeaning',
    )

    const unexpectedResourceField = schemaTwoCatalog()
    unexpectedResourceField.kits.studio.resources[0].futureMeaning = true
    expect(() =>
      assertGeneratedDrumKitCatalog(unexpectedResourceField),
    ).toThrow('Unexpected Drum Night resource')

    const unsupportedFormat = schemaTwoCatalog()
    const formatsWithFuture = unsupportedFormat.kits.studio.resources[0]
      .formats as Record<string, unknown>
    formatsWithFuture.future = {}
    expect(() => assertGeneratedDrumKitCatalog(unsupportedFormat)).toThrow(
      'Unsupported Drum Night sample format: future',
    )

    const unexpectedEncodingField = schemaTwoCatalog()
    const formatsWithUnexpectedEncoding = unexpectedEncodingField.kits.studio
      .resources[0].formats as Record<string, unknown>
    const mp3 = formatsWithUnexpectedEncoding.mp3 as Record<string, unknown>
    mp3.futureMeaning = true
    expect(() =>
      assertGeneratedDrumKitCatalog(unexpectedEncodingField),
    ).toThrow('Unexpected Drum Night mp3 encoding field: futureMeaning')
  })

  it('rejects invalid measured power and non-monotonic velocity curves', () => {
    const invalidPower = schemaTwoCatalog()
    invalidPower.kits.live.resources[0].power = 1.01
    expect(() => assertGeneratedDrumKitCatalog(invalidPower)).toThrow(
      'Invalid Drum Night kit resource',
    )

    const invalidCurve = schemaTwoCatalog()
    invalidCurve.kits.live.velcurve = {
      default: [
        [1, 0.2],
        [64, 0.8],
        [127, 0.7],
      ],
    }
    expect(() => assertGeneratedDrumKitCatalog(invalidCurve)).toThrow(
      'Invalid Drum Night velocity curve',
    )
  })

  it('validates articulation and choke data as untrusted catalog input', () => {
    const invalidArticulation = schemaTwoCatalog()
    invalidArticulation.kits.live.resources[0].articulation = 'future-drum'
    expect(() => assertGeneratedDrumKitCatalog(invalidArticulation)).toThrow(
      'Invalid Drum Night kit resource',
    )

    const invalidChoke = schemaTwoCatalog()
    invalidChoke.kits.live.resources[0].chokes = ['hh', 'hh']
    expect(() => assertGeneratedDrumKitCatalog(invalidChoke)).toThrow(
      'Invalid Drum Night kit resource',
    )
  })

  it('resolves articulation curves before the kit default', () => {
    const defaultCurve = [
      [1, 0.05],
      [127, 1],
    ] as const
    const rideCurve = [
      [1, 0.1],
      [127, 1],
    ] as const

    expect(
      resolveDrumKitVelocityCurve(
        { default: defaultCurve, articulations: { ride: rideCurve } },
        'ride',
      ),
    ).toBe(rideCurve)
    expect(
      resolveDrumKitVelocityCurve(
        { default: defaultCurve, articulations: { ride: rideCurve } },
        'kick',
      ),
    ).toBe(defaultCurve)
    expect(drumKitVelocityCurveFor('studio', 'kick')).toBeUndefined()
    expect(drumKitVelocityCurveFor('circuit', 'kick')).toBeUndefined()
  })

  it('carries the redistribution terms users and publishers need', () => {
    expect(drumKitManifest('classic-gm').license).toMatchObject({
      spdx: 'Apache-2.0',
      shareAlike: false,
      noticePath: 'classic-gm/LICENSE.md',
      licenseTextPath: 'classic-gm/APACHE-2.0.txt',
    })
    expect(drumKitManifest('studio').license).toMatchObject({
      spdx: 'CC0-1.0',
      shareAlike: false,
      noticePath: 'studio/LICENSE.md',
    })
    expect(drumKitManifest('live').license).toMatchObject({
      spdx: 'CC-BY-SA-4.0',
      shareAlike: true,
      attribution: expect.stringContaining('Vincent'),
      noticePath: 'live/LICENSE.md',
    })
    const apacheBytes = readFileSync(
      resolve(
        'public/drum-night/kits',
        drumKitManifest('classic-gm').license.licenseTextPath!,
      ),
    )
    expect(apacheBytes.byteLength).toBe(11_358)
    expect(createHash('sha256').update(apacheBytes).digest('hex')).toBe(
      'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30',
    )
    const apacheText = apacheBytes.toString('utf8')
    expect(apacheText).toContain('Apache License')
    expect(apacheText).toContain('TERMS AND CONDITIONS')
    expect(apacheText).toContain('END OF TERMS AND CONDITIONS')
  })

  it('resolves velocity layers and deliberate GM family folds', () => {
    const quietKick = drumKitResourcesForHit('studio', 35, 20)
    const loudKick = drumKitResourcesForHit('studio', 36, 126)
    expect(quietKick).toHaveLength(2)
    expect(quietKick.every((resource) => resource.velocityMax === 80)).toBe(
      true,
    )
    expect(loudKick).toHaveLength(2)
    expect(loudKick.every((resource) => resource.velocityMin === 81)).toBe(true)
    expect(
      drumKitResourcesForHit('live', 43, Number.POSITIVE_INFINITY).map(
        (resource) => resource.articulation,
      ),
    ).toEqual(['tom-low', 'tom-low'])
    expect(drumKitResourcesForHit('studio', 54, 100)).toEqual([])
    expect(drumKitResourcesForHit('mercury-synth', 36, 100)).toEqual([])
  })

  it('keeps every shipped sample content-addressed and byte-identical', () => {
    for (const kit of DRUM_KIT_CATALOG) {
      let kitBytes = 0
      for (const resource of kit.resources) {
        expect(resource.path).toMatch(
          /^(classic-gm|studio|live)\/v1\/[a-f0-9]{16}-[a-z0-9-]+\.mp3$/,
        )
        const path = resolve('public/drum-night/kits', resource.path)
        expect(existsSync(path)).toBe(true)
        const bytes = readFileSync(path)
        expect(bytes.byteLength).toBe(resource.encodedBytes)
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(
          resource.sha256,
        )
        expect(resource.formats.mp3).toEqual({
          path: resource.path,
          mimeType: resource.mimeType,
          encodedBytes: resource.encodedBytes,
          sha256: resource.sha256,
        })
        expect(20 * Math.log10(resource.playbackGain)).toBeGreaterThanOrEqual(
          -12.01,
        )
        expect(20 * Math.log10(resource.playbackGain)).toBeLessThanOrEqual(
          12.01,
        )
        kitBytes += bytes.byteLength
      }
      expect(kitBytes).toBe(kit.publishedEncodedBytes)
    }
    for (const kit of Object.values(generatedCatalog.kits)) {
      for (const resource of kit.resources) {
        expect(resource.source.commit.trim()).not.toBe('')
        expect(resource.source.path.trim()).not.toBe('')
        expect(resource.source.transforms.trim()).not.toBe('')
      }
    }
  })

  it('resolves same-origin and configurable media bases without changing keys', () => {
    const resource = drumKitManifest('classic-gm').resources[0]
    expect(resolveDrumKitAssetUrl(resource)).toBe(
      `/drum-night/kits/${resource.path}`,
    )
    expect(
      resolveDrumKitAssetUrl(
        resource,
        'https://media.mercurypitch.test/drum-night/kits',
      ),
    ).toBe(`https://media.mercurypitch.test/drum-night/kits/${resource.path}`)
    expect(resolveDrumKitAssetUrl(resource, 'media/kits')).toBe(
      `/media/kits/${resource.path}`,
    )
    expect(() => resolveDrumKitAssetUrl(resource, '//attacker.test')).toThrow(
      'cannot be protocol-relative',
    )
    expect(() => resolveDrumKitAssetUrl(resource, '\\\\attacker.test')).toThrow(
      'contain backslashes',
    )
    expect(() => resolveDrumKitAssetUrl(resource, 'data:text/plain,')).toThrow(
      'must use HTTP or HTTPS',
    )
  })
})
