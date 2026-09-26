// Crystal Promenade traversal proof — exercise measured jumps, the certified scroll, two-speed glass, voice rests and saved recovery.
import { describe, expect, it } from 'vitest'
import { CLOUDWAY_CRYSTAL_PROMENADE_MEASUREMENTS as MEASUREMENTS, CLOUDWAY_CRYSTAL_PROMENADE_STUDY as LEVEL, } from '../content/cloudway-laboratory'
import { containsBody } from './collision'
import { createGlassGame } from './game'
import { MOVEMENT } from './movement'

interface RoutePoint {
  readonly x: number
  readonly z: number
}

interface AttemptOptions {
  readonly jumpGaps?: boolean
  readonly maxSeconds?: number
  readonly settle?: boolean
  readonly supportId?: string
}

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
    respawns += events.filter((event) => event.type === 'respawn').length
    const state = game.snapshot()
    for (const platform of state.platformStates ?? [])
      if (platform.phase === 'warning' && !firstWarning.has(platform.id))
        firstWarning.set(platform.id, seconds)
    const support = state.player.supportPlatformId
    if (support != null) visited.add(support)
    return events
  }

  function rest(duration = 0.25) {
    for (let frame = 0; frame < Math.ceil(duration / dt); frame++) step()
  }

  function driveToward(point: RoutePoint, jumpGaps: boolean) {
    const state = game.snapshot()
    const position = state.player.position
    const dx = point.x - position.x
    const dz = point.z - position.z
    const distance = Math.hypot(dx, dz)
    const nx = dx / distance
    const nz = dz / distance
    const edge = (LEVEL.intentionalGaps ?? []).some((gap) => {
      const projectedX = position.x + nx * 0.26
      const projectedZ = position.z + nz * 0.26
      return (
        projectedX >= gap.minX &&
        projectedX <= gap.maxX &&
        projectedZ >= gap.minZ &&
        projectedZ <= gap.maxZ
      )
    })
    const raised = LEVEL.platforms.some((platform) => {
      const projectedX = position.x + nx * 0.4
      const projectedZ = position.z + nz * 0.4
      return (
        platform.top > position.y + 0.02 &&
        projectedX >= platform.minX &&
        projectedX <= platform.maxX &&
        projectedZ >= platform.minZ &&
        projectedZ <= platform.maxZ
      )
    })
    const magnitude = distance < 0.4 ? Math.min(1, distance * 4) : 1
    step(
      nx * magnitude,
      nz * magnitude,
      ((edge && jumpGaps) || raised) && state.player.grounded,
    )
  }

  function attempt(point: RoutePoint, options: AttemptOptions = {}) {
    const {
      jumpGaps = true,
      maxSeconds = 15,
      settle = true,
      supportId,
    } = options
    const startingRespawns = respawns
    for (let frame = 0; frame < Math.ceil(maxSeconds / dt); frame++) {
      if (respawns > startingRespawns) return 'respawn' as const
      const state = game.snapshot()
      if (state.complete) return 'reached' as const
      const distance = Math.hypot(
        point.x - state.player.position.x,
        point.z - state.player.position.z,
      )
      if (
        distance < 0.07 &&
        state.player.grounded &&
        (supportId === undefined ||
          state.player.supportPlatformId === supportId)
      ) {
        if (settle) rest()
        return respawns > startingRespawns
          ? ('respawn' as const)
          : ('reached' as const)
      }
      driveToward(point, jumpGaps)
    }
    return 'timeout' as const
  }

  function reach(point: RoutePoint, options: AttemptOptions = {}) {
    const result = attempt(point, options)
    if (result === 'reached') return
    throw new Error(
      `Cannot reach ${point.x},${point.z}: ${JSON.stringify(game.snapshot().player)}; outcome=${result}; respawns=${respawns}`,
    )
  }

  function waitFor(predicate: () => boolean, maxSeconds = 15) {
    for (let frame = 0; frame < Math.ceil(maxSeconds / dt); frame++) {
      if (predicate()) return
      step()
    }
    throw new Error('Timed platform did not reach the expected waiting window')
  }

  function platform(id: string) {
    return game.snapshot().platformStates?.find((state) => state.id === id)
  }

  function sing(id: string) {
    expect(game.beginEncounter(id, 60)).toBe(true)
    for (let frame = 0; frame < Math.ceil(3 / dt); frame++) {
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
    attempt,
    elapsed: () => seconds,
    firstWarning,
    game,
    platform,
    reach,
    respawns: () => respawns,
    rest,
    sing,
    step,
    visited,
    waitFor,
  }
}

const P = MEASUREMENTS.platformCentres

function savedAt(checkpointId: string, completedBreakableIds: string[] = []) {
  return {
    version: 2,
    levelId: LEVEL.id,
    checkpointId,
    completedBreakableIds,
    finished: false,
  }
}

function platform(id: string) {
  const result = LEVEL.platforms.find((candidate) => candidate.id === id)
  if (result === undefined) throw new Error(`Missing platform ${id}`)
  return result
}

