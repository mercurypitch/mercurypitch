// Challenge camera planning — two-subject framing and reversible presentation timing.

import { Box3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { ChallengeCameraShot } from './challenge-camera'
import { createChallengeCameraDirector, planChallengeCameraShot, } from './challenge-camera'

const merc = new Box3(
  new Vector3(-0.35, 0, -0.28),
  new Vector3(0.35, 1.35, 0.28),
)
const tallExhibit = new Box3(
  new Vector3(0.85, 0.25, -0.36),
  new Vector3(1.45, 2.85, 0.36),
)

function shot(position: Vector3, target = new Vector3()): ChallengeCameraShot {
  const frame = { minX: -0.5, maxX: 0.5, minY: -0.5, maxY: 0.5 }
  return {
    pose: { position, target, fovDegrees: 48 },
    mercFrame: frame,
    targetFrame: frame,
    combinedFrame: frame,
    safeBottomNdc: -0.4,
    side: 1,
    clearance: 1,
    occluded: false,
  }
}

describe('planChallengeCameraShot', () => {
  it.each([
    { aspect: 16 / 9, safeBottomFraction: 0.31 },
    { aspect: 9 / 16, safeBottomFraction: 0.46 },
  ])(
    'fits Merc and a tall exhibit above the live panel at aspect $aspect',
    ({ aspect, safeBottomFraction }) => {
      const result = planChallengeCameraShot(
        { encounterId: 'portrait', merc, target: tallExhibit },
        {
          aspect,
          fovDegrees: 48,
          near: 0.05,
          far: 180,
          safeBottomFraction,
          currentPosition: new Vector3(0, 1.8, 4),
        },
      )

      expect(result.mercFrame.minY).toBeGreaterThanOrEqual(
        result.safeBottomNdc - 0.001,
      )
      expect(result.targetFrame.minY).toBeGreaterThanOrEqual(
        result.safeBottomNdc - 0.001,
      )
      expect(result.combinedFrame.minX).toBeGreaterThanOrEqual(-0.881)
      expect(result.combinedFrame.maxX).toBeLessThanOrEqual(0.881)
      expect(result.combinedFrame.maxY).toBeLessThanOrEqual(0.861)
      expect(result.pose.position.y).toBeLessThan(0.7)
      if (aspect < 1) expect(result.pose.fovDegrees).toBeGreaterThan(48)
      else expect(result.pose.fovDegrees).toBe(48)
    },
  )

  it('chooses the unobstructed three-quarter side', () => {
    const result = planChallengeCameraShot(
      { encounterId: 'goblet', merc, target: tallExhibit },
      {
        aspect: 16 / 9,
        fovDegrees: 48,
        near: 0.05,
        far: 180,
        safeBottomFraction: 0.28,
        currentPosition: new Vector3(0, 2, 4),
        isOccluded: (position) => position.z > 0,
      },
    )

    expect(result.side).toBe(-1)
    expect(result.occluded).toBe(false)
  })

  it('still returns a bounded fallback for an exhibit larger than its search range', () => {
    const hugePortrait = new Box3(
      new Vector3(-12, 0, -1),
      new Vector3(12, 18, 1),
    )

    expect(() =>
      planChallengeCameraShot(
        { encounterId: 'huge', merc, target: hugePortrait },
        {
          aspect: 9 / 16,
          fovDegrees: 48,
          near: 0.05,
          far: 180,
          safeBottomFraction: 0.5,
          currentPosition: new Vector3(0, 2, 4),
        },
      ),
    ).not.toThrow()
  })
})

describe('createChallengeCameraDirector', () => {
  const exploration = {
    position: new Vector3(0, 2, 4),
    target: new Vector3(0, 0.6, 0),
    fovDegrees: 48,
  }

  it('holds through the encounter and returns to the exact exploration pose', () => {
    const director = createChallengeCameraDirector({ reducedMotion: false })
    const challengeShot = shot(new Vector3(2.4, 0.55, 1.8))
    for (let frame = 0; frame < 20; frame++)
      director.update({
        encounterId: 'goblet',
        paused: false,
        deltaSeconds: 0.05,
        explorationPose: exploration,
        shot: challengeShot,
      })

    expect(director.snapshot()).toMatchObject({
      mode: 'holding',
      encounterId: 'goblet',
      progress: 1,
    })
    const held = director.update({
      encounterId: 'goblet',
      paused: false,
      deltaSeconds: 0.05,
      explorationPose: exploration,
      shot: challengeShot,
    })!
    expect(held.position.distanceTo(challengeShot.pose.position)).toBeLessThan(
      Number.EPSILON * 4,
    )

    let restored = held
    for (let frame = 0; frame < 15; frame++)
      restored = director.update({
        encounterId: null,
        paused: false,
        deltaSeconds: 0.05,
        explorationPose: exploration,
        shot: null,
      })!

    expect(director.snapshot().mode).toBe('exploration')
    expect(restored.position.toArray()).toEqual(exploration.position.toArray())
    expect(restored.target.toArray()).toEqual(exploration.target.toArray())
  })

  it('freezes while paused, then smoothly reframes a changed live panel', () => {
    const director = createChallengeCameraDirector({ reducedMotion: false })
    const first = shot(new Vector3(2.4, 0.55, 1.8))
    for (let frame = 0; frame < 20; frame++)
      director.update({
        encounterId: 'portrait',
        paused: false,
        deltaSeconds: 0.05,
        explorationPose: exploration,
        shot: first,
      })
    const beforePause = director.update({
      encounterId: 'portrait',
      paused: true,
      deltaSeconds: 0.05,
      explorationPose: exploration,
      shot: first,
    })!
    const duringPause = director.update({
      encounterId: null,
      paused: true,
      deltaSeconds: 0.05,
      explorationPose: exploration,
      shot: null,
    })!
    expect(duringPause.position.toArray()).toEqual(
      beforePause.position.toArray(),
    )

    const changed = shot(new Vector3(3.2, 0.7, 2.2))
    const firstReframe = director.update({
      encounterId: 'portrait',
      paused: false,
      deltaSeconds: 0.05,
      explorationPose: exploration,
      shot: changed,
    })!
    expect(
      firstReframe.position.distanceTo(changed.pose.position),
    ).toBeGreaterThan(0.05)
    for (let frame = 0; frame < 40; frame++)
      director.update({
        encounterId: 'portrait',
        paused: false,
        deltaSeconds: 0.05,
        explorationPose: exploration,
        shot: changed,
      })
    const settled = director.update({
      encounterId: 'portrait',
      paused: false,
      deltaSeconds: 0.05,
      explorationPose: exploration,
      shot: changed,
    })!
    expect(settled.position.distanceTo(changed.pose.position)).toBeLessThan(
      0.001,
    )
  })
})
