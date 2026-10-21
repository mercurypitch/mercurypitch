// Unbroken Archive tests — earn every intact exhibit, traverse both gates and restore the route without shattering.

import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { GameEvent, GlassGame, MovementInput, PitchTargets, } from '../contracts'
import { createGlassGame } from '../core/game'
import { MOVEMENT } from '../core/movement'
import { createAdventureCamera } from '../render/camera'
import { GLASS_ENCLOSED_CHAMBER } from './enclosed-chamber'
import { GLASS_UNBROKEN_ARCHIVE, UNBROKEN_ARCHIVE_ROUTE, } from './unbroken-archive'

const prefix = 'glassworks-unbroken-archive/archive-awakening'
const idle: MovementInput = { moveX: 0, moveZ: 0, jumpDown: false }
const exhibits = [
  { room: 'diadem', name: 'sunlit-diadem', z: UNBROKEN_ARCHIVE_ROUTE.diadem },
  { room: 'tide', name: 'tidal-wave', z: UNBROKEN_ARCHIVE_ROUTE.tide },
  { room: 'lotus', name: 'aurora-lotus', z: UNBROKEN_ARCHIVE_ROUTE.lotus },
] as const

function settle(game: GlassGame): void {
  for (let frame = 0; frame < 24; frame++) game.step(idle, MOVEMENT.fixedStep)
}

