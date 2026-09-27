// Thawing Song presentation tests — route art follows lesson order and every visible blocker has honest contact.

import { describe, expect, it } from 'vitest'
import type { SolidPropDefinition, Vec3 } from '../contracts'
import { FLAT_COURSE_COLLIDER } from '../core/collision'
import { MOVEMENT } from '../core/movement'
import { createMuseumAssetLoadPlan } from '../render/asset-load-plan'
import { CLOUDWAY_THAWING_SONG } from './cloudway-thawing-song'

const level = CLOUDWAY_THAWING_SONG

function cylinder(
  id: string,
): Extract<SolidPropDefinition, { shape: 'cylinder' }> {
  const solid = level.solids?.find((candidate) => candidate.id === id)
  if (solid?.shape !== 'cylinder')
    throw new Error(`Expected cylinder solid "${id}".`)
  return solid
}

function localPoint(origin: Vec3, yaw: number, x: number, z: number): Vec3 {
  return {
    x: origin.x + Math.cos(yaw) * x + Math.sin(yaw) * z,
    y: origin.y,
    z: origin.z - Math.sin(yaw) * x + Math.cos(yaw) * z,
  }
}

function localZ(origin: Vec3, yaw: number, position: Vec3): number {
  const x = position.x - origin.x
  const z = position.z - origin.z
  return Math.sin(yaw) * x + Math.cos(yaw) * z
}

