// Moving course controls — waits, boarding and exits share one live simulation.
import { describe, expect, it } from 'vitest'
import { replayTrajectory } from '../../solver/trajectory-stepper'
import { createSplitForkChunk } from './chunk-curves'
import { createAuroraGlideChunk, createDiagonalGlideChunk, createFrostRaftTransferChunk, createSkyElevatorGlideChunk, createTwinGlideCrossingChunk, } from './chunk-ferries'
import { createHexCascadeChunk, createScrollBridgeChunk, } from './chunk-stepping'
import { movingChunkFixture } from './moving-chunk.test-helpers'

const entryPhases = [0, 0.7, 2.4, 4.2, 5.6, 7.8]

describe('real ferry traversal at different arrival phases', () => {
  const ferries = [
    ['aurora', () => createAuroraGlideChunk('probe')],
    [
      'diagonal-right',
      () => createDiagonalGlideChunk('probe', 'left-to-right'),
    ],
    ['diagonal-left', () => createDiagonalGlideChunk('probe', 'right-to-left')],
    ['elevator', () => createSkyElevatorGlideChunk('probe', 0.56)],
  ] as const

  for (const [name, factory] of ferries)
    it.each(entryPhases)(
      `${name}: arrival at %ss can wait, board and leave`,
      (delay) => {
        const fixture = movingChunkFixture(factory())
        const [departure, raft, arrival] = fixture.platforms
        fixture.waitSeconds(delay)
        fixture.walkToFront(departure)
        fixture.waitNearDock(raft)
        fixture.jumpTo(raft)
        fixture.rideToFarDock(raft)
        fixture.jumpTo(arrival)
        expect(fixture.game.snapshot().player.supportPlatformId).toBe(
          arrival.id,
        )
        expect(fixture.landings.map((landing) => landing.id)).toEqual([
          departure.id,
          raft.id,
          arrival.id,
        ])
      },
    )

  it.each(entryPhases)(
    'twin ferries: arrival at %ss has a safe transfer wait',
    (delay) => {
      const fixture = movingChunkFixture(createTwinGlideCrossingChunk('probe'))
      const [departure, first, pivot, second, arrival, final] =
        fixture.platforms
      fixture.waitSeconds(delay)
      fixture.walkToFront(departure)
      fixture.waitNearDock(first)
      fixture.jumpTo(first)
      fixture.rideToFarDock(first)
      fixture.jumpTo(pivot)
      fixture.walkTo(() => ({
        x: (pivot.minX + pivot.maxX) / 2,
        z: (pivot.minZ + pivot.maxZ) / 2,
      }))
      // Missing a complete ferry cycle must be recoverable at the midpoint.
      fixture.waitSeconds(8.2)
      expect(fixture.game.snapshot().player.supportPlatformId).toBe(pivot.id)
      fixture.walkToFront(pivot, 0.15)
      fixture.waitNearDock(second)
      fixture.jumpTo(second)
      fixture.rideToFarDock(second)
      fixture.jumpTo(arrival)
      fixture.walkTo(() => ({
        x: (final.minX + final.maxX) / 2,
        z: (final.minZ + final.maxZ) / 2,
      }))
      expect(fixture.game.snapshot().player.supportPlatformId).toBe(final.id)
      const replay = replayTrajectory(fixture.level, undefined, fixture.inputs)
      expect(replay.fell).toBe(false)
      expect(replay.player.supportPlatformId).toBe(final.id)
    },
  )
})

