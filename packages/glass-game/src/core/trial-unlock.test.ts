// Island unlock regressions — completion, grading and chapter membership stay independent.
import { describe, expect, it } from 'vitest'
import { MUSEUM_CAMPAIGN } from '../content/campaign'
import { islandChapterIds, MUSEUM_TRIALS } from '../content/campaign-trials'
import { CLOUDWAY_CURRENT_TRIAL } from '../content/cloudway-layouts'
import { CLOUDWAY_GLASS_RIBBON } from '../content/cloudway-trial'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import type { LevelDefinition, SavedProgress } from '../contracts'
import { readProgress } from './progress'
import { evaluateTrialUnlock } from './trial-unlock'

const chapters = MUSEUM_CAMPAIGN.map((chapter) => ({
  chapterId: chapter.id,
  title: chapter.level.title,
  level: chapter.level,
}))
const island = ['first-light', 'glassworks']

function completed(
  level: LevelDefinition,
  stars: 1 | 2 | 3 = 3,
): SavedProgress {
  return {
    ...readProgress(level, null),
    completedBreakableIds: level.breakables.map((item) => item.id),
    finished: true,
    rewards: {
      version: 1,
      discoveredEncounterIds: [],
      collectedCoinIds: [],
      collectedPortraitIds: [],
      qualityResults: (level.rewards?.grading ?? []).map((policy) => ({
        encounterId: policy.encounterId,
        grade: stars,
        policyRevision: policy.policyRevision,
        challengeRevision: policy.challengeRevision,
        contentRevision: level.authored?.contentRevision ?? 1,
        evidenceVersion: 'pitch-accuracy-v1',
        reliableSeconds: 3,
        meanAbsoluteCents: 5,
      })),
    },
  }
}

