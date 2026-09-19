// Camera movement regression — heading follow stays smooth without steering the player.
import { BoxGeometry, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, Vector3, } from 'three'
import { describe, expect, it } from 'vitest'
import { GLASS_FOUNDATION_STRAIGHT } from '../content/foundation-routes'
import { GLASSWORKS } from '../content/glassworks'
import type { GameSnapshot, LevelDefinition } from '../contracts'
import { createGlassGame } from '../core/game'
import { cameraRelativeMovement, createAdventureCamera } from './camera'
import type { MuseumMaterials } from './materials'
import { createMuseum } from './museum'

const FRAME = 1 / 60
const FOUNDATION_FIRST_ENCOUNTER =
  'glass-foundation/straight/arrival/encounter/arrival-goblet'
const OPEN_ROOM: LevelDefinition = {
  id: 'camera-open-room',
  title: 'Camera open room',
  spawn: { position: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
  platforms: [
    {
      id: 'room',
      minX: -20,
      maxX: 20,
      minZ: -20,
      maxZ: 20,
      top: 0,
      thickness: 0.4,
      kind: 'deck',
      material: 'stone',
    },
  ],
  checkpoints: [
    {
      id: 'arrival',
      position: { x: 0, y: 0, z: 0 },
      radius: 1,
      facingYaw: Math.PI,
    },
  ],
  breakables: [],
  exit: {
    minX: 18,
    maxX: 19,
    minZ: 18,
    maxZ: 19,
    top: 0,
    requiresCompleted: [],
  },
  fallBelow: -2,
}

function withMotion(
  snapshot: GameSnapshot,
  facingYaw: number,
  options: {
    paused?: boolean
    phase?: GameSnapshot['phase']
    speed?: number
  } = {},
): GameSnapshot {
  const speed = options.speed ?? 1
  return {
    ...snapshot,
    paused: options.paused ?? false,
    phase: options.phase ?? 'idle',
    player: {
      ...snapshot.player,
      facingYaw,
      velocity: {
        ...snapshot.player.velocity,
        x: -Math.sin(facingYaw) * speed,
        z: -Math.cos(facingYaw) * speed,
      },
    },
  }
}

function updateFor(
  rig: ReturnType<typeof createAdventureCamera>,
  snapshot: GameSnapshot,
  seconds: number,
): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += FRAME)
    rig.update(snapshot, FRAME)
}