function walkAxis(game: GlassGame, axis: 'x' | 'z', destination: number): void {
  const direction = Math.sign(
    destination - game.snapshot().player.position[axis],
  )
  const input = {
    ...idle,
    moveX: axis === 'x' ? direction : 0,
    moveZ: axis === 'z' ? direction : 0,
  }
  for (
    let frame = 0;
    frame < 2400 &&
    direction * (destination - game.snapshot().player.position[axis]) > 0;
    frame++
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
  settle(game)
}

function awaken(
  game: GlassGame,
  id: string,
  outcome: 'path-opened' | 'exit-opened',
  targets: number | PitchTargets = 57,
  targetMidi = 57,
): void {
  expect(game.snapshot().nearbyBreakableId).toBe(id)
  expect(game.beginEncounter(id, targets)).toBe(true)
  expect(game.snapshot().activeEncounter?.targetMidi).toBe(targetMidi)
  const events: GameEvent[] = []
  for (let sequence = 0; sequence <= 48; sequence++) {
    const capturedAtMs = sequence * 25
    events.push(
      ...game.feedPitch(
        {
          sequence,
          capturedAtMs,
          captureSeconds: capturedAtMs / 1000,
          midi: targetMidi,
          confidence: 0.9,
        },
        capturedAtMs,
      ),
    )
  }
  expect(events).toContainEqual({ type: 'awaken', id, outcome })
  expect(events.some((event) => event.type === 'break')).toBe(false)
  expect(game.snapshot().phase).toBe('idle')
  expect(
    game.snapshot().breakables.find((target) => target.id === id)?.brokenAt,
  ).toBeNull()
}

describe('Unbroken Archive', () => {
  it('uses three existing mounted glassware models and separate progress identity', () => {
    expect(GLASS_UNBROKEN_ARCHIVE.id).toBe(prefix)
    expect(GLASS_UNBROKEN_ARCHIVE.id).not.toBe(GLASS_ENCLOSED_CHAMBER.id)
    expect(
      GLASS_UNBROKEN_ARCHIVE.breakables.map((target) => target.variant).sort(),
    ).toEqual([
      'g01-sunlit-diadem',
      'g14-tidal-wave-carafe',
      'g22-aurora-lotus-bowl',
    ])
    for (const target of GLASS_UNBROKEN_ARCHIVE.breakables) {
      expect(target.completion).toBe('awaken')
      expect(target.mount?.kind).toBe('plinth')
      expect(target.challenge).toMatchObject({
        kind: 'hold',
        step: {
          target: 'comfortable',
          archiveNoteDegree: exhibits.findIndex((exhibit) =>
            target.id.endsWith(`/encounter/${exhibit.name}`),
          ),
        },
      })
    }
    expect(GLASS_UNBROKEN_ARCHIVE.guidance?.tutorial?.id).toBe(
      'unbroken-archive-awakening',
    )
  })

  it('backs only the first room cabinets with floor-to-shelf contact', () => {
    const cabinets =
      GLASS_UNBROKEN_ARCHIVE.solids?.filter(
        (solid) =>
          solid.id.includes('archive-') && solid.id.endsWith('-cabinet'),
      ) ?? []
    expect(cabinets).toHaveLength(4)
    for (const cabinet of cabinets) {
      expect(cabinet.id).toContain('/diadem/solid/')
      expect(cabinet).toMatchObject({
        shape: 'box',
        top: 3.1,
        thickness: 3.1,
        minZ: cabinet.id.includes('archive-north-') ? 3.94 : -3.8,
        maxZ: cabinet.id.includes('archive-north-') ? 4.44 : 3.8,
      })
    }
  })

  it('leaves camera room behind every entry checkpoint in both phone orientations', () => {
    for (const [index, exhibit] of exhibits.entries()) {
      const game = createGlassGame(GLASS_UNBROKEN_ARCHIVE, {
        version: 2,
        levelId: prefix,
        checkpointId: `${prefix}/${exhibit.room}/checkpoint/entry`,
        completedBreakableIds: exhibits
          .slice(0, index)
          .map(
            (previous) =>
              `${prefix}/${previous.room}/encounter/${previous.name}`,
          ),
        finished: false,
      })
      settle(game)
      const snapshot = game.snapshot()
      expect(snapshot.nearbyBreakableId).toBeNull()
      for (const [width, height] of [
        [390, 844],
        [844, 390],
      ] as const) {
        const rig = createAdventureCamera(GLASS_UNBROKEN_ARCHIVE)
        rig.camera.aspect = width / height
        rig.camera.updateProjectionMatrix()
        for (let frame = 0; frame < 180; frame++)
          rig.update(snapshot, MOVEMENT.fixedStep)
        rig.camera.updateMatrixWorld()
        const player = snapshot.player.position
        expect(
          Math.hypot(
            rig.camera.position.x - player.x,
            rig.camera.position.z - player.z,
          ),
        ).toBeGreaterThan(2)
        // A 60 cm body envelope must stay readable with room around it after entry or reload.
        const projected = [-0.3, 0.3].flatMap((x) =>
          [0, 0.6].flatMap((y) =>
            [-0.2, 0.2].map((z) =>
              new Vector3(player.x + x, player.y + y, player.z + z).project(
                rig.camera,
              ),
            ),
          ),
        )
        expect(
          Math.max(...projected.map((point) => point.x)) -
            Math.min(...projected.map((point) => point.x)),
        ).toBeLessThan(1.3)
        expect(
          Math.max(...projected.map((point) => point.y)) -
            Math.min(...projected.map((point) => point.y)),
        ).toBeLessThan(0.65)
        for (const point of projected) {
          expect(Math.abs(point.x)).toBeLessThan(0.8)
          expect(Math.abs(point.y)).toBeLessThan(0.8)
        }
      }
    }
  })

  it('opens both room gates, earns all three targets and walks to the exit with every vessel intact', () => {
    const game = createGlassGame(GLASS_UNBROKEN_ARCHIVE)
    const firstGate = `${prefix}/diadem/solid/north-gate-body`
    const secondGate = `${prefix}/tide/solid/north-gate-body`
    expect(game.snapshot().activeSolidIds).toEqual(
      expect.arrayContaining([firstGate, secondGate]),
    )
    expect(game.beginEncounter(`${prefix}/tide/encounter/tidal-wave`, 57)).toBe(
      false,
    )

    for (const [index, exhibit] of exhibits.entries()) {
      walkAxis(game, 'z', exhibit.z - 0.05)
      walkAxis(game, 'x', 0)
      const id = `${prefix}/${exhibit.room}/encounter/${exhibit.name}`
      awaken(
        game,
        id,
        index < 2 ? 'path-opened' : 'exit-opened',
        { comfortable: 57, low: 50, high: 70 },
        [57, 61, 64][index]!,
      )
      if (index === 0) {
        expect(game.snapshot().activeSolidIds).not.toContain(firstGate)
        expect(game.snapshot().activeSolidIds).toContain(secondGate)
      }
      if (index === 1)
        expect(game.snapshot().activeSolidIds).not.toContain(secondGate)
      // Walk around the collision-backed display before entering the passage.
      walkAxis(game, 'x', 1)
    }
    walkAxis(game, 'z', UNBROKEN_ARCHIVE_ROUTE.lotus + 2.5)
    walkAxis(game, 'x', 0)
    for (let frame = 0; frame < 200 && !game.snapshot().complete; frame++)
      game.step({ ...idle, moveZ: 1 }, MOVEMENT.fixedStep)
    expect(game.snapshot().complete).toBe(true)
    expect(
      game.snapshot().breakables.every((target) => target.brokenAt === null),
    ).toBe(true)
    expect(game.saveProgress().completedBreakableIds).toHaveLength(3)
  })

  it('restores earned passages and intact glass at the next checkpoint', () => {
    const firstId = `${prefix}/diadem/encounter/sunlit-diadem`
    const restored = createGlassGame(GLASS_UNBROKEN_ARCHIVE, {
      version: 2,
      levelId: prefix,
      checkpointId: `${prefix}/tide/checkpoint/entry`,
      completedBreakableIds: [firstId],
      finished: false,
    })
    expect(restored.snapshot().player.position).toEqual({
      x: 0,
      y: 0,
      z: UNBROKEN_ARCHIVE_ROUTE.tide - 1.4,
    })
    expect(restored.snapshot().activeSolidIds).not.toContain(
      `${prefix}/diadem/solid/north-gate-body`,
    )
    expect(restored.snapshot().activeSolidIds).toContain(
      `${prefix}/tide/solid/north-gate-body`,
    )
    expect(
      restored.snapshot().breakables.find((target) => target.id === firstId)
        ?.brokenAt,
    ).toBeNull()
    expect(restored.beginEncounter(firstId, 57)).toBe(false)
    expect(restored.saveProgress().completedBreakableIds).toEqual([firstId])
  })
})
