// Camera movement regression — heading follow stays smooth without steering the player.
import { BoxGeometry, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, Vector3, } from 'three'
import { describe, expect, it } from 'vitest'
import { GLASS_ENCLOSED_CHAMBER } from '../content/enclosed-chamber'
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

const ENCLOSED_CORNER_ROOM: LevelDefinition = {
  ...OPEN_ROOM,
  id: 'camera-enclosed-corner',
  title: 'Camera enclosed corner',
  spawn: {
    position: { x: 3.5, y: 0, z: 3.5 },
    facingYaw: Math.PI / 4,
  },
  platforms: [
    {
      id: 'enclosed-floor',
      minX: -4.266,
      maxX: 4.266,
      minZ: -4.266,
      maxZ: 4.266,
      top: 0,
      thickness: 0.25,
      kind: 'deck',
      material: 'stone',
    },
  ],
  solids: [
    {
      id: 'east-wall',
      kind: 'prop',
      shape: 'box',
      minX: 4.266,
      maxX: 4.566,
      minZ: -4.566,
      maxZ: 4.566,
      top: 3.6,
      thickness: 3.6,
      presentation: { role: 'wall', material: 'stone' },
    },
    {
      id: 'north-wall',
      kind: 'prop',
      shape: 'box',
      minX: -4.566,
      maxX: 4.566,
      minZ: 4.266,
      maxZ: 4.566,
      top: 3.6,
      thickness: 3.6,
      presentation: { role: 'wall', material: 'stone' },
    },
  ],
  checkpoints: [
    {
      id: 'corner-spawn',
      position: { x: 3.5, y: 0, z: 3.5 },
      radius: 1,
      facingYaw: Math.PI / 4,
    },
  ],
  presentation: {
    worldBounds: {
      minX: -5,
      maxX: 5,
      minY: -1,
      maxY: 4,
      minZ: -5,
      maxZ: 5,
    },
    lightBounds: {
      minX: -5,
      maxX: 5,
      minY: -1,
      maxY: 4,
      minZ: -5,
      maxZ: 5,
    },
    rooms: [
      {
        id: 'corner',
        bounds: {
          minX: -4.566,
          maxX: 4.566,
          minY: -0.25,
          maxY: 3.6,
          minZ: -4.566,
          maxZ: 4.566,
        },
        cameraBounds: {
          minX: -4.266,
          maxX: 4.266,
          minY: 0,
          maxY: 3.44,
          minZ: -4.266,
          maxZ: 4.266,
        },
      },
    ],
    audioRegions: [],
    visuals: [],
    assetRecipeIds: [],
  },
}

