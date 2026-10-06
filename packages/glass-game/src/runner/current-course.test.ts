// Current course tests — one entry identity, compatible lifetime credit and fresh route position.
import { describe, expect, it } from 'vitest'
import type { CompiledRunnerCourse } from './contracts'
import { SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY } from './crystal-obstacle-study'
import { CURRENT_SINGING_COURSE, mergeCurrentSingingProgress, readEarlierSingingRecord, } from './current-course'
import { SINGING_CURRENT, SINGING_CURRENT_CURRENT, SINGING_CURRENT_LEARNING, SINGING_CURRENT_TRIALS, } from './first-course'
import { createSongRunnerGame } from './game'
import { createRunnerTargetQuality, readSavedRunnerProgress } from './progress'

function earned(course: CompiledRunnerCourse, grade: 1 | 2 | 3 = 3) {
  const target = course.targets[0]!
  return {
    ...readSavedRunnerProgress(course, null),
    completed: true,
    bestTargetQualities: [
      createRunnerTargetQuality(
        course,
        target.id,
        grade,
        target.notes.reduce(
          (total, note) => total + note.minimumReliableSeconds,
          0,
        ),
        10,
      ),
    ],
    collectedRewardIds: [
      course.rewards.pickups[0]!.id,
      course.rewards.finishRewardIds[0]!,
    ],
  }
}

describe('current Singing Current entry', () => {
  it('retains the shipped crystal identity, complete geometry and free steering with the angled camera', () => {
    expect(CURRENT_SINGING_COURSE.id).toBe(
      SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY.id,
    )
    expect(CURRENT_SINGING_COURSE.revision).toBe(
      SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY.revision,
    )
    expect(CURRENT_SINGING_COURSE.obstacles).toBe(
      SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY.obstacles,
    )
    expect(CURRENT_SINGING_COURSE.movement.kind).toBe('continuous')
    expect(CURRENT_SINGING_COURSE.presentation.cameraProfile).toBe(
      'steering-angled',
    )
    expect(
      CURRENT_SINGING_COURSE.obstacles.some(
        (obstacle) => obstacle.id === 'rose-jump-hurdle',
      ),
    ).toBe(true)
  })

  it('keeps the better score and imports each matching reward only once across repeat entries', () => {
    const earlier = earned(SINGING_CURRENT, 2)
    const current = earned(CURRENT_SINGING_COURSE, 3)
    const merged = mergeCurrentSingingProgress(current, earlier)
    expect(merged).toEqual(current)
    expect(mergeCurrentSingingProgress(merged, earlier)).toEqual(merged)
    expect(earlier).toEqual(earned(SINGING_CURRENT, 2))
    const betterEarlier = mergeCurrentSingingProgress(
      earned(CURRENT_SINGING_COURSE, 1),
      earlier,
    )
    expect(betterEarlier.bestTargetQualities[0]!.grade).toBe(2)
  })

  it.each([SINGING_CURRENT_CURRENT, SINGING_CURRENT_LEARNING])(
    'retains revision $revision historical grades without misgrading the new singing challenge',
    (course) => {
      const earlier = earned(course)
      const merged = mergeCurrentSingingProgress(null, earlier)
      expect(readEarlierSingingRecord(earlier)?.bestTargetQualities).toEqual(
        earlier.bestTargetQualities,
      )
      expect(merged.bestTargetQualities).toEqual([])
      expect(merged.completed).toBe(true)
      expect(merged.collectedRewardIds).toEqual(
        earned(CURRENT_SINGING_COURSE).collectedRewardIds.sort(),
      )
    },
  )

  it('rejects forged, stale and unrelated historical evidence', () => {
    const earlier = earned(SINGING_CURRENT)
    const quality = earlier.bestTargetQualities[0]!
    const incompatible = [
      { ...quality, completionFingerprint: 'retired-fingerprint' },
      { ...quality, judgeProfileRevision: 99 },
      { ...quality, evidenceVersion: 'unknown' },
      { ...quality, reliableSeconds: 0 },
      { ...quality, targetId: 'other-course-target' },
      { ...quality, courseRevision: 2 },
    ]
    expect(
      mergeCurrentSingingProgress(null, {
        ...earlier,
        bestTargetQualities: incompatible,
      }).bestTargetQualities,
    ).toEqual([])
    for (const raw of [
      null,
      [],
      'bad',
      { ...earlier, version: 99 },
      { ...earlier, courseRevision: 99 },
      earned(SINGING_CURRENT_TRIALS.responsive),
    ]) {
      expect(readEarlierSingingRecord(raw)).toBeUndefined()
      expect(mergeCurrentSingingProgress(null, raw)).toEqual(
        readSavedRunnerProgress(CURRENT_SINGING_COURSE, null),
      )
    }
  })

  it('never promotes an old checkpoint or completion into a running or finished new route', () => {
    const progress = mergeCurrentSingingProgress(null, {
      ...earned(SINGING_CURRENT),
      checkpointId: 'melody',
      courseSeconds: 100,
    })
    const game = createSongRunnerGame(CURRENT_SINGING_COURSE, {
      comfortableMidi: 57,
      progress,
    })
    expect(game.snapshot().courseSeconds).toBe(0)
    expect(game.snapshot().status).toBe('ready')
    expect(game.prepareCheckpoint('melody')).toEqual({
      ok: false,
      reason: 'checkpoint-not-reached',
    })
    expect(game.snapshot().bestTargetQualities).toHaveLength(1)
    expect(game.saveProgress().completed).toBe(true)
    expect(game.saveProgress()).not.toHaveProperty('checkpointId')
  })
})
