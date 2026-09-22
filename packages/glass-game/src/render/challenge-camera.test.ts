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

// Shipped Cloudway finale placement with the scaled legend-slab frame and its
// presentation ring. Merc's bounds reflect the 0.55 m runtime rig scale.
const cloudwayPortrait = new Box3(
  new Vector3(0.657_778, 0.185, 30.905),
  new Vector3(1.342_222, 1.124_944, 31.395),
)
const cloudwayPortraitFacing = new Vector3(0, 0, -1)

function cloudwayMerc(x: number, z: number): Box3 {
  return new Box3(
    new Vector3(x - 0.27, 0.015, z - 0.19),
    new Vector3(x + 0.27, 0.565, z + 0.19),
  )
}

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
      expect(result.pose.position.y).toBeGreaterThan(merc.max.y + 0.1)
      expect(result.pose.position.y).toBeLessThan(tallExhibit.max.y)
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

  it('keeps the authored face of a flat portrait readable', () => {
    const targetFacing = new Vector3(1, 0, 0)
    const result = planChallengeCameraShot(
      {
        encounterId: 'flat-portrait',
        merc,
        target: tallExhibit,
        targetFacing,
      },
      {
        aspect: 320 / 640,
        fovDegrees: 48,
        near: 0.05,
        far: 180,
        safeBottomFraction: 0.55,
        currentPosition: new Vector3(0, 2, 4),
      },
    )
    const targetCentre = tallExhibit.getCenter(new Vector3())
    const view = result.pose.position.sub(targetCentre).setY(0).normalize()
    const targetSide = new Vector3(-targetFacing.z, 0, targetFacing.x)

    expect(view.dot(targetFacing)).toBeGreaterThan(0.45)
    expect(Math.abs(view.dot(targetSide))).toBeGreaterThan(0.55)
    expect(result.combinedFrame.minX).toBeGreaterThanOrEqual(-0.881)
    expect(result.combinedFrame.maxX).toBeLessThanOrEqual(0.881)
  })

  it('preserves the established side when a live-panel reframe still fits', () => {
    const options = {
      aspect: 390 / 844,
      fovDegrees: 48,
      near: 0.05,
      far: 180,
      safeBottomFraction: 0.46,
      currentPosition: new Vector3(0, 2, 4),
    }
    const initial = planChallengeCameraShot(
      { encounterId: 'portrait', merc, target: tallExhibit },
      options,
    )
    const preferredSide = initial.side === 1 ? -1 : 1
    const reframed = planChallengeCameraShot(
      { encounterId: 'portrait', merc, target: tallExhibit },
      { ...options, safeBottomFraction: 0.5, preferredSide },
    )

    expect(reframed.side).toBe(preferredSide)
    expect(reframed.combinedFrame.minX).toBeGreaterThanOrEqual(-0.881)
    expect(reframed.combinedFrame.maxX).toBeLessThanOrEqual(0.881)
  })

  it.each([
    {
      label: 'centred desktop approach after a far zoom',
      aspect: 1440 / 900,
      safeBottomFraction: 0.34,
      merc: cloudwayMerc(1, 30.4),
      currentPosition: new Vector3(1, 2.25, 24.4),
    },
    {
      label: 'left tablet approach after a near zoom',
      aspect: 1024 / 768,
      safeBottomFraction: 0.38,
      merc: cloudwayMerc(0.45, 30.3),
      currentPosition: new Vector3(0.45, 1.45, 28.5),
    },
    {
      label: 'right phone approach',
      aspect: 390 / 844,
      safeBottomFraction: 0.48,
      merc: cloudwayMerc(1.55, 30.3),
      currentPosition: new Vector3(4.55, 2.1, 30.3),
    },
  ])(
    'keeps the Cloudway portrait front-facing in a raised side composition: $label',
    ({
      aspect,
      safeBottomFraction,
      merc: cloudwayMercBounds,
      currentPosition,
    }) => {
      const result = planChallengeCameraShot(
        {
          encounterId: 'cloudway-finale-portrait',
          merc: cloudwayMercBounds,
          target: cloudwayPortrait,
          targetFacing: cloudwayPortraitFacing,
        },
        {
          aspect,
          fovDegrees: 48,
          near: 0.05,
          far: 180,
          safeBottomFraction,
          currentPosition,
        },
      )
      const portraitCentre = cloudwayPortrait.getCenter(new Vector3())
      const view = result.pose.position.clone().sub(portraitCentre).setY(0)
      view.normalize()
      const horizontalOverlap = Math.max(
        0,
        Math.min(result.mercFrame.maxX, result.targetFrame.maxX) -
          Math.max(result.mercFrame.minX, result.targetFrame.minX),
      )
      const narrowerSubject = Math.min(
        result.mercFrame.maxX - result.mercFrame.minX,
        result.targetFrame.maxX - result.targetFrame.minX,
      )

      expect(view.dot(cloudwayPortraitFacing)).toBeGreaterThan(0.45)
      expect(Math.abs(view.x)).toBeGreaterThan(0.68)
      expect(horizontalOverlap / narrowerSubject).toBeLessThanOrEqual(0.2)
      expect(result.pose.position.y).toBeGreaterThan(
        cloudwayMercBounds.max.y + 0.1,
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
    },
  )

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