describe('Cloudway island unlock', () => {
  it('selects the crescent without reusing legacy trial progress or changing its historical unlock key', () => {
    const trial = MUSEUM_TRIALS[0]!
    expect(trial).toMatchObject({
      id: 'first-island-cloudway',
      islandId: 'first-light-landmass',
      chapter: {
        id: 'cloudway-glass-ribbon',
        imageAsset: 'cloudway-ribbon-preview',
        level: CLOUDWAY_CURRENT_TRIAL,
      },
    })

    const legacySave: SavedProgress = {
      ...readProgress(CLOUDWAY_GLASS_RIBBON, null),
      completedBreakableIds: CLOUDWAY_GLASS_RIBBON.breakables.map(
        (item) => item.id,
      ),
      finished: true,
    }
    expect(readProgress(CLOUDWAY_CURRENT_TRIAL, legacySave)).toEqual(
      readProgress(CLOUDWAY_CURRENT_TRIAL, null),
    )

    const currentSave: SavedProgress = {
      ...readProgress(CLOUDWAY_CURRENT_TRIAL, null),
      checkpointId: 'cloudway-checkpoint-frost-catch',
    }
    expect(readProgress(CLOUDWAY_GLASS_RIBBON, currentSave)).toEqual(
      readProgress(CLOUDWAY_GLASS_RIBBON, null),
    )
  })

  it('derives the first-island gate from both mapped galleries without adding the trial to the campaign', () => {
    expect(
      islandChapterIds(FLOATING_MUSEUM_JOURNEY, MUSEUM_TRIALS[0]!.islandId),
    ).toEqual(island)
    expect(
      chapters.some(
        (chapter) => chapter.chapterId === MUSEUM_TRIALS[0]!.chapter.id,
      ),
    ).toBe(false)
  })
  it('accepts the ungraded tutorial and requires three stars in the graded gallery', () => {
    const saves = new Map(
      chapters.map((chapter) => [chapter.level.id, completed(chapter.level)]),
    )
    expect(
      evaluateTrialUnlock(island, chapters, (id) => saves.get(id)),
    ).toMatchObject({
      unlocked: true,
      chapters: [
        {
          chapterId: 'first-light',
          graded: false,
          completed: true,
          ready: true,
        },
        { chapterId: 'glassworks', graded: true, earnedStars: 3, ready: true },
      ],
    })
    saves.set(chapters[1]!.level.id, completed(chapters[1]!.level, 2))
    expect(
      evaluateTrialUnlock(island, chapters, (id) => saves.get(id)),
    ).toMatchObject({
      unlocked: false,
      chapters: [expect.anything(), { earnedStars: 2, ready: false }],
    })
  })

  it('does not treat a portrait break as finishing the route', () => {
    const saves = new Map(
      chapters.map((chapter) => [chapter.level.id, completed(chapter.level)]),
    )
    saves.get(chapters[1]!.level.id)!.finished = false
    expect(
      evaluateTrialUnlock(island, chapters, (id) => saves.get(id)),
    ).toMatchObject({
      unlocked: false,
      chapters: [expect.anything(), { earnedStars: 3, completed: false }],
    })
  })

  it('uses replay tiers independently of portrait accuracy after migration', () => {
    const load = (id: string) =>
      completed(chapters.find((chapter) => chapter.level.id === id)!.level)
    const replay = (stars: 0 | 1 | 2 | 3) => (id: string) =>
      id === chapters[1]!.level.id
        ? { stars, previouslyUnlocked: false }
        : undefined
    expect(
      evaluateTrialUnlock(island, chapters, load, replay(2)),
    ).toMatchObject({
      unlocked: false,
      chapters: [expect.anything(), { earnedStars: 2, ready: false }],
    })
    expect(
      evaluateTrialUnlock(island, chapters, load, replay(3)).unlocked,
    ).toBe(true)
  })

  it('retains earlier trial access without inventing a new difficulty clear', () => {
    const load = (id: string) =>
      completed(chapters.find((chapter) => chapter.level.id === id)!.level)
    const replay = (id: string) =>
      id === chapters[1]!.level.id
        ? { stars: 0 as const, previouslyUnlocked: true }
        : undefined
    expect(evaluateTrialUnlock(island, chapters, load, replay)).toMatchObject({
      unlocked: true,
      chapters: [
        expect.anything(),
        { earnedStars: 0, previouslyUnlocked: true, ready: true },
      ],
    })
    const unfinished = (id: string) => ({ ...load(id), finished: false })
    expect(
      evaluateTrialUnlock(island, chapters, unfinished, replay).unlocked,
    ).toBe(false)
  })

  it('fails closed for missing/empty chapter membership and malformed or mismatched saves', () => {
    expect(evaluateTrialUnlock([], chapters, () => null).unlocked).toBe(false)
    expect(
      evaluateTrialUnlock(['unknown'], chapters, () => null),
    ).toMatchObject({
      unlocked: false,
      chapters: [{ title: 'Gallery unavailable', ready: false }],
    })
    const wrongSave = completed(chapters[2]!.level)
    expect(
      evaluateTrialUnlock(island, chapters, () => wrongSave).unlocked,
    ).toBe(false)
    expect(
      evaluateTrialUnlock(island, chapters, () => ({
        finished: true,
        stars: 3,
      })).unlocked,
    ).toBe(false)
  })

  it('a new chapter on an island becomes a requirement without affecting other islands', () => {
    const saves = new Map(
      chapters
        .slice(0, 2)
        .map((chapter) => [chapter.level.id, completed(chapter.level)]),
    )
    expect(
      evaluateTrialUnlock(island, chapters, (id) => saves.get(id)).unlocked,
    ).toBe(true)
    expect(
      evaluateTrialUnlock([...island, 'twin-galleries'], chapters, (id) =>
        saves.get(id),
      ).unlocked,
    ).toBe(false)
  })

  it('keeps earned historical stars but rejects star records without a completed graded encounter', () => {
    const save = completed(chapters[1]!.level)
    save.rewards!.qualityResults[0]!.policyRevision += 10
    const load = (id: string) =>
      id === save.levelId ? save : completed(chapters[0]!.level)
    expect(evaluateTrialUnlock(island, chapters, load).unlocked).toBe(true)
    save.completedBreakableIds = []
    expect(evaluateTrialUnlock(island, chapters, load).unlocked).toBe(false)
  })
})
