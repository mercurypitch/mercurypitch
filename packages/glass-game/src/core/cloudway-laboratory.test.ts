// Crystal Promenade traversal study — prove authored turns, waiting rests, timed glass and saved recovery.
import { describe, expect, it } from 'vitest'
import { CLOUDWAY_CRYSTAL_PROMENADE_STUDY as LEVEL } from '../content/cloudway-laboratory'
import { createGlassGame } from './game'

function visit(dt: number, saved?: unknown) {
  const game = createGlassGame(LEVEL, saved)
  let seconds = 0
  let sequence = 0
  let respawns = 0
  const visited = new Set<string>()

  function step(x = 0, z = 0, jump = false) {
    seconds += dt
    const events = game.step(
      { moveX: x, moveZ: z, jumpDown: jump },
      dt,
      seconds * 1000,
    )
    respawns += events.filter((e) => e.type === 'respawn').length
    const support = game.snapshot().player.supportPlatformId
    if (support != null) visited.add(support)
    return events
  }

  function rest(duration = 0.25) {
    for (let i = 0; i < Math.ceil(duration / dt); i++) step()
  }

  function reach(x: number, z: number, settle = true) {
    for (let frame = 0; frame < Math.ceil(15 / dt); frame++) {
      const state = game.snapshot()
      if (state.complete) return
      const pos = state.player.position
      const dx = x - pos.x,
        dz = z - pos.z,
        distance = Math.hypot(dx, dz)
      if (distance < 0.07) {
        if (settle) rest()
        return
      }
      const nx = dx / distance,
        nz = dz / distance
      const edge = (LEVEL.intentionalGaps ?? []).some((g) => {
        const px = pos.x + nx * 0.26,
          pz = pos.z + nz * 0.26
        return px >= g.minX && px <= g.maxX && pz >= g.minZ && pz <= g.maxZ
      })
      const raised = LEVEL.platforms.some((p) => {
        const px = pos.x + nx * 0.4,
          pz = pos.z + nz * 0.4
        return (
          p.top > pos.y + 0.02 &&
          px >= p.minX &&
          px <= p.maxX &&
          pz >= p.minZ &&
          pz <= p.maxZ
        )
      })
      const magnitude = distance < 0.4 ? Math.min(1, distance * 4) : 1
      step(
        nx * magnitude,
        nz * magnitude,
        (edge || raised) && state.player.grounded,
      )
    }
    throw new Error(
      `Cannot reach ${x},${z}: ${JSON.stringify(game.snapshot().player)}; respawns=${respawns}`,
    )
  }

  function waitFor(predicate: () => boolean, maxSeconds = 15) {
    for (let i = 0; i < Math.ceil(maxSeconds / dt); i++) {
      if (predicate()) return
      step()
    }
    throw new Error('Timed platform did not reach the expected waiting window')
  }

  function platform(id: string) {
    return game.snapshot().platformStates?.find((p) => p.id === id)
  }

  function sing(id: string) {
    expect(game.beginEncounter(id, 60)).toBe(true)
    for (let i = 0; i < Math.ceil(3 / dt); i++) {
      seconds += dt
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
      game.step({ moveX: 0, moveZ: 0, jumpDown: false }, dt, seconds * 1000)
      if (game.snapshot().phase === 'shattering') break
    }
    expect(game.snapshot().completedBreakableIds).toContain(id)
    rest(2.5)
  }
  return {
    game,
    step,
    rest,
    reach,
    waitFor,
    platform,
    sing,
    visited,
    respawns: () => respawns,
  }
}

