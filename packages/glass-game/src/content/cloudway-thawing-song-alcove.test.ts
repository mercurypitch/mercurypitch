// Thawing Song alcove tests — optional discoveries stay safe, finite and outside the required lesson.

import { describe, expect, it } from 'vitest'
import type { LevelDefinition, Vec3 } from '../contracts.ts'
import { containsBody, FLAT_COURSE_COLLIDER } from '../core/collision.ts'
import { MOVEMENT } from '../core/movement.ts'
import { getRequiredRouteBreakableIds, readProgress } from '../core/progress.ts'
import { applyEncounterRewards, emptyRewardProgress } from '../core/rewards.ts'
import { CLOUDWAY_THAWING_SONG } from './cloudway-thawing-song.ts'
import { CLOUDWAY_THAWING_SONG_ALCOVE } from './cloudway-thawing-song-alcove.ts'
import { THAWING_SONG_ALCOVE_BEACON_POSE, THAWING_SONG_ALCOVE_ID, THAWING_SONG_ALCOVE_LESSON_ID, THAWING_SONG_ALCOVE_OPTIONAL_IDS, } from './thawing-song-alcove-source.ts'

const canonical = CLOUDWAY_THAWING_SONG
const alcove = CLOUDWAY_THAWING_SONG_ALCOVE

function platform(level: LevelDefinition, id: string) {
  const result = level.platforms.find((candidate) => candidate.id === id)
  if (result === undefined) throw new Error(`Missing platform "${id}".`)
  return result
}

function encounter(level: LevelDefinition, id: string) {
  const result = level.breakables.find((candidate) => candidate.id === id)
  if (result === undefined) throw new Error(`Missing encounter "${id}".`)
  return result
}

function hasStaticBodySupport(level: LevelDefinition, position: Vec3): boolean {
  return level.platforms.some(
    (candidate) =>
      candidate.behavior === undefined &&
      candidate.surface === undefined &&
      containsBody(position, MOVEMENT, candidate),
  )
}

