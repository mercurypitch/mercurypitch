// Singing Current art regressions — measured wall families and sound materials preserve the approved course and close camera.

import { describe, expect, it } from 'vitest'
import { SINGING_CURRENT_TARGET_WALLS, SINGING_CURRENT_WALL_PROFILES, } from '../content/singing-current-wall-profiles'
import { runnerCameraPose } from '../render/runner-world-layout'
import { compileSongRunnerCourse } from './compile-course'
import { SINGING_CURRENT_CURRENT, SINGING_CURRENT_LEARNING, SINGING_CURRENT_RESPONSIVE as COURSE, SINGING_CURRENT_RESPONSIVE_CATALOG as CATALOG, SINGING_CURRENT_RESPONSIVE_SOURCE as SOURCE, } from './first-course'

describe('Singing Current authored wall course', () => {
  it('assigns every approved target a distinct authored wall with its actual size and material', () => {
    expect(COURSE.laneCenters).toEqual([-2, 0, 2])
    expect(
      new Set(COURSE.targets.map((target) => target.glassPresentation?.variant))
        .size,
    ).toBe(8)
    for (const target of COURSE.targets) {
      const id =
        SINGING_CURRENT_TARGET_WALLS[
          target.id as keyof typeof SINGING_CURRENT_TARGET_WALLS
        ]
      const profile = SINGING_CURRENT_WALL_PROFILES[id]
      expect(target.glassPresentation).toEqual(profile.presentation)
      expect(target.soundProfile).toEqual(profile.soundProfile)
      expect(
        COURSE.chunks.find((chunk) => chunk.id === target.chunkId)!
          .assetProfileIds,
      ).toContain(profile.bundle)
    }
    expect(Object.keys(CATALOG.glassProfiles)).toHaveLength(10)
    for (const course of [SINGING_CURRENT_CURRENT, SINGING_CURRENT_LEARNING])
      expect(
        course.targets.every(
          (target) => target.glassPresentation === undefined,
        ),
      ).toBe(true)
  })

  it.each([0.5, 1, 1.8])(
    'preserves the accepted close camera on the wider road at aspect %s',
    (aspect) => {
      expect(COURSE.presentation.cameraProfile).toBe('responsive-close')
      expect(
        runnerCameraPose(
          aspect,
          COURSE.laneCenters,
          COURSE.presentation.cameraProfile,
        ),
      ).toEqual(runnerCameraPose(aspect, [-1.1, 0, 1.1]))
    },
  )

  it('rejects artwork that cannot fit a changed road instead of silently shrinking it', () => {
    expect(() =>
      compileSongRunnerCourse(
        { ...SOURCE, track: { ...SOURCE.track, laneCenters: [-0.5, 0, 0.5] } },
        CATALOG,
      ),
    ).toThrow('glassProfileId does not fit the full course width')
  })
})