function angleError(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

function createTestMaterials(): MuseumMaterials {
  return Object.fromEntries(
    ['marble', 'teal', 'limestone', 'gold', 'rock', 'glass'].map((id) => [
      id,
      new MeshPhysicalMaterial(),
    ]),
  ) as MuseumMaterials
}

describe('camera-relative traversal', () => {
  it('moves away from the camera at all cardinal headings', () => {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const forward = cameraRelativeMovement(0, 1, yaw)
      expect(forward.moveX).toBeCloseTo(-Math.sin(yaw))
      expect(forward.moveZ).toBeCloseTo(-Math.cos(yaw))
      const right = cameraRelativeMovement(1, 0, yaw)
      expect(
        right.moveX * forward.moveX + right.moveZ * forward.moveZ,
      ).toBeCloseTo(0)
    }
  })
  it('caps diagonals without losing analog stick magnitude', () => {
    const diagonal = cameraRelativeMovement(1, 1, 0.7)
    expect(Math.hypot(diagonal.moveX, diagonal.moveZ)).toBeCloseTo(1)
    const analog = cameraRelativeMovement(0.2, 0.1, 0.7)
    expect(Math.hypot(analog.moveX, analog.moveZ)).toBeCloseTo(
      Math.hypot(0.2, 0.1),
    )
  })
  it('follows the moving heading by the shortest turn without changing the movement reference', () => {
    const rig = createAdventureCamera(GLASSWORKS)
    rig.setMovementActive(true)
    const start = GLASSWORKS.spawn.facingYaw
    const facingAcrossWrap = -Math.PI + 0.24
    const moving = withMotion(
      createGlassGame(GLASSWORKS).snapshot(),
      facingAcrossWrap,
    )

    rig.update(moving, FRAME)
    expect(rig.yaw()).toBeGreaterThan(start)
    expect(rig.movementYaw()).toBe(start)
    updateFor(rig, moving, 1.5)
    expect(Math.abs(angleError(rig.yaw(), facingAcrossWrap))).toBeLessThan(0.01)
    expect(rig.movementYaw()).toBe(start)

    rig.setMovementActive(false)
    rig.update(withMotion(moving, facingAcrossWrap, { speed: 0 }), FRAME)
    expect(rig.movementYaw()).toBe(rig.yaw())
  })
  it('keeps manual orbit until its quiet window expires and movement resumes', () => {
    const rig = createAdventureCamera(GLASSWORKS)
    const moving = withMotion(createGlassGame(GLASSWORKS).snapshot(), 0)
    rig.setMovementActive(true)
    rig.setOrbitActive(true)
    rig.orbit(-0.7, 0.2)
    const chosenYaw = rig.yaw()

    updateFor(rig, moving, 2.5)
    expect(rig.yaw()).toBeCloseTo(chosenYaw)
    expect(rig.movementYaw()).toBeCloseTo(chosenYaw)
    rig.setOrbitActive(false)
    updateFor(rig, moving, 1.5)
    expect(rig.yaw()).toBeCloseTo(chosenYaw)
    updateFor(rig, moving, 0.5)
    expect(
      Math.abs(angleError(rig.yaw(), moving.player.facingYaw)),
    ).toBeLessThan(Math.abs(angleError(chosenYaw, moving.player.facingYaw)))

    rig.orbit(0.35, 0)
    expect(rig.movementYaw()).toBeCloseTo(rig.yaw())
    const secondOrbit = rig.yaw()
    updateFor(rig, moving, 1)
    expect(rig.yaw()).toBeCloseTo(secondOrbit)
  })
  it('keeps a sustained camera-relative direction straight after follow resumes', () => {
    const game = createGlassGame(OPEN_ROOM)
    const rig = createAdventureCamera(OPEN_ROOM)
    rig.setMovementActive(true)
    const start = game.snapshot().player.position

    for (let frame = 0; frame < 180; frame++) {
      const movement = cameraRelativeMovement(1, 0, rig.movementYaw())
      game.step({ ...movement, jumpDown: false }, FRAME)
      rig.update(game.snapshot(), FRAME)
    }

    const end = game.snapshot().player.position
    expect(start.x - end.x).toBeGreaterThan(2.5)
    expect(end.z).toBeCloseTo(start.z, 4)
    expect(Math.abs(angleError(rig.yaw(), Math.PI / 2))).toBeLessThan(0.01)
    expect(rig.movementYaw()).toBe(OPEN_ROOM.spawn.facingYaw)
  })
  it('keeps the movement basis through a blocked stop until input releases', () => {
    const rig = createAdventureCamera(GLASSWORKS)
    const state = createGlassGame(GLASSWORKS).snapshot()
    const moving = withMotion(state, Math.PI / 2)
    rig.setMovementActive(true)
    updateFor(rig, moving, 1.5)
    expect(rig.movementYaw()).toBe(GLASSWORKS.spawn.facingYaw)

    updateFor(rig, withMotion(moving, Math.PI / 2, { speed: 0 }), 2)
    expect(rig.movementYaw()).toBe(GLASSWORKS.spawn.facingYaw)
    rig.setMovementActive(false)
    expect(rig.movementYaw()).toBe(rig.yaw())
  })
  it('stays quiet while idle, paused or in an encounter', () => {
    const state = createGlassGame(GLASSWORKS).snapshot()
    for (const snapshot of [
      withMotion(state, 0, { speed: 0 }),
      withMotion(state, 0, { paused: true }),
      withMotion(state, 0, { phase: 'listening' }),
    ]) {
      const rig = createAdventureCamera(GLASSWORKS)
      rig.setMovementActive(true)
      updateFor(rig, snapshot, 2.5)
      expect(rig.yaw()).toBe(GLASSWORKS.spawn.facingYaw)
    }
  })
  it('leaves automatic rotation off for reduced motion while retaining manual camera control', () => {
    const rig = createAdventureCamera(GLASSWORKS, { reducedMotion: true })
    const moving = withMotion(createGlassGame(GLASSWORKS).snapshot(), 0)
    rig.setMovementActive(true)
    updateFor(rig, moving, 2.5)
    expect(rig.yaw()).toBe(GLASSWORKS.spawn.facingYaw)
    rig.orbit(0.4, 0)
    expect(rig.yaw()).toBeCloseTo(GLASSWORKS.spawn.facingYaw + 0.4)
    expect(rig.movementYaw()).toBeCloseTo(rig.yaw())
  })
  it('bounds a long resume frame and a teleported target without snapping heading', () => {
    const rig = createAdventureCamera(GLASSWORKS)
    const state = createGlassGame(GLASSWORKS).snapshot()
    const teleported = withMotion(
      {
        ...state,
        player: {
          ...state.player,
          position: { x: 12, y: 0, z: -9 },
        },
      },
      0,
    )
    const start = rig.yaw()

    rig.setMovementActive(true)
    rig.update({ ...teleported, paused: true }, 30)
    expect(rig.yaw()).toBe(start)
    rig.update(teleported, 30)
    expect(Math.abs(rig.yaw() - start)).toBeCloseTo(2.8 * 0.05)
    const target = new Vector3(12, 0.42, -9)
    expect(rig.camera.position.distanceTo(target)).toBeCloseTo(4)
  })
  it('recenters heading without discarding the chosen pitch or zoom', () => {
    const rig = createAdventureCamera(GLASSWORKS)
    const state = createGlassGame(GLASSWORKS).snapshot()
    const target = new Vector3()
      .copy(state.player.position)
      .add(new Vector3(0, 0.42, 0))
    rig.orbit(0.7, 0.2)
    rig.zoom(1)
    rig.update(state, FRAME)
    const chosenHeight = rig.camera.position.y - target.y
    rig.recenter()
    rig.update(state, FRAME)
    expect(rig.yaw()).toBeCloseTo(GLASSWORKS.spawn.facingYaw)
    expect(rig.movementYaw()).toBeCloseTo(rig.yaw())
    expect(rig.camera.position.distanceTo(target)).toBeCloseTo(5)
    expect(rig.camera.position.y - target.y).toBeCloseTo(chosenHeight)
  })
  it('retracts before actual museum geometry and restores the free orbit after it clears', () => {
    const rig = createAdventureCamera(GLASSWORKS)
    const state = createGlassGame(GLASSWORKS).snapshot()
    const target = new Vector3()
      .copy(state.player.position)
      .add(new Vector3(0, 0.42, 0))
    const wall = new Mesh(new BoxGeometry(2, 3, 0.3), new MeshBasicMaterial())
    wall.position.set(1.2, 1, -0.5)
    wall.updateMatrixWorld()
    rig.setOccluders([wall])
    rig.update(state, 1 / 60)
    expect(rig.camera.position.distanceTo(target)).toBeLessThan(2)
    expect(rig.camera.position.z).toBeGreaterThan(-0.35)
    rig.setOccluders([])
    rig.update(state, 1 / 60)
    expect(rig.camera.position.distanceTo(target)).toBeCloseTo(4)
    wall.geometry.dispose()
    wall.material.dispose()
  })
  it('lifts a wall-compressed boom while preserving the chosen pitch', () => {
    const rig = createAdventureCamera(GLASSWORKS)
    const state = createGlassGame(GLASSWORKS).snapshot()
    const target = new Vector3()
      .copy(state.player.position)
      .add(new Vector3(0, 0.42, 0))
    const chosenPitch = 0.54
    rig.orbit(0, chosenPitch - 0.36)
    const wall = new Mesh(
      new BoxGeometry(2, 1.75, 0.3),
      new MeshBasicMaterial(),
    )
    wall.position.set(target.x, 0.875, target.z - 0.55)
    wall.updateMatrixWorld()
    rig.setOccluders([wall])

    rig.update(state, FRAME)
    const liftedHeight = rig.camera.position.y - target.y
    expect(rig.camera.position.distanceTo(target)).toBeGreaterThan(3.5)
    expect(liftedHeight).toBeGreaterThan(3.5)

    // Clearance inside the hysteresis band must not immediately drop the view.
    wall.position.z = target.z - 1.2
    wall.updateMatrixWorld()
    rig.update(state, FRAME)
    expect(rig.camera.position.y - target.y).toBeGreaterThan(3.5)

    rig.setOccluders([])
    rig.update(state, FRAME)
    const easingHeight = rig.camera.position.y - target.y
    expect(easingHeight).toBeLessThan(liftedHeight)
    expect(easingHeight).toBeGreaterThan(4 * Math.sin(chosenPitch) + 0.5)
    updateFor(rig, state, 1)
    expect(rig.camera.position.distanceTo(target)).toBeCloseTo(4)
    expect(rig.camera.position.y - target.y).toBeCloseTo(
      4 * Math.sin(chosenPitch),
      2,
    )

    wall.geometry.dispose()
    wall.material.dispose()
  })
  it('keeps Merc readable at the authored straight exit wall', () => {
    const materials = createTestMaterials()
    const museum = createMuseum(GLASS_FOUNDATION_STRAIGHT, materials)
    const snapshot = createGlassGame(GLASS_FOUNDATION_STRAIGHT, {
      version: 1,
      levelId: GLASS_FOUNDATION_STRAIGHT.id,
      checkpointId: 'glass-foundation/straight/gallery/checkpoint/entry',
      completedBreakableIds: [FOUNDATION_FIRST_ENCOUNTER],
    }).snapshot()
    const exitPose: GameSnapshot = {
      ...snapshot,
      player: {
        ...snapshot.player,
        position: { x: 0, y: 0, z: 8.3 },
        facingYaw: 0,
        velocity: { x: 0, y: 0, z: 0 },
      },
    }
    museum.update(exitPose)
    const rig = createAdventureCamera(GLASS_FOUNDATION_STRAIGHT)
    rig.orbit(-Math.PI, 0)
    rig.setOccluders(museum.cameraOccluders())
    rig.update(exitPose, FRAME)
    const target = new Vector3(0, 0.42, 8.3)

    expect(rig.camera.position.distanceTo(target)).toBeGreaterThan(3.5)
    expect(rig.camera.position.y - target.y).toBeGreaterThan(3)

    museum.materialLibrary.dispose()
    Object.values(materials).forEach((material) => material.dispose())
  })
})
