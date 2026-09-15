// Game integration tests — walk the real course and preserve only earned voice success.

import { describe, expect, it } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import type { GameEvent, GlassGame, MovementInput } from '../contracts'
import { createGlassGame } from './game'
import { MOVEMENT } from './movement'

const idle: MovementInput = { moveX: 0, moveZ: 0, jumpDown: false }
const goblet = GLASSWORKS.breakables[0].id
const vase = GLASSWORKS.breakables[1].id
const hero = GLASSWORKS.breakables[2].id

function steps(game: GlassGame, count: number, input = idle): GameEvent[] {
  const events: GameEvent[] = []
  for (let n = 0; n < count; n++)
    events.push(...game.step(input, MOVEMENT.fixedStep))
  return events
}

function walkToGoblet(game: GlassGame): void {
  for (let n = 0; n < 200 && game.snapshot().player.position.z < 2.2; n++)
    game.step({ ...idle, moveZ: 1 }, MOVEMENT.fixedStep)
  game.step({ ...idle, moveZ: 1, jumpDown: true }, MOVEMENT.fixedStep)
  for (let n = 0; n < 120; n++) {
    game.step({ ...idle, moveZ: 1 }, MOVEMENT.fixedStep)
    if (
      game.snapshot().player.grounded &&
      game.snapshot().player.position.z > 2.7
    )
      break
  }
  steps(game, 24)
  expect(game.snapshot().nearbyBreakableId).toBe(goblet)
}

function sing(game: GlassGame): GameEvent[] {
  const events: GameEvent[] = []
  for (let n = 0; n <= 48; n++)
    events.push(
      ...game.feedPitch(
        {
          sequence: n,
          captureSeconds: n * 0.025,
          capturedAtMs: n * 25,
          confidence: 0.9,
          midi: 57,
        },
        n * 25,
      ),
    )
  return events
}

function walkAxis(
  game: GlassGame,
  axis: 'x' | 'z',
  destination: number,
  settle = true,
): void {
  const direction = Math.sign(
    destination - game.snapshot().player.position[axis],
  )
  const input = {
    ...idle,
    moveX: axis === 'x' ? direction : 0,
    moveZ: axis === 'z' ? direction : 0,
  }
  for (
    let n = 0;
    n < 2000 &&
    direction * (destination - game.snapshot().player.position[axis]) > 0;
    n++
  ) {
    expect(
      game
        .step(input, MOVEMENT.fixedStep)
        .some((event) => event.type === 'respawn'),
    ).toBe(false)
  }
  expect(
    direction * (destination - game.snapshot().player.position[axis]),
  ).toBeLessThanOrEqual(0)
  if (settle) steps(game, 24)
}

function jumpSouth(game: GlassGame): void {
  game.step({ ...idle, moveZ: -1, jumpDown: true }, MOVEMENT.fixedStep)
  for (let n = 0; n < 120 && !game.snapshot().player.grounded; n++) {
    expect(
      game
        .step({ ...idle, moveZ: -1 }, MOVEMENT.fixedStep)
        .some((event) => event.type === 'respawn'),
    ).toBe(false)
  }
  expect(game.snapshot().player.grounded).toBe(true)
  steps(game, 24)
}