const NARROW_CORNER_HALF_WIDTH = 1.420_108
const NARROW_CORNER_ROOM: LevelDefinition = {
  ...ENCLOSED_CORNER_ROOM,
  id: 'camera-narrow-corner',
  title: 'Camera narrow corner',
  spawn: {
    position: { x: 1.05, y: 0, z: 1.05 },
    facingYaw: Math.PI / 4,
  },
  platforms: [
    {
      ...ENCLOSED_CORNER_ROOM.platforms[0],
      minX: -NARROW_CORNER_HALF_WIDTH,
      maxX: NARROW_CORNER_HALF_WIDTH,
      minZ: -NARROW_CORNER_HALF_WIDTH,
      maxZ: NARROW_CORNER_HALF_WIDTH,
    },
  ],
  solids: [
    {
      id: 'narrow-east-wall',
      kind: 'prop',
      shape: 'box',
      minX: NARROW_CORNER_HALF_WIDTH,
      maxX: NARROW_CORNER_HALF_WIDTH + 0.3,
      minZ: -NARROW_CORNER_HALF_WIDTH - 0.3,
      maxZ: NARROW_CORNER_HALF_WIDTH + 0.3,
      top: 3.6,
      thickness: 3.6,
      presentation: { role: 'wall', material: 'stone' },
    },
    {
      id: 'narrow-north-wall',
      kind: 'prop',
      shape: 'box',
      minX: -NARROW_CORNER_HALF_WIDTH - 0.3,
      maxX: NARROW_CORNER_HALF_WIDTH + 0.3,
      minZ: NARROW_CORNER_HALF_WIDTH,
      maxZ: NARROW_CORNER_HALF_WIDTH + 0.3,
      top: 3.6,
      thickness: 3.6,
      presentation: { role: 'wall', material: 'stone' },
    },
  ],
  checkpoints: [
    {
      id: 'narrow-corner-spawn',
      position: { x: 1.05, y: 0, z: 1.05 },
      radius: 1,
      facingYaw: Math.PI / 4,
    },
  ],
  presentation: {
    ...ENCLOSED_CORNER_ROOM.presentation!,
    rooms: [
      {
        id: 'narrow-corner',
        bounds: {
          minX: -NARROW_CORNER_HALF_WIDTH - 0.3,
          maxX: NARROW_CORNER_HALF_WIDTH + 0.3,
          minY: -0.25,
          maxY: 3.6,
          minZ: -NARROW_CORNER_HALF_WIDTH - 0.3,
          maxZ: NARROW_CORNER_HALF_WIDTH + 0.3,
        },
        cameraBounds: {
          minX: -NARROW_CORNER_HALF_WIDTH,
          maxX: NARROW_CORNER_HALF_WIDTH,
          minY: 0,
          maxY: 3.44,
          minZ: -NARROW_CORNER_HALF_WIDTH,
          maxZ: NARROW_CORNER_HALF_WIDTH,
        },
      },
    ],
  },
}

const PRESSED_EAST_WALL_ROOM: LevelDefinition = {
  ...ENCLOSED_CORNER_ROOM,
  id: 'camera-pressed-east-wall',
  title: 'Camera pressed east wall',
  spawn: {
    position: { x: 4.08, y: 0, z: 0 },
    facingYaw: -Math.PI / 2,
  },
  checkpoints: [
    {
      id: 'wall-spawn',
      position: { x: 4.08, y: 0, z: 0 },
      radius: 1,
      facingYaw: -Math.PI / 2,
    },
  ],
}

