// Living Glass trial contract — the contained route binds one responsive platform to one real singing exhibit.

import { describe, expect, it } from 'vitest'
import type { GameEvent, MovementInput } from '../contracts'
import { createGlassGame, isWithinBreakableInteractionCircle, } from '../core/game'
import { MOVEMENT } from '../core/movement'
import { SHATTER_LIFECYCLE_SECONDS } from '../core/shatter-presentation'
import { LIVING_CRYSTAL_PLATFORM_RENDER_ID } from './living-crystal-profile'
import { LIVING_GLASS_CHECKPOINT_ID, LIVING_GLASS_HOLD, LIVING_GLASS_LEVEL_ID, LIVING_GLASS_ROSEBUD_ANCHOR, LIVING_GLASS_ROSEBUD_ID, LIVING_GLASS_ROSEBUD_POSITION, LIVING_GLASS_TRIAL, } from './living-glass-trial'
import { RESONANCE_ROSEBUD_VARIANT_ID } from './resonance-rosebud-profile'

const SAVED_AT_ROSEBUD = {
  version: 1,
  levelId: LIVING_GLASS_LEVEL_ID,
  checkpointId: LIVING_GLASS_CHECKPOINT_ID,
  completedBreakableIds: [],
} as const

const IDLE: MovementInput = { moveX: 0, moveZ: 0, jumpDown: false }

function feedHold(
  game: ReturnType<typeof createGlassGame>,
  startSequence: number,
  seconds: number,
): GameEvent[] {
  const events: GameEvent[] = []
  const frames = Math.ceil(seconds / 0.025)
  for (let offset = 0; offset <= frames; offset++) {
    const sequence = startSequence + offset
    const capturedAtMs = sequence * 25
    events.push(
      ...game.feedPitch(
        {
          sequence,
          captureSeconds: capturedAtMs / 1000,
          capturedAtMs,
          midi: 57,
          confidence: 0.9,
        },
        capturedAtMs,
      ),
    )
  }
  return events
}

function walkAxis(
  game: ReturnType<typeof createGlassGame>,
  axis: 'x' | 'z',
  destination: number,
): GameEvent[] {
  const events: GameEvent[] = []
  const direction = Math.sign(
    destination - game.snapshot().player.position[axis],
  )
  const input = {
    ...IDLE,
    moveX: axis === 'x' ? direction : 0,
    moveZ: axis === 'z' ? direction : 0,
  }
  for (
    let frame = 0;
    frame < 1200 &&
    direction * (destination - game.snapshot().player.position[axis]) > 0;
    frame++
  )
    events.push(...game.step(input, MOVEMENT.fixedStep))
  for (let frame = 0; frame < 24; frame++)
    events.push(...game.step(IDLE, MOVEMENT.fixedStep))
  return events
}

function enterExit(game: ReturnType<typeof createGlassGame>): GameEvent[] {
  return [
    ...walkAxis(game, 'x', 0.85),
    ...walkAxis(game, 'z', 4.6),
    ...walkAxis(game, 'x', 0),
    ...walkAxis(game, 'z', 5.08),
  ]
}

