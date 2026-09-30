// Thawing Song presentation tests — route art follows lesson order and every visible blocker has honest contact.

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { SolidPropDefinition, Vec3 } from '../contracts'
import { FLAT_COURSE_COLLIDER } from '../core/collision'
import { MOVEMENT } from '../core/movement'
import { createMuseumAssetLoadPlan } from '../render/asset-load-plan'
import { resolveLivingCrystalPlatformPlacements } from '../render/living-crystal-platform-layout'
import { CLOUDWAY_THAWING_SONG } from './cloudway-thawing-song'
import { LIVING_CRYSTAL_PLATFORM_BUNDLE_ID } from './living-crystal-profile'
import { RESONANCE_ROSEBUD_BUNDLE_ID } from './resonance-rosebud-profile'

const level = CLOUDWAY_THAWING_SONG

function physicalAndSaveSignature(): string {
  const projection = {
    authored: level.authored,
    platforms: level.platforms,
    solids: level.solids,
    intentionalGaps: level.intentionalGaps,
    checkpoints: level.checkpoints,
    breakables: level.breakables.map(
      ({
        id,
        position,
        anchor,
        optional,
        requiresCompleted,
        challenge,
        presentation,
        mount,
      }) => ({
        id,
        position,
        anchor,
        optional,
        requiresCompleted,
        challenge,
        presentation,
        mount,
      }),
    ),
    melodyLesson: level.melodyLesson,
    exit: level.exit,
    fallBelow: level.fallBelow,
  }
  return createHash('sha256').update(JSON.stringify(projection)).digest('hex')
}

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
  it('preserves the certified physical route and saved-attempt identity', () => {
    expect(physicalAndSaveSignature()).toBe(
      'e25cc33a5aa550fa40e726eb200bf7fa8d315a2fa922c2216d1fea1a6bf3a42c',
    )
  })

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
      expect(room!.cameraBounds!.minX).toBeLessThanOrEqual(
        room!.bounds.minX - 5.4,
      )
      expect(room!.cameraBounds!.maxX).toBeGreaterThanOrEqual(
        room!.bounds.maxX + 5.4,
      )
      expect(room!.cameraBounds!.minZ).toBeLessThanOrEqual(
        room!.bounds.minZ - 5.4,
      )
      expect(room!.cameraBounds!.maxZ).toBeGreaterThanOrEqual(
        room!.bounds.maxZ + 5.4,
      )
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

  it('owns every plain encounter ID in its real route room', () => {
    expect(
      level.presentation?.rooms.map((room) => [
        room.id.split('/').at(-3),
        room.breakableIds,
      ]),
    ).toEqual([
      ['thaw-north', ['thaw-note-home']],
      ['thaw-first-gate', ['thaw-gate-rise']],
      ['thaw-east', ['thaw-note-crown']],
      ['thaw-second-gate', ['thaw-gate-return']],
      ['thaw-south', ['thaw-note-homecoming']],
      ['thaw-finale', ['thaw-portrait-finale']],
    ])
  })

  it('derives three grouped Living Crystal supports without changing their nine decks', () => {
    const placements = resolveLivingCrystalPlatformPlacements(level)
    expect(placements).toMatchObject([
      {
        platformId: 'thaw-current-home',
        coveredPlatformIds: [
          'thaw-arrival-2',
          'thaw-arrival-3',
          'thaw-arrival-4',
        ],
        roomId: `${level.id}/thaw-north/room/route`,
        position: { x: -6, y: 0, z: -10 },
        turns: 0,
        contactWidth: 3.2,
        contactDepth: 2.16,
      },
      {
        platformId: 'thaw-current-crown',
        coveredPlatformIds: [
          'thaw-lantern-1',
          'thaw-lantern-2',
          'thaw-lantern-3',
        ],
        roomId: `${level.id}/thaw-east/room/route`,
        position: { x: -5.4, y: 0, z: 2.63 },
        turns: 0,
        contactWidth: 3.2,
        contactDepth: 2.16,
      },
      {
        platformId: 'thaw-current-homecoming',
        coveredPlatformIds: ['thaw-home-1', 'thaw-home-2', 'thaw-home-3'],
        roomId: `${level.id}/thaw-south/room/route`,
        position: { x: 8.38, y: 0, z: 3.35 },
        turns: 1,
        contactWidth: 2.16,
        contactDepth: 3.2,
      },
    ])
    const covered = new Set(
      placements.flatMap((placement) => placement.coveredPlatformIds),
    )
    expect(covered.size).toBe(9)
    expect(
      level.presentation?.floorArt?.some((art) => covered.has(art.platformId)),
    ).toBe(false)
  })

  it('uses three tuned Rosebuds while retaining only the existing plinth collision', () => {
    expect(
      level.breakables
        .filter((target) =>
          [
            'thaw-note-home',
            'thaw-note-crown',
            'thaw-note-homecoming',
          ].includes(target.id),
        )
        .map((target) => [target.id, target.variant]),
    ).toEqual([
      ['thaw-note-home', 'resonance-rosebud-v1'],
      ['thaw-note-crown', 'resonance-rosebud-v1'],
      ['thaw-note-homecoming', 'resonance-rosebud-v1'],
    ])
    expect(level.presentation?.resonanceExhibits).toEqual([
      expect.objectContaining({
        encounterId: 'thaw-note-home',
        seed: 20_260_930,
        intensity: 0.78,
        cohesion: 0.95,
      }),
      expect.objectContaining({
        encounterId: 'thaw-note-crown',
        seed: 20_260_931,
        intensity: 1,
        cohesion: 0.8824,
      }),
      expect.objectContaining({
        encounterId: 'thaw-note-homecoming',
        seed: 20_260_932,
        intensity: 0.88,
        cohesion: 0.93,
      }),
    ])
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

  it('keeps opaque enclosure bays and native-pruned kits out of the open garden load plan', () => {
    const plan = createMuseumAssetLoadPlan(level)
    expect(level.presentation?.visuals).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recipeId: 'museum-screen-v4' }),
      ]),
    )
    expect(plan.bundles).toContain('museum-decor-v5')
    expect(
      plan.bundles.filter(
        (bundle) => bundle === LIVING_CRYSTAL_PLATFORM_BUNDLE_ID,
      ),
    ).toEqual([LIVING_CRYSTAL_PLATFORM_BUNDLE_ID])
    expect(
      plan.bundles.filter((bundle) => bundle === RESONANCE_ROSEBUD_BUNDLE_ID),
    ).toEqual([RESONANCE_ROSEBUD_BUNDLE_ID])
    expect(plan.bundles).not.toContain('museum-screen-v4')
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