describe('Glassworks simulation', () => {
  it('starts with closed progression bridges and no active voice', () => {
    const game = createGlassGame(GLASSWORKS)
    expect(game.snapshot().enabledPlatformIds).not.toContain('arch-bridge')
    expect(game.snapshot().enabledPlatformIds).not.toContain('hero-bridge')
    expect(game.snapshot().activeEncounter).toBeNull()
    expect(game.beginEncounter(goblet, 57)).toBe(false)
    expect(sing(game)).toEqual([])
    expect(game.saveProgress().completedBreakableIds).toEqual([])
  })

  it('walks and jumps to the first voice-only encounter, parks movement, and saves before shatter', () => {
    const game = createGlassGame(GLASSWORKS)
    walkToGoblet(game)
    const parked = game.snapshot().player.position
    expect(game.beginEncounter(goblet, 57)).toBe(true)
    steps(game, 60, { moveX: 1, moveZ: -1, jumpDown: true })
    expect(game.snapshot().player.position).toEqual(parked)
    expect(sing(game)).toEqual([{ type: 'break', id: goblet }])
    expect(game.snapshot().phase).toBe('shattering')
    expect(game.saveProgress().completedBreakableIds).toEqual([goblet])
    expect(game.snapshot().enabledPlatformIds).toContain('arch-bridge')
    expect(game.snapshot().enabledPlatformIds).not.toContain('hero-bridge')
    expect(sing(game)).toEqual([])

    const restored = createGlassGame(GLASSWORKS, game.saveProgress())
    expect(restored.snapshot().phase).toBe('idle')
    expect(restored.snapshot().breakables[0]).toMatchObject({
      phase: 'complete',
      brokenAt: null,
    })
    expect(restored.snapshot().enabledPlatformIds).toContain('arch-bridge')
  })

  it('cancels charge on pause and does not restart from stale capture after returning', () => {
    const game = createGlassGame(GLASSWORKS)
    walkToGoblet(game)
    expect(game.beginEncounter(goblet, 57)).toBe(true)
    for (let n = 0; n <= 12; n++)
      game.feedPitch(
        {
          sequence: n,
          captureSeconds: n / 40,
          capturedAtMs: n * 25,
          confidence: 0.9,
          midi: 57,
        },
        n * 25,
      )
    expect(game.snapshot().activeEncounter?.charge).toBeGreaterThan(0)
    game.setPaused(true)
    const pausedPosition = game.snapshot().player.position
    expect(sing(game)).toEqual([])
    steps(game, 240, { ...idle, moveX: 1, jumpDown: true })
    expect(game.snapshot().player.position).toEqual(pausedPosition)
    game.setPaused(false)
    expect(game.snapshot().activeEncounter).toBeNull()
    expect(sing(game)).toEqual([])
    expect(game.saveProgress().completedBreakableIds).toEqual([])
    expect(game.beginEncounter(goblet, 57)).toBe(true)
    expect(game.snapshot().activeEncounter?.charge).toBe(0)
  })

  it('restores a checkpoint after falling without redoing earned singing', () => {
    const game = createGlassGame(GLASSWORKS)
    walkToGoblet(game)
    game.beginEncounter(goblet, 57)
    sing(game)
    steps(game, 180)
    let fell = false
    for (let n = 0; n < 600; n++) {
      if (
        game
          .step({ ...idle, moveX: 1 }, MOVEMENT.fixedStep)
          .some((event) => event.type === 'respawn')
      ) {
        fell = true
        break
      }
    }
    expect(fell).toBe(true)
    expect(game.snapshot().checkpointId).toBe('goblet')
    expect(game.snapshot().player.position).toEqual({ x: 1.2, y: 0, z: 3.15 })
    expect(game.saveProgress().completedBreakableIds).toEqual([goblet])
    expect(game.snapshot().enabledPlatformIds).toContain('arch-bridge')
  })

  it('missed first jump lands on its catch and returns to the approach', () => {
    const game = createGlassGame(GLASSWORKS)
    let respawn: GameEvent | undefined
    for (let n = 0; n < 500; n++) {
      respawn = game
        .step({ ...idle, moveZ: 1 }, MOVEMENT.fixedStep)
        .find((event) => event.type === 'respawn')
      if (respawn !== undefined) break
    }
    expect(respawn).toEqual({ type: 'respawn', checkpointId: 'jump-arrival' })
    expect(game.snapshot().player.position).toEqual({ x: 1.2, y: 0, z: 1.8 })
  })

  it('does not oscillate checkpoint events where trigger radii overlap', () => {
    const game = createGlassGame(GLASSWORKS)
    steps(game, 40, { ...idle, moveZ: 1 })
    steps(game, 24)
    expect(
      steps(game, 120).filter((event) => event.type === 'checkpoint'),
    ).toEqual([])
  })

  it('freezes an airborne arc during pause and resumes it without replaying held jump', () => {
    const game = createGlassGame(GLASSWORKS)
    steps(game, 20, { ...idle, jumpDown: true })
    const before = game.snapshot().player
    expect(before.velocity.y).toBeGreaterThan(0)
    game.setPaused(true)
    steps(game, 500, { ...idle, jumpDown: true })
    expect(game.snapshot().player.position).toEqual(before.position)
    expect(game.snapshot().player.velocity.y).toBe(before.velocity.y)
    game.setPaused(false)
    const events = steps(game, 180, { ...idle, jumpDown: true })
    expect(events.filter((event) => event.type === 'jumped')).toEqual([])
    expect(game.snapshot().player.grounded).toBe(true)
  })

  it('rejects malformed, foreign, orphaned and unknown saved progress', () => {
    for (const saved of [
      null,
      'nope',
      {
        version: 1,
        levelId: 'other',
        checkpointId: 'hero',
        completedBreakableIds: [goblet, vase],
      },
      {
        version: 1,
        levelId: GLASSWORKS.id,
        checkpointId: 'hero',
        completedBreakableIds: [hero, 'unknown'],
        finished: true,
      },
    ]) {
      const game = createGlassGame(GLASSWORKS, saved)
      expect(game.saveProgress().completedBreakableIds).toEqual([])
      expect(game.snapshot().checkpointId).toBe('arrival')
      expect(game.snapshot().complete).toBe(false)
      expect(game.snapshot().enabledPlatformIds).not.toContain('hero-bridge')
    }
  })

  it('completes at the authored exit only after all three required displays', () => {
    const saved = {
      version: 1,
      levelId: GLASSWORKS.id,
      checkpointId: 'hero',
      completedBreakableIds: [hero, vase, goblet],
    }
    const game = createGlassGame(GLASSWORKS, saved)
    for (let n = 0; n < 200 && game.snapshot().player.position.x > 5.5; n++)
      game.step({ ...idle, moveX: -1 }, MOVEMENT.fixedStep)
    steps(game, 24)
    const events: GameEvent[] = []
    for (let n = 0; n < 300 && !game.snapshot().complete; n++)
      events.push(...game.step({ ...idle, moveZ: -1 }, MOVEMENT.fixedStep))
    expect(events.filter((event) => event.type === 'complete')).toHaveLength(1)
    expect(game.snapshot().complete).toBe(true)
    expect(game.saveProgress().finished).toBe(true)
    expect(game.saveProgress().completedBreakableIds).toHaveLength(3)
    expect(
      createGlassGame(GLASSWORKS, game.saveProgress()).snapshot().complete,
    ).toBe(true)
  })

  it('traverses both opened bridges and terraces, then an optional display before exiting', () => {
    const game = createGlassGame(GLASSWORKS)
    const breakNearby = (id: string): void => {
      expect(game.beginEncounter(id, 57)).toBe(true)
      expect(sing(game)).toEqual([{ type: 'break', id }])
      steps(game, 180)
    }
    walkToGoblet(game)
    breakNearby(goblet)
    walkAxis(game, 'z', 7.5)
    walkAxis(game, 'x', 9.8)
    walkAxis(game, 'z', 7.22, false)
    jumpSouth(game)
    expect(game.snapshot().checkpointId).toBe('jump-terrace')
    walkAxis(game, 'z', 5.72, false)
    jumpSouth(game)
    walkAxis(game, 'z', 2.7)
    breakNearby(vase)
    walkAxis(game, 'x', 5.5)
    walkAxis(game, 'z', 1.8)
    breakNearby(hero)
    expect(game.snapshot().complete).toBe(false)
    walkAxis(game, 'x', 4.6)
    walkAxis(game, 'z', 4.4)
    const optional = GLASSWORKS.breakables.find((target) => target.optional)!
    breakNearby(optional.id)
    expect(game.saveProgress().completedBreakableIds).toEqual([
      goblet,
      vase,
      hero,
      optional.id,
    ])
    walkAxis(game, 'z', 1.8)
    walkAxis(game, 'x', 5.5)
    for (let n = 0; n < 300 && !game.snapshot().complete; n++)
      game.step({ ...idle, moveZ: -1 }, MOVEMENT.fixedStep)
    expect(game.snapshot().complete).toBe(true)
  })
})
