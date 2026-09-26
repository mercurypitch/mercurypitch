// First-person camera regression — eye framing stays stable and challenge aim is temporary.

import { Box3, PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { createFirstPersonCamera, FIRST_PERSON_EYE_HEIGHT, } from './first-person-camera'

function camera(aspect: number): PerspectiveCamera {
  const result = new PerspectiveCamera(48, aspect, 0.05, 180)
  result.updateProjectionMatrix()
  return result
}

describe('first-person camera', () => {
  it('enters from the current view and uses a stable body-relative eye', () => {
    const view = createFirstPersonCamera(0)
    view.enter(new Vector3(4, 3, 2), new Vector3(1, 2, -2))
    const subject = camera(16 / 9)
    const target = new Vector3()

    view.frame(subject, target, {
      playerPosition: { x: 7, y: 1.25, z: -3 },
    })

    expect(subject.position).toEqual(
      new Vector3(7, 1.25 + FIRST_PERSON_EYE_HEIGHT, -3),
    )
    const projectedDirection = target.clone().sub(subject.position).normalize()
    const enteredDirection = new Vector3(-3, -1, -4).normalize()
    expect(projectedDirection.distanceTo(enteredDirection)).toBeLessThan(0.001)
  })

  it('makes deliberate look own yaw and inverts pointer pitch convention', () => {
    const view = createFirstPersonCamera(0.2)
    view.orbit(0.4, 0.3)
    expect(view.yaw()).toBeCloseTo(0.6)
    expect(view.pitch()).toBeCloseTo(-0.3)
  })

  it.each([
    ['320px portrait', 320 / 720],
    ['tablet landscape', 1180 / 820],
  ])(
    'keeps a challenge target above the live panel at %s',
    (_label, aspect) => {
      const view = createFirstPersonCamera(0)
      const subject = camera(aspect)
      const renderedTarget = new Vector3()
      const targetBounds = new Box3(
        new Vector3(-0.45, 0.1, -4.45),
        new Vector3(0.45, 1.25, -3.55),
      )

      for (let frame = 0; frame < 60; frame++)
        view.frame(subject, renderedTarget, {
          playerPosition: { x: 0, y: 0, z: 0 },
          challengeTarget: targetBounds,
          safeBottomFraction: 0.42,
          deltaSeconds: 1 / 60,
        })
      subject.updateMatrixWorld(true)
      const projectedBottom = new Vector3(0, 0.1, -4).project(subject).y

      expect(projectedBottom).toBeGreaterThan(-1 + 0.42 * 2)
    },
  )

  it('fits every corner of a nearby tall exhibit above the phone panel', () => {
    const view = createFirstPersonCamera(0)
    const subject = camera(320 / 720)
    const renderedTarget = new Vector3()
    const safeBottomNdc = -1 + 0.42 * 2
    const targetBounds = new Box3(
      new Vector3(-0.42, 0.05, -2.24),
      new Vector3(0.42, 1.85, -2.16),
    )

    for (let frame = 0; frame < 90; frame++)
      view.frame(subject, renderedTarget, {
        playerPosition: { x: 0, y: 0, z: 0 },
        challengeTarget: targetBounds,
        safeBottomFraction: 0.42,
        deltaSeconds: 1 / 60,
      })
    subject.updateMatrixWorld(true)

    for (const x of [targetBounds.min.x, targetBounds.max.x])
      for (const y of [targetBounds.min.y, targetBounds.max.y])
        for (const z of [targetBounds.min.z, targetBounds.max.z]) {
          const projected = new Vector3(x, y, z).project(subject)
          expect(Math.abs(projected.x)).toBeLessThan(0.95)
          expect(projected.y).toBeGreaterThan(safeBottomNdc + 0.02)
          expect(projected.y).toBeLessThan(0.92)
        }
  })

  it('returns exactly to the player-owned view after challenge aim', () => {
    const view = createFirstPersonCamera(0.4)
    view.orbit(0.25, -0.12)
    const subject = camera(1)
    const renderedTarget = new Vector3()
    const playerPosition = { x: 0, y: 0, z: 0 }
    view.frame(subject, renderedTarget, { playerPosition })
    const before = renderedTarget.clone().sub(subject.position).normalize()

    for (let frame = 0; frame < 30; frame++)
      view.frame(subject, renderedTarget, {
        playerPosition,
        challengeTarget: new Box3(new Vector3(3, 0, 1), new Vector3(4, 1, 2)),
        safeBottomFraction: 0.35,
        deltaSeconds: 1 / 60,
      })
    for (let frame = 0; frame < 90; frame++)
      view.frame(subject, renderedTarget, {
        playerPosition,
        deltaSeconds: 1 / 60,
      })

    expect(
      renderedTarget
        .clone()
        .sub(subject.position)
        .normalize()
        .distanceTo(before),
    ).toBeLessThan(0.001)
  })

  it('damps encounter aim normally and snaps it for reduced motion', () => {
    const targetBounds = new Box3(
      new Vector3(2.8, 0.1, -2.2),
      new Vector3(3.6, 1.3, -1.5),
    )
    const expectedYaw = Math.atan2(-3.2, 1.85)
    const playerPosition = { x: 0, y: 0, z: 0 }
    const renderedTarget = new Vector3()
    const damped = createFirstPersonCamera(0)

    damped.frame(camera(1), renderedTarget, {
      playerPosition,
      challengeTarget: targetBounds,
      deltaSeconds: 1 / 60,
    })

    expect(Math.abs(damped.renderedYaw())).toBeGreaterThan(0.05)
    expect(Math.abs(damped.renderedYaw())).toBeLessThan(Math.abs(expectedYaw))
    expect(damped.settled()).toBe(false)

    const reduced = createFirstPersonCamera(0)
    reduced.frame(camera(1), renderedTarget, {
      playerPosition,
      challengeTarget: targetBounds,
      deltaSeconds: 1 / 60,
      reducedMotion: true,
    })
    expect(reduced.renderedYaw()).toBeCloseTo(expectedYaw)
    expect(reduced.settled()).toBe(true)
  })

  it('keeps a finite upward aim when a nearby wide target exceeds the FOV cap', () => {
    const view = createFirstPersonCamera(0)
    const subject = camera(320 / 720)
    const renderedTarget = new Vector3()

    view.frame(subject, renderedTarget, {
      playerPosition: { x: 0, y: 0, z: 0 },
      challengeTarget: new Box3(
        new Vector3(-5, 3.5, -2),
        new Vector3(5, 5.5, -1.5),
      ),
      safeBottomFraction: 0.42,
      reducedMotion: true,
    })

    const direction = renderedTarget.clone().sub(subject.position).normalize()
    expect(subject.fov).toBe(96)
    expect(direction.toArray().every(Number.isFinite)).toBe(true)
    expect(direction.y).toBeGreaterThan(0.5)
  })
})
