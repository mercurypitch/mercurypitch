// Route witnesses retain moving-platform time and reject isolated waypoint/teleport evidence.
import { describe, expect, it } from 'vitest'
import type { MovementInput } from '../contracts'
import { createGlassGame } from '../core/game'
import { deck, testLevel } from './solver.test-fixtures'
import { verifyMovementRoute } from './trajectory-stepper'

const wait: MovementInput = { moveX: 0, moveZ: 0, jumpDown: false }
const forward: MovementInput = { moveX: 0, moveZ: 1, jumpDown: false }
const goal = {
  id: 'far-deck',
  label: 'Far deck',
  kind: 'position' as const,
  anchor: { x: 0, y: 0, z: 3 },
  interactionRadius: 0.2,
}

describe('continuous route replay', () => {
  it('needs an actual wait before crossing an initially retracted scroll', () => {
    const level = testLevel({
      platforms: [
        deck('arrival', -2, 0.5),
        deck('scroll', 0.5, 2.5, {
          kind: 'bridge',
          behavior: {
            kind: 'scroll',
            axis: 'z',
            minLengthRatio: 0.1,
            extendedSeconds: 10,
            retractedSeconds: 1,
            transitionSeconds: 0.25,
            initialState: 'retracted',
          },
        }),
        deck('far-deck', 2.5, 6),
      ],
    })
    const walk = Array.from({ length: 400 }, () => forward)
    expect(
      verifyMovementRoute(createGlassGame(level), walk, [goal]),
    ).toMatchObject({ status: 'inconclusive', fell: true })
    const game = createGlassGame(level)
    const route = [...Array.from({ length: 156 }, () => wait), ...walk]
    expect(verifyMovementRoute(game, route, [goal])).toMatchObject({
      status: 'reached',
      fell: false,
      reachedTargetIds: ['far-deck'],
    })
    expect(game.snapshot().player.supportPlatformId).toBe('far-deck')
  })

  it('requires every ordered waypoint, not just an easy opening anchor', () => {
    const level = testLevel()
    const home = { ...goal, id: 'home', anchor: level.spawn.position }
    const distant = { ...goal, id: 'distant', anchor: { x: 0, y: 0, z: 7 } }
    expect(
      verifyMovementRoute(
        createGlassGame(level),
        Array.from({ length: 100 }, () => forward),
        [home, distant],
      ),
    ).toMatchObject({ status: 'inconclusive', reachedTargetIds: ['home'] })
    expect(
      verifyMovementRoute(
        createGlassGame(level),
        Array.from({ length: 800 }, () => forward),
        [home, goal, distant],
      ),
    ).toMatchObject({
      status: 'reached',
      reachedTargetIds: ['home', 'far-deck', 'distant'],
    })
  })

  it('reports route budget exhaustion without claiming the route is impossible', () => {
    expect(
      verifyMovementRoute(
        createGlassGame(testLevel()),
        Array.from({ length: 400 }, () => forward),
        [goal],
        5,
      ),
    ).toMatchObject({
      status: 'inconclusive',
      totalTicks: 5,
      reason: expect.stringContaining('budget'),
    })
  })
})
