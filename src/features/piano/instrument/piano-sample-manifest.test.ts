// ============================================================
// Piano sample manifest tests — licensing, pinning, and deterministic zones
// ============================================================

import { describe, expect, it } from 'vitest'
import { isAllowedSalamanderSampleUrl, resolveSalamanderRootMidi, resolveSalamanderVelocityLayer, SALAMANDER_COMPACT_PIANO_MANIFEST, SALAMANDER_SAMPLE_LICENSE, salamanderAttackResource, salamanderReleaseResource, } from './piano-sample-manifest'

describe('Salamander compact piano manifest', () => {
  it('records the sample author, commercial redistribution license, and adaptation', () => {
    expect(SALAMANDER_SAMPLE_LICENSE).toMatchObject({
      spdx: 'CC-BY-3.0',
      author: 'Alexander Holm',
      repackAuthor: 'Jan Forst',
      url: 'https://creativecommons.org/licenses/by/3.0/',
    })
    expect(SALAMANDER_SAMPLE_LICENSE.attribution).toContain(
      'Salamander Grand Piano V3',
    )
    expect(SALAMANDER_SAMPLE_LICENSE.changes).toContain(
      'velocity layers 4, 8, 12, and 16',
    )
    expect(Object.isFrozen(SALAMANDER_SAMPLE_LICENSE)).toBe(true)
  })

  it('contains the compact four-layer attacks, chromatic releases, and pedal noises', () => {
    const attacks = SALAMANDER_COMPACT_PIANO_MANIFEST.resources.filter(
      (resource) => resource.kind === 'attack',
    )
    const releases = SALAMANDER_COMPACT_PIANO_MANIFEST.resources.filter(
      (resource) => resource.kind === 'release',
    )
    const pedals = SALAMANDER_COMPACT_PIANO_MANIFEST.resources.filter(
      (resource) => resource.kind === 'pedal',
    )

    expect(attacks).toHaveLength(120)
    expect(releases).toHaveLength(88)
    expect(pedals).toHaveLength(4)
    expect(SALAMANDER_COMPACT_PIANO_MANIFEST.resources).toHaveLength(212)
    expect(SALAMANDER_COMPACT_PIANO_MANIFEST.publishedEncodedBytes).toBe(
      22_432_800,
    )
  })

  it('uses only exact version-pinned jsDelivr URLs from the manifest allowlist', () => {
    for (const resource of SALAMANDER_COMPACT_PIANO_MANIFEST.resources) {
      expect(resource.url).toMatch(
        /^https:\/\/cdn\.jsdelivr\.net\/npm\/@audio-samples\//,
      )
      expect(resource.url).not.toContain('@latest')
      expect(isAllowedSalamanderSampleUrl(resource.url)).toBe(true)
    }

    const attack = salamanderAttackResource(63, 12)
    expect(attack.url).toContain(
      'piano-mp3-velocity12@1.0.5/audio/D%234v12.mp3',
    )
    expect(
      isAllowedSalamanderSampleUrl(attack.url.replace('@1.0.5', '@latest')),
    ).toBe(false)
    expect(isAllowedSalamanderSampleUrl('https://example.com/piano.mp3')).toBe(
      false,
    )
  })

  it('maps every piano key to a deterministic minor-third root and velocity zone', () => {
    expect(resolveSalamanderRootMidi(20)).toBe(21)
    expect(resolveSalamanderRootMidi(61)).toBe(60)
    expect(resolveSalamanderRootMidi(62)).toBe(63)
    expect(resolveSalamanderRootMidi(109)).toBe(108)
    expect(resolveSalamanderVelocityLayer(0)).toBe(4)
    expect(resolveSalamanderVelocityLayer(0.25)).toBe(8)
    expect(resolveSalamanderVelocityLayer(0.74)).toBe(12)
    expect(resolveSalamanderVelocityLayer(1)).toBe(16)
    expect(salamanderReleaseResource(21).url.endsWith('/rel1.mp3')).toBe(true)
    expect(salamanderReleaseResource(108).url.endsWith('/rel88.mp3')).toBe(true)
  })
})
