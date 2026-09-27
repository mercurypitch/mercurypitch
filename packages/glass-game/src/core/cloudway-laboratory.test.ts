// Crystal Promenade traversal proof — exercise measured jumps, the certified scroll, two-speed glass, voice rests and saved recovery.
import { describe, expect, it } from 'vitest'
import { CLOUDWAY_CRYSTAL_PROMENADE_MEASUREMENTS as MEASUREMENTS, CLOUDWAY_CRYSTAL_PROMENADE_MECHANICS_PREVIEW as PREVIEW, CLOUDWAY_CRYSTAL_PROMENADE_STUDY as LEVEL, } from '../content/cloudway-laboratory'
import type { LevelDefinition } from '../contracts'
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

function visit(dt: number, saved?: unknown, level: LevelDefinition = LEVEL) {
  const game = createGlassGame(level, saved)
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
    const edge = (level.intentionalGaps ?? []).some((gap) => {
      const projectedX = position.x + nx * 0.26
      const projectedZ = position.z + nz * 0.26
      return (
        projectedX >= gap.minX &&
        projectedX <= gap.maxX &&
        projectedZ >= gap.minZ &&
        projectedZ <= gap.maxZ
      )
    })
    const raised = level.platforms.some((platform) => {
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

function previewSavedAt(
  checkpointId: string,
  completedBreakableIds: string[] = [],
) {
  return {
    version: 2,
    levelId: PREVIEW.id,
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

function platformCentre(level: LevelDefinition, id: string): RoutePoint {
  const result = level.platforms.find((candidate) => candidate.id === id)
  if (result === undefined) throw new Error(`Missing platform ${id}`)
  return {
    x: (result.minX + result.maxX) / 2,
    z: (result.minZ + result.maxZ) / 2,
  }
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
  const scroll = platform('scroll-deck')
  const negativeRoller = {
    x: P.scroll.x,
    z:
      scroll.minZ - MEASUREMENTS.scroll.edgeSupports.negative.outwardLength / 2,
  }
  const positiveRoller = {
    x: P.scroll.x,
    z:
      scroll.maxZ + MEASUREMENTS.scroll.edgeSupports.positive.outwardLength / 2,
  }
  v.reach(negativeRoller, { settle: false, supportId: 'scroll-deck' })
  expect(v.game.snapshot().player.position.y).toBeCloseTo(
    MEASUREMENTS.scroll.edgeSupports.negative.topOffset,
    8,
  )
  v.reach(P.scroll, { settle: false, supportId: 'scroll-deck' })
  expect(v.game.snapshot().player).toMatchObject({
    grounded: true,
    supportPlatformId: 'scroll-deck',
  })
  v.reach(positiveRoller, { settle: false, supportId: 'scroll-deck' })
  expect(v.game.snapshot().player.position.y).toBeCloseTo(
    MEASUREMENTS.scroll.edgeSupports.positive.topOffset,
    8,
  )
  v.rest(0.12)
  expect(v.game.snapshot().player.supportPlatformId).toBe('scroll-deck')
  v.reach(P.scrollCatch, { supportId: 'scroll-catch' })
}

describe('Crystal Promenade mechanics bench', () => {
  it('keeps the saved namespace and revision-3 prefix while publishing the revision-4 route', () => {
    expect(LEVEL.id).toBe('cloudway-crystal-promenade-first-slice')
    expect(LEVEL.authored).toMatchObject({
      layoutId: 'crystal-promenade-first-slice',
      contentRevision: 4,
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
      'frost-lily-one',
      'frost-lily-two',
      'wall-approach-entry',
      'wall-approach',
      'wall-approach-middle',
      'wall-approach-forward',
      'wall-approach-threshold',
      'wall-catch',
      'raft-dock',
      'aurora-raft',
      'raft-catch',
      'finale-court',
    ])
    expect(forwardGap('arrival', 'scroll-approach-entry')).toBeCloseTo(
      MEASUREMENTS.gaps.arrivalApproach,
      12,
    )
    const scroll = platform('scroll-deck')
    const physicalScrollMinZ =
      scroll.minZ - MEASUREMENTS.scroll.edgeSupports.negative.outwardLength
    const physicalScrollMaxZ =
      scroll.maxZ + MEASUREMENTS.scroll.edgeSupports.positive.outwardLength
    expect(physicalScrollMinZ - platform('scroll-approach').maxZ).toBeCloseTo(
      MEASUREMENTS.gaps.scrollEntry,
      12,
    )
    expect(platform('scroll-catch').minZ - physicalScrollMaxZ).toBeCloseTo(
      MEASUREMENTS.gaps.scrollExit,
      12,
    )
    expect(scroll.maxZ - scroll.minZ).toBeCloseTo(
      MEASUREMENTS.scroll.extensionLength,
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
    expect(forwardGap('final-terrace', 'frost-lily-one')).toBeCloseTo(
      MEASUREMENTS.gaps.frostEntry,
      12,
    )
    expect(forwardGap('frost-lily-one', 'frost-lily-two')).toBeCloseTo(
      MEASUREMENTS.gaps.frostBend,
      12,
    )
    expect(forwardGap('frost-lily-two', 'wall-approach-entry')).toBeCloseTo(
      MEASUREMENTS.gaps.frostExit,
      12,
    )
    expect(forwardGap('raft-dock', 'aurora-raft')).toBeCloseTo(
      MEASUREMENTS.gaps.auroraEntry,
      12,
    )
    const raft = platform('aurora-raft')
    expect(platform('raft-catch').minZ - (raft.maxZ + 2.2)).toBeCloseTo(
      MEASUREMENTS.gaps.auroraExit,
      12,
    )
    for (const [back, front] of [
      ['arrival-entry', 'arrival'],
      ['scroll-approach-entry', 'scroll-approach'],
      ['scroll-catch', 'scroll-court'],
      ['final-catch', 'final-terrace'],
      ['wall-approach-entry', 'wall-approach'],
      ['wall-approach', 'wall-approach-middle'],
      ['wall-approach-middle', 'wall-approach-forward'],
      ['wall-approach-forward', 'wall-approach-threshold'],
      ['wall-approach-threshold', 'wall-catch'],
      ['wall-catch', 'raft-dock'],
      ['raft-catch', 'finale-court'],
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

  it('restores revision-3 partial and completed saves without moving the retained checkpoint', () => {
    const partial = createGlassGame(
      LEVEL,
      savedAt('final-save', ['voice-home', 'voice-third']),
    ).snapshot()
    expect(partial.player.position.x).toBeCloseTo(P.finalCatch.x, 12)
    expect(partial.player.position.y).toBe(0)
    expect(partial.player.position.z).toBeCloseTo(P.finalCatch.z, 12)
    expect(partial.player.supportPlatformId).toBe('final-catch')
    expect(partial.complete).toBe(false)

    const earnedEncounterIds = ['voice-home', 'voice-third', 'voice-fifth']
    const completed = createGlassGame(LEVEL, {
      ...savedAt('final-save', earnedEncounterIds),
      finished: true,
    }).snapshot()
    expect(completed.completedBreakableIds).toEqual(earnedEncounterIds)
    expect(completed.complete).toBe(true)
    expect(completed.activeSolidIds).not.toContain('barrier:voice-fifth:pane')
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
      v.reach(P.finalTerrace, { supportId: 'final-terrace' })
      v.reach(P.frostLilyOne, { supportId: 'frost-lily-one' })
      v.reach(P.frostLilyTwo, { supportId: 'frost-lily-two' })
      const fifth = LEVEL.breakables.find(
        (target) => target.id === 'voice-fifth',
      )!
      v.reach(fifth.anchor, {
        maxSeconds: 20,
        supportId: 'wall-approach-entry',
      })
      expect(v.game.snapshot().checkpointId).toBe('wall-save')
      expect(v.game.snapshot().activeSolidIds).toContain(
        'barrier:voice-fifth:pane',
      )
      v.sing('voice-fifth')
      expect(v.game.snapshot().activeSolidIds).not.toContain(
        'barrier:voice-fifth:pane',
      )
      v.reach(P.wallApproach, { supportId: 'wall-approach' })
      for (const id of [
        'wall-approach-middle',
        'wall-approach-forward',
        'wall-approach-threshold',
        'wall-catch',
        'raft-dock',
      ])
        v.reach(platformCentre(LEVEL, id), { supportId: id })
      v.waitFor(() => Math.abs(v.platform('aurora-raft')?.offset.z ?? 1) < 1e-6)
      v.reach(P.auroraRaft, { settle: false, supportId: 'aurora-raft' })
      v.waitFor(() => (v.platform('aurora-raft')?.offset.z ?? 0) > 2.18)
      v.reach(P.raftCatch, { supportId: 'raft-catch' })
      expect(v.game.snapshot().checkpointId).toBe('finale-save')
      const exitPoint = {
        x: (LEVEL.exit.minX + LEVEL.exit.maxX) / 2,
        z: LEVEL.exit.maxZ - 0.05,
      }
      v.reach(exitPoint, { supportId: 'finale-court' })
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
          'frost-lily-one',
          'frost-lily-two',
          'wall-approach-entry',
          'wall-approach',
          'wall-approach-middle',
          'wall-approach-forward',
          'wall-approach-threshold',
          'aurora-raft',
          'raft-catch',
        ]),
      )
    },
  )

  it.each([1 / 60, 1 / 30])(
    'traverses the cross-axis mechanics preview without a fall at %s seconds/frame',
    (dt) => {
      const v = visit(dt, previewSavedAt('preview-arrival-save'), PREVIEW)
      const encounter = (id: string) =>
        PREVIEW.breakables.find((target) => target.id === id)!
      v.reach(encounter('preview-voice-home').anchor, {
        supportId: 'preview-arrival',
      })
      v.sing('preview-voice-home')
      v.reach({ x: -7.63, z: -0.55 }, { supportId: 'preview-frost-one' })
      v.reach({ x: -4.88, z: 0.2 }, { supportId: 'preview-frost-two' })
      v.reach(
        { x: -2.15, z: 0.2 },
        {
          maxSeconds: 20,
          supportId: 'preview-frost-catch',
        },
      )
      expect(v.game.snapshot().checkpointId).toBe('preview-scroll-save')
      v.waitFor(
        () =>
          v.platform('preview-scroll-deck')?.phase === 'extended' &&
          (v.platform('preview-scroll-deck')?.phaseProgress ?? 1) < 0.05,
      )
      const scroll = PREVIEW.platforms.find(
        (platform) => platform.id === 'preview-scroll-deck',
      )!
      const negativeRollerX =
        scroll.minX -
        MEASUREMENTS.scroll.edgeSupports.negative.outwardLength / 2
      const positiveRollerX =
        scroll.maxX +
        MEASUREMENTS.scroll.edgeSupports.positive.outwardLength / 2
      v.reach(
        { x: negativeRollerX, z: 0.2 },
        {
          settle: false,
          supportId: 'preview-scroll-deck',
        },
      )
      v.reach(
        { x: 0.201982044, z: 0.2 },
        {
          settle: false,
          supportId: 'preview-scroll-deck',
        },
      )
      v.reach(
        { x: positiveRollerX, z: 0.2 },
        {
          settle: false,
          supportId: 'preview-scroll-deck',
        },
      )
      v.reach(
        { x: 3.273464088, z: 0.2 },
        {
          supportId: 'preview-scroll-court',
        },
      )
      v.sing('preview-voice-third')
      v.reach(
        { x: 3, z: 3.12 },
        {
          settle: false,
          supportId: 'preview-rose-step',
        },
      )
      v.reach(
        { x: 3.45, z: 4.99 },
        {
          settle: false,
          supportId: 'preview-amethyst-step',
        },
      )
      v.reach(encounter('preview-voice-fifth').anchor, {
        maxSeconds: 20,
        supportId: 'preview-wall-approach-entry',
      })
      expect(v.game.snapshot().checkpointId).toBe('preview-wall-save')
      v.sing('preview-voice-fifth')
      for (const id of [
        'preview-wall-approach',
        'preview-wall-approach-middle',
        'preview-wall-approach-forward',
        'preview-wall-approach-threshold',
        'preview-wall-catch',
        'preview-raft-dock',
        'preview-glide-turn',
      ])
        v.reach(platformCentre(PREVIEW, id), { supportId: id })
      v.waitFor(
        () => Math.abs(v.platform('preview-aurora-raft')?.offset.x ?? 1) < 1e-6,
      )
      v.reach(platformCentre(PREVIEW, 'preview-aurora-raft'), {
        settle: false,
        supportId: 'preview-aurora-raft',
      })
      v.waitFor(() => (v.platform('preview-aurora-raft')?.offset.x ?? 0) > 2.18)
      v.reach(platformCentre(PREVIEW, 'preview-raft-catch'), {
        supportId: 'preview-raft-catch',
      })
      expect(v.game.snapshot().checkpointId).toBe('preview-finale-save')
      v.reach(
        {
          x: PREVIEW.exit.maxX - 0.02,
          z: (PREVIEW.exit.minZ + PREVIEW.exit.maxZ) / 2,
        },
        {
          supportId: 'preview-finale',
        },
      )
      v.rest(0.5)
      expect(v.game.snapshot().complete).toBe(true)
      expect(v.respawns()).toBe(0)
      expect([...v.visited]).toEqual(
        expect.arrayContaining([
          'preview-frost-one',
          'preview-frost-two',
          'preview-scroll-deck',
          'preview-rose-step',
          'preview-amethyst-step',
          'preview-wall-approach-entry',
          'preview-wall-approach',
          'preview-wall-approach-middle',
          'preview-wall-approach-forward',
          'preview-wall-approach-threshold',
          'preview-aurora-raft',
          'preview-raft-catch',
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

  it.each([1 / 60, 1 / 30])(
    'carries each visible roller rider through a full retract/extend cycle at %s seconds/frame',
    (dt) => {
      for (const side of ['negative', 'positive'] as const) {
        const v = visit(dt, savedAt('scroll-save', ['voice-home']))
        v.waitFor(
          () =>
            v.platform('scroll-deck')?.phase === 'extended' &&
            (v.platform('scroll-deck')?.phaseProgress ?? 1) < 0.05,
        )
        const scroll = platform('scroll-deck')
        const edge = MEASUREMENTS.scroll.edgeSupports[side]
        const direction = side === 'negative' ? -1 : 1
        v.reach(
          {
            x: P.scroll.x,
            z:
              P.scroll.z +
              direction *
                (MEASUREMENTS.scroll.extensionLength / 2 +
                  edge.outwardLength / 2),
          },
          { settle: false, supportId: 'scroll-deck' },
        )
        const initialRatio = v.platform(scroll.id)?.lengthRatio ?? 1
        const riderOffset =
          v.game.snapshot().player.position.z -
          (P.scroll.z +
            direction *
              ((MEASUREMENTS.scroll.extensionLength * initialRatio) / 2 +
                edge.outwardLength / 2))
        const phases = new Set<string>()
        let completedCycle = false
        for (let frame = 0; frame < Math.ceil(12 / dt); frame++) {
          v.step()
          const state = v.platform(scroll.id)!
          phases.add(state.phase)
          const player = v.game.snapshot().player
          expect(player).toMatchObject({
            grounded: true,
            supportPlatformId: scroll.id,
          })
          expect(player.position.y).toBeCloseTo(edge.topOffset, 8)
          const expectedRiderZ =
            P.scroll.z +
            direction *
              ((MEASUREMENTS.scroll.extensionLength *
                (state.lengthRatio ?? 1)) /
                2 +
                edge.outwardLength / 2) +
            riderOffset
          expect(Math.abs(player.position.z - expectedRiderZ)).toBeLessThan(
            0.003,
          )
          if (
            phases.has('retracting') &&
            phases.has('retracted') &&
            phases.has('extending') &&
            state.phase === 'extended'
          ) {
            completedCycle = true
            break
          }
        }
        expect(completedCycle).toBe(true)
        expect(v.respawns()).toBe(0)
      }
    },
  )

  it.each(
    ([1 / 60, 1 / 30] as const).flatMap(
      (dt) =>
        [
          { dt, id: 'rose-step', point: P.rose, warningSeconds: 2 },
          { dt, id: 'amethyst-step', point: P.amethyst, warningSeconds: 4 },
        ] as const,
    ),
  )(
    '$id removes support after $warningSeconds seconds at $dt seconds/frame, then restores on checkpoint recovery',
    ({ dt, id, point, warningSeconds }) => {
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
