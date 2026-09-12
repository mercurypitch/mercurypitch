// Recorded kit contracts — every velocity selects a real strike and dynamics survive runtime gain.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { drumKitManifest, drumKitResourcesForHit, drumKitVelocityCurveFor, } from './drum-kit-manifest'
import { resolveDrumHitGain } from './drum-velocity-contract.mjs'

describe.each(['muldjord', 'crocell'] as const)('%s recorded bank', (kitId) => {
  it('covers every expanded GM key at all velocities without inventing missing articulations', () => {
    const kit = drumKitManifest(kitId)
    expect(kit.resources).toHaveLength(kitId === 'muldjord' ? 111 : 107)
    expect(kit.sampleStatus).toBe('ready')
    const expectedKeys = [
      35,
      36,
      38,
      41,
      42,
      43,
      45,
      46,
      47,
      48,
      49,
      50,
      51,
      52,
      53,
      57,
      59,
      ...(kitId === 'crocell' ? [37, 40, 44, 55] : []),
    ].sort((a, b) => a - b)
    expect(
      [...new Set(kit.resources.flatMap((r) => [...r.gmKeys]))].sort(
        (a, b) => a - b,
      ),
    ).toEqual(expectedKeys)
    for (const gm of expectedKeys) {
      for (let velocity = 1; velocity <= 127; velocity += 1) {
        const strikes = drumKitResourcesForHit(kitId, gm, velocity)
        expect(strikes.length).toBeGreaterThanOrEqual(1)
        expect(strikes.length).toBeLessThanOrEqual(2)
        expect(new Set(strikes.map((s) => s.sha256)).size).toBe(strikes.length)
        expect(strikes.every((s) => s.readiness === 'ready')).toBe(true)
      }
    }
    for (const missing of [
      39,
      54,
      56,
      58,
      73,
      75,
      78,
      80,
      ...(kitId === 'muldjord' ? [37, 40, 44, 55] : []),
    ]) {
      expect(drumKitResourcesForHit(kitId, missing, 100)).toEqual([])
    }
  })

  it('retains one kit gain, recorded soft/hard amplitudes and the approved hi-hat choke', () => {
    const kit = drumKitManifest(kitId)
    expect(new Set(kit.resources.map((r) => r.playbackGain)).size).toBe(1)
    for (const resource of kit.resources) {
      expect(resource.power).toBeUndefined()
      for (const velocity of [1, 40, 80, 100, 127]) {
        expect(
          resolveDrumHitGain(
            resource.articulation,
            velocity,
            drumKitVelocityCurveFor(kitId, resource.articulation),
            resource.power,
          ),
        ).toBe(1)
      }
    }
    expect(
      drumKitResourcesForHit(kitId, 42, 100).every((r) =>
        r.chokes.includes('hi-hat-open'),
      ),
    ).toBe(true)
    if (kitId === 'crocell') {
      expect(
        drumKitResourcesForHit(kitId, 44, 100).every((r) =>
          r.chokes.includes('hi-hat-open'),
        ),
      ).toBe(true)
      expect(drumKitResourcesForHit(kitId, 59, 100)).toEqual(
        drumKitResourcesForHit(kitId, 51, 100),
      )
    } else {
      expect(drumKitResourcesForHit(kitId, 59, 100)).not.toEqual(
        drumKitResourcesForHit(kitId, 51, 100),
      )
    }
    expect(drumKitResourcesForHit(kitId, 53, 100)).not.toEqual(
      drumKitResourcesForHit(kitId, 51, 100),
    )
    expect(drumKitResourcesForHit(kitId, 43, 100)).toEqual(
      drumKitResourcesForHit(kitId, 45, 100),
    )
    expect(drumKitResourcesForHit(kitId, 48, 100)).toEqual(
      drumKitResourcesForHit(kitId, 50, 100),
    )
    expect(
      drumKitResourcesForHit(kitId, 46, 100).every(
        (r) => r.chokeGroup === 'hi-hat-open',
      ),
    ).toBe(true)
  })

  it('ships creator credits, source and change notices under CC BY 4.0', () => {
    const license = drumKitManifest(kitId).license
    expect(license.spdx).toBe('CC-BY-4.0')
    expect(license.shareAlike).toBe(false)
    expect(license.attribution).toContain('Lars Muldjord')
    const notice = readFileSync(
      resolve('public/drum-night/kits', license.noticePath!),
      'utf8',
    )
    expect(notice).toContain('MercuryPitch modifications')
    expect(notice.replaceAll(/\s+/g, ' ')).toContain('No endorsement')
    expect(notice).toContain('CC BY 4.0')
    expect(
      readFileSync(
        resolve('public/drum-night/kits', license.licenseTextPath!),
        'utf8',
      ),
    ).toContain('Disclaimer of Warranties')
  })
})