describe('generated timing challenges use real entry waits and continuous jumps', () => {
  // Minimum warning durations for the three generator difficulty ranges.
  const warnings = [0.95, 1.3, 1.8]
  for (const warning of warnings)
    it.each([0, 3.1, 7.8])(
      `frost transfer, ${warning}s crackle, entry %ss`,
      (delay) => {
        const fixture = movingChunkFixture(
          createFrostRaftTransferChunk('probe', warning),
        )
        const [departure, ice1, ice2, raft, crackle, arrival] =
          fixture.platforms
        fixture.waitSeconds(delay)
        fixture.walkToFront(departure)
        fixture.jumpTo(ice1)
        fixture.runToFront(ice1)
        fixture.jumpTo(ice2)
        fixture.walkToFront(ice2, 0.2)
        fixture.waitNearDock(raft)
        fixture.jumpTo(raft)
        fixture.rideToFarDock(raft)
        fixture.jumpTo(crackle)
        fixture.runToFront(crackle)
        fixture.jumpTo(arrival)
        expect(fixture.game.snapshot().player.supportPlatformId).toBe(
          arrival.id,
        )
      },
    )

  it.each(entryPhases)(
    'scroll arrival at %ss waits safely upstream and crosses',
    (delay) => {
      const chunk = createScrollBridgeChunk('probe')
      const withApproach = {
        ...chunk,
        platforms: [
          {
            localId: 'approach',
            profileId: 'pearl-rest',
            center: { x: 0, y: 0, z: chunk.entrySocket.position.z - 0.96 },
          },
          ...chunk.platforms,
          {
            localId: 'finish',
            profileId: 'pearl-rest',
            center: { x: 0, y: 0, z: chunk.exitSocket.position.z + 0.96 },
          },
        ],
      }
      const fixture = movingChunkFixture(withApproach)
      const [departure, scroll, arrival] = fixture.platforms
      fixture.waitSeconds(delay)
      fixture.walkToFront(departure)
      fixture.waitFor(() => fixture.game.snapshot().elapsedSeconds % 9.4 < 0.02)
      fixture.jumpTo(scroll)
      fixture.runToFront(scroll)
      fixture.jumpTo(arrival)
      expect(fixture.game.snapshot().player.supportPlatformId).toBe(arrival.id)
    },
  )

  it.each(warnings)(
    'hex cascade supports continuous crossing at %ss warning',
    (warning) => {
      const chunk = createHexCascadeChunk('probe', warning)
      const withApproach = {
        ...chunk,
        platforms: [
          {
            localId: 'approach',
            profileId: 'pearl-rest',
            center: { x: 0, y: 0, z: chunk.entrySocket.position.z - 0.96 },
          },
          ...chunk.platforms,
          {
            localId: 'finish',
            profileId: 'pearl-rest',
            center: { x: 0, y: 0, z: chunk.exitSocket.position.z + 0.96 },
          },
        ],
      }
      const fixture = movingChunkFixture(withApproach)
      fixture.walkToFront(fixture.platforms[0])
      for (const platform of fixture.platforms.slice(1)) {
        fixture.jumpTo(platform)
        if (platform.id !== 'finish') fixture.runToFront(platform)
      }
      expect(fixture.game.snapshot().player.supportPlatformId).toBe('finish')
    },
  )
})

function crossFrostFork(inset: number) {
  const fixture = movingChunkFixture(createSplitForkChunk('probe'))
  const [departure, frost, , , arrival] = fixture.platforms
  // The left lane is a momentum route. The broad Pearl arrival accepts the
  // same lateral line; aiming at its center spends jump range on a needless turn.
  fixture.walkTo(() => ({ x: -1, z: 0.36 }))
  let leftDeparture = false
  let leftFrost = false
  for (let tick = 0; tick < 1200; tick++) {
    const player = fixture.game.snapshot().player
    let jump = false
    if (
      !leftDeparture &&
      player.grounded &&
      player.position.z >= departure.maxZ - 0.05
    ) {
      leftDeparture = true
      jump = true
    }
    if (
      !leftFrost &&
      player.grounded &&
      player.supportPlatformId === frost.id &&
      player.position.z >= frost.maxZ - inset
    ) {
      leftFrost = true
      jump = true
    }
    fixture.step(0, 1, jump)
    if (fixture.game.snapshot().player.supportPlatformId === arrival.id)
      return fixture
  }
  throw new Error('Frost fork input witness exhausted its bounded traversal.')
}

describe('split fork frost momentum route', () => {
  it.each([0.15, 0.1, 0.05])(
    'crosses the upward gap with a %sm edge inset',
    (inset) => {
      const fixture = crossFrostFork(inset)
      expect(fixture.landings.map((landing) => landing.id)).toEqual([
        'fork-dep-probe',
        'fork-frost-probe',
        'fork-arr-probe',
      ])
      const replay = replayTrajectory(fixture.level, undefined, fixture.inputs)
      expect(replay.fell).toBe(false)
      expect(replay.player.supportPlatformId).toBe('fork-arr-probe')
    },
  )

  it('does not mistake an early jump failure for a certified route', () => {
    expect(() => crossFrostFork(0.22)).toThrow('Traversal respawned')
  })
})