describe('living glass trial', () => {
  it('contains one authored crystal platform and one collision-backed Rosebud', () => {
    expect(
      LIVING_GLASS_TRIAL.platforms.filter(
        (platform) => platform.renderId === LIVING_CRYSTAL_PLATFORM_RENDER_ID,
      ),
    ).toHaveLength(1)
    expect(LIVING_GLASS_TRIAL.breakables).toEqual([
      expect.objectContaining({
        id: LIVING_GLASS_ROSEBUD_ID,
        variant: RESONANCE_ROSEBUD_VARIANT_ID,
        position: LIVING_GLASS_ROSEBUD_POSITION,
        anchor: LIVING_GLASS_ROSEBUD_ANCHOR,
        optional: false,
      }),
    ])
    const rosebud = LIVING_GLASS_TRIAL.breakables[0]!
    expect(
      LIVING_GLASS_TRIAL.solids?.find(
        (solid) => solid.id === rosebud.mount?.solidId,
      ),
    ).toMatchObject({
      shape: 'cylinder',
      x: rosebud.position.x,
      z: rosebud.position.z,
    })
    expect(
      isWithinBreakableInteractionCircle(
        LIVING_GLASS_ROSEBUD_ANCHOR,
        rosebud.anchor,
      ),
    ).toBe(true)
    expect(
      LIVING_GLASS_TRIAL.checkpoints.find(
        (checkpoint) => checkpoint.id === LIVING_GLASS_CHECKPOINT_ID,
      ),
    ).toMatchObject({
      position: LIVING_GLASS_ROSEBUD_ANCHOR,
      facingYaw: Math.PI,
    })
    expect(LIVING_GLASS_TRIAL.exit.requiresCompleted).toEqual([
      LIVING_GLASS_ROSEBUD_ID,
    ])
    expect(LIVING_GLASS_TRIAL.rewards).toBeUndefined()
  })

  it('drives authoritative charge, cancel and completion from a real A3 hold', () => {
    const game = createGlassGame(LIVING_GLASS_TRIAL, SAVED_AT_ROSEBUD)
    expect(game.snapshot()).toMatchObject({
      checkpointId: LIVING_GLASS_CHECKPOINT_ID,
      nearbyBreakableId: LIVING_GLASS_ROSEBUD_ID,
      completedBreakableIds: [],
    })

    expect(game.beginEncounter(LIVING_GLASS_ROSEBUD_ID, 57)).toBe(true)
    feedHold(game, 0, LIVING_GLASS_HOLD.requiredSeconds / 2)
    expect(game.snapshot().breakables[0]?.charge).toBeGreaterThan(0.4)
    expect(game.snapshot().breakables[0]?.charge).toBeLessThan(0.6)
    game.cancelEncounter()
    expect(game.snapshot().breakables[0]?.charge).toBe(0)

    expect(game.beginEncounter(LIVING_GLASS_ROSEBUD_ID, 57)).toBe(true)
    const events = feedHold(game, 100, LIVING_GLASS_HOLD.requiredSeconds + 0.05)
    expect(events).toContainEqual({
      type: 'break',
      id: LIVING_GLASS_ROSEBUD_ID,
      outcome: 'exit-opened',
    })
    expect(game.snapshot()).toMatchObject({
      phase: 'shattering',
      completedBreakableIds: [LIVING_GLASS_ROSEBUD_ID],
      breakables: [
        {
          id: LIVING_GLASS_ROSEBUD_ID,
          charge: 1,
          phase: 'shattering',
          brokenAt: expect.any(Number),
        },
      ],
    })
  })

  it('restores completion without replaying the release clock', () => {
    const game = createGlassGame(LIVING_GLASS_TRIAL, {
      ...SAVED_AT_ROSEBUD,
      completedBreakableIds: [LIVING_GLASS_ROSEBUD_ID],
    })
    expect(game.snapshot()).toMatchObject({
      phase: 'idle',
      completedBreakableIds: [LIVING_GLASS_ROSEBUD_ID],
      breakables: [
        {
          id: LIVING_GLASS_ROSEBUD_ID,
          charge: 1,
          phase: 'complete',
          brokenAt: null,
        },
      ],
    })
  })

  it('keeps the real exit inert until the hold is earned', () => {
    const locked = createGlassGame(LIVING_GLASS_TRIAL, SAVED_AT_ROSEBUD)
    expect(enterExit(locked).some((event) => event.type === 'complete')).toBe(
      false,
    )
    expect(locked.snapshot()).toMatchObject({
      complete: false,
      nearLockedExit: true,
    })

    const earned = createGlassGame(LIVING_GLASS_TRIAL, SAVED_AT_ROSEBUD)
    expect(earned.beginEncounter(LIVING_GLASS_ROSEBUD_ID, 57)).toBe(true)
    feedHold(earned, 0, LIVING_GLASS_HOLD.requiredSeconds + 0.05)
    for (
      let elapsed = 0;
      elapsed <= SHATTER_LIFECYCLE_SECONDS + MOVEMENT.fixedStep;
      elapsed += MOVEMENT.fixedStep
    )
      earned.step(IDLE, MOVEMENT.fixedStep)
    const exitEvents = enterExit(earned)
    expect(exitEvents).toContainEqual({ type: 'complete' })
    expect(earned.snapshot().complete).toBe(true)
  })
})
