// Camera input follow regression — stable input bases cannot feed camera turns back into travel.

import { describe, expect, it, vi } from 'vitest'
import type { LevelDefinition } from '../contracts'
import { createGlassGame } from '../core/game'
import { createAdventureInput } from '../ui/input'
import { shortestAngleDelta } from './angular-response'
import { createAdventureCamera } from './camera'

const FRAME = 1 / 60
const OPEN_ROOM: LevelDefinition = {
  id: 'camera-input-follow-room',
  title: 'Camera input follow room',
  spawn: { position: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
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
      facingYaw: 0,
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

function keyboardEvent(code: string): KeyboardEvent {
  return {
    code,
    target: null,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent
}

function createHarness(zoom = 0) {
  const game = createGlassGame(OPEN_ROOM)
  const camera = createAdventureCamera(OPEN_ROOM)
  const input = createAdventureInput()
  camera.zoom(zoom)
  const key = (code: string, down: boolean) =>
    input.key(keyboardEvent(code), down)
  const step = (seconds: number) => {
    for (let elapsed = 0; elapsed < seconds - FRAME / 2; elapsed += FRAME) {
      const active = input.hasMovementIntent()
      const changed = input.consumeMovementReferenceChange()
      camera.setMovementActive(active)
      if (active && changed !== null) camera.rebaseMovement(changed)
      game.step(input.read(camera.movementYaw()), FRAME)
      camera.update(game.snapshot(), FRAME)
    }
  }
  return { camera, game, input, key, step }
}

function yawDistance(from: number, to: number): number {
  return Math.abs(shortestAngleDelta(from, to))
}

describe('camera follow from real movement contacts', () => {
  it.each([
    ['KeyA', -1, -2],
    ['KeyD', 1, 2],
  ] as const)(
    'keeps W + %s steering on a steady view while W remains held',
    (sideKey, side, zoom) => {
      const harness = createHarness(zoom)
      harness.key('KeyW', true)
      harness.step(0.45)
      const beforeChord = harness.camera.yaw()
      const beforePosition = harness.game.snapshot().player.position

      harness.key(sideKey, true)
      harness.step(0.6)
      harness.key(sideKey, false)
      harness.step(0.6)

      const after = harness.game.snapshot().player.position
      expect(yawDistance(beforeChord, harness.camera.yaw())).toBeLessThan(0.02)
      expect(Math.sign(after.x - beforePosition.x)).toBe(side)
      expect(after.z).toBeLessThan(beforePosition.z - 0.5)
      expect(harness.input.hasMovementIntent()).toBe(true)
    },
  )

  it.each([-2, 0, 2])(
    'leaves the view steady after a brief lateral tap at zoom delta %s',
    (zoom) => {
      const harness = createHarness(zoom)
      const start = harness.camera.yaw()

      harness.key('KeyA', true)
      harness.step(0.15)
      harness.key('KeyA', false)
      harness.step(0.8)

      expect(yawDistance(start, harness.camera.yaw())).toBeLessThan(0.02)
      expect(harness.game.snapshot().player.position.x).toBeLessThan(-0.04)
    },
  )

  it('delays then smoothly follows sustained lateral keyboard travel', () => {
    const harness = createHarness()
    const start = harness.camera.yaw()
    harness.key('KeyA', true)

    harness.step(0.18)
    expect(yawDistance(start, harness.camera.yaw())).toBeLessThan(0.02)

    harness.step(2.1)
    expect(yawDistance(harness.camera.yaw(), Math.PI / 2)).toBeLessThan(0.03)
    expect(harness.camera.movementYaw()).toBeCloseTo(start)
  })

  it('holds the view through a continuous thumb sweep, then follows its final travel after release', () => {
    const harness = createHarness()
    const start = harness.camera.yaw()
    harness.input.setStick(0, -1)
    harness.step(0.35)
    harness.input.setStick(-1, 0)

    harness.step(1.5)
    expect(yawDistance(start, harness.camera.yaw())).toBeLessThan(0.02)
    expect(harness.camera.movementYaw()).toBeCloseTo(start)

    harness.input.setStick(0, 0)
    const beforeReleaseFollow = harness.camera.yaw()
    harness.step(FRAME)
    const maximumFollowAcceleration = (80 * Math.PI) / 180 / 0.32
    expect(yawDistance(beforeReleaseFollow, harness.camera.yaw())).toBeCloseTo(
      (maximumFollowAcceleration * FRAME ** 2) / 2,
    )
    harness.step(2 - FRAME)
    expect(yawDistance(harness.camera.yaw(), Math.PI / 2)).toBeLessThan(0.03)
  })

  it('preserves held-thumb world travel while a separate pointer orbits', () => {
    const harness = createHarness()
    harness.input.setStick(0, -1)
    harness.step(0.5)
    const stableBasis = harness.camera.movementYaw()
    const beforeOrbit = harness.input.read(stableBasis)

    harness.camera.setOrbitActive(true)
    harness.camera.orbit(0.75, 0)
    harness.camera.setOrbitActive(false)

    expect(harness.camera.movementYaw()).toBeCloseTo(stableBasis)
    expect(harness.input.read(harness.camera.movementYaw())).toMatchObject({
      moveX: beforeOrbit.moveX,
      moveZ: beforeOrbit.moveZ,
    })
    const chosenView = harness.camera.yaw()
    harness.step(1.5)
    expect(harness.camera.yaw()).toBeCloseTo(chosenView)
    expect(harness.camera.movementYaw()).toBeCloseTo(stableBasis)
  })
})
