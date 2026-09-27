// Quarter-turn art study tests — exact docks, continuous union footing and the deliberate inner void stay honest.

import { describe, expect, it } from 'vitest'
import { findSupport } from '../core/collision'
import { createGlassGame } from '../core/game'
import { MOVEMENT } from '../core/movement'
import { PEARL_QUARTER_TURN_SUPPORT } from './pearl-quarter-turn-profile'
import { CLOUDWAY_QUARTER_TURN_ART_STUDY, QUARTER_TURN_ART_STUDY_PLATFORMS, QUARTER_TURN_ART_STUDY_SAVE_ID, QUARTER_TURN_FINISH_ID, QUARTER_TURN_PLATFORM_ID, QUARTER_TURN_START_ID, QUARTER_TURN_Z_ARM_ID, } from './quarter-turn-art-study'

describe('quarter-turn modular art study', () => {
  it('keeps save identity, render scale and two-box support coupled', () => {
    expect(CLOUDWAY_QUARTER_TURN_ART_STUDY.id).toBe(
      QUARTER_TURN_ART_STUDY_SAVE_ID,
    )
    expect(CLOUDWAY_QUARTER_TURN_ART_STUDY.authored).toEqual({
      levelId: QUARTER_TURN_ART_STUDY_SAVE_ID,
      layoutId: 'quarter-turn-art-study-v1',
      contentRevision: 1,
    })
    const root = QUARTER_TURN_ART_STUDY_PLATFORMS.find(
      (platform) => platform.id === QUARTER_TURN_PLATFORM_ID,
    )!
    const child = QUARTER_TURN_ART_STUDY_PLATFORMS.find(
      (platform) => platform.id === QUARTER_TURN_Z_ARM_ID,
    )!
    expect(child.parentPlatformId).toBe(root.id)
    expect(root.maxX - root.minX).toBeCloseTo(
      PEARL_QUARTER_TURN_SUPPORT.boxes[0].size[0],
      8,
    )
    expect(child.maxX - child.minX).toBeCloseTo(
      PEARL_QUARTER_TURN_SUPPORT.playableArmWidth,
      8,
    )
    expect(
      PEARL_QUARTER_TURN_SUPPORT.playableArmWidth - MOVEMENT.radius * 2,
    ).toBeCloseTo(0.512, 8)
  })

  it('walks both seams and the elbow under one public support identity', () => {
    const game = createGlassGame(CLOUDWAY_QUARTER_TURN_ART_STUDY)
    const visited = new Set<string | null>()
    const events: string[] = []
    for (let frame = 0; frame < 360; frame++) {
      const snapshot = game.snapshot()
      visited.add(snapshot.player.supportPlatformId ?? null)
      if (snapshot.player.position.z >= 1.04) break
      events.push(
        ...game
          .step({ moveX: 0, moveZ: 1, jumpDown: false }, 1 / 60)
          .map((event) => event.type),
      )
    }
    for (let frame = 0; frame < 360; frame++) {
      const snapshot = game.snapshot()
      visited.add(snapshot.player.supportPlatformId ?? null)
      if (snapshot.player.position.x >= 2.15) break
      events.push(
        ...game
          .step({ moveX: 1, moveZ: 0, jumpDown: false }, 1 / 60)
          .map((event) => event.type),
      )
    }
    const snapshot = game.snapshot()
    expect(events).not.toContain('respawn')
    expect(snapshot.player.grounded).toBe(true)
    expect(snapshot.player.position.x).toBeGreaterThanOrEqual(2.15)
    expect(visited).toContain(QUARTER_TURN_START_ID)
    expect(visited).toContain(QUARTER_TURN_PLATFORM_ID)
    expect(visited).toContain(QUARTER_TURN_FINISH_ID)
    expect(visited).not.toContain(QUARTER_TURN_Z_ARM_ID)
  })

  it('leaves the concave inner quadrant unsupported', () => {
    const support = findSupport(
      { x: 0.2, y: 0, z: 0 },
      MOVEMENT,
      QUARTER_TURN_ART_STUDY_PLATFORMS,
    )
    expect(support).toBeNull()
    expect(CLOUDWAY_QUARTER_TURN_ART_STUDY.intentionalGaps).toEqual([
      expect.objectContaining({ id: 'quarter-turn-a-inner-quadrant', top: 0 }),
    ])
  })
})
