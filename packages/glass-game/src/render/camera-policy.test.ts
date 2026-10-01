// Camera policy regressions — fallback challenge framing respects authored barrier envelopes and poses.

import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { FROST_WALL_PANE } from '../content/frost-wall-profile'
import { GLASSWORKS } from '../content/glassworks'
import type { BreakableDefinition, LevelDefinition } from '../contracts'
import { createGlassGame } from '../core/game'
import { createFallbackChallengeSubjects, enclosureCompositionPitch, ENCLOSURE_EYE_LEVEL_PITCH, ENCLOSURE_READABLE_BOOM_DISTANCE, } from './camera-policy'

describe('enclosure composition pitch', () => {
  it('blends continuously into an eye-level view near the readable boom distance', () => {
    const selectedPitch = 0.5
    const samples = [1.1, 1.2, 1.3, 1.4, 1.5, 1.55, 1.6].map((reach) =>
      enclosureCompositionPitch(selectedPitch, reach),
    )

    expect(samples[0]).toBeCloseTo(ENCLOSURE_EYE_LEVEL_PITCH)
    expect(samples.at(-1)).toBeCloseTo(selectedPitch)
    for (let index = 1; index < samples.length; index++) {
      expect(samples[index]).toBeGreaterThanOrEqual(samples[index - 1]!)
      expect(samples[index]! - samples[index - 1]!).toBeLessThan(0.13)
    }
    expect(
      enclosureCompositionPitch(
        selectedPitch,
        ENCLOSURE_READABLE_BOOM_DISTANCE - 0.001,
      ),
    ).toBeCloseTo(selectedPitch, 4)
    expect(
      enclosureCompositionPitch(
        selectedPitch,
        ENCLOSURE_READABLE_BOOM_DISTANCE + 0.001,
      ),
    ).toBeCloseTo(selectedPitch, 4)
  })

  it('does not raise an already lower player-selected pitch', () => {
    expect(enclosureCompositionPitch(0.18, 1.1)).toBeCloseTo(0.18)
  })
})

describe('fallback challenge subjects', () => {
  it('frames a rotated barrier from its certified floor-based envelope', () => {
    const barrier: BreakableDefinition = {
      ...GLASSWORKS.breakables[0]!,
      id: 'frosted-scroll-wall',
      variant: 'frosted-scroll-wall',
      position: { x: 2, y: 0.32, z: -3 },
      presentation: { kind: 'barrier', facingYaw: Math.PI / 2 },
    }
    const level: LevelDefinition = {
      ...GLASSWORKS,
      breakables: [barrier],
    }
    const subjects = createFallbackChallengeSubjects(
      level,
      barrier.id,
      createGlassGame(GLASSWORKS).snapshot(),
    )
    const size = subjects.target.getSize(new Vector3())
    const center = subjects.target.getCenter(new Vector3())

    expect(subjects.encounterId).toBe(barrier.id)
    expect(size.x).toBeCloseTo(FROST_WALL_PANE.depth)
    expect(size.y).toBeCloseTo(FROST_WALL_PANE.height)
    expect(size.z).toBeCloseTo(FROST_WALL_PANE.width)
    expect(subjects.target.min.y).toBeCloseTo(barrier.position.y)
    expect(center.x).toBeCloseTo(barrier.position.x)
    expect(center.y).toBeCloseTo(
      barrier.position.y + FROST_WALL_PANE.height / 2,
    )
    expect(center.z).toBeCloseTo(barrier.position.z)
  })
})
