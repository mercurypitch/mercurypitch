// Platform runtime tests — one fixed-step truth drives motion, support, frost and collapse.

import { describe, expect, it } from 'vitest'
import type { GlassGame, LevelDefinition, MovementInput, PlatformDefinition, } from '../contracts'
import { LEVEL_MOVEMENT_LIMITS } from '../contracts'
import { FLAT_COURSE_COLLIDER, resolveMovingPlatformPushes } from './collision'
import { createGlassGame } from './game'
import { createMovement, MOVEMENT, stepMovement } from './movement'
import { createPlatformRuntime, platformRuntimeDefinitionError, } from './platform-runtime'
import { SHATTER_LIFECYCLE_SECONDS } from './shatter-presentation'

const idle: MovementInput = { moveX: 0, moveZ: 0, jumpDown: false }

function platform(
  id: string,
  extra: Partial<PlatformDefinition> = {},
): PlatformDefinition {
  return {
    id,
    minX: -1,
    maxX: 1,
    minZ: -1,
    maxZ: 1,
    top: 0,
    thickness: 0.2,
    kind: 'deck',
    material: 'stone',
    ...extra,
  }
}

function level(
  platforms: readonly PlatformDefinition[],
  fallBelow = -10,
): LevelDefinition {
  return {
    id: 'platform-runtime-proof',
    title: 'Platform runtime proof',
    spawn: {
      position: { x: 0, y: platforms[0]?.top ?? 0, z: 0 },
      facingYaw: 0,
      checkpointId: 'start',
    },
    platforms,
    checkpoints: [
      {
        id: 'start',
        position: { x: 0, y: platforms[0]?.top ?? 0, z: 0 },
        radius: 0.3,
        facingYaw: 0,
      },
    ],
    breakables: [],
    exit: {
      minX: 100,
      maxX: 101,
      minZ: 100,
      maxZ: 101,
      top: 0,
      requiresCompleted: [],
    },
    fallBelow,
  }
}

function fixedSteps(
  game: GlassGame,
  count: number,
  input: MovementInput = idle,
): void {
  for (let step = 0; step < count; step++) game.step(input, MOVEMENT.fixedStep)
}

function stateFor(game: GlassGame, id: string) {
  return game.snapshot().platformStates?.find((state) => state.id === id)
}

function voicePlatformLevel(): LevelDefinition {
  const result = level([
    platform('raft', {
      behavior: {
        kind: 'glide',
        translation: { x: 0.4, y: 0, z: 0 },
        travelSeconds: 1,
        dwellSeconds: 0.05,
      },
    }),
  ])
  result.breakables = [
    {
      id: 'voice-glass',
      label: 'Voice glass',
      position: { x: 0, y: 0, z: 0 },
      anchor: { x: 0, y: 0, z: 0 },
      variant: 'proof',
      optional: false,
      challenge: {
        kind: 'hold',
        step: {
          target: 'comfortable',
          hold: {
            requiredSeconds: 0.05,
            toleranceCents: 75,
            confidenceFloor: 0.5,
            dropoutGraceSeconds: 0.1,
            decayPerSecond: 0.25,
            maximumSampleGapSeconds: 0.1,
            maximumSampleAgeMs: 150,
          },
        },
      },
    },
  ]
  return result
}

function finishVoiceGlass(game: GlassGame): void {
  const events = []
  for (let sequence = 0; sequence <= 8; sequence++)
    events.push(
      ...game.feedPitch(
        {
          sequence,
          captureSeconds: sequence * 0.025,
          capturedAtMs: sequence * 25,
          confidence: 0.9,
          midi: 57,
        },
        sequence * 25,
      ),
    )
  expect(events).toContainEqual({
    type: 'break',
    id: 'voice-glass',
    outcome: 'celebration',
  })
}

