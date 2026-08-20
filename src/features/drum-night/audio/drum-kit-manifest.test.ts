// ============================================================
// Drum kit manifest tests — licenses, immutable assets, and hit resolution
// ============================================================

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DRUM_KIT_CATALOG, DRUM_KIT_IDS, drumKitManifest, drumKitResourcesForHit, resolveDrumKitAssetUrl, } from './drum-kit-manifest'

describe('Drum Night kit catalog', () => {
  it('offers four distinct flavors with a zero-byte synth floor', () => {
    expect(DRUM_KIT_IDS).toEqual([
      'mercury-synth',
      'classic-gm',
      'studio',
      'live',
    ])
    expect(DRUM_KIT_CATALOG.map((kit) => kit.name)).toEqual([
      'Mercury Synth',
      'Classic GM',
      'Studio',
      'Live',
    ])
    expect(drumKitManifest('mercury-synth')).toMatchObject({
      engine: 'synth',
      optionalDownload: false,
      publishedEncodedBytes: 0,
      resources: [],
    })
    expect(drumKitManifest('classic-gm').publishedEncodedBytes).toBe(1_703_796)
    expect(drumKitManifest('studio').publishedEncodedBytes).toBe(2_318_633)
    expect(drumKitManifest('live').publishedEncodedBytes).toBe(2_625_351)
    expect(
      DRUM_KIT_CATALOG.reduce((sum, kit) => sum + kit.publishedEncodedBytes, 0),
    ).toBe(6_647_780)
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
        expect(20 * Math.log10(resource.playbackGain)).toBeGreaterThanOrEqual(
          -12.01,
        )
        expect(20 * Math.log10(resource.playbackGain)).toBeLessThanOrEqual(
          12.01,
        )
        expect(resource.source.commit.trim()).not.toBe('')
        expect(resource.source.path.trim()).not.toBe('')
        expect(resource.source.transforms.trim()).not.toBe('')
        kitBytes += bytes.byteLength
      }
      expect(kitBytes).toBe(kit.publishedEncodedBytes)
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
