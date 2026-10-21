// Archive Hush route tests — reachable intact displays, ordered protection doors and a walkable escape.
import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { GameEvent, GlassGame, MovementInput } from '../contracts'
import { createGlassGame } from '../core/game'
import { MOVEMENT } from '../core/movement'
import { createAdventureCamera } from '../render/camera'
import { getBreakableRenderRecipe } from '../render/catalog'
import { ARCHIVE_HUSH_DISPLAYS, ARCHIVE_HUSH_LEVEL_ID, ARCHIVE_HUSH_ROOMS, GLASS_ARCHIVE_HUSH, } from './archive-hush-room'
import { GLASS_UNBROKEN_ARCHIVE } from './unbroken-archive'

const idle: MovementInput = { moveX: 0, moveZ: 0, jumpDown: false }
const displays = ARCHIVE_HUSH_ROOMS[0]!.vesselIds.map(
  (id) => GLASS_ARCHIVE_HUSH.breakables.find((target) => target.id === id)!,
)

function step(game: GlassGame, input = idle, frames = 24): GameEvent[] {
  const events: GameEvent[] = []
  for (let frame = 0; frame < frames; frame++)
    events.push(...game.step(input, MOVEMENT.fixedStep))
  expect(events.some((event) => event.type === 'respawn')).toBe(false)
  return events
}

function walkTo(game: GlassGame, axis: 'x' | 'z', destination: number): void {
  const direction = Math.sign(
    destination - game.snapshot().player.position[axis],
  )
  for (
    let frame = 0;
    frame < 600 &&
    direction * (destination - game.snapshot().player.position[axis]) > 0;
    frame++
  ) {
    step(
      game,
      {
        ...idle,
        moveX: axis === 'x' ? direction : 0,
        moveZ: axis === 'z' ? direction : 0,
      },
      1,
    )
  }
  expect(
    Math.abs(destination - game.snapshot().player.position[axis]),
  ).toBeLessThan(0.08)
  step(game)
}

