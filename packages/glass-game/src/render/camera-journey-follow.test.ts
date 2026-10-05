// Journey camera follow regression — physical route contacts keep Merc visible through the museum corner.

import { Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { GLASSWORKS_JOURNEY } from '../content/glassworks-journey'
import { createGlassGame } from '../core/game'
import { MOVEMENT } from '../core/movement'
import { createAdventureInput } from '../ui/input'
import { shortestAngleDelta } from './angular-response'
import { createAdventureCamera } from './camera'
import { MAXIMUM_FOLLOW_RADIANS_PER_SECOND } from './camera-policy'
import { createEnclosureFraming } from './enclosure-framing'

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

function yawDistance(from: number, to: number): number {
  return Math.abs(shortestAngleDelta(from, to))
}

describe('Journey camera follow from real movement contacts', () => {
  it.each([10, 30, 60])(
    'settles behind a fully blocked Journey chord without changing its held basis at %i Hz',
    (framesPerSecond) => {
      const frame = 1 / framesPerSecond
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
      camera.update(game.snapshot(), frame)
      camera.recenter()
      const step = (dt = frame) => {
        camera.setMovementActive(input.hasMovementIntent())
        const changed = input.consumeMovementReferenceChange()
        if (changed !== null)
          camera.rebaseMovement(changed, input.desiredTravelYaw(0) ?? undefined)
        game.step(input.read(camera.movementYaw()), dt)
        camera.update(game.snapshot(), dt)
      }
      input.key(keyboardEvent('KeyW'), true)
      // Keep the authored lead-in at 50 ms even when a render frame is longer.
      for (let elapsed = 0; elapsed < 0.05 - 1e-9; elapsed += frame)
        step(Math.min(frame, 0.05 - elapsed))
      input.key(keyboardEvent('KeyD'), true)
      step()
      const heldBasis = camera.movementYaw()
      const requestedHeading = input.desiredTravelYaw(heldBasis)!
      for (let elapsed = 0; elapsed < 12; elapsed += frame) {
        step()
        const player = game.snapshot().player
        if (
          player.position.x < 8 &&
          Math.hypot(player.velocity.x, player.velocity.z) === 0
        )
          break
      }
      const blocked = game.snapshot().player
      expect(blocked.position.x).toBeCloseTo(7.912274158)
      expect(blocked.position.z).toBeCloseTo(13.476945732)
      expect(Math.hypot(blocked.velocity.x, blocked.velocity.z)).toBe(0)
      expect(yawDistance(blocked.facingYaw, requestedHeading)).toBeCloseTo(
        Math.PI / 4,
      )
      expect(yawDistance(camera.yaw(), requestedHeading)).toBeLessThan(0.02)
      for (let elapsed = 0; elapsed < 2; elapsed += frame) step()
      expect(yawDistance(camera.yaw(), blocked.facingYaw)).toBeLessThan(0.08)
      expect(camera.movementYaw()).toBeCloseTo(heldBasis)
      expect(game.snapshot().player.position).toEqual(blocked.position)
      expect(input.hasMovementIntent()).toBe(true)
      const settledYaw = camera.yaw()
      for (let elapsed = 0; elapsed < 2; elapsed += frame) step()
      expect(yawDistance(camera.yaw(), settledYaw)).toBeLessThan(0.02)
    },
  )

  it.each([
    [10, 'keyboard'],
    [30, 'keyboard'],
    [60, 'keyboard'],
    [10, 'stick'],
    [30, 'stick'],
    [60, 'stick'],
  ] as const)(
    'follows Merc during displacement through the Journey corner at %i Hz with held %s input',
    (framesPerSecond, contactKind) => {
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
      const enclosure = createEnclosureFraming(GLASSWORKS_JOURNEY)!
      const input = createAdventureInput()
      const start = game.snapshot().player.position
      let assertReadableWallFollow = false
      let redirectedPosition: { x: number; z: number } | null = null
      let redirectedYaw: number | null = null
      let firstCorrectionDistance: number | null = null
      let oneMetreError: number | null = null
      let chordHeading: number | null = null
      let passageHeadingError: number | null = null
      let passageInputError: number | null = null
      let bridgedCameraClearanceSeam = false
      let previousSeamCameraPosition: Vector3 | null = null
      let previousSeamPlayerPosition: Vector3 | null = null
      let previousSeamTarget: Vector3 | null = null
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
          if (chordHeading !== null) {
            const player = game.snapshot().player
            if (
              passageHeadingError === null &&
              player.position.x - start.x > 7
            ) {
              passageHeadingError = yawDistance(camera.yaw(), player.facingYaw)
              passageInputError = yawDistance(camera.yaw(), chordHeading)
            }
            if (
              player.position.z >= 25.45 &&
              Math.abs(player.velocity.x) > 0.05 &&
              Math.abs(player.velocity.z) < 0.05
            ) {
              redirectedPosition ??= {
                x: player.position.x,
                z: player.position.z,
              }
              redirectedYaw ??= camera.yaw()
              const redirectedDistance = Math.hypot(
                player.position.x - redirectedPosition.x,
                player.position.z - redirectedPosition.z,
              )
              if (
                firstCorrectionDistance === null &&
                yawDistance(camera.yaw(), redirectedYaw) > 0.002
              )
                firstCorrectionDistance = redirectedDistance
              if (oneMetreError === null && redirectedDistance >= 1)
                oneMetreError = yawDistance(camera.yaw(), player.facingYaw)
            }
          }
          if (assertReadableWallFollow) {
            const snapshot = game.snapshot()
            const target = camera.getChallengeMetrics().target
            const targetPosition = new Vector3(target.x, target.y, target.z)
            const cameraSafe = enclosure.cameraViewSafe(
              targetPosition,
              camera.camera.position,
              snapshot.activeSolidIds ?? [],
            )
            expect(
              cameraSafe,
              JSON.stringify({
                player: snapshot.player.position,
                target,
                camera: camera.camera.position,
              }),
            ).toBe(true)
            const subjectTarget = new Vector3(
              snapshot.player.position.x,
              0.42,
              snapshot.player.position.z,
            )
            expect(
              enclosure.cameraViewSafe(
                subjectTarget,
                camera.camera.position,
                snapshot.activeSolidIds ?? [],
              ),
            ).toBe(true)
            if (
              !enclosure.cameraPositionSafe(
                targetPosition,
                camera.camera.position,
                snapshot.activeSolidIds ?? [],
              )
            )
              bridgedCameraClearanceSeam = true
            if (snapshot.player.position.x >= 19.7) {
              const currentPlayerPosition = new Vector3(
                snapshot.player.position.x,
                snapshot.player.position.y,
                snapshot.player.position.z,
              )
              if (
                previousSeamCameraPosition !== null &&
                previousSeamPlayerPosition !== null &&
                previousSeamTarget !== null
              ) {
                const maximumPlacementStep =
                  currentPlayerPosition.distanceTo(previousSeamPlayerPosition) +
                  4 *
                    MAXIMUM_FOLLOW_RADIANS_PER_SECOND *
                    Math.min(frameSeconds, 0.05)
                expect(
                  camera.camera.position.distanceTo(previousSeamCameraPosition),
                ).toBeLessThanOrEqual(maximumPlacementStep + 0.001)
                expect(
                  enclosure.cameraTravelSafe(
                    previousSeamCameraPosition,
                    camera.camera.position,
                    snapshot.activeSolidIds ?? [],
                  ),
                ).toBe(true)
                expect(
                  targetPosition.distanceTo(previousSeamTarget),
                ).toBeLessThanOrEqual(maximumPlacementStep + 0.001)
              }
              previousSeamCameraPosition = camera.camera.position.clone()
              previousSeamPlayerPosition = currentPlayerPosition
              previousSeamTarget = targetPosition.clone()
            }
            if (snapshot.player.position.z >= 25.45)
              expect(
                camera.camera.position.distanceTo(targetPosition),
                JSON.stringify({
                  player: snapshot.player.position,
                  target,
                  camera: camera.camera.position,
                }),
              ).toBeGreaterThanOrEqual(1.45)
            camera.camera.updateMatrixWorld()
            for (const height of [0.02, 0.58]) {
              const projected = new Vector3(
                snapshot.player.position.x,
                height,
                snapshot.player.position.z,
              ).project(camera.camera)
              expect(Math.abs(projected.x)).toBeLessThan(0.95)
              expect(Math.abs(projected.y)).toBeLessThan(0.95)
              expect(Math.abs(projected.z)).toBeLessThan(1)
            }
          }
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
      if (contactKind === 'keyboard') {
        input.setStick(0, 0)
        input.key(keyboardEvent('KeyW'), true)
        input.key(keyboardEvent('KeyA'), true)
      } else input.setStick(-1, -1)
      chordHeading = input.desiredTravelYaw(camera.movementYaw())
      expect(chordHeading).not.toBeNull()
      assertReadableWallFollow = true
      advanceUntil(() => game.snapshot().player.position.x - start.x > 9.5, 8)

      const end = game.snapshot().player
      expect(input.hasMovementIntent()).toBe(true)
      expect(camera.movementYaw()).toBeCloseTo(initialMovementBasis)
      expect(end.position.x - start.x).toBeGreaterThan(9.5)
      expect(end.position.z - start.z).toBeGreaterThan(17)
      expect(firstCorrectionDistance).not.toBeNull()
      expect(firstCorrectionDistance!).toBeLessThanOrEqual(
        MOVEMENT.radius * 1.25,
      )
      expect(oneMetreError).not.toBeNull()
      expect(oneMetreError!).toBeLessThan(0.6)
      expect(passageHeadingError).not.toBeNull()
      expect(passageHeadingError!).toBeLessThan(0.16)
      expect(passageInputError).not.toBeNull()
      expect(passageInputError!).toBeGreaterThan(0.3)
      expect(bridgedCameraClearanceSeam).toBe(true)
      expect(yawDistance(camera.yaw(), end.facingYaw)).toBeLessThan(0.16)
      camera.camera.updateMatrixWorld()
      const target = camera.getChallengeMetrics().target
      const boom = camera.camera.position.distanceTo(
        new Vector3(target.x, target.y, target.z),
      )
      const feet = new Vector3(end.position.x, 0.02, end.position.z).project(
        camera.camera,
      )
      const head = new Vector3(end.position.x, 0.58, end.position.z).project(
        camera.camera,
      )
      expect(boom).toBeGreaterThanOrEqual(1.45)
      for (const point of [feet, head]) {
        expect(Math.abs(point.x)).toBeLessThan(0.95)
        expect(Math.abs(point.y)).toBeLessThan(0.95)
        expect(Math.abs(point.z)).toBeLessThan(1)
      }
      expect(head.y).toBeGreaterThan(feet.y)
    },
  )
})