describe('Crystal Promenade simulation study', () => {
  it.each([1 / 60, 1 / 30])(
    'traverses the bent course at %s seconds/frame without a fall',
    (dt) => {
      const v = visit(dt)
      v.reach(-4.8, -19.6)
      v.sing('voice-home')
      // Avoid the arrival plinth, then take the left bend.
      v.reach(-3.9, -19.1)
      v.reach(-5, -16.8)
      v.reach(-6, -13.9)
      v.reach(-6, -10.6)
      v.reach(-5, -7.7)
      expect(v.game.snapshot().checkpointId).toBe('scroll-save')
      v.reach(-3.7, -7.4)
      v.waitFor(
        () =>
          v.platform('scroll-deck')?.phase === 'extended' &&
          (v.platform('scroll-deck')?.phaseProgress ?? 1) < 0.05,
      )
      v.reach(3.7, -7.4)
      v.reach(4.1, -4.2, false)
      v.reach(4.7, -1.8, false)
      v.reach(4, 0.4)
      v.sing('voice-third')
      // Pass the urn on its west side; a checkpoint belongs to the static garden.
      v.reach(3, 1)
      v.reach(3, 2.7)
      v.reach(4, 2.6)
      expect(v.game.snapshot().checkpointId).toBe('garden-save')
      v.reach(4, 3.25)
      v.waitFor(() => (v.platform('aurora-raft')?.offset.z ?? Infinity) < 0.001)
      v.reach(4, 5.6)
      expect(v.game.snapshot().player.supportPlatformId).toBe('aurora-raft')
      v.waitFor(() => (v.platform('aurora-raft')?.offset.z ?? 0) > 1.79)
      v.reach(4, 8.25)
      v.reach(4, 11)
      v.reach(3, 13.5)
      v.reach(2.5, 15.3)
      v.reach(2, 17.1)
      v.reach(1, 19)
      expect(v.game.snapshot().checkpointId).toBe('final-save')
      expect(v.game.snapshot().complete).toBe(false)
      v.reach(0.3, 20.3)
      v.sing('voice-fifth')
      v.reach(1.1, 20.3)
      v.reach(1.1, 21.9)
      expect(v.game.snapshot().complete).toBe(true)
      expect(v.respawns()).toBe(0)
      expect([...v.visited]).toEqual(
        expect.arrayContaining([
          'frost-bend',
          'scroll-deck',
          'rose-step',
          'amethyst-step',
          'aurora-raft',
          'stair-one',
          'stair-two',
          'stair-three',
        ]),
      )
    },
  )

  it.each([1 / 60, 1 / 30])(
    'can return from an explored finale to its first unbroken vase at %s seconds/frame',
    (dt) => {
      const v = visit(dt, {
        version: 2,
        levelId: LEVEL.id,
        checkpointId: 'final-save',
        completedBreakableIds: [],
        finished: false,
      })
      v.reach(2, 17.1)
      v.reach(2.5, 15.3)
      v.reach(3, 13.5)
      v.reach(4, 11)
      v.reach(4, 9.95)
      v.waitFor(() => (v.platform('aurora-raft')?.offset.z ?? 0) > 1.799)
      v.reach(4, 8)
      expect(v.game.snapshot().player.supportPlatformId).toBe('aurora-raft')
      v.waitFor(() => (v.platform('aurora-raft')?.offset.z ?? Infinity) < 0.001)
      v.reach(4, 5.2)
      v.reach(4, 3.2)
      v.reach(3, 2.7)
      v.reach(3, 0.4)
      v.reach(4, -0.1)
      v.reach(4.7, -1.8, false)
      v.reach(4.1, -4.2, false)
      v.reach(3.7, -7.4)
      v.reach(2.1, -7.4)
      v.waitFor(
        () =>
          v.platform('scroll-deck')?.phase === 'extended' &&
          (v.platform('scroll-deck')?.phaseProgress ?? 1) < 0.05,
      )
      v.reach(-3.7, -7.4)
      v.reach(-5, -7.7)
      v.reach(-6, -10.6)
      v.reach(-6, -13.9)
      v.reach(-5, -16.8)
      v.reach(-3.9, -19.1)
      v.reach(-4.8, -19.6)
      expect(v.respawns()).toBe(0)
      expect(v.game.snapshot().nextRequiredBreakableId).toBe('voice-home')
      expect(v.game.beginEncounter('voice-home', 60)).toBe(true)
    },
  )

  it('restores an explored garden without awarding unbroken targets or unlocking its exit', () => {
    const v = visit(1 / 60, {
      version: 2,
      levelId: LEVEL.id,
      checkpointId: 'garden-save',
      completedBreakableIds: [],
      finished: true,
    })
    expect(v.game.snapshot()).toMatchObject({
      checkpointId: 'garden-save',
      complete: false,
      completedBreakableIds: [],
    })
    expect(v.game.beginEncounter('voice-third', 60)).toBe(false)
    for (let i = 0; i < 300 && v.respawns() === 0; i++) v.step(1)
    expect(v.respawns()).toBe(1)
    const restored = createGlassGame(LEVEL, v.game.saveProgress())
    expect(restored.snapshot().player.position).toEqual({ x: 4, y: 0, z: 2.6 })
    expect(restored.snapshot().complete).toBe(false)
  })
})
