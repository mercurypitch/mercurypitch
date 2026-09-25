// Crystal Promenade traversal proof — exercise the certified scroll, two-speed glass, voice rests and saved recovery.
import { describe, expect, it } from 'vitest'
import { CLOUDWAY_CRYSTAL_PROMENADE_STUDY as LEVEL } from '../content/cloudway-laboratory'
import { createGlassGame } from './game'

function visit(dt: number, saved?: unknown) {
  const game = createGlassGame(LEVEL, saved)
  let seconds = 0
  let sequence = 0
  let respawns = 0
  const visited = new Set<string>()
  const firstWarning = new Map<string, number>()

  function step(x = 0, z = 0, jump = false) {
    seconds += dt
    const events = game.step(
      { moveX: x, moveZ: z, jumpDown: jump },
      dt,
      seconds * 1000,
    )
    respawns += events.filter((e) => e.type === 'respawn').length
    const state = game.snapshot()
    for (const platform of state.platformStates ?? [])
      if (platform.phase === 'warning' && !firstWarning.has(platform.id))
        firstWarning.set(platform.id, seconds)
    const support = state.player.supportPlatformId
    if (support != null) visited.add(support)
    return events
  }

  function rest(duration = 0.25) {
    for (let i = 0; i < Math.ceil(duration / dt); i++) step()
  }

  function reach(x: number, z: number, settle = true, jumpGaps = true) {
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
        ((edge && jumpGaps) || raised) && state.player.grounded,
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
    firstWarning,
    elapsed: () => seconds,
    respawns: () => respawns,
  }
}

const Z = {
  arrival: -10,
  approach: -8.14,
  scroll: -7.401252972,
  scrollCatch: -6.662505944,
  rose: -5.232505944,
  amethyst: -3.612505944,
  final: -2.452505944,
}

function savedAt(checkpointId: string, completedBreakableIds: string[] = []) {
  return {
    version: 2,
    levelId: LEVEL.id,
    checkpointId,
    completedBreakableIds,
    finished: false,
  }
}

function crossScroll(v: ReturnType<typeof visit>) {
  v.reach(0, Z.approach)
  v.waitFor(
    () =>
      v.platform('scroll-deck')?.phase === 'extended' &&
      (v.platform('scroll-deck')?.phaseProgress ?? 1) < 0.05,
  )
  // Walk onto the actual short-Z support, rather than jumping over its art.
  v.reach(0, Z.scroll, true, false)
  expect(v.game.snapshot().player.supportPlatformId).toBe('scroll-deck')
  v.reach(0, Z.scrollCatch, true, false)
}

describe('Crystal Promenade first playable slice', () => {
  it.each([1 / 60, 1 / 30])(
    'crosses each support and completes three safe-rest encounters without a fall at %s seconds/frame',
    (dt) => {
      const v = visit(dt)
      v.reach(-0.55, Z.arrival)
      expect(v.game.snapshot().player.supportPlatformId).toBe('arrival')
      const home = LEVEL.breakables.find(
        (target) => target.id === 'voice-home',
      )!
      v.reach(home.anchor.x, home.anchor.z)
      expect(v.game.snapshot().player.supportPlatformId).toBe('arrival')
      v.sing('voice-home')
      v.reach(0, Z.arrival)
      crossScroll(v)
      expect(v.game.snapshot().checkpointId).toBe('scroll-save')
      v.reach(-0.45, Z.scrollCatch)
      expect(v.game.snapshot().player.supportPlatformId).toBe('scroll-catch')
      v.sing('voice-third')
      v.reach(0, Z.scrollCatch)
      v.reach(0, Z.rose, false)
      v.reach(0, Z.amethyst, false)
      v.reach(0, Z.final)
      expect(v.game.snapshot().checkpointId).toBe('final-save')
      v.reach(0.85, Z.final)
      for (let frame = 0; frame < Math.ceil(0.5 / dt); frame++) v.step(0, 1)
      expect(v.game.snapshot().complete).toBe(false)
      expect(v.game.snapshot().player.position.z).toBeLessThan(
        (LEVEL.exit.minZ + LEVEL.exit.maxZ) / 2,
      )
      v.reach(-0.45, Z.final)
      expect(v.game.snapshot().player.supportPlatformId).toBe('final-catch')
      v.sing('voice-fifth')
      v.reach(0.85, Z.final)
      v.reach(0.85, Z.final + 0.23)
      v.rest(1)
      expect(v.game.snapshot().complete).toBe(true)
      expect(v.respawns()).toBe(0)
      expect([...v.visited]).toEqual(
        expect.arrayContaining([
          'arrival',
          'scroll-approach',
          'scroll-deck',
          'scroll-catch',
          'rose-step',
          'amethyst-step',
          'final-catch',
        ]),
      )
    },
  )

  it.each([
    { id: 'rose-step', targetZ: Z.rose, warningSeconds: 2 },
    { id: 'amethyst-step', targetZ: Z.amethyst, warningSeconds: 4 },
  ] as const)(
    '$id removes support after $warningSeconds seconds, then restores on checkpoint recovery',
    ({ id, targetZ, warningSeconds }) => {
      const dt = 1 / 60
      const v = visit(dt, savedAt('final-save', ['voice-home', 'voice-third']))
      v.reach(0, Z.amethyst, false)
      if (id === 'rose-step') v.reach(0, targetZ, false)
      v.waitFor(() => v.game.snapshot().player.supportPlatformId === id)
      const contactedAt = v.firstWarning.get(id)
      expect(contactedAt).toBeDefined()
      v.waitFor(() => v.platform(id)?.phase === 'released', warningSeconds + 1)
      const contactDuration = v.elapsed() - contactedAt!
      expect(contactDuration).toBeGreaterThanOrEqual(warningSeconds - dt * 2)
      expect(contactDuration).toBeLessThanOrEqual(warningSeconds + dt * 2)
      expect(v.game.snapshot().player.supportPlatformId).not.toBe(id)
      v.waitFor(() => v.respawns() === 1)
      expect(v.game.snapshot().checkpointId).toBe('final-save')
      expect(v.platform('rose-step')?.phase).toBe('intact')
      expect(v.platform('amethyst-step')?.phase).toBe('intact')
      expect(v.game.snapshot().complete).toBe(false)
      const restored = createGlassGame(LEVEL, v.game.saveProgress())
      expect(restored.snapshot().player.position.x).toBe(0)
      expect(restored.snapshot().player.position.y).toBe(0)
      expect(restored.snapshot().player.position.z).toBeCloseTo(Z.final, 12)
    },
  )

  it('does not award missing voice targets or unlock the exit from an explored finale', () => {
    const v = visit(1 / 60, {
      ...savedAt('final-save'),
      finished: true,
    })
    expect(v.game.snapshot()).toMatchObject({
      complete: false,
      completedBreakableIds: [],
    })
    expect(v.game.beginEncounter('voice-fifth', 60)).toBe(false)
    expect(v.game.snapshot().nextRequiredBreakableId).toBe('voice-home')
  })
})