describe('Archive Hush first room', () => {
  it('uses registered existing glassware for every room display', () => {
    for (const display of GLASS_ARCHIVE_HUSH.breakables) {
      const recipe = getBreakableRenderRecipe(display.variant)
      expect(recipe.bundle).toBeTruthy()
      expect(recipe.intactNode).toBeTruthy()
      expect(recipe.displayHeight).toBeGreaterThan(0)
    }
  })

  it('keeps three existing vessels and progress identity separate from the awakening route', () => {
    expect(GLASS_ARCHIVE_HUSH.id).toBe(ARCHIVE_HUSH_LEVEL_ID)
    expect(GLASS_ARCHIVE_HUSH.id).not.toBe(GLASS_UNBROKEN_ARCHIVE.id)
    expect(displays.map((display) => display.variant)).toEqual([
      'goblet',
      'g01-sunlit-diadem',
      'vase',
    ])
    expect(displays.map((display) => display.id)).toEqual(
      ARCHIVE_HUSH_DISPLAYS.map(
        (display) => `${ARCHIVE_HUSH_LEVEL_ID}/diadem/encounter/${display.id}`,
      ),
    )
    expect(GLASS_ARCHIVE_HUSH.checkpoints).toHaveLength(3)
    expect(GLASS_ARCHIVE_HUSH.exit.requiresCompleted).toHaveLength(12)
    const oldSave = createGlassGame(GLASS_UNBROKEN_ARCHIVE).saveProgress()
    const hush = createGlassGame(GLASS_ARCHIVE_HUSH, {
      ...oldSave,
      finished: true,
    })
    expect(hush.snapshot().complete).toBe(false)
    expect(hush.saveProgress().completedBreakableIds).toEqual([])
  })

  it('allows a grounded walk to every display without entering a plinth or cabinet', () => {
    for (const display of displays) {
      const game = createGlassGame(GLASS_ARCHIVE_HUSH)
      step(game)
      walkTo(game, 'x', display.anchor.x)
      walkTo(game, 'z', display.anchor.z)
      expect(game.snapshot().nearbyBreakableId).toBeNull()
      expect(game.beginEncounter(display.id, 57)).toBe(false)
      expect(game.snapshot().player.grounded).toBe(true)
      expect(game.snapshot().player.position.y).toBeCloseTo(0)
      const events = step(game, { ...idle, moveZ: 1 }, 180)
      expect(game.snapshot().player.position.z).toBeLessThan(
        display.position.z - 0.42,
      )
      expect(game.snapshot().player.position.z).toBeGreaterThan(
        display.anchor.z,
      )
      expect(game.snapshot().player.position.y).toBeCloseTo(0)
      expect(
        events.some(
          (event) => event.type === 'awaken' || event.type === 'break',
        ),
      ).toBe(false)
    }
  })

  it.each([-1, 1])(
    'backs the %s side cabinet with contact before the shelves',
    (direction) => {
      const game = createGlassGame(GLASS_ARCHIVE_HUSH)
      step(game, { ...idle, moveX: direction }, 360)
      const player = game.snapshot().player
      expect(Math.abs(player.position.x)).toBeGreaterThan(3.4)
      expect(Math.abs(player.position.x)).toBeLessThanOrEqual(
        3.72 - MOVEMENT.radius + 0.001,
      )
      expect(player.grounded).toBe(true)
      expect(player.position.y).toBeCloseTo(0)
    },
  )

  it.each([-1, 1])(
    'stops a grounded approach before the %s rear display shelves',
    (direction) => {
      for (const level of [GLASS_ARCHIVE_HUSH, GLASS_UNBROKEN_ARCHIVE]) {
        const game = createGlassGame(level)
        step(game)
        walkTo(game, 'x', direction * 2.85)
        step(game, { ...idle, moveZ: 1 }, 360)
        const player = game.snapshot().player
        expect(player.position.z).toBeGreaterThan(3.4)
        expect(player.position.z + MOVEMENT.radius).toBeLessThanOrEqual(
          3.94 + 0.001,
        )
        expect(player.grounded).toBe(true)
        expect(player.position.y).toBeCloseTo(0)
        expect(
          game
            .snapshot()
            .breakables.every((target) => target.brokenAt === null),
        ).toBe(true)
      }
    },
  )

  it.each([
    [390, 844],
    [844, 390],
    [820, 1180],
  ])(
    'keeps the entry body clear of the camera at %s by %s',
    (width, height) => {
      const game = createGlassGame(GLASS_ARCHIVE_HUSH)
      step(game)
      const snapshot = game.snapshot()
      const rig = createAdventureCamera(GLASS_ARCHIVE_HUSH)
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
      for (const x of [-0.3, 0.3])
        for (const y of [0, 0.6])
          for (const z of [-0.2, 0.2]) {
            const point = new Vector3(
              player.x + x,
              player.y + y,
              player.z + z,
            ).project(rig.camera)
            expect(Math.abs(point.x)).toBeLessThan(0.8)
            expect(Math.abs(point.y)).toBeLessThan(0.8)
          }
    },
  )

  it('keeps each room and curtain group in the same canonical display order', () => {
    expect(ARCHIVE_HUSH_ROOMS.map((room) => room.id)).toEqual([
      'diadem',
      'tide',
      'lotus',
    ])
    expect(ARCHIVE_HUSH_ROOMS.map((room) => room.vesselIds.length)).toEqual([
      3, 4, 5,
    ])
    expect(
      ARCHIVE_HUSH_ROOMS.map((room) => room.curtainVesselIds.length),
    ).toEqual([0, 1, 2])
    const ids = ARCHIVE_HUSH_ROOMS.flatMap((room) => room.vesselIds)
    expect(new Set(ids).size).toBe(12)
    expect([...ids].sort()).toEqual(
      GLASS_ARCHIVE_HUSH.breakables.map((target) => target.id).sort(),
    )
    for (const room of ARCHIVE_HUSH_ROOMS) {
      expect(room.curtainVesselIds).toEqual(room.vesselIds.slice(2, -1))
      for (const id of room.curtainVesselIds) {
        const target = GLASS_ARCHIVE_HUSH.breakables.find(
          (item) => item.id === id,
        )!
        expect(target.position.x).toBe(2.7)
        expect(target.position.z).toBeGreaterThan(room.centerZ + 1)
      }
    }
    expect(GLASS_ARCHIVE_HUSH.exit.minZ).toBeGreaterThan(
      ARCHIVE_HUSH_ROOMS[2]!.centerZ + 8,
    )
  })

  it('walks all three protected doors and finishes only at the end of the final passage', () => {
    const game = createGlassGame(GLASS_ARCHIVE_HUSH)
    step(game)
    const events: GameEvent[] = []
    const completed: string[] = []
    for (const [index, room] of ARCHIVE_HUSH_ROOMS.entries()) {
      if (index > 0) walkTo(game, 'z', room.centerZ - 2.2)
      expect(game.saveProgress().checkpointId).toBe(
        `${ARCHIVE_HUSH_LEVEL_ID}/${room.id}/checkpoint/entry`,
      )
      walkTo(game, 'x', -2.25)
      walkTo(game, 'z', room.centerZ + 3.2)
      walkTo(game, 'x', 0)
      const gateId = `${ARCHIVE_HUSH_LEVEL_ID}/${room.id}/solid/north-gate-body`
      expect(game.snapshot().activeSolidIds).toContain(gateId)
      step(game, { ...idle, moveZ: 1 }, 120)
      expect(game.snapshot().player.position.z).toBeLessThan(room.centerZ + 4.3)
      expect(game.snapshot().complete).toBe(false)
      expect(game.completeProtectionRoom(room.id)).toBe(true)
      expect(game.completeProtectionRoom(room.id)).toBe(false)
      completed.push(...room.vesselIds)
      expect(game.saveProgress().completedBreakableIds).toEqual(completed)
      expect(game.snapshot().activeSolidIds).not.toContain(gateId)
      expect(game.snapshot().complete).toBe(false)
      expect(
        game.snapshot().breakables.every((target) => target.brokenAt === null),
      ).toBe(true)
    }
    events.push(...step(game, { ...idle, moveZ: 1 }, 360))
    expect(events.filter((event) => event.type === 'complete')).toHaveLength(1)
    expect(
      events.some((event) => event.type === 'break' || event.type === 'awaken'),
    ).toBe(false)
    expect(game.snapshot().player.position.z).toBeGreaterThan(
      GLASS_ARCHIVE_HUSH.exit.minZ,
    )
    expect(game.snapshot().complete).toBe(true)
    expect(game.saveProgress().finished).toBe(true)
    expect(
      createGlassGame(GLASS_ARCHIVE_HUSH, game.saveProgress()).snapshot()
        .complete,
    ).toBe(true)
  })

  it('reaches every later curtain pad without entering a display or leaving the floor', () => {
    for (const [index, room] of ARCHIVE_HUSH_ROOMS.entries()) {
      for (const id of room.curtainVesselIds) {
        const game = createGlassGame(GLASS_ARCHIVE_HUSH, {
          version: 2,
          levelId: ARCHIVE_HUSH_LEVEL_ID,
          checkpointId: `${ARCHIVE_HUSH_LEVEL_ID}/${room.id}/checkpoint/entry`,
          completedBreakableIds: ARCHIVE_HUSH_ROOMS.slice(0, index).flatMap(
            (prior) => prior.vesselIds,
          ),
        })
        const target = GLASS_ARCHIVE_HUSH.breakables.find(
          (item) => item.id === id,
        )!
        step(game)
        walkTo(game, 'x', -2.25)
        walkTo(game, 'z', room.centerZ + 3.3)
        walkTo(game, 'x', target.anchor.x)
        walkTo(game, 'z', target.anchor.z)
        expect(game.snapshot().player.grounded).toBe(true)
        expect(game.snapshot().player.position.y).toBeCloseTo(0)
        expect(game.beginEncounter(id, 57)).toBe(false)
      }
    }
  })
})