const ENCLOSED_GATE_ROOM: LevelDefinition = {
  ...ENCLOSED_CORNER_ROOM,
  id: 'camera-enclosed-gate',
  title: 'Camera enclosed gate',
  spawn: { position: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
  solids: [
    {
      id: 'camera-gate',
      kind: 'prop',
      shape: 'box',
      minX: -0.7,
      maxX: 0.7,
      minZ: 1,
      maxZ: 1.12,
      top: 1.55,
      thickness: 1.55,
      presentation: { role: 'gate', material: 'brass' },
    },
  ],
  checkpoints: [
    {
      id: 'gate-spawn',
      position: { x: 0, y: 0, z: 0 },
      radius: 1,
      facingYaw: 0,
    },
  ],
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
    updateFor(rig, moving, 0.15)
    expect(rig.yaw()).toBeCloseTo(chosenYaw)
    updateFor(rig, moving, 0.15)
    expect(
      Math.abs(angleError(rig.yaw(), moving.player.facingYaw)),
    ).toBeLessThan(Math.abs(angleError(chosenYaw, moving.player.facingYaw)))

    rig.orbit(0.35, 0)
    expect(rig.movementYaw()).toBeCloseTo(rig.yaw())
    const secondOrbit = rig.yaw()
    updateFor(rig, moving, 0.15)
    expect(rig.yaw()).toBeCloseTo(secondOrbit)
    updateFor(rig, moving, 0.15)
    expect(
      Math.abs(angleError(rig.yaw(), moving.player.facingYaw)),
    ).toBeLessThan(Math.abs(angleError(secondOrbit, moving.player.facingYaw)))
  })
  it.each([false, true])(
    'finishes a short side-step heading after movement stops with zoom=%s',
    (zoomed) => {
      const game = createGlassGame(OPEN_ROOM)
      const rig = createAdventureCamera(OPEN_ROOM)
      if (zoomed) rig.zoom(1)
      rig.setMovementActive(true)

      for (let frame = 0; frame < 12; frame++) {
        const movement = cameraRelativeMovement(-1, 0, rig.movementYaw())
        game.step({ ...movement, jumpDown: false }, FRAME)
        rig.update(game.snapshot(), FRAME)
      }
      const committedFacing = game.snapshot().player.facingYaw
      expect(Math.abs(angleError(rig.yaw(), committedFacing))).toBeGreaterThan(
        0.5,
      )

      rig.setMovementActive(false)
      for (let frame = 0; frame < 72; frame++) {
        game.step({ moveX: 0, moveZ: 0, jumpDown: false }, FRAME)
        rig.update(game.snapshot(), FRAME)
      }

      expect(Math.abs(angleError(rig.yaw(), committedFacing))).toBeLessThan(
        0.04,
      )
    },
  )
  it('cancels a pending heading when manual orbit takes ownership', () => {
    const rig = createAdventureCamera(GLASSWORKS)
    const state = createGlassGame(GLASSWORKS).snapshot()
    const moving = withMotion(state, 0)
    rig.setMovementActive(true)
    updateFor(rig, moving, 0.2)

    rig.setOrbitActive(true)
    rig.orbit(-0.45, 0)
    const chosenYaw = rig.yaw()
    rig.setOrbitActive(false)
    rig.setMovementActive(false)
    // Braking velocity after a released contact is not fresh movement intent.
    updateFor(rig, moving, 0.2)
    updateFor(rig, withMotion(moving, 0, { speed: 0 }), 2)

    expect(rig.yaw()).toBeCloseTo(chosenYaw)
  })
  it('cancels a pending heading across a short respawn', () => {
    const rig = createAdventureCamera(GLASSWORKS)
    const state = createGlassGame(GLASSWORKS).snapshot()
    const moving = withMotion(state, 0)
    rig.setMovementActive(true)
    updateFor(rig, moving, 0.2)
    const beforeRespawn = rig.yaw()

    rig.cancelHeadingFollow()
    const shortRespawn = withMotion(
      {
        ...state,
        player: {
          ...state.player,
          position: {
            ...state.player.position,
            x: state.player.position.x + 1,
          },
        },
      },
      0,
      { speed: 0 },
    )
    updateFor(rig, shortRespawn, 2)

    expect(rig.yaw()).toBeCloseTo(beforeRespawn)
    expect(rig.movementYaw()).toBeCloseTo(rig.yaw())
  })
  it.each([
    ['pause', { paused: true }],
    ['encounter', { phase: 'listening' as const }],
  ])('drops a pending heading during %s', (_, unavailable) => {
    const rig = createAdventureCamera(GLASSWORKS)
    const state = createGlassGame(GLASSWORKS).snapshot()
    const moving = withMotion(state, 0)
    rig.setMovementActive(true)
    updateFor(rig, moving, 0.2)

    rig.update({ ...moving, ...unavailable }, FRAME)
    rig.setMovementActive(false)
    const blockedYaw = rig.yaw()
    updateFor(rig, withMotion(moving, 0, { speed: 0 }), 2)

    expect(rig.yaw()).toBeCloseTo(blockedYaw)
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
  it.each([30, 60, 120])(
    'reanchors a deliberate chord to the sampled view at %sfps without feedback',
    (fps) => {
      const frame = 1 / fps
      const game = createGlassGame(OPEN_ROOM)
      const rig = createAdventureCamera(OPEN_ROOM)
      rig.setMovementActive(true)

      for (let index = 0; index < fps * 1.5; index++) {
        const left = cameraRelativeMovement(-1, 0, rig.movementYaw())
        game.step({ ...left, jumpDown: false }, frame)
        rig.update(game.snapshot(), frame)
      }

      const sampledView = rig.yaw()
      const staleReference = rig.movementYaw()
      const staleChord = cameraRelativeMovement(-1, 1, staleReference)
      const intendedChord = cameraRelativeMovement(-1, 1, sampledView)
      expect(
        Math.abs(
          angleError(
            Math.atan2(staleChord.moveX, staleChord.moveZ),
            Math.atan2(intendedChord.moveX, intendedChord.moveZ),
          ),
        ),
      ).toBeGreaterThan(1)

      rig.rebaseMovement()
      expect(rig.movementYaw()).toBeCloseTo(sampledView)
      for (let index = 0; index < fps; index++) {
        const diagonal = cameraRelativeMovement(-1, 1, rig.movementYaw())
        expect(diagonal.moveX).toBeCloseTo(intendedChord.moveX)
        expect(diagonal.moveZ).toBeCloseTo(intendedChord.moveZ)
        game.step({ ...diagonal, jumpDown: false }, frame)
        rig.update(game.snapshot(), frame)
        expect(rig.movementYaw()).toBeCloseTo(sampledView)
      }
    },
  )
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
    rig.camera.updateMatrixWorld()
    const visiblePoints = [
      new Vector3(0, 0.02, 8.3),
      new Vector3(0, 0.58, 8.3),
      new Vector3(0, 0.02, 7.45),
    ].map((point) => point.project(rig.camera))

    expect(rig.camera.position.y).toBeLessThanOrEqual(2.96)
    expect(rig.camera.position.z).toBeLessThanOrEqual(9.06)
    for (const point of visiblePoints) {
      expect(Math.abs(point.x)).toBeLessThan(1)
      expect(Math.abs(point.y)).toBeLessThan(1)
      expect(Math.abs(point.z)).toBeLessThan(1)
    }

    museum.materialLibrary.dispose()
    Object.values(materials).forEach((material) => material.dispose())
  })
  it.each([
    ['arrival', { x: 0, y: 0, z: -2.8 }, Math.PI],
    ['turn', { x: 12.096_037_511_825_562, y: 0, z: 0 }, Math.PI],
  ])(
    'uses readable third-person framing at the enclosed chamber %s',
    (_, position, facingYaw) => {
      const rig = createAdventureCamera(GLASS_ENCLOSED_CHAMBER)
      const snapshot = createGlassGame(GLASS_ENCLOSED_CHAMBER).snapshot()
      const pose: GameSnapshot = {
        ...snapshot,
        player: {
          ...snapshot.player,
          position,
          facingYaw,
          velocity: { x: 0, y: 0, z: 0 },
        },
      }

      rig.update(pose, FRAME)
      rig.camera.updateMatrixWorld()
      const horizontalDistance = Math.hypot(
        rig.camera.position.x - position.x,
        rig.camera.position.z - position.z,
      )
      const viewElevation = Math.atan2(
        rig.camera.position.y - 0.42,
        horizontalDistance,
      )
      const forward = new Vector3(-Math.sin(facingYaw), 0, -Math.cos(facingYaw))

      expect(horizontalDistance).toBeGreaterThan(0.9)
      expect(viewElevation).toBeLessThan(0.8)
      for (const point of [
        new Vector3(position.x, 0.02, position.z),
        new Vector3(position.x, 0.58, position.z),
        new Vector3(position.x, 0.02, position.z).addScaledVector(
          forward,
          0.85,
        ),
      ]) {
        const projected = point.project(rig.camera)
        expect(Math.abs(projected.x)).toBeLessThan(0.95)
        expect(Math.abs(projected.y)).toBeLessThan(0.95)
        expect(Math.abs(projected.z)).toBeLessThan(1)
      }
    },
  )
  it.each([
    ['landscape', 16 / 9],
    ['portrait', 9 / 16],
  ])(
    'keeps Merc and the landing in frame at a narrow %s corner',
    (_, aspect) => {
      const rig = createAdventureCamera(NARROW_CORNER_ROOM)
      rig.camera.aspect = aspect
      rig.camera.updateProjectionMatrix()
      const snapshot = createGlassGame(NARROW_CORNER_ROOM).snapshot()

      rig.update(snapshot, FRAME)
      rig.camera.updateMatrixWorld()
      const forward = new Vector3(
        -Math.sin(snapshot.player.facingYaw),
        0,
        -Math.cos(snapshot.player.facingYaw),
      )
      const feet = new Vector3(1.05, 0.02, 1.05).project(rig.camera)
      const head = new Vector3(1.05, 0.58, 1.05).project(rig.camera)
      const landing = new Vector3(1.05, 0.02, 1.05)
        .addScaledVector(forward, 0.85)
        .project(rig.camera)

      expect(rig.camera.position.x).toBeLessThanOrEqual(1.180_108)
      expect(rig.camera.position.y).toBeLessThanOrEqual(3.2)
      expect(rig.camera.position.z).toBeLessThanOrEqual(1.180_108)
      for (const point of [feet, head, landing]) {
        expect(Math.abs(point.x)).toBeLessThan(0.95)
        expect(Math.abs(point.y)).toBeLessThan(0.95)
        expect(Math.abs(point.z)).toBeLessThan(1)
      }
      expect(head.y).toBeGreaterThan(feet.y)
      expect(landing.y).toBeGreaterThan(head.y)
    },
  )
  it('keeps a wall-pressed manual orbit at the last camera-safe centre', () => {
    const rig = createAdventureCamera(PRESSED_EAST_WALL_ROOM)
    const snapshot = createGlassGame(PRESSED_EAST_WALL_ROOM).snapshot()
    const body = new Vector3(4.08, 0.42, 0)

    rig.update(snapshot, FRAME)
    const interiorPosition = rig.camera.position.clone()
    expect(interiorPosition.x).toBeLessThanOrEqual(4.026)
    expect(interiorPosition.distanceTo(body)).toBeGreaterThan(2)

    rig.orbit(Math.PI, 0)
    rig.update(snapshot, FRAME)
    rig.camera.updateMatrixWorld()
    expect(rig.camera.position.distanceTo(interiorPosition)).toBeLessThan(0.001)
    expect(rig.camera.position.x).toBeLessThanOrEqual(4.026)
    for (const point of [
      new Vector3(4.08, 0.02, 0),
      new Vector3(4.08, 0.58, 0),
    ]) {
      const projected = point.project(rig.camera)
      expect(Math.abs(projected.x)).toBeLessThan(1)
      expect(Math.abs(projected.y)).toBeLessThan(1)
      expect(Math.abs(projected.z)).toBeLessThan(1)
    }
  })
  it.each([30, 60, 120])(
    'eases outward monotonically after an active gate opens at %sfps',
    (fps) => {
      const frame = 1 / fps
      const rig = createAdventureCamera(ENCLOSED_GATE_ROOM)
      const closed = createGlassGame(ENCLOSED_GATE_ROOM).snapshot()
      const open: GameSnapshot = {
        ...closed,
        activeSolidIds: closed.activeSolidIds?.filter(
          (id) => id !== 'camera-gate',
        ),
      }
      const target = new Vector3(0, 0.42, -0.45)

      rig.update(closed, frame)
      let previousDistance = rig.camera.position.distanceTo(target)
      expect(previousDistance).toBeLessThan(3.1)
      for (let index = 0; index < fps * 1.5; index++) {
        rig.update(open, frame)
        const nextDistance = rig.camera.position.distanceTo(target)
        expect(nextDistance).toBeGreaterThanOrEqual(previousDistance - 0.001)
        previousDistance = nextDistance
      }
      expect(previousDistance).toBeCloseTo(4, 2)
    },
  )
})
