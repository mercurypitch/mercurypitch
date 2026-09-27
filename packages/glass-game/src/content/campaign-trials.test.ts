// Island path tests — real routes keep distinct save identities and earned island gates.
import { describe, expect, it } from 'vitest'
import { readProgress } from '../core/progress'
import { evaluateTrialUnlock } from '../core/trial-unlock'
import { MUSEUM_CAMPAIGN } from './campaign'
import { islandChapterIds,MUSEUM_TRIALS } from './campaign-trials'
import { FLOATING_MUSEUM_JOURNEY } from './museum-journey'

const requirements = MUSEUM_CAMPAIGN.map((chapter) => ({
  chapterId: chapter.id,
  title: chapter.level.title,
  level: chapter.level,
}))

describe('museum island side paths', () => {
  it('assigns one real optional route to each island without changing main chapter order', () => {
    expect(
      MUSEUM_TRIALS.map((trial) =>
        islandChapterIds(FLOATING_MUSEUM_JOURNEY, trial.islandId),
      ),
    ).toEqual([
      ['first-light', 'glassworks'],
      ['twin-galleries'],
      ['resonance-conservatory'],
    ])
    expect(
      new Set(MUSEUM_TRIALS.map((trial) => trial.chapter.level.id)).size,
    ).toBe(3)
    for (const trial of MUSEUM_TRIALS) {
      expect(
        MUSEUM_CAMPAIGN.some((chapter) => chapter.id === trial.chapter.id),
      ).toBe(false)
      expect(trial.chapter.level.platforms.length).toBeGreaterThan(0)
      expect(trial.chapter.level.breakables.length).toBeGreaterThan(0)
    }
  })
  it('earns each new path independently and fails closed on unfinished or lower-tier galleries', () => {
    for (const trial of MUSEUM_TRIALS.slice(1)) {
      const ids = islandChapterIds(FLOATING_MUSEUM_JOURNEY, trial.islandId)
      const chapter = MUSEUM_CAMPAIGN.find(
        (candidate) => candidate.id === ids[0],
      )!
      const saved = {
        ...readProgress(chapter.level, null),
        completedBreakableIds: chapter.level.breakables
          .filter((item) => !item.optional)
          .map((item) => item.id),
        finished: true,
      }
      const load = (id: string) => (id === chapter.level.id ? saved : null)
      expect(
        evaluateTrialUnlock(ids, requirements, load, () => ({
          stars: 2,
          previouslyUnlocked: false,
        })).unlocked,
      ).toBe(false)
      expect(
        evaluateTrialUnlock(ids, requirements, load, () => ({
          stars: 3,
          previouslyUnlocked: false,
        })).unlocked,
      ).toBe(true)
      expect(
        evaluateTrialUnlock(ids, requirements, load, () => ({
          stars: 0,
          previouslyUnlocked: true,
        })).unlocked,
      ).toBe(true)
      saved.finished = false
      expect(
        evaluateTrialUnlock(ids, requirements, load, () => ({
          stars: 3,
          previouslyUnlocked: false,
        })).unlocked,
      ).toBe(false)
    }
  })
})
