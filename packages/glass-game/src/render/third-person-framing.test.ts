// Third-person passage framing regression — bounded clearances yield predictable boom reach.

import { describe, expect, it } from 'vitest'
import { contextualThirdPersonReach, createThirdPersonFraming, PASSAGE_CLEARANCE_SAMPLE_DISTANCE, sampleThirdPersonClearance, } from './third-person-framing'

const base = {
  requestedReach: 4,
  aspect: 1180 / 820,
  fovDegrees: 48,
  pitch: 0.36,
}

describe('contextual third-person reach', () => {
  it('keeps the requested reach in open space and beside one wall', () => {
    expect(
      contextualThirdPersonReach({
        ...base,
        clearance: {
          left: PASSAGE_CLEARANCE_SAMPLE_DISTANCE,
          right: PASSAGE_CLEARANCE_SAMPLE_DISTANCE,
          headroom: PASSAGE_CLEARANCE_SAMPLE_DISTANCE,
        },
      }),
    ).toBe(4)
    expect(
      contextualThirdPersonReach({
        ...base,
        clearance: {
          left: 0.8,
          right: PASSAGE_CLEARANCE_SAMPLE_DISTANCE,
          headroom: PASSAGE_CLEARANCE_SAMPLE_DISTANCE,
        },
      }),
    ).toBe(4)
  })

  it('moves closer as a two-sided passage narrows', () => {
    const generous = contextualThirdPersonReach({
      ...base,
      clearance: { left: 1.4, right: 1.4, headroom: 2.4 },
    })
    const narrow = contextualThirdPersonReach({
      ...base,
      clearance: { left: 0.9, right: 0.9, headroom: 2.4 },
    })
    expect(generous).toBeLessThan(4)
    expect(narrow).toBeLessThan(generous)
  })

  it('shortens for a low ceiling and preserves portrait near-plane room', () => {
    const low = contextualThirdPersonReach({
      ...base,
      clearance: { left: 2.4, right: 2.4, headroom: 0.65 },
    })
    const portrait = contextualThirdPersonReach({
      ...base,
      aspect: 320 / 720,
      clearance: { left: 0.38, right: 0.38, headroom: 2.4 },
    })
    expect(low).toBeLessThan(2)
    expect(portrait).toBeGreaterThanOrEqual(0.72)
  })

  it('samples left, right and ceiling relative to Merc facing', () => {
    const directions: { x: number; y: number; z: number }[] = []
    const clearance = sampleThirdPersonClearance(Math.PI / 2, (direction) => {
      directions.push(direction.clone())
      return directions.length
    })
    expect(clearance).toEqual({ left: 1, right: 2, headroom: 3 })
    expect(directions[0]!.x).toBeCloseTo(0)
    expect(directions[0]!.z).toBeCloseTo(-1)
    expect(directions[1]!.x).toBeCloseTo(0)
    expect(directions[1]!.z).toBeCloseTo(1)
    expect(directions[2]).toMatchObject({ x: 0, y: 1, z: 0 })
  })

  it('hard-caps obstruction and restores open reach gradually', () => {
    const framing = createThirdPersonFraming()
    const initial = framing.update({
      requestedReach: 4,
      contextualReach: 4,
      safeReach: 4,
      deltaSeconds: 1 / 60,
      snap: true,
    })
    const blocked = framing.update({
      requestedReach: 4,
      contextualReach: 4,
      safeReach: 1.1,
      deltaSeconds: 1 / 60,
      snap: false,
    })
    const recovering = framing.update({
      requestedReach: 4,
      contextualReach: 4,
      safeReach: 4,
      deltaSeconds: 1 / 60,
      snap: false,
    })
    expect(initial).toBe(4)
    expect(blocked).toBe(1.1)
    expect(recovering).toBeGreaterThan(1.1)
    expect(recovering).toBeLessThan(4)
  })

  it('preserves readable passage distance only up to physical clearance', () => {
    const framing = createThirdPersonFraming()
    const readable = framing.update({
      requestedReach: 4,
      contextualReach: 1.2,
      minimumReadableReach: 1.55,
      safeReach: 4,
      deltaSeconds: 1 / 60,
      snap: true,
    })
    const physicallyBlocked = framing.update({
      requestedReach: 4,
      contextualReach: 1.2,
      minimumReadableReach: 1.55,
      safeReach: 0.9,
      deltaSeconds: 1 / 60,
      snap: false,
    })

    expect(readable).toBe(1.55)
    expect(physicallyBlocked).toBe(0.9)
  })
})