describe('The Thawing Song presentation', () => {
  it('derives six bounded render rooms from the authored route sections', () => {
    expect(level.camera?.kind).toBe('route-sections')
    if (level.camera?.kind !== 'route-sections') return
    expect(level.presentation?.rooms).toHaveLength(6)
    for (const section of level.camera.sections) {
      const room = level.presentation?.rooms.find(
        (candidate) => candidate.id === `${level.id}/${section.id}/room/route`,
      )
      expect(room, section.id).toBeDefined()
      for (const platformId of section.platformIds) {
        const platform = level.platforms.find(
          (candidate) => candidate.id === platformId,
        )!
        expect(room!.bounds.minX).toBeLessThanOrEqual(platform.minX)
        expect(room!.bounds.maxX).toBeGreaterThanOrEqual(platform.maxX)
        expect(room!.bounds.minZ).toBeLessThanOrEqual(platform.minZ)
        expect(room!.bounds.maxZ).toBeGreaterThanOrEqual(platform.maxZ)
      }
    }
  })

  it('maps the five physical cues directly from ordered lesson stations', () => {
    const lesson = level.melodyLesson!
    const markers = level.presentation?.melodyMarkers ?? []
    const pitchOffsets = lesson.melody.phrases.flatMap((phrase) =>
      phrase.anchors.map((anchor) => anchor.offsetSemitones),
    )

    expect(
      markers.map(({ encounterId, anchorId }) => ({ encounterId, anchorId })),
    ).toEqual(lesson.stations)
    expect(markers.map((marker) => marker.pitchOffsetSemitones)).toEqual(
      pitchOffsets,
    )
    expect(markers.map((marker) => marker.pitchOffsetSemitones)).toEqual([
      0, 2, 4, 2, 0,
    ])
    for (const marker of markers) {
      expect(marker.position.y).toBe(0)
      expect(marker.roomId).toMatch(/\/room\/route$/)
      expect(
        level.platforms.some(
          (platform) =>
            marker.position.x >= platform.minX &&
            marker.position.x <= platform.maxX &&
            marker.position.z >= platform.minZ &&
            marker.position.z <= platform.maxZ &&
            marker.position.y === platform.top,
        ),
        marker.id,
      ).toBe(true)
    }
  })

  it('closes both frost-wall side lips with four visible planter bowls', () => {
    const planters = (level.presentation?.decorations ?? []).filter((item) =>
      item.id.includes('-planter'),
    )
    expect(planters).toHaveLength(4)

    const expectedPositions = [
      [-6.83, 1.55],
      [-3.97, 1.55],
      [7.3, 1.92],
      [7.3, 4.78],
    ]
    const actualPositions = planters
      .map((planter) => [planter.position.x, planter.position.z])
      .sort(([leftX, leftZ], [rightX, rightZ]) =>
        leftX === rightX ? leftZ - rightZ : leftX - rightX,
      )
    expectedPositions.forEach(([x, z], index) => {
      expect(actualPositions[index]![0]).toBeCloseTo(x, 10)
      expect(actualPositions[index]![1]).toBeCloseTo(z, 10)
    })

    for (const planter of planters) {
      expect(planter.recipeId).toBe('crystal-planter-v5')
      expect(planter.coveredSolidIds).toHaveLength(1)
      const bowl = cylinder(planter.coveredSolidIds![0]!)
      expect(bowl).toMatchObject({
        radiusTop: 0.1,
        radiusBottom: 0.17,
        top: 1.08,
        thickness: 1.08,
        presentation: { role: 'plinth', material: 'stone' },
      })
      expect(planter.position.y).toBe(0)
      expect(planter.scale).toBe(0.82)
    }

    // In gate-local X, each bowl overlaps the 1.356m frame edge and reaches
    // beyond the 1.6m Pearl slab edge while leaving the 0.86m pane clear.
    expect(1.43 - 0.29).toBeGreaterThan(0.86)
    expect(1.43 - 0.29).toBeLessThan(1.355656505)
    expect(1.43 + 0.29).toBeGreaterThan(1.6)
  })

  it('blocks a wall-side crossing at ground and at Merc jump apex', () => {
    const solids = [...level.platforms, ...(level.solids ?? [])]
    for (const encounterId of ['thaw-gate-rise', 'thaw-gate-return']) {
      const gate = level.breakables.find(
        (candidate) => candidate.id === encounterId,
      )!
      if (gate.presentation?.kind !== 'barrier')
        throw new Error(`Expected barrier "${encounterId}".`)
      const yaw = gate.presentation.facingYaw
      for (const side of [-1, 1])
        for (const feetY of [0, MOVEMENT.jumpHeight])
          for (const direction of [-1, 1]) {
            const start = localPoint(
              { ...gate.position, y: feetY },
              yaw,
              side * 1.6,
              direction * -0.7,
            )
            const localDistance = direction * 1.4
            const collision = FLAT_COURSE_COLLIDER.move(
              start,
              {
                x: Math.sin(yaw) * localDistance,
                y: 0,
                z: Math.cos(yaw) * localDistance,
              },
              solids,
              MOVEMENT,
            )
            expect(
              localZ(gate.position, yaw, collision.position) * direction,
              `${encounterId} side ${side} at ${feetY}m`,
            ).toBeLessThan(0)
          }
    }
  })

  it('pairs every screen with a visible proxy and keeps native-pruned kits out of the load plan', () => {
    const screens =
      level.presentation?.visuals.filter(
        (visual) => visual.recipeId === 'museum-screen-v4',
      ) ?? []
    expect(screens).toHaveLength(5)
    expect(
      screens.map(({ id, position, yaw }) => ({
        id: id.slice(id.lastIndexOf('/') + 1),
        position,
        yaw,
      })),
    ).toEqual([
      {
        id: 'arrival-west-screen',
        position: { x: -7.72, y: 0, z: -10 },
        yaw: Math.PI / 2,
      },
      {
        id: 'crown-west-screen',
        position: { x: -1.65, y: 0, z: 4.54 },
        yaw: Math.PI,
      },
      {
        id: 'crown-east-screen',
        position: { x: 1.55, y: 0, z: 4.54 },
        yaw: Math.PI,
      },
      {
        id: 'homecoming-north-screen',
        position: { x: 10.3, y: 0, z: -0.4 },
        yaw: -Math.PI / 2,
      },
      {
        id: 'homecoming-south-screen',
        position: { x: 10.3, y: 0, z: -4.15 },
        yaw: -Math.PI / 2,
      },
    ])
    for (const screen of screens) {
      expect(screen.coveredSolidIds).toHaveLength(1)
      const solid = level.solids?.find(
        (candidate) => candidate.id === screen.coveredSolidIds![0],
      )
      expect(solid?.presentation).toEqual({ role: 'wall', material: 'stone' })
    }

    const plan = createMuseumAssetLoadPlan(level)
    expect(plan.bundles).toEqual(
      expect.arrayContaining(['museum-screen-v4', 'museum-decor-v5']),
    )
    expect(plan.bundles).not.toEqual(
      expect.arrayContaining([
        'museum-garden-v2',
        'museum-column-v3',
        'museum-arcade-v3',
        'museum-canopy-v3',
      ]),
    )
  })
})
