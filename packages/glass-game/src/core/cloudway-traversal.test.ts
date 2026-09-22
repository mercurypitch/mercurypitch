// Cloudway traversal proof — complete the authored route with movement and measured pitch input.
import { describe, expect, it } from 'vitest'
import { CLOUDWAY_ENCOUNTER_IDS as ENCOUNTER, CLOUDWAY_GLASS_RIBBON as LEVEL, CLOUDWAY_PLATFORM_IDS as PLATFORM, } from '../content/cloudway-trial'
import { createGlassGame } from './game'

const REST = { moveX: 0, moveZ: 0, jumpDown: false }

function visit(frameSeconds: number) {
  const game = createGlassGame(LEVEL)
  let seconds = 0
  let sequence = 0
  let respawns = 0
  const visited = new Set<string>()

  function step(moveX = 0, moveZ = 0, jumpDown = false) {
    seconds += frameSeconds
    const events = game.step(
      { moveX, moveZ, jumpDown },
      frameSeconds,
      seconds * 1000,
    )
    respawns += events.filter((event) => event.type === 'respawn').length
    const support = game.snapshot().player.supportPlatformId
    if (support != null) visited.add(support)
  }

  function reach(x: number, z: number) {
    for (let frame = 0; frame < 10 / frameSeconds; frame++) {
      const position = game.snapshot().player.position
      const dx = x - position.x,
        dz = z - position.z
      const distance = Math.hypot(dx, dz)
      if (distance < 0.06) {
        for (let i = 0; i < 0.3 / frameSeconds; i++) step()
        return
      }
      const magnitude = Math.min(1, distance * 3)
      step((dx / distance) * magnitude, (dz / distance) * magnitude)
    }
    throw new Error(
      `Could not reach safe perch ${x},${z}: ${JSON.stringify(game.snapshot().player)}`,
    )
  }

  function sing(id: string) {
    expect(
      game.beginEncounter(id, 60),
      `Near ${id}: ${JSON.stringify(game.snapshot().player.position)}`,
    ).toBe(true)
    for (let frame = 0; frame < 3 / frameSeconds; frame++) {
      seconds += frameSeconds
      game.feedPitch(
        {
          sequence: ++sequence,
          captureSeconds: seconds,
          capturedAtMs: seconds * 1000,
          midi: 60,
          confidence: 0.98,
        },
        seconds * 1000,
      )
      game.step(REST, frameSeconds, seconds * 1000)
      if (game.snapshot().phase === 'shattering') break
    }
    expect(game.snapshot().completedBreakableIds).toContain(id)
    for (let frame = 0; frame < 2.5 / frameSeconds; frame++) step()
  }

  function forwardTo(z: number, allowRaft = false) {
    let raftMode: 'approach' | 'board' | 'ride' | 'leave' = 'approach'
    for (let frame = 0; frame < 45 / frameSeconds; frame++) {
      const snapshot = game.snapshot()
      const position = snapshot.player.position
      if (snapshot.complete) return
      if (position.z >= z) {
        for (let i = 0; i < 0.3 / frameSeconds; i++) step()
        return
      }
      const raft = snapshot.platformStates?.find(
        (item) => item.id === PLATFORM.glideRaft,
      )
      if (allowRaft) {
        if (raftMode === 'approach' && position.z >= 12.65) {
          if ((raft?.offset.z ?? Infinity) > 0.025) {
            step()
            continue
          }
          raftMode = 'board'
        }
        if (
          raftMode === 'board' &&
          snapshot.player.supportPlatformId === PLATFORM.glideRaft
        )
          raftMode = 'ride'
        if (raftMode === 'ride') {
          if ((raft?.offset.z ?? 0) < 1.86) {
            step()
            continue
          }
          raftMode = 'leave'
        }
      }
      const edge = LEVEL.intentionalGaps?.find(
        (gap) =>
          position.z >= gap.minZ - 0.23 &&
          position.z < gap.minZ &&
          position.x >= gap.minX &&
          position.x <= gap.maxX,
      )
      step(0, 1, edge !== undefined && snapshot.player.grounded)
    }
    throw new Error(
      `Could not cross to z=${z}; mode=${raftMode}; ${JSON.stringify(game.snapshot().player)}; respawns=${respawns}`,
    )
  }
  reach(0.7, 1.75)
  sing(ENCOUNTER.arrival)
  forwardTo(9.5)
  forwardTo(18.3, true)
  reach(0.7, 18.55)
  sing(ENCOUNTER.crossing)
  forwardTo(29.5)
  reach(1, 30.4)
  sing(ENCOUNTER.finale)
  forwardTo(32.1)
  return { game, seconds, respawns, visited }
}

