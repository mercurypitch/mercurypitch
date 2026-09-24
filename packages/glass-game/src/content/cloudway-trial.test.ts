// Cloudway Glass Ribbon contract tests — preserve one readable route with safe voice perches and explicit gaps.

import { describe, expect, it } from 'vitest'
import { createGlassGame } from '../core/game'
import { MOVEMENT } from '../core/movement'
import { CLOUDWAY_ENCOUNTER_IDS, CLOUDWAY_GLASS_RIBBON, CLOUDWAY_GLASS_RIBBON_ROUTE, CLOUDWAY_PLATFORM_IDS, } from './cloudway-trial'

describe('The Glass Ribbon', () => {
  it('authors the approved first-pilot family exactly once', () => {
    const frost = CLOUDWAY_GLASS_RIBBON.platforms.filter(
      (platform) => platform.surface?.kind === 'frost',
    )
    const glide = CLOUDWAY_GLASS_RIBBON.platforms.filter(
      (platform) => platform.behavior?.kind === 'glide',
    )
    const crackle = CLOUDWAY_GLASS_RIBBON.platforms.filter(
      (platform) => platform.behavior?.kind === 'crackle',
    )

    expect(CLOUDWAY_GLASS_RIBBON.title).toBe('The Glass Ribbon')
    expect(frost.map((platform) => platform.id)).toEqual([
      CLOUDWAY_PLATFORM_IDS.frostOne,
      CLOUDWAY_PLATFORM_IDS.frostTwo,
    ])
    expect(glide.map((platform) => platform.id)).toEqual([
      CLOUDWAY_PLATFORM_IDS.glideRaft,
    ])
    expect(crackle.map((platform) => platform.id)).toEqual([
      CLOUDWAY_PLATFORM_IDS.crackleOne,
      CLOUDWAY_PLATFORM_IDS.crackleTwo,
    ])
  })

  it('keeps every voice anchor on a static marble deck', () => {
    for (const target of CLOUDWAY_GLASS_RIBBON.breakables) {
      const platform = CLOUDWAY_GLASS_RIBBON.platforms.find(
        (candidate) =>
          target.anchor.x >= candidate.minX &&
          target.anchor.x <= candidate.maxX &&
          target.anchor.z >= candidate.minZ &&
          target.anchor.z <= candidate.maxZ,
      )
      expect(platform, target.id).toBeDefined()
      expect(platform?.kind, target.id).toBe('deck')
      expect(platform?.renderId, target.id).toBe('cloudway-marble')
      expect(platform?.surface, target.id).toBeUndefined()
      expect(platform?.behavior, target.id).toBeUndefined()
      expect(target.challenge.kind, target.id).toBe('hold')
      if (target.challenge.kind === 'hold')
        expect(target.challenge.step.target, target.id).toBe('comfortable')
    }
  })

  it('marks each physical route break and keeps it reachable at walk speed', () => {
    const gaps = CLOUDWAY_GLASS_RIBBON.intentionalGaps ?? []
    expect(gaps).toHaveLength(9)
    expect(new Set(gaps.map((gap) => gap.id)).size).toBe(gaps.length)

    const airborneSeconds =
      (2 * Math.sqrt(2 * MOVEMENT.gravity * MOVEMENT.jumpHeight)) /
      MOVEMENT.gravity
    const walkRange =
      airborneSeconds * CLOUDWAY_GLASS_RIBBON.movement!.walkSpeed
    for (const gap of gaps) {
      const depth = gap.maxZ - gap.minZ
      expect(depth + MOVEMENT.radius * 2, gap.id).toBeLessThan(walkRange)
      expect(depth, gap.id).toBeGreaterThanOrEqual(0.5)
    }
  })

  it('publishes a monotonic northbound traversal for simulation and browser proofs', () => {
    expect(CLOUDWAY_GLASS_RIBBON_ROUTE.recommendedTravelDirection).toEqual({
      x: 0,
      z: 1,
    })
    const waypoints = CLOUDWAY_GLASS_RIBBON_ROUTE.waypoints
    expect(waypoints).toHaveLength(CLOUDWAY_GLASS_RIBBON.platforms.length)
    expect(
      waypoints.every(
        (point, index) => index === 0 || point.z > waypoints[index - 1]!.z,
      ),
    ).toBe(true)
    expect(new Set(waypoints.map((point) => point.platformId))).toEqual(
      new Set(CLOUDWAY_GLASS_RIBBON.platforms.map((platform) => platform.id)),
    )
  })

  it('uses stable checkpoints before hazards without inventing a new voice judge', () => {
    expect(CLOUDWAY_GLASS_RIBBON.spawn.checkpointId).toBe(
      'cloudway-checkpoint-arrival',
    )
    expect(
      CLOUDWAY_GLASS_RIBBON.checkpoints.map((checkpoint) => checkpoint.id),
    ).toEqual([
      'cloudway-checkpoint-arrival',
      'cloudway-checkpoint-frost-catch',
      'cloudway-checkpoint-glide-east',
      'cloudway-checkpoint-crackle-recovery',
      'cloudway-checkpoint-finale',
    ])
    expect(CLOUDWAY_GLASS_RIBBON.exit.requiresCompleted).toEqual([
      CLOUDWAY_ENCOUNTER_IDS.arrival,
      CLOUDWAY_ENCOUNTER_IDS.crossing,
      CLOUDWAY_ENCOUNTER_IDS.finale,
    ])
    expect(
      CLOUDWAY_GLASS_RIBBON.breakables.every(
        (target) => target.challenge.kind === 'hold',
      ),
    ).toBe(true)
  })

  it('discovers the first Sing action from the authored spawn and keeps the route explicit', () => {
    const game = createGlassGame(CLOUDWAY_GLASS_RIBBON)
    expect(game.snapshot()).toMatchObject({
      nearbyBreakableId: CLOUDWAY_ENCOUNTER_IDS.arrival,
      nextRequiredBreakableId: CLOUDWAY_ENCOUNTER_IDS.arrival,
      nearbyLockedBreakableId: null,
    })
    expect(
      CLOUDWAY_GLASS_RIBBON.guidance?.tutorial?.pages.some((page) =>
        /glowing circle.*tap Sing/i.test(`${page.body} ${page.aside ?? ''}`),
      ),
    ).toBe(true)
  })

  it('matches every visible plinth and the intact finale portrait with collision', () => {
    const solids = CLOUDWAY_GLASS_RIBBON.solids ?? []
    for (const target of CLOUDWAY_GLASS_RIBBON.breakables) {
      const plinth = solids.find((solid) => solid.id === `plinth:${target.id}`)
      expect(plinth, target.id).toMatchObject({
        kind: 'prop',
        shape: 'cylinder',
        x: target.position.x,
        z: target.position.z,
        top: 0.24,
        thickness: 0.24,
        radiusTop: 0.25,
        radiusBottom: 0.29,
      })
    }

    const portrait = solids.find(
      (solid) => solid.id === `intact:${CLOUDWAY_ENCOUNTER_IDS.finale}`,
    )
    expect(portrait).toMatchObject({
      kind: 'prop',
      shape: 'box',
      activation: { noneCompleted: [CLOUDWAY_ENCOUNTER_IDS.finale] },
    })
    const restored = createGlassGame(CLOUDWAY_GLASS_RIBBON, {
      version: 2,
      levelId: CLOUDWAY_GLASS_RIBBON.id,
      checkpointId: 'cloudway-checkpoint-finale',
      completedBreakableIds: [
        CLOUDWAY_ENCOUNTER_IDS.arrival,
        CLOUDWAY_ENCOUNTER_IDS.crossing,
        CLOUDWAY_ENCOUNTER_IDS.finale,
      ],
    })
    expect(restored.snapshot().activeSolidIds).not.toContain(
      `intact:${CLOUDWAY_ENCOUNTER_IDS.finale}`,
    )
  })
})
