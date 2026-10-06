// Glassware terrace proof — the real movement and pitch core owns footing, individual breaks and the gated exit.

import { describe, expect, it } from 'vitest'
import type { MovementInput } from '../contracts'
import { createGlassGame } from '../core/game'
import { MOVEMENT } from '../core/movement'
import { SHATTER_PLAYBACK_SPEED, shatterLifecycleSeconds, } from '../core/shatter-presentation'
import { GLASSWARE_TRIO_STUDY } from './glassware-trio-study'
import { LIVING_GLASS_HOLD } from './living-glass-trial'

const idle: MovementInput = { moveX: 0, moveZ: 0, jumpDown: false }

function walk(
  game: ReturnType<typeof createGlassGame>,
  axis: 'x' | 'z',
  target: number,
) {
  const direction = Math.sign(target - game.snapshot().player.position[axis])
  const input = {
    ...idle,
    moveX: axis === 'x' ? direction : 0,
    moveZ: axis === 'z' ? direction : 0,
  }
  for (
    let frame = 0;
    frame < 1800 &&
    direction * (target - game.snapshot().player.position[axis]) > 0;
    frame++
  ) {
    game.step(input, MOVEMENT.fixedStep)
    expect(game.snapshot().player.position.y).toBeGreaterThan(-0.01)
  }
  for (let frame = 0; frame < 30; frame++) game.step(idle, MOVEMENT.fixedStep)
  expect(game.snapshot().player.position[axis]).toBeCloseTo(target, 0)
}

describe('glassware trio terrace', () => {
  it('reaches and sings all three exhibits without jumping or awarding a neighbouring glass', () => {
    const game = createGlassGame(GLASSWARE_TRIO_STUDY)
    walk(game, 'z', 2.7)
    const completed: string[] = []
    let sequence = 0
    for (const exhibit of GLASSWARE_TRIO_STUDY.breakables) {
      walk(game, 'x', exhibit.anchor.x)
      expect(game.snapshot().nearbyBreakableId).toBe(exhibit.id)
      expect(game.beginEncounter(exhibit.id, 57)).toBe(true)
      for (
        let frame = 0;
        frame <= Math.ceil((LIVING_GLASS_HOLD.requiredSeconds + 0.08) / 0.025);
        frame++
      ) {
        sequence++
        const now = sequence * 25
        game.feedPitch(
          {
            sequence,
            captureSeconds: now / 1000,
            capturedAtMs: now,
            midi: 57,
            confidence: 0.9,
          },
          now,
        )
      }
      completed.push(exhibit.id)
      expect(game.snapshot().completedBreakableIds).toEqual(completed)
      for (
        let elapsed = 0;
        elapsed <=
        shatterLifecycleSeconds(SHATTER_PLAYBACK_SPEED.default) +
          MOVEMENT.fixedStep;
        elapsed += MOVEMENT.fixedStep
      )
        game.step(idle, MOVEMENT.fixedStep)
      expect(game.snapshot().phase).toBe('idle')
    }
    walk(game, 'x', 1)
    walk(game, 'z', 4.7)
    walk(game, 'x', 0)
    walk(game, 'z', 4.95)
    expect(game.snapshot().complete).toBe(true)
    const restored = createGlassGame(GLASSWARE_TRIO_STUDY, game.saveProgress())
    expect(restored.snapshot().completedBreakableIds).toEqual(completed)
    expect(
      restored.snapshot().breakables.every((glass) => glass.brokenAt === null),
    ).toBe(true)
  })

  it('keeps the exit locked without pitch evidence and gives each visible mount a matching collision proxy', () => {
    const game = createGlassGame(GLASSWARE_TRIO_STUDY)
    walk(game, 'z', 2.7)
    walk(game, 'x', 1)
    walk(game, 'z', 4.7)
    walk(game, 'x', 0)
    walk(game, 'z', 4.95)
    expect(game.snapshot()).toMatchObject({
      complete: false,
      nearLockedExit: true,
      completedBreakableIds: [],
    })
    for (const exhibit of GLASSWARE_TRIO_STUDY.breakables) {
      const mount = exhibit.mount!
      expect(
        GLASSWARE_TRIO_STUDY.solids?.find(
          (solid) => solid.id === mount.solidId,
        ),
      ).toMatchObject({
        shape: 'cylinder',
        x: exhibit.position.x,
        z: exhibit.position.z,
        top: mount.height,
        thickness: mount.height,
        radiusTop: mount.radiusTop,
        radiusBottom: mount.radiusBottom,
        presentation: mount.presentation,
      })
    }
  })
})