function forwardGap(fromId: string, toId: string): number {
  return platform(toId).minZ - platform(fromId).maxZ
}

function crossScroll(v: ReturnType<typeof visit>) {
  v.reach(P.scrollApproach, { supportId: 'scroll-approach' })
  v.waitFor(
    () =>
      v.platform('scroll-deck')?.phase === 'extended' &&
      (v.platform('scroll-deck')?.phaseProgress ?? 1) < 0.05,
  )
  v.reach(P.scroll, { supportId: 'scroll-deck' })
  expect(v.game.snapshot().player).toMatchObject({
    grounded: true,
    supportPlatformId: 'scroll-deck',
  })
  v.rest(0.12)
  expect(v.game.snapshot().player.supportPlatformId).toBe('scroll-deck')
  v.reach(P.scrollCatch, { supportId: 'scroll-catch' })
}

describe('Crystal Promenade first playable slice', () => {
  it('keeps the first-slice namespace while publishing measured edge gaps as revision 2', () => {
    expect(LEVEL.id).toBe('cloudway-crystal-promenade-first-slice')
    expect(LEVEL.authored).toMatchObject({
      layoutId: 'crystal-promenade-first-slice',
      contentRevision: 2,
    })
    expect(LEVEL.platforms.map((item) => item.id)).toEqual([
      'arrival-entry',
      'arrival',
      'scroll-approach-entry',
      'scroll-approach',
      'scroll-deck',
      'scroll-catch',
      'scroll-court',
      'rose-step',
      'amethyst-step',
      'final-catch',
      'final-terrace',
    ])
    expect(forwardGap('arrival', 'scroll-approach-entry')).toBeCloseTo(
      MEASUREMENTS.gaps.arrivalApproach,
      12,
    )
    expect(forwardGap('scroll-approach', 'scroll-deck')).toBeCloseTo(
      MEASUREMENTS.gaps.scrollEntry,
      12,
    )
    expect(forwardGap('scroll-deck', 'scroll-catch')).toBeCloseTo(
      MEASUREMENTS.gaps.scrollExit,
      12,
    )
    expect(forwardGap('scroll-court', 'rose-step')).toBeCloseTo(
      MEASUREMENTS.gaps.roseEntry,
      12,
    )
    expect(forwardGap('rose-step', 'amethyst-step')).toBeCloseTo(
      MEASUREMENTS.gaps.crystalDuet,
      12,
    )
    expect(forwardGap('amethyst-step', 'final-catch')).toBeCloseTo(
      MEASUREMENTS.gaps.duetExit,
      12,
    )
    for (const [back, front] of [
      ['arrival-entry', 'arrival'],
      ['scroll-approach-entry', 'scroll-approach'],
      ['scroll-catch', 'scroll-court'],
      ['final-catch', 'final-terrace'],
    ] as const) {
      expect(forwardGap(back, front)).toBeCloseTo(0, 12)
      expect(platform(front).maxZ - platform(back).minZ).toBeCloseTo(1.44, 12)
    }
    const safePositions = [
      LEVEL.spawn.position,
      ...LEVEL.checkpoints.map((checkpoint) => checkpoint.position),
      ...LEVEL.breakables.map((target) => target.anchor),
      {
        x: (LEVEL.exit.minX + LEVEL.exit.maxX) / 2,
        y: LEVEL.exit.top,
        z: (LEVEL.exit.minZ + LEVEL.exit.maxZ) / 2,
      },
    ]
    for (const position of safePositions)
      expect(
        LEVEL.platforms.some(
          (candidate) =>
            candidate.behavior === undefined &&
            containsBody(position, MOVEMENT, candidate),
        ),
      ).toBe(true)
  })

  it.each([1 / 60, 1 / 30])(
    'crosses every measured gap and completes three safe-rest encounters without a fall at %s seconds/frame',
    (dt) => {
      const v = visit(dt)
      const home = LEVEL.breakables.find(
        (target) => target.id === 'voice-home',
      )!
      v.reach(home.anchor, { supportId: 'arrival' })
      v.sing('voice-home')
      v.reach({ x: 0.25, z: P.arrival.z }, { supportId: 'arrival' })
      crossScroll(v)
      expect(v.game.snapshot().checkpointId).toBe('scroll-save')
      const third = LEVEL.breakables.find(
        (target) => target.id === 'voice-third',
      )!
      v.reach(third.anchor, { supportId: 'scroll-court' })
      v.sing('voice-third')
      v.reach({ x: 0.2, z: P.scrollCourt.z }, { supportId: 'scroll-court' })
      v.reach(P.rose, { settle: false, supportId: 'rose-step' })
      v.reach(P.amethyst, { settle: false, supportId: 'amethyst-step' })
      v.reach(P.finalCatch, { supportId: 'final-catch' })
      expect(v.game.snapshot().checkpointId).toBe('final-save')
      const exitPoint = {
        x: (LEVEL.exit.minX + LEVEL.exit.maxX) / 2,
        z: LEVEL.exit.maxZ - 0.05,
      }
      v.reach(
        { x: exitPoint.x, z: P.finalTerrace.z },
        { supportId: 'final-terrace' },
      )
      for (let frame = 0; frame < Math.ceil(0.5 / dt); frame++) v.step(0, 1)
      expect(v.game.snapshot().complete).toBe(false)
      expect(v.game.snapshot().player.position.z).toBeLessThan(
        (LEVEL.exit.minZ + LEVEL.exit.maxZ) / 2,
      )
      const fifth = LEVEL.breakables.find(
        (target) => target.id === 'voice-fifth',
      )!
      v.reach(fifth.anchor, { supportId: 'final-catch' })
      v.sing('voice-fifth')
      v.reach(exitPoint, { supportId: 'final-terrace' })
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

  it.each([1 / 60, 1 / 30])(
    'cannot walk across either full-extension scroll gap at %s seconds/frame',
    (dt) => {
      const entry = visit(dt, savedAt('scroll-save', ['voice-home']))
      entry.waitFor(() => entry.platform('scroll-deck')?.phase === 'extended')
      expect(
        entry.attempt(P.scroll, {
          jumpGaps: false,
          maxSeconds: 4,
          supportId: 'scroll-deck',
        }),
      ).toBe('respawn')
      expect(entry.game.snapshot()).toMatchObject({
        checkpointId: 'scroll-save',
        player: { grounded: true, supportPlatformId: 'scroll-approach' },
      })

      const exit = visit(dt, savedAt('scroll-save', ['voice-home']))
      exit.waitFor(
        () =>
          exit.platform('scroll-deck')?.phase === 'extended' &&
          (exit.platform('scroll-deck')?.phaseProgress ?? 1) < 0.05,
      )
      exit.reach(P.scroll, { supportId: 'scroll-deck' })
      expect(
        exit.attempt(P.scrollCatch, {
          jumpGaps: false,
          maxSeconds: 4,
          supportId: 'scroll-catch',
        }),
      ).toBe('respawn')
      expect(exit.game.snapshot().checkpointId).toBe('scroll-save')
      expect(exit.visited.has('scroll-catch')).toBe(false)
    },
  )

  it.each([1 / 60, 1 / 30])(
    'rejects the standard jump during the retracted window and gives a fair checkpoint retry at %s seconds/frame',
    (dt) => {
      const v = visit(dt, savedAt('scroll-save', ['voice-home']))
      v.waitFor(
        () =>
          v.platform('scroll-deck')?.phase === 'retracted' &&
          (v.platform('scroll-deck')?.phaseProgress ?? 1) < 0.1,
      )
      expect(
        v.attempt(P.scroll, {
          maxSeconds: 4,
          supportId: 'scroll-deck',
        }),
      ).toBe('respawn')
      expect(v.game.snapshot()).toMatchObject({
        checkpointId: 'scroll-save',
        player: { grounded: true, supportPlatformId: 'scroll-approach' },
      })
      expect(v.respawns()).toBe(1)
      v.waitFor(
        () =>
          v.platform('scroll-deck')?.phase === 'extended' &&
          (v.platform('scroll-deck')?.phaseProgress ?? 1) < 0.05,
      )
      v.reach(P.scroll, { supportId: 'scroll-deck' })
      expect(v.respawns()).toBe(1)
    },
  )

  it('retains grounded contact while the centred scroll support retracts beneath Merc', () => {
    const v = visit(1 / 60, savedAt('scroll-save', ['voice-home']))
    v.reach(P.scroll, { supportId: 'scroll-deck' })
    for (let frame = 0; frame < 360; frame++) {
      expect(v.game.snapshot().player).toMatchObject({
        grounded: true,
        supportPlatformId: 'scroll-deck',
      })
      if (v.platform('scroll-deck')?.phase === 'retracted') break
      v.step()
    }
    expect(v.platform('scroll-deck')?.phase).toBe('retracted')
    expect(v.respawns()).toBe(0)
  })

  it.each([
    { id: 'rose-step', point: P.rose, warningSeconds: 2 },
    { id: 'amethyst-step', point: P.amethyst, warningSeconds: 4 },
  ] as const)(
    '$id removes support after $warningSeconds seconds, then restores on checkpoint recovery',
    ({ id, point, warningSeconds }) => {
      const dt = 1 / 60
      const v = visit(dt, savedAt('final-save', ['voice-home', 'voice-third']))
      v.reach(P.amethyst, { settle: false, supportId: 'amethyst-step' })
      if (id === 'rose-step')
        v.reach(point, { settle: false, supportId: 'rose-step' })
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
      expect(restored.snapshot().player.position.x).toBeCloseTo(
        P.finalCatch.x,
        12,
      )
      expect(restored.snapshot().player.position.y).toBe(0)
      expect(restored.snapshot().player.position.z).toBeCloseTo(
        P.finalCatch.z,
        12,
      )
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