describe('authored platform runtime', () => {
  it('eases a glide through both endpoint dwells and reverses without a transform jump', () => {
    const raft = platform('raft', {
      behavior: {
        kind: 'glide',
        translation: { x: 2, y: 0, z: 0 },
        travelSeconds: 0.6,
        dwellSeconds: 0.1,
      },
    })
    const runtime = createPlatformRuntime([raft])
    const active = new Set(['raft'])
    const advance = (count: number) => {
      for (let step = 0; step < count; step++)
        runtime.advance(MOVEMENT.fixedStep, active)
    }

    advance(12)
    expect(runtime.snapshots()[0]).toMatchObject({
      phase: 'moving',
      phaseProgress: 0,
      offset: { x: 0, y: 0, z: 0 },
    })
    advance(36)
    expect(runtime.snapshots()[0]?.offset.x).toBeCloseTo(1, 8)
    expect(runtime.supportDelta('raft').x).toBeGreaterThan(0)
    advance(36)
    expect(runtime.snapshots()[0]?.offset.x).toBeCloseTo(2, 8)
    advance(12)
    expect(runtime.snapshots()[0]?.offset.x).toBeCloseTo(2, 8)
    advance(1)
    expect(runtime.supportDelta('raft').x).toBeLessThan(0)
    expect(runtime.snapshots()[0]?.offset.x).toBeLessThan(2)
  })

  it('retracts a scroll about its fixed centre and reaches both authored endpoints', () => {
    const scroll = platform('scroll', {
      minX: -4,
      maxX: 4,
      minZ: -2,
      maxZ: 2,
      top: 1.25,
      behavior: {
        kind: 'scroll',
        axis: 'x',
        minLengthRatio: 0.25,
        extendedSeconds: 0.25,
        retractedSeconds: 0.5,
        transitionSeconds: 0.25,
        initialState: 'extended',
      },
    })
    const runtime = createPlatformRuntime([scroll])
    const active = new Set(['scroll'])
    const materialized = () =>
      runtime.materialize([scroll])[0] as PlatformDefinition

    expect(runtime.snapshots()[0]).toMatchObject({
      phase: 'extended',
      phaseProgress: 0,
      lengthRatio: 1,
    })
    expect(materialized()).toMatchObject({
      minX: -4,
      maxX: 4,
      minZ: -2,
      maxZ: 2,
      top: 1.25,
    })

    runtime.advance(0.25, active)
    expect(runtime.snapshots()[0]).toMatchObject({
      phase: 'retracting',
      phaseProgress: 0,
      lengthRatio: 1,
    })
    runtime.advance(0.125, active)
    expect(runtime.snapshots()[0]).toMatchObject({
      phase: 'retracting',
      phaseProgress: 0.5,
      lengthRatio: 0.625,
    })
    expect(materialized()).toMatchObject({
      minX: -2.5,
      maxX: 2.5,
      minZ: -2,
      maxZ: 2,
      top: 1.25,
    })

    runtime.advance(0.125, active)
    expect(runtime.snapshots()[0]).toMatchObject({
      phase: 'retracted',
      phaseProgress: 0,
      lengthRatio: 0.25,
    })
    expect(materialized()).toMatchObject({ minX: -1, maxX: 1 })
    runtime.advance(0.5, active)
    expect(runtime.snapshots()[0]).toMatchObject({
      phase: 'extending',
      phaseProgress: 0,
      lengthRatio: 0.25,
    })
    runtime.advance(0.25, active)
    expect(runtime.snapshots()[0]).toMatchObject({
      phase: 'extended',
      phaseProgress: 0,
      lengthRatio: 1,
    })
  })

  it('starts a retracted scroll on its chosen world axis and freezes at dt zero', () => {
    const scroll = platform('turned-scroll', {
      minX: -3,
      maxX: 3,
      minZ: -4,
      maxZ: 4,
      behavior: {
        kind: 'scroll',
        axis: 'z',
        minLengthRatio: 0.25,
        extendedSeconds: 1,
        retractedSeconds: 1,
        transitionSeconds: 1,
        initialState: 'retracted',
      },
    })
    const runtime = createPlatformRuntime([scroll])
    const active = new Set(['turned-scroll'])
    const initial = runtime.materialize([scroll])[0] as PlatformDefinition
    expect(initial).toMatchObject({
      minX: -3,
      maxX: 3,
      minZ: -1,
      maxZ: 1,
    })
    expect(runtime.snapshots()[0]).toMatchObject({
      phase: 'retracted',
      lengthRatio: 0.25,
    })

    runtime.advance(1.5, active)
    const beforePause = runtime.snapshots()[0]
    const beforeBounds = runtime.materialize([scroll])[0]
    runtime.advance(0, active)
    expect(runtime.snapshots()[0]).toEqual(beforePause)
    expect(runtime.materialize([scroll])[0]).toEqual(beforeBounds)
  })

  it('bounds scroll ratios and timings and keeps large-step phase progress clamped', () => {
    const behavior = {
      kind: 'scroll',
      axis: 'x',
      minLengthRatio: 0.1,
      extendedSeconds: 0.25,
      retractedSeconds: 60,
      transitionSeconds: 30,
      initialState: 'extended',
    } as const
    expect(
      platformRuntimeDefinitionError(platform('bounded-scroll', { behavior })),
    ).toBeUndefined()
    for (const invalid of [
      { ...behavior, minLengthRatio: 0.099 },
      { ...behavior, minLengthRatio: 0.951 },
      { ...behavior, extendedSeconds: 0.249 },
      { ...behavior, retractedSeconds: 60.001 },
      { ...behavior, transitionSeconds: 0.249 },
      { ...behavior, transitionSeconds: 30.001 },
    ])
      expect(
        platformRuntimeDefinitionError(
          platform('invalid-scroll', { behavior: invalid }),
        ),
      ).toContain('scroll')

    const cyclic = platform('cyclic-scroll', {
      behavior: {
        ...behavior,
        minLengthRatio: 0.4,
        extendedSeconds: 0.5,
        retractedSeconds: 0.5,
        transitionSeconds: 0.5,
      },
    })
    const runtime = createPlatformRuntime([cyclic])
    runtime.advance(20_000.75, new Set(['cyclic-scroll']))
    expect(runtime.snapshots()[0]).toMatchObject({
      phase: 'retracting',
      phaseProgress: 0.5,
    })
    expect(runtime.snapshots()[0]?.lengthRatio).toBeCloseTo(0.7, 12)
    expect(runtime.snapshots()[0]?.phaseProgress).toBeGreaterThanOrEqual(0)
    expect(runtime.snapshots()[0]?.phaseProgress).toBeLessThanOrEqual(1)
  })

  it('drops an edge rider as collision retracts while retaining centre support', () => {
    const scroll = platform('scroll', {
      minX: -2,
      maxX: 2,
      behavior: {
        kind: 'scroll',
        axis: 'x',
        minLengthRatio: 0.25,
        extendedSeconds: 0.25,
        retractedSeconds: 0.25,
        transitionSeconds: 0.25,
        initialState: 'extended',
      },
    })
    const edgeLevel = level([scroll], -100)
    edgeLevel.spawn.position.x = 1.2
    edgeLevel.checkpoints[0]!.position.x = 1.2
    const edge = createGlassGame(edgeLevel)
    fixedSteps(edge, 60)
    expect(stateFor(edge, 'scroll')).toMatchObject({
      phase: 'retracted',
      lengthRatio: 0.25,
      collisionEnabled: true,
    })
    expect(edge.snapshot().activeSolidIds).toContain('scroll')
    expect(edge.snapshot().player.supportPlatformId).toBeNull()
    expect(edge.snapshot().player.grounded).toBe(false)
    expect(edge.snapshot().player.position.y).toBeLessThan(0)

    const centre = createGlassGame(level([scroll], -100))
    fixedSteps(centre, 120)
    expect(centre.snapshot().player.supportPlatformId).toBe('scroll')
    expect(centre.snapshot().player.grounded).toBe(true)
    expect(centre.snapshot().player.position).toMatchObject({
      x: 0,
      y: 0,
      z: 0,
    })
  })

  it('bounds the cosine glide peak and rejects malformed behavior before any NaN reaches simulation', () => {
    const boundaryDistance = (2 * LEVEL_MOVEMENT_LIMITS.maximumSpeed) / Math.PI
    expect(
      platformRuntimeDefinitionError(
        platform('bounded', {
          behavior: {
            kind: 'glide',
            translation: { x: boundaryDistance * (1 - 1e-10), y: 0, z: 0 },
            travelSeconds: 1,
            dwellSeconds: 0.1,
          },
        }),
      ),
    ).toBeUndefined()
    expect(
      platformRuntimeDefinitionError(
        platform('too-fast', {
          behavior: {
            kind: 'glide',
            translation: { x: boundaryDistance * 1.001, y: 0, z: 0 },
            travelSeconds: 1,
            dwellSeconds: 0.1,
          },
        }),
      ),
    ).toContain('speed')
    expect(() =>
      createPlatformRuntime([
        platform('nan-crackle', {
          behavior: {
            kind: 'crackle',
            warningSeconds: Number.NaN,
            releaseSeconds: 1,
            resetSeconds: 1,
          },
        }),
      ]),
    ).toThrow('Invalid platform "nan-crackle"')
    expect(
      platformRuntimeDefinitionError(
        platform('nan-translation', {
          behavior: {
            kind: 'glide',
            translation: { x: Number.NaN, y: 0, z: 0 },
            travelSeconds: 1,
            dwellSeconds: 0.1,
          },
        }),
      ),
    ).toContain('translation')
    expect(
      platformRuntimeDefinitionError(
        platform('unbounded-frost', {
          surface: {
            kind: 'frost',
            controlMultiplier: 0,
            brakingMultiplier: 0.2,
            maximumSpeed: Number.POSITIVE_INFINITY,
          },
        }),
      ),
    ).toContain('frost')
  })

  it('rejects malformed intentional gaps before simulation starts', () => {
    const malformed = level([platform('floor')])
    malformed.intentionalGaps = [
      {
        id: 'bad-gap',
        minX: 0,
        maxX: Number.NaN,
        minZ: -1,
        maxZ: 1,
        top: 0,
      },
    ]
    expect(() => createGlassGame(malformed)).toThrow(
      'Invalid intentional gap "bad-gap"',
    )

    const unsupportedOwner = level([
      platform('moving-floor', {
        behavior: {
          kind: 'glide',
          translation: { x: 1, y: 0, z: 0 },
          travelSeconds: 1,
          dwellSeconds: 0.1,
        },
      }),
    ])
    unsupportedOwner.solids = [
      {
        id: 'floating-prop',
        kind: 'prop',
        shape: 'box',
        minX: -0.2,
        maxX: 0.2,
        minZ: -0.2,
        maxZ: 0.2,
        top: 0.5,
        thickness: 0.5,
        platformId: 'moving-floor',
      },
    ]
    expect(() => createGlassGame(unsupportedOwner)).toThrow(
      'platformId cannot reference behavioral platform',
    )
  })

  it('carries a rider without drift, then stops applying support delta after jump', () => {
    const game = createGlassGame(
      level([
        platform('raft', {
          behavior: {
            kind: 'glide',
            translation: { x: 1.5, y: 0, z: 0 },
            travelSeconds: 1,
            dwellSeconds: 0.1,
          },
        }),
      ]),
    )

    fixedSteps(game, 72)
    const riding = game.snapshot()
    const raft = stateFor(game, 'raft')!
    expect(riding.player.supportPlatformId).toBe('raft')
    expect(riding.player.position.x).toBeCloseTo(raft.offset.x, 8)
    expect(riding.player.position.z).toBe(0)

    const jump = game.step({ ...idle, jumpDown: true }, MOVEMENT.fixedStep)
    expect(jump).toContainEqual({ type: 'jumped' })
    const airborneX = game.snapshot().player.position.x
    const raftX = stateFor(game, 'raft')!.offset.x
    fixedSteps(game, 12)
    expect(game.snapshot().player.supportPlatformId).toBeNull()
    expect(game.snapshot().player.position.x).toBeCloseTo(airborneX, 8)
    expect(stateFor(game, 'raft')!.offset.x - raftX).toBeGreaterThan(0.1)
  })

  it('freezes a paused glide and resumes one bounded step without wall-clock catch-up', () => {
    const game = createGlassGame(
      level([
        platform('raft', {
          behavior: {
            kind: 'glide',
            translation: { x: 1.5, y: 0, z: 0 },
            travelSeconds: 1,
            dwellSeconds: 0.1,
          },
        }),
      ]),
    )
    fixedSteps(game, 48)
    const before = game.snapshot()
    game.setPaused(true)
    game.step(idle, 120)
    expect(stateFor(game, 'raft')!.offset).toEqual(
      before.platformStates?.[0]?.offset,
    )
    expect(game.snapshot().player.position).toEqual(before.player.position)

    game.setPaused(false)
    game.step(idle, MOVEMENT.fixedStep)
    expect(
      Math.abs(
        stateFor(game, 'raft')!.offset.x -
          (before.platformStates?.[0]?.offset.x ?? 0),
      ),
    ).toBeLessThan(0.05)
  })

  it('freezes platform clocks through voice capture and shatter without catch-up', () => {
    const voiceGame = createGlassGame(voicePlatformLevel())
    fixedSteps(voiceGame, 30)
    const beforeVoice = stateFor(voiceGame, 'raft')!.offset.x
    expect(beforeVoice).toBeGreaterThan(0)
    expect(voiceGame.beginEncounter('voice-glass', 57)).toBe(true)
    voiceGame.step(idle, 10)
    expect(stateFor(voiceGame, 'raft')!.offset.x).toBe(beforeVoice)
    voiceGame.cancelEncounter()
    voiceGame.step(idle, MOVEMENT.fixedStep)
    const afterVoiceDelta = stateFor(voiceGame, 'raft')!.offset.x - beforeVoice
    expect(afterVoiceDelta).toBeGreaterThan(0)
    expect(afterVoiceDelta).toBeLessThan(0.02)

    const shatterGame = createGlassGame(voicePlatformLevel())
    fixedSteps(shatterGame, 30)
    expect(shatterGame.beginEncounter('voice-glass', 57)).toBe(true)
    finishVoiceGlass(shatterGame)
    const beforeShatter = stateFor(shatterGame, 'raft')!.offset.x
    shatterGame.step(idle, SHATTER_LIFECYCLE_SECONDS)
    expect(shatterGame.snapshot().phase).toBe('idle')
    expect(stateFor(shatterGame, 'raft')!.offset.x).toBe(beforeShatter)
    shatterGame.step(idle, MOVEMENT.fixedStep)
    const afterShatterDelta =
      stateFor(shatterGame, 'raft')!.offset.x - beforeShatter
    expect(afterShatterDelta).toBeGreaterThan(0)
    expect(afterShatterDelta).toBeLessThan(0.02)
  })

  it('uses reduced grounded frost control and braking while preserving ordinary air response', () => {
    const frost = {
      kind: 'frost',
      controlMultiplier: 0.4,
      brakingMultiplier: 0.2,
      maximumSpeed: 1.1,
    } as const
    const floor = platform('frost', { minX: -20, maxX: 20, surface: frost })
    const configured = {
      walkSpeed: 1.55,
      runSpeed: 2.7,
      runDelaySeconds: 0.1,
      runRampSeconds: 0.2,
    }
    const bounded = createMovement({ x: 0, y: 0, z: 0 }, 0)
    for (let step = 0; step < 360; step++)
      stepMovement(
        bounded,
        { ...idle, moveX: 1 },
        MOVEMENT.fixedStep,
        [floor],
        FLAT_COURSE_COLLIDER,
        configured,
        { surface: frost },
      )
    expect(bounded.velocity.x).toBeCloseTo(frost.maximumSpeed, 5)

    const normal = createMovement({ x: 0, y: 0, z: 0 }, 0)
    const icy = createMovement({ x: 0, y: 0, z: 0 }, 0)
    normal.velocity.x = icy.velocity.x = 0.8
    for (let step = 0; step < 24; step++) {
      stepMovement(normal, idle, MOVEMENT.fixedStep, [floor])
      stepMovement(
        icy,
        idle,
        MOVEMENT.fixedStep,
        [floor],
        FLAT_COURSE_COLLIDER,
        undefined,
        { surface: frost },
      )
    }
    expect(normal.velocity.x).toBe(0)
    expect(icy.velocity.x).toBeGreaterThan(0.3)
    expect(icy.position.x).toBeGreaterThan(normal.position.x)

    const airborne = createMovement({ x: 0, y: 1, z: 0 }, 0)
    airborne.grounded = false
    airborne.velocity.x = 0.8
    for (let step = 0; step < 24; step++)
      stepMovement(
        airborne,
        idle,
        MOVEMENT.fixedStep,
        [floor],
        FLAT_COURSE_COLLIDER,
        undefined,
        { surface: frost },
      )
    expect(airborne.velocity.x).toBe(0)
  })

  it('removes crackle support exactly after warning, then releases, resets and rearms collision', () => {
    const tile = platform('tile', {
      behavior: {
        kind: 'crackle',
        warningSeconds: 0.05,
        releaseSeconds: 0.05,
        resetSeconds: 0.05,
      },
    })
    const game = createGlassGame(level([tile], -100))

    fixedSteps(game, 1)
    expect(stateFor(game, 'tile')).toMatchObject({
      phase: 'warning',
      phaseProgress: 0,
      collisionEnabled: true,
    })
    fixedSteps(game, 5)
    expect(stateFor(game, 'tile')?.phase).toBe('warning')
    expect(game.snapshot().activeSolidIds).toContain('tile')
    fixedSteps(game, 1)
    expect(stateFor(game, 'tile')).toMatchObject({
      phase: 'released',
      collisionEnabled: false,
    })
    expect(game.snapshot().activeSolidIds).not.toContain('tile')
    expect(game.snapshot().player.supportPlatformId).toBeNull()

    fixedSteps(game, 6)
    expect(stateFor(game, 'tile')?.phase).toBe('resetting')
    fixedSteps(game, 6)
    expect(stateFor(game, 'tile')).toMatchObject({
      phase: 'intact',
      collisionEnabled: true,
    })
    expect(game.snapshot().activeSolidIds).toContain('tile')
  })

  it('resets every platform phase and transform when an airborne fall respawns', () => {
    const tile = platform('tile', {
      behavior: {
        kind: 'crackle',
        warningSeconds: 0.025,
        releaseSeconds: 1,
        resetSeconds: 1,
      },
    })
    const game = createGlassGame(level([tile], -0.02))
    let respawned = false
    for (let step = 0; step < 120; step++) {
      if (
        game
          .step(idle, MOVEMENT.fixedStep)
          .some((event) => event.type === 'respawn')
      ) {
        respawned = true
        break
      }
    }
    expect(respawned).toBe(true)
    expect(stateFor(game, 'tile')).toMatchObject({
      phase: 'intact',
      phaseProgress: 0,
      collisionEnabled: true,
      offset: { x: 0, y: 0, z: 0 },
    })
    expect(game.snapshot().player.supportPlatformId).toBe('tile')
  })

  it('pushes a non-rider with a translating side without tunnelling through a back wall', () => {
    const previous = platform('raft', {
      minX: 0,
      maxX: 1,
      top: 0.5,
      thickness: 0.5,
    })
    const current = { ...previous, minX: 0.05, maxX: 1.05 }
    const wall = platform('wall', {
      minX: 1.365,
      maxX: 1.5,
      minZ: -1,
      maxZ: 1,
      top: 1,
      thickness: 1,
    })
    const push = resolveMovingPlatformPushes(
      { x: 1.17, y: 0, z: 0 },
      MOVEMENT,
      [
        {
          id: 'raft',
          previous,
          current,
          displacement: { x: 0.05, y: 0, z: 0 },
        },
      ],
      [current, wall],
      FLAT_COURSE_COLLIDER,
      null,
    )
    expect(push.crushed).toBe(true)
    expect(push.position.x).toBeCloseTo(wall.minX - MOVEMENT.radius)
    expect(push.position.x + MOVEMENT.radius).toBeLessThanOrEqual(wall.minX)
  })

  it('respawns deterministically when a translating side pins a non-rider', () => {
    const floor = platform('floor', { minX: -2, maxX: 2 })
    const raft = platform('raft', {
      minX: -1,
      maxX: -0.2,
      top: 0.5,
      thickness: 0.5,
      behavior: {
        kind: 'glide',
        translation: { x: 0.6, y: 0, z: 0 },
        travelSeconds: 0.5,
        dwellSeconds: 0.05,
      },
    })
    const wall = platform('wall', {
      minX: 0.3,
      maxX: 0.5,
      top: 1,
      thickness: 1,
    })
    const pinLevel = level([floor, raft, wall])
    pinLevel.spawn.position.x = 0.12
    pinLevel.checkpoints[0]!.position.x = 0.12
    const game = createGlassGame(pinLevel)
    let respawned = false
    for (let step = 0; step < 120; step++) {
      if (
        game
          .step(idle, MOVEMENT.fixedStep)
          .some((event) => event.type === 'respawn')
      ) {
        respawned = true
        break
      }
    }

    expect(respawned).toBe(true)
    expect(game.snapshot().player.position.x).toBe(0.12)
    expect(stateFor(game, 'raft')?.offset).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('stops an upward-carried rider at headroom instead of tunnelling through the ceiling', () => {
    const raft = platform('raft', { top: 0.1 })
    const ceiling = platform('ceiling', {
      top: 0.75,
      thickness: 0.2,
    })
    const rider = createMovement({ x: 0, y: 0, z: 0 }, 0)
    rider.supportPlatformId = 'raft'
    rider.supportSolidId = 'raft'
    const result = stepMovement(
      rider,
      idle,
      MOVEMENT.fixedStep,
      [raft, ceiling],
      FLAT_COURSE_COLLIDER,
      undefined,
      { supportDelta: { x: 0, y: 0.1, z: 0 } },
    )
    expect(result.crushed).toBe(true)
    expect(rider.position.y + MOVEMENT.height).toBeCloseTo(
      ceiling.top - ceiling.thickness,
    )
    expect(rider.grounded).toBe(false)
  })
})