describe('Cloudway first-island journey', () => {
  it('returns an exploring visitor to the last safe landing before they sing', () => {
    const game = createGlassGame(LEVEL)
    const frameSeconds = 1 / 60
    let seconds = 0
    const checkpointEvents: string[] = []

    const step = (moveX = 0, moveZ = 0, jumpDown = false) => {
      seconds += frameSeconds
      const events = game.step(
        { moveX, moveZ, jumpDown },
        frameSeconds,
        seconds * 1000,
      )
      checkpointEvents.push(
        ...events.flatMap((event) =>
          event.type === 'checkpoint' ? [event.id] : [],
        ),
      )
      return events
    }
    for (let frame = 0; frame < 12 / frameSeconds; frame++) {
      const snapshot = game.snapshot()
      if (snapshot.player.position.z >= 9.45) break
      const edge = LEVEL.intentionalGaps?.find(
        (gap) =>
          snapshot.player.position.z >= gap.minZ - 0.23 &&
          snapshot.player.position.z < gap.minZ &&
          snapshot.player.position.x >= gap.minX &&
          snapshot.player.position.x <= gap.maxX,
      )
      step(0, 1, edge !== undefined && snapshot.player.grounded)
    }
    for (let frame = 0; frame < 0.4 / frameSeconds; frame++) step()

    expect(game.snapshot().completedBreakableIds).toEqual([])
    expect(checkpointEvents).toContain('cloudway-checkpoint-frost-catch')
    expect(game.snapshot().checkpointId).toBe('cloudway-checkpoint-frost-catch')

    let respawnedAt: string | undefined
    for (let frame = 0; frame < 6 / frameSeconds; frame++) {
      const respawn = step(1).find((event) => event.type === 'respawn')
      if (respawn?.type === 'respawn') {
        respawnedAt = respawn.checkpointId
        break
      }
    }
    expect(respawnedAt).toBe('cloudway-checkpoint-frost-catch')
    expect(game.snapshot().player.position).toEqual({ x: 0.7, y: 0, z: 9.5 })

    const restored = createGlassGame(LEVEL, game.saveProgress())
    expect(restored.snapshot()).toMatchObject({
      checkpointId: 'cloudway-checkpoint-frost-catch',
      completedBreakableIds: [],
      complete: false,
      player: { position: { x: 0.7, y: 0, z: 9.5 } },
    })
  })

  it('keeps encounter and exit requirements closed at an explored checkpoint', () => {
    const game = createGlassGame(LEVEL, {
      version: 2,
      levelId: LEVEL.id,
      checkpointId: 'cloudway-checkpoint-glide-east',
      completedBreakableIds: [],
      finished: true,
    })

    expect(game.snapshot()).toMatchObject({
      checkpointId: 'cloudway-checkpoint-glide-east',
      completedBreakableIds: [],
      nearbyBreakableId: null,
      complete: false,
    })
    expect(game.beginEncounter(ENCOUNTER.crossing, 60)).toBe(false)
  })

  it('lets a zero-break finale reload return to the first required encounter', () => {
    const frameSeconds = 1 / 60
    const game = createGlassGame(LEVEL, {
      version: 2,
      levelId: LEVEL.id,
      checkpointId: 'cloudway-checkpoint-finale',
      completedBreakableIds: [],
      finished: false,
    })
    let seconds = 0
    let respawns = 0
    const step = (moveX = 0, moveZ = 0, jumpDown = false) => {
      seconds += frameSeconds
      const events = game.step(
        { moveX, moveZ, jumpDown },
        frameSeconds,
        seconds * 1000,
      )
      respawns += events.filter((event) => event.type === 'respawn').length
    }
    const southTo = (z: number) => {
      for (let frame = 0; frame < 30 / frameSeconds; frame++) {
        const snapshot = game.snapshot()
        const position = snapshot.player.position
        if (position.z <= z) {
          for (let rest = 0; rest < 0.3 / frameSeconds; rest++) step()
          return
        }
        const edge = LEVEL.intentionalGaps?.find(
          (gap) =>
            position.z <= gap.maxZ + 0.23 &&
            position.z > gap.maxZ &&
            position.x >= gap.minX &&
            position.x <= gap.maxX,
        )
        step(0, -1, edge !== undefined && snapshot.player.grounded)
      }
      throw new Error(
        `Could not travel south to z=${z}: ${JSON.stringify(game.snapshot().player)}`,
      )
    }
    const reach = (x: number, z: number) => {
      for (let frame = 0; frame < 8 / frameSeconds; frame++) {
        const position = game.snapshot().player.position
        const dx = x - position.x
        const dz = z - position.z
        const distance = Math.hypot(dx, dz)
        if (distance < 0.05) {
          for (let rest = 0; rest < 0.3 / frameSeconds; rest++) step()
          return
        }
        const magnitude = Math.min(1, distance * 3)
        step((dx / distance) * magnitude, (dz / distance) * magnitude)
      }
      throw new Error(
        `Could not reach ${x},${z}: ${JSON.stringify(game.snapshot().player)}`,
      )
    }

    southTo(18.5)
    southTo(17.9)
    for (let frame = 0; frame < 12 / frameSeconds; frame++) {
      const snapshot = game.snapshot()
      const raft = snapshot.platformStates?.find(
        (item) => item.id === PLATFORM.glideRaft,
      )
      if (
        snapshot.player.supportPlatformId === PLATFORM.glideRaft ||
        (raft?.offset.z ?? 0) >= 1.86
      ) {
        step(0, -1, snapshot.player.grounded)
        if (game.snapshot().player.supportPlatformId === PLATFORM.glideRaft)
          break
      } else step()
    }
    expect(game.snapshot().player.supportPlatformId).toBe(PLATFORM.glideRaft)
    for (let frame = 0; frame < 10 / frameSeconds; frame++) {
      const raft = game
        .snapshot()
        .platformStates?.find((item) => item.id === PLATFORM.glideRaft)
      if ((raft?.offset.z ?? Infinity) <= 0.025) break
      step()
    }
    southTo(12.8)
    southTo(1.75)
    reach(0.3, 1.75)

    expect(respawns).toBe(0)
    expect(game.snapshot().nearbyBreakableId).toBe(ENCOUNTER.arrival)
    expect(game.beginEncounter(ENCOUNTER.arrival, 60)).toBe(true)
  })

  it.each([1 / 60, 1 / 120])(
    'crosses every platform and finishes with three voice breaks at dt=%s',
    (dt) => {
      const result = visit(dt)
      expect(result.respawns).toBe(0)
      expect(result.visited).toEqual(
        new Set(LEVEL.platforms.map((item) => item.id)),
      )
      expect(result.game.snapshot().complete).toBe(true)
      expect(result.game.saveProgress()).toMatchObject({
        levelId: LEVEL.id,
        finished: true,
        completedBreakableIds: [
          ENCOUNTER.arrival,
          ENCOUNTER.crossing,
          ENCOUNTER.finale,
        ],
      })
      expect(result.seconds).toBeLessThan(120)
    },
  )
})
