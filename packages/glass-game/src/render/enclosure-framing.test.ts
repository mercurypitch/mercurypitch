// Enclosure framing regression — authored room unions bound a camera-sized boom.

import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { GLASS_ENCLOSED_CHAMBER } from '../content/enclosed-chamber'
import type { Bounds3, LevelDefinition } from '../contracts'
import { CAMERA_CLEARANCE_RADIUS, CAMERA_TARGET_LOOK_AHEAD, createEnclosureFraming, } from './enclosure-framing'

function levelWithVolumes(cameraBounds: readonly Bounds3[]): LevelDefinition {
  return {
    id: 'enclosure-framing-proof',
    title: 'Enclosure framing proof',
    spawn: { position: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
    platforms: [
      {
        id: 'floor',
        minX: -10,
        maxX: 10,
        minZ: -10,
        maxZ: 10,
        top: 0,
        thickness: 0.25,
        kind: 'deck',
        material: 'stone',
      },
    ],
    solids: [
      {
        id: 'progress-gate',
        kind: 'prop',
        shape: 'box',
        minX: -0.6,
        maxX: 0.6,
        minZ: 1,
        maxZ: 1.12,
        top: 1.55,
        thickness: 1.55,
        presentation: { role: 'gate', material: 'brass' },
      },
    ],
    checkpoints: [
      {
        id: 'spawn',
        position: { x: 0, y: 0, z: 0 },
        radius: 1,
        facingYaw: 0,
      },
    ],
    breakables: [],
    exit: {
      minX: 8,
      maxX: 9,
      minZ: 8,
      maxZ: 9,
      top: 0,
      requiresCompleted: [],
    },
    fallBelow: -2,
    presentation: {
      worldBounds: {
        minX: -10,
        maxX: 10,
        minY: -1,
        maxY: 5,
        minZ: -10,
        maxZ: 10,
      },
      lightBounds: {
        minX: -10,
        maxX: 10,
        minY: -1,
        maxY: 5,
        minZ: -10,
        maxZ: 10,
      },
      rooms: cameraBounds.map((bounds, index) => ({
        id: `room-${index}`,
        bounds,
        cameraBounds: bounds,
      })),
      audioRegions: [],
      visuals: [],
      assetRecipeIds: [],
    },
  }
}

const FIRST_VOLUME: Bounds3 = {
  minX: -1,
  maxX: 1,
  minY: 0,
  maxY: 3.44,
  minZ: -2,
  maxZ: 1,
}

const CHAMBER_GATE = 'glassworks-chamber/chamber/chamber/solid/east-center-body'
const REVEAL_GATE = 'glassworks-chamber/chamber/reveal/solid/north-gate-body'

describe('enclosure framing', () => {
  it('traverses the real chamber joins while active gates retain each reveal', () => {
    const framing = createEnclosureFraming(GLASS_ENCLOSED_CHAMBER)!
    const east = new Vector3(1, 0, 0)
    const north = new Vector3(0, 0, 1)
    const chamber = new Vector3(0, 2.8, 0)
    const corner = new Vector3(12.096_037_511_825_562, 2.8, 0)

    // The chamber, entry and corner volumes remain camera-continuous, while
    // the active east screen owns the doorway until its encounter completes.
    expect(framing.volumeDistance(chamber, east, 20)).toBeGreaterThan(13)
    expect(
      framing.solidDistance(chamber, east, 20, [CHAMBER_GATE]),
    ).toBeLessThan(4.5)
    expect(framing.solidDistance(chamber, east, 20, [])).toBe(20)

    // The turn, reveal, narrow terrace neck and broad exterior panorama form
    // one continuous union. The second gate still prevents an early reveal.
    expect(framing.volumeDistance(corner, north, 20)).toBeGreaterThan(15.9)
    expect(
      framing.solidDistance(corner, north, 20, [REVEAL_GATE]),
    ).toBeLessThan(8)
    expect(framing.solidDistance(corner, north, 20, [])).toBe(20)
  })

  it('traverses collinear volume unions only when camera-sized joins remain continuous', () => {
    const joined = createEnclosureFraming(
      levelWithVolumes([
        FIRST_VOLUME,
        {
          ...FIRST_VOLUME,
          minZ: FIRST_VOLUME.maxZ - CAMERA_CLEARANCE_RADIUS * 2,
          maxZ: 4,
        },
      ]),
    )
    const gapped = createEnclosureFraming(
      levelWithVolumes([
        FIRST_VOLUME,
        {
          ...FIRST_VOLUME,
          minZ: FIRST_VOLUME.maxZ - CAMERA_CLEARANCE_RADIUS * 2 + 0.02,
          maxZ: 4,
        },
      ]),
    )
    const origin = new Vector3(0, 0.42, 0)
    const direction = new Vector3(0, 0, 1)

    expect(joined).not.toBeNull()
    expect(gapped).not.toBeNull()
    expect(joined!.volumeDistance(origin, direction, 4)).toBeCloseTo(3.75)
    expect(gapped!.volumeDistance(origin, direction, 4)).toBeCloseTo(0.75)
  })

  it('keeps an active gate across the full doorway camera volume', () => {
    const framing = createEnclosureFraming(
      levelWithVolumes([
        FIRST_VOLUME,
        { ...FIRST_VOLUME, minZ: 0.52, maxZ: 4 },
      ]),
    )!
    const origin = new Vector3(0, 2.8, 0)
    const direction = new Vector3(0, 0, 1)

    expect(
      framing.solidDistance(origin, direction, 4, ['progress-gate']),
    ).toBeCloseTo(0.75)
    expect(framing.solidDistance(origin, direction, 4, [])).toBe(4)
  })

  it('clips look-ahead before active straight and rotated gates', () => {
    const volumes = [FIRST_VOLUME, { ...FIRST_VOLUME, minZ: 0.52, maxZ: 4 }]
    const straight = createEnclosureFraming(levelWithVolumes(volumes))!
    const straightTarget = new Vector3()
    expect(
      straight.frameTarget(
        new Vector3(0, 0.42, 0.7),
        Math.PI,
        ['progress-gate'],
        straightTarget,
      ),
    ).toBe(true)
    expect(straightTarget.z).toBeCloseTo(0.99)

    const rotatedLevel: LevelDefinition = {
      ...levelWithVolumes([
        { ...FIRST_VOLUME, maxX: 1 },
        { ...FIRST_VOLUME, minX: 0.52, maxX: 4 },
      ]),
      solids: [
        {
          id: 'rotated-gate',
          kind: 'prop',
          shape: 'box',
          minX: 1,
          maxX: 1.12,
          minZ: -0.6,
          maxZ: 0.6,
          top: 1.55,
          thickness: 1.55,
          presentation: { role: 'gate', material: 'brass' },
        },
      ],
    }
    const rotated = createEnclosureFraming(rotatedLevel)!
    const rotatedTarget = new Vector3()
    expect(
      rotated.frameTarget(
        new Vector3(0.7, 0.42, 0),
        -Math.PI / 2,
        ['rotated-gate'],
        rotatedTarget,
      ),
    ).toBe(true)
    expect(rotatedTarget.x).toBeCloseTo(0.99)
  })

  it('allows a wall-pressed pivot to boom outward from camera clearance', () => {
    const framing = createEnclosureFraming(levelWithVolumes([FIRST_VOLUME]))!
    const pressedPivot = new Vector3(0, 0.42, 0.8)

    expect(
      framing.solidDistance(pressedPivot, new Vector3(0, 0, -1), 4, [
        'progress-gate',
      ]),
    ).toBe(4)
    expect(
      framing.solidDistance(pressedPivot, new Vector3(0, 0, 1), 4, [
        'progress-gate',
      ]),
    ).toBe(0)
  })

  it('clips a smoothed L-corner target before it crosses the missing quadrant', () => {
    const horizontal: Bounds3 = {
      minX: -4,
      maxX: 4,
      minY: 0,
      maxY: 3.44,
      minZ: -1,
      maxZ: 1,
    }
    const vertical: Bounds3 = {
      minX: -1,
      maxX: 1,
      minY: 0,
      maxY: 3.44,
      minZ: 0.52,
      maxZ: 4,
    }
    const framing = createEnclosureFraming(
      levelWithVolumes([horizontal, vertical]),
    )!
    const body = new Vector3(3.5, 0.42, 0)
    const smoothedFromNextRoom = new Vector3(0, 0.42, 3.5)
    const constrained = new Vector3()

    expect(
      framing.constrainTarget(body, smoothedFromNextRoom, [], constrained),
    ).toBe(true)
    expect(constrained.distanceTo(smoothedFromNextRoom)).toBeGreaterThan(2)
    expect(constrained.z).toBeLessThan(1)
  })

  it('adds stable look-ahead but falls back at a respawn outside authored volumes', () => {
    const framing = createEnclosureFraming(levelWithVolumes([FIRST_VOLUME]))!
    const target = new Vector3()

    expect(framing.frameTarget(new Vector3(0, 0.42, 0), 0, [], target)).toBe(
      true,
    )
    expect(target).toEqual(new Vector3(0, 0.42, -CAMERA_TARGET_LOOK_AHEAD))

    const respawn = new Vector3(8, 0.42, 8)
    expect(framing.frameTarget(respawn, Math.PI, [], target)).toBe(false)
    expect(target).toEqual(respawn)
    expect(framing.volumeDistance(respawn, new Vector3(0, 0, 1), 4)).toBeNull()
  })
})
