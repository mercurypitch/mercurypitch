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