describe('The Thawing Song Curator Alcove', () => {
  it('uses a distinct save and melody identity without changing the canonical course', () => {
    expect(alcove.id).toBe(THAWING_SONG_ALCOVE_ID)
    expect(alcove.id).not.toBe(canonical.id)
    expect(alcove.authored).toEqual({
      levelId: THAWING_SONG_ALCOVE_ID,
      layoutId: 'thawing-song-curator-alcove-v1',
      contentRevision: 1,
    })
    expect(alcove.melodyLesson?.id).toBe(THAWING_SONG_ALCOVE_LESSON_ID)
    expect(canonical.melodyLesson?.id).toBe('thawing-song-sunlit')
    expect(
      canonical.platforms.some(({ id }) => id.startsWith('thaw-alcove')),
    ).toBe(false)
    expect(
      canonical.breakables.some(({ id }) => id.startsWith('thaw-alcove')),
    ).toBe(false)

    const restored = readProgress(alcove, {
      version: 3,
      levelId: canonical.id,
      checkpointId: canonical.checkpoints.at(-1)?.id,
      completedBreakableIds: canonical.breakables.map(({ id }) => id),
      finished: true,
      rewards: {
        version: 1,
        discoveredEncounterIds: ['thaw-alcove-goblet'],
        collectedCoinIds: ['thaw-alcove-sun-coin'],
        qualityResults: [],
        collectedPortraitIds: [],
      },
    })
    expect(restored).toMatchObject({
      levelId: THAWING_SONG_ALCOVE_ID,
      checkpointId: alcove.spawn.checkpointId,
      completedBreakableIds: [],
      finished: false,
      rewards: {
        discoveredEncounterIds: [],
        collectedCoinIds: [],
      },
    })
  })

  it('keeps the five-note lesson and finale as the entire required route', () => {
    expect(getRequiredRouteBreakableIds(alcove)).toEqual(
      getRequiredRouteBreakableIds(canonical),
    )
    expect(alcove.exit.requiresCompleted).toEqual(
      canonical.exit.requiresCompleted,
    )
    expect(alcove.melodyLesson?.stations).toEqual(
      canonical.melodyLesson?.stations,
    )
    expect(alcove.melodyLesson?.finaleEncounterId).toBe(
      canonical.melodyLesson?.finaleEncounterId,
    )

    for (const id of THAWING_SONG_ALCOVE_OPTIONAL_IDS) {
      const target = encounter(alcove, id)
      expect(target.optional).toBe(true)
      expect(target.requiresCompleted).toEqual(['thaw-note-crown'])
      expect(target.challenge.kind).toBe('hold')
      expect(getRequiredRouteBreakableIds(alcove)).not.toContain(id)
    }
  })

  it('joins a marked static side court to the east route with no hidden gaps', () => {
    const joins = [
      ['thaw-east-2-3', 'thaw-alcove-approach', 'z'],
      ['thaw-alcove-approach', 'thaw-alcove-court-1', 'z'],
      ['thaw-alcove-court-1', 'thaw-alcove-court-2', 'z'],
      ['thaw-alcove-court-2', 'thaw-alcove-court-3', 'z'],
      ['thaw-alcove-court-2', 'thaw-alcove-beacon-rest', 'x'],
    ] as const
    for (const [beforeId, afterId, axis] of joins) {
      const before = platform(alcove, beforeId)
      const after = platform(alcove, afterId)
      const beforeEdge = axis === 'x' ? before.maxX : before.maxZ
      const afterEdge = axis === 'x' ? after.minX : after.minZ
      expect(afterEdge - beforeEdge, `${beforeId} -> ${afterId}`).toBeCloseTo(
        0,
        12,
      )
    }

    const added = alcove.platforms.filter(({ id }) =>
      id.startsWith('thaw-alcove'),
    )
    expect(added).toHaveLength(5)
    for (const support of added) {
      expect(support.behavior, support.id).toBeUndefined()
      expect(support.surface, support.id).toBeUndefined()
    }

    const safePositions = [
      ...THAWING_SONG_ALCOVE_OPTIONAL_IDS.map(
        (id) => encounter(alcove, id).anchor,
      ),
      alcove.checkpoints.find(({ id }) => id === 'thaw-alcove-save')!.position,
      THAWING_SONG_ALCOVE_BEACON_POSE.position,
    ]
    for (const position of safePositions)
      expect(
        hasStaticBodySupport(alcove, position),
        JSON.stringify(position),
      ).toBe(true)
  })

  it.each([1 / 30, 1 / 60])(
    'walks the side court and both anchors on static support at %s seconds/frame',
    (dt) => {
      let position = { x: 1.55, y: 0, z: 4.07 }
      const destinations = [
        { x: 1.55, y: 0, z: 8.71 },
        encounter(alcove, 'thaw-alcove-goblet').anchor,
        encounter(alcove, 'thaw-alcove-coupe').anchor,
        THAWING_SONG_ALCOVE_BEACON_POSE.position,
      ]
      for (const destination of destinations) {
        let steps = 0
        while (
          Math.hypot(destination.x - position.x, destination.z - position.z) >
          1e-8
        ) {
          const dx = destination.x - position.x
          const dz = destination.z - position.z
          const distance = Math.hypot(dx, dz)
          const stride = Math.min(distance, 1.35 * dt)
          const collision = FLAT_COURSE_COLLIDER.move(
            position,
            {
              x: (dx / distance) * stride,
              y: 0,
              z: (dz / distance) * stride,
            },
            alcove.platforms,
            MOVEMENT,
            alcove.intentionalGaps,
          )
          position = collision.position
          expect(collision.support, JSON.stringify(position)).not.toBeNull()
          expect(position.y).toBe(0)
          expect(++steps).toBeLessThan(1_000)
        }
      }
    },
  )

  it('reserves a supported beacon pose clear of the vocal anchors and exhibits', () => {
    const support = platform(
      alcove,
      THAWING_SONG_ALCOVE_BEACON_POSE.supportingPlatformId,
    )
    expect(
      containsBody(THAWING_SONG_ALCOVE_BEACON_POSE.position, MOVEMENT, support),
    ).toBe(true)

    for (const id of THAWING_SONG_ALCOVE_OPTIONAL_IDS) {
      const target = encounter(alcove, id)
      for (const position of [target.anchor, target.position])
        expect(
          Math.hypot(
            position.x - THAWING_SONG_ALCOVE_BEACON_POSE.position.x,
            position.z - THAWING_SONG_ALCOVE_BEACON_POSE.position.z,
          ),
          `${id} at ${JSON.stringify(position)}`,
        ).toBeGreaterThan(0.8)
    }
  })

  it('awards each optional discovery exactly once and exposes no grading policy', () => {
    expect(alcove.rewards).toEqual({
      revision: 1,
      discoveries: [
        {
          encounterId: 'thaw-alcove-goblet',
          coinIds: ['thaw-alcove-sun-coin'],
        },
        {
          encounterId: 'thaw-alcove-coupe',
          coinIds: ['thaw-alcove-moon-coin'],
        },
      ],
      grading: [],
    })

    const goblet = applyEncounterRewards(
      alcove,
      emptyRewardProgress(),
      'thaw-alcove-goblet',
    )
    const replay = applyEncounterRewards(alcove, goblet, 'thaw-alcove-goblet')
    const complete = applyEncounterRewards(alcove, replay, 'thaw-alcove-coupe')
    expect(replay).toEqual(goblet)
    expect(complete.discoveredEncounterIds).toEqual([
      'thaw-alcove-goblet',
      'thaw-alcove-coupe',
    ])
    expect(complete.collectedCoinIds).toEqual([
      'thaw-alcove-sun-coin',
      'thaw-alcove-moon-coin',
    ])
  })

  it('adds one bounded camera room and visible floor markers for the detour', () => {
    const section =
      alcove.camera?.kind === 'route-sections'
        ? alcove.camera.sections.find(({ id }) => id === 'thaw-alcove')
        : undefined
    expect(section?.platformIds).toEqual([
      'thaw-alcove-approach',
      'thaw-alcove-court-1',
      'thaw-alcove-court-2',
      'thaw-alcove-court-3',
      'thaw-alcove-beacon-rest',
    ])
    const room = alcove.presentation?.rooms.find(
      ({ id }) => id === `${alcove.id}/thaw-alcove/room/route`,
    )
    expect(room).toBeDefined()
    for (const platformId of section?.platformIds ?? []) {
      const support = platform(alcove, platformId)
      expect(room!.bounds.minX).toBeLessThanOrEqual(support.minX)
      expect(room!.bounds.maxX).toBeGreaterThanOrEqual(support.maxX)
      expect(room!.bounds.minZ).toBeLessThanOrEqual(support.minZ)
      expect(room!.bounds.maxZ).toBeGreaterThanOrEqual(support.maxZ)
    }
    expect(alcove.presentation?.floorArt).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platformId: 'thaw-alcove-approach',
          recipeId: 'sound-wave',
        }),
        expect.objectContaining({
          platformId: 'thaw-alcove-court-2',
          recipeId: 'hero-petal',
        }),
      ]),
    )
  })
})
