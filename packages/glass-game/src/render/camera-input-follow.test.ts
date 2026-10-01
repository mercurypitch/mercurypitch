// Camera input follow regression — stable input bases cannot feed camera turns back into travel.

import { describe, expect, it, vi } from 'vitest'
import { GLASSWORKS_JOURNEY } from '../content/glassworks-journey'
import type { LevelDefinition } from '../contracts'
import { createGlassGame } from '../core/game'
import { MOVEMENT } from '../core/movement'
import { createAdventureInput } from '../ui/input'
import { shortestAngleDelta } from './angular-response'
import { createAdventureCamera } from './camera'
import type { AdventureCameraMode } from './camera-policy'

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

const ENCLOSED_ROOM: LevelDefinition = {
  ...OPEN_ROOM,
  id: 'camera-input-follow-enclosed-room',
  title: 'Camera input follow enclosed room',
  presentation: {
    worldBounds: {
      minX: -20,
      maxX: 20,
      minY: -1,
      maxY: 4,
      minZ: -20,
      maxZ: 20,
    },
    lightBounds: {
      minX: -20,
      maxX: 20,
      minY: -1,
      maxY: 4,
      minZ: -20,
      maxZ: 20,
    },
    rooms: [
      {
        id: 'enclosed-navigation',
        bounds: {
          minX: -8,
          maxX: 8,
          minY: -0.4,
          maxY: 3.6,
          minZ: -8,
          maxZ: 1.2,
        },
        cameraBounds: {
          minX: -8,
          maxX: 8,
          minY: 0,
          maxY: 3.4,
          minZ: -8,
          maxZ: 1.2,
        },
      },
    ],
    audioRegions: [],
    visuals: [],
    assetRecipeIds: [],
  },
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

function createHarness(
  zoom = 0,
  mode: AdventureCameraMode = 'third-person',
  level: LevelDefinition = OPEN_ROOM,
  options: { frameSeconds?: number; reducedMotion?: boolean } = {},
) {
  const game = createGlassGame(level)
  const camera = createAdventureCamera(level, {
    mode,
    reducedMotion: options.reducedMotion,
  })
  const input = createAdventureInput()
  const frame = options.frameSeconds ?? FRAME
  camera.zoom(zoom)
  camera.update(game.snapshot(), frame)
  const key = (code: string, down: boolean) =>
    input.key(keyboardEvent(code), down)
  const step = (seconds: number) => {
    for (let elapsed = 0; elapsed < seconds - frame / 2; elapsed += frame) {
      const active = input.hasMovementIntent()
      const changed = input.consumeMovementReferenceChange()
      camera.setMovementActive(active)
      if (active && changed !== null)
        camera.rebaseMovement(changed, input.desiredTravelYaw(0) ?? undefined)
      game.step(input.read(camera.movementYaw()), frame)
      camera.update(game.snapshot(), frame)
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

  it.each([4, 30, 60, 120])(
    'anticipates a held forward-right turn inside an enclosure at %i Hz',
    (framesPerSecond) => {
      const harness = createHarness(0, 'third-person', ENCLOSED_ROOM, {
        frameSeconds: 1 / framesPerSecond,
      })
      harness.key('KeyW', true)
      harness.step(0.3)
      const beforeChord = harness.camera.yaw()
      harness.key('KeyD', true)

      harness.step(0.3)
      expect(yawDistance(beforeChord, harness.camera.yaw())).toBeLessThan(0.02)
      harness.step(1.7)

      const requestedHeading = harness.input.desiredTravelYaw(
        harness.camera.movementYaw(),
      )
      expect(requestedHeading).not.toBeNull()
      expect(yawDistance(beforeChord, harness.camera.yaw())).toBeGreaterThan(
        0.4,
      )
      expect(yawDistance(harness.camera.yaw(), requestedHeading!)).toBeLessThan(
        0.08,
      )
      expect(harness.camera.movementYaw()).toBeCloseTo(beforeChord)
    },
  )

  it('returns behind held keyboard travel after a front-facing manual orbit', () => {
    const harness = createHarness(0, 'third-person', ENCLOSED_ROOM)
    harness.key('KeyW', true)
    harness.step(0.3)
    const travelHeading = harness.input.desiredTravelYaw(
      harness.camera.movementYaw(),
    )
    expect(travelHeading).not.toBeNull()

    harness.camera.orbit(Math.PI, 0)
    const frontFacingYaw = harness.camera.yaw()
    expect(yawDistance(frontFacingYaw, travelHeading!)).toBeGreaterThan(3)

    harness.key('KeyD', true)
    harness.step(FRAME)
    expect(harness.camera.movementYaw()).toBeCloseTo(travelHeading!)
    harness.key('KeyD', false)
    harness.step(FRAME)

    harness.step(0.8)
    expect(yawDistance(frontFacingYaw, harness.camera.yaw())).toBeLessThan(0.02)

    harness.step(3.2)
    expect(yawDistance(harness.camera.yaw(), travelHeading!)).toBeLessThan(0.08)
    expect(harness.input.hasMovementIntent()).toBe(true)
  })

  it('queues a sustained turn that ends inside the manual-look quiet window', () => {
    const harness = createHarness()
    harness.camera.orbit(0.8, 0)
    const manualYaw = harness.camera.yaw()
    const start = harness.game.snapshot().player.position

    harness.key('KeyA', true)
    harness.step(0.45)
    harness.key('KeyA', false)
    harness.step(0.2)
    expect(yawDistance(manualYaw, harness.camera.yaw())).toBeLessThan(0.02)

    harness.step(2.2)
    const end = harness.game.snapshot().player.position
    const travelHeading = Math.atan2(start.x - end.x, start.z - end.z)
    expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeGreaterThan(0.2)
    expect(yawDistance(harness.camera.yaw(), travelHeading)).toBeLessThan(0.04)
  })

  it('keeps normal lateral dwell after an idle manual view', () => {
    const harness = createHarness()
    harness.camera.orbit(0.8, 0)
    harness.step(1.2)
    const manualYaw = harness.camera.yaw()

    harness.key('KeyA', true)
    harness.step(0.6)
    harness.key('KeyA', false)

    const releasedTurn = yawDistance(manualYaw, harness.camera.yaw())
    expect(releasedTurn).toBeGreaterThan(0.05)
    expect(releasedTurn).toBeLessThan(0.3)
    harness.step(0.9)
    expect(yawDistance(manualYaw, harness.camera.yaw())).toBeGreaterThan(0.4)
  })

  it('reacquires behind Merc rather than a stale diagonal after collision stops movement', () => {
    const game = createGlassGame(ENCLOSED_ROOM)
    const camera = createAdventureCamera(ENCLOSED_ROOM)
    const blockedFacing = Math.PI / 2
    const blocked = {
      ...game.snapshot(),
      player: {
        ...game.snapshot().player,
        facingYaw: blockedFacing,
        velocity: { x: 0, y: 0, z: 0 },
      },
    }
    camera.update(blocked, FRAME)
    camera.setMovementActive(true)
    camera.rebaseMovement('keyboard', Math.PI / 4)
    const stableMovementBasis = camera.movementYaw()
    const requestedHeading = stableMovementBasis + Math.PI / 4
    camera.orbit(Math.PI, 0)

    for (let frame = 0; frame < 300; frame++) camera.update(blocked, FRAME)

    expect(yawDistance(camera.yaw(), blockedFacing)).toBeLessThan(0.08)
    expect(yawDistance(camera.yaw(), requestedHeading)).toBeGreaterThan(0.5)
    expect(camera.movementYaw()).toBeCloseTo(stableMovementBasis)
  })

  it('reacquires behind a fully blocked Merc after the manual quiet window already expired', () => {
    const game = createGlassGame(ENCLOSED_ROOM)
    const camera = createAdventureCamera(ENCLOSED_ROOM)
    const blockedFacing = Math.PI / 2
    const blocked = {
      ...game.snapshot(),
      player: {
        ...game.snapshot().player,
        facingYaw: blockedFacing,
        velocity: { x: 0, y: 0, z: 0 },
      },
    }
    camera.update(blocked, FRAME)
    camera.orbit(Math.PI, 0)
    for (let frame = 0; frame < 90; frame++) camera.update(blocked, FRAME)

    camera.setMovementActive(true)
    camera.rebaseMovement('keyboard', Math.PI / 4)
    for (let frame = 0; frame < 300; frame++) camera.update(blocked, FRAME)

    expect(yawDistance(camera.yaw(), blockedFacing)).toBeLessThan(0.08)
  })

  it.each([10, 60])(
    'follows Merc through the Journey corner during one held stick contact at %i Hz',
    (framesPerSecond) => {
      const frameSeconds = 1 / framesPerSecond
      const levelId = GLASSWORKS_JOURNEY.id
      const game = createGlassGame(GLASSWORKS_JOURNEY, {
        version: 1,
        levelId,
        checkpointId: `${levelId}/garden/checkpoint/entry`,
        completedBreakableIds: [
          `${levelId}/vestibule/encounter/vestibule-goblet`,
          `${levelId}/garden/encounter/garden-decanter`,
        ],
        finished: false,
      })
      const camera = createAdventureCamera(GLASSWORKS_JOURNEY)
      const input = createAdventureInput()
      const start = game.snapshot().player.position
      camera.update(game.snapshot(), frameSeconds)
      const initialMovementBasis = camera.movementYaw()
      const advanceUntil = (reached: () => boolean, seconds: number): void => {
        const movementSecondsPerFrame = Math.min(
          frameSeconds,
          MOVEMENT.fixedStep * MOVEMENT.maximumSteps,
        )
        for (
          let frame = 0;
          frame < seconds / movementSecondsPerFrame;
          frame++
        ) {
          const active = input.hasMovementIntent()
          const changed = input.consumeMovementReferenceChange()
          camera.setMovementActive(active)
          if (active && changed !== null)
            camera.rebaseMovement(
              changed,
              input.desiredTravelYaw(0) ?? undefined,
            )
          game.step(input.read(camera.movementYaw()), frameSeconds)
          camera.update(game.snapshot(), frameSeconds)
          if (reached()) return
        }
        throw new Error(
          'Held stick did not reach the Journey route checkpoint.',
        )
      }

      input.setStick(1, 0)
      advanceUntil(() => start.x - game.snapshot().player.position.x > 1.25, 4)
      input.setStick(0, -1)
      advanceUntil(() => game.snapshot().player.position.z - start.z > 5.3, 5)
      input.setStick(-1, 0)
      advanceUntil(() => game.snapshot().player.position.x > start.x - 0.2, 4)
      input.setStick(0, -1)
      advanceUntil(() => game.snapshot().player.position.z - start.z > 13.35, 6)
      input.setStick(-1, -1)
      const chordHeading = input.desiredTravelYaw(camera.movementYaw())
      expect(chordHeading).not.toBeNull()
      advanceUntil(() => game.snapshot().player.position.x - start.x > 4.5, 7)

      const end = game.snapshot().player
      expect(input.hasMovementIntent()).toBe(true)
      expect(camera.movementYaw()).toBeCloseTo(initialMovementBasis)
      expect(end.position.z - start.z).toBeGreaterThan(15.5)
      expect(end.position.z).toBeLessThan(25.9)
      expect(yawDistance(camera.yaw(), end.facingYaw)).toBeLessThan(0.16)
      expect(yawDistance(camera.yaw(), chordHeading!)).toBeGreaterThan(0.3)
    },
  )

  it('keeps enclosed diagonal follow disabled for reduced motion', () => {
    const harness = createHarness(0, 'third-person', ENCLOSED_ROOM, {
      reducedMotion: true,
    })
    const startYaw = harness.camera.yaw()
    harness.key('KeyW', true)
    harness.key('KeyD', true)

    harness.step(2)
    expect(yawDistance(startYaw, harness.camera.yaw())).toBeLessThan(0.001)

    harness.camera.orbit(0.4, 0)
    expect(yawDistance(startYaw, harness.camera.yaw())).toBeCloseTo(0.4)
  })

  it('finishes an enclosed diagonal turn after crossing its room boundary', () => {
    const harness = createHarness(0, 'third-person', ENCLOSED_ROOM)
    harness.key('KeyW', true)
    harness.key('KeyD', true)
    const startYaw = harness.camera.yaw()

    harness.step(1)
    const insideYaw = harness.camera.yaw()
    expect(harness.game.snapshot().player.position.z).toBeGreaterThan(-1.2)
    expect(yawDistance(startYaw, insideYaw)).toBeGreaterThan(0.02)

    harness.step(1.4)
    const outsideYaw = harness.camera.yaw()
    expect(harness.game.snapshot().player.position.z).toBeLessThan(-1.2)
    expect(yawDistance(startYaw, outsideYaw)).toBeGreaterThan(
      yawDistance(startYaw, insideYaw),
    )
    expect(
      yawDistance(outsideYaw, harness.game.snapshot().player.facingYaw),
    ).toBeLessThan(0.08)
  })

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

  it('preserves held-thumb world travel while the third-person view recenters', () => {
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
    expect(yawDistance(harness.camera.yaw(), stableBasis)).toBeLessThan(
      yawDistance(chosenView, stableBasis),
    )
    expect(harness.camera.movementYaw()).toBeCloseTo(stableBasis)
  })

  it('returns behind Merc after a front orbit during one held corridor stick contact', () => {
    const harness = createHarness(0, 'third-person', ENCLOSED_ROOM)
    harness.input.setStick(0, -1)
    harness.step(0.6)
    const stableBasis = harness.camera.movementYaw()

    harness.camera.setOrbitActive(true)
    harness.camera.orbit(Math.PI, 0)
    harness.camera.setOrbitActive(false)
    const frontYaw = harness.camera.yaw()
    expect(
      yawDistance(frontYaw, harness.game.snapshot().player.facingYaw),
    ).toBeGreaterThan(3)

    harness.step(0.8)
    expect(yawDistance(frontYaw, harness.camera.yaw())).toBeLessThan(0.02)
    harness.step(3.4)
    expect(
      yawDistance(
        harness.camera.yaw(),
        harness.game.snapshot().player.facingYaw,
      ),
    ).toBeLessThan(0.08)
    expect(harness.camera.movementYaw()).toBeCloseTo(stableBasis)
    expect(harness.input.hasMovementIntent()).toBe(true)
  })

  it('keeps first-person view yaw player-owned while strafe changes body facing', () => {
    const harness = createHarness(0, 'first-person')
    const viewYaw = harness.camera.yaw()
    harness.key('KeyD', true)

    harness.step(1.2)

    expect(harness.game.snapshot().player.position.x).toBeGreaterThan(0.5)
    expect(yawDistance(viewYaw, harness.camera.yaw())).toBeLessThan(0.001)
    expect(
      yawDistance(viewYaw, harness.game.snapshot().player.facingYaw),
    ).toBeGreaterThan(1)
  })

  it('updates first-person held travel only after deliberate manual look', () => {
    const harness = createHarness(0, 'first-person')
    harness.key('KeyW', true)
    harness.step(0.25)
    const originalBasis = harness.camera.movementYaw()
    const originalInput = harness.input.read(originalBasis)

    harness.camera.setOrbitActive(true)
    harness.camera.orbit(0.6, 0)
    harness.camera.setOrbitActive(false)

    const lookedBasis = harness.camera.movementYaw()
    const lookedInput = harness.input.read(lookedBasis)
    expect(yawDistance(originalBasis, lookedBasis)).toBeCloseTo(0.6)
    expect(lookedInput.moveX).not.toBeCloseTo(originalInput.moveX)
    expect(lookedInput.moveZ).not.toBeCloseTo(originalInput.moveZ)

    const before = harness.game.snapshot().player.position
    harness.step(0.5)
    const after = harness.game.snapshot().player.position
    expect(after.x).toBeLessThan(before.x - 0.1)
    expect(after.z).toBeLessThan(before.z - 0.1)
    expect(yawDistance(harness.camera.yaw(), lookedBasis)).toBeLessThan(0.001)
  })
})
