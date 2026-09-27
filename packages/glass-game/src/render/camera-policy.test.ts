// Camera policy regressions — fallback challenge framing respects authored barrier envelopes and poses.

import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { FROST_WALL_PANE } from '../content/frost-wall-profile'
import { GLASSWORKS } from '../content/glassworks'
import type { BreakableDefinition, LevelDefinition } from '../contracts'
import { createGlassGame } from '../core/game'
import { createFallbackChallengeSubjects } from './camera-policy'

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
