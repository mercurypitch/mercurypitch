// Fresh visit host regressions — loading a replay never mutates the completed durable save.
import { describe, expect, it, vi } from 'vitest'
import { GLASS_ENCLOSED_CHAMBER } from '../content/enclosed-chamber'
import { GLASSWORKS_JOURNEY } from '../content/glassworks-journey'
import type { SavedProgress } from '../contracts'
import type { GlassGameHost } from '../host'
import { createFreshVisitHost } from './fresh-visit-host'

function completedProgress(): SavedProgress {
  return {
    version: 1,
    levelId: GLASS_ENCLOSED_CHAMBER.id,
    checkpointId: GLASS_ENCLOSED_CHAMBER.checkpoints.at(-1)?.id ?? '',
    completedBreakableIds: GLASS_ENCLOSED_CHAMBER.breakables.map(
      (item) => item.id,
    ),
    finished: true,
  }
}

function fixture() {
  const durable = completedProgress()
  const saveProgress = vi.fn()
  const host = {
    loadProgress: vi.fn((levelId: string) =>
      levelId === durable.levelId ? durable : { levelId },
    ),
    saveProgress,
  } as unknown as GlassGameHost
  return { durable, host, saveProgress }
}

describe('fresh visit host', () => {
  it('starts the selected level in memory without clearing its completed save', () => {
    const { durable, host, saveProgress } = fixture()
    const replay = createFreshVisitHost(host, GLASS_ENCLOSED_CHAMBER)

    expect(replay.loadProgress(GLASS_ENCLOSED_CHAMBER.id)).toEqual({
      version: 2,
      levelId: GLASS_ENCLOSED_CHAMBER.id,
      checkpointId:
        GLASS_ENCLOSED_CHAMBER.spawn.checkpointId ??
        GLASS_ENCLOSED_CHAMBER.checkpoints[0]?.id ??
        '',
      completedBreakableIds: [],
      finished: false,
      rewards: {
        version: 1,
        discoveredEncounterIds: [],
        collectedCoinIds: [],
        qualityResults: [],
        collectedPortraitIds: [],
      },
    })
    expect(saveProgress).not.toHaveBeenCalled()
    expect(host.loadProgress(GLASS_ENCLOSED_CHAMBER.id)).toBe(durable)
  })

  it('delegates other loads and never erases durable route progress on a replay write', () => {
    const { durable, host, saveProgress } = fixture()
    const replay = createFreshVisitHost(host, GLASS_ENCLOSED_CHAMBER)
    const other = replay.loadProgress('another-gallery')
    const started = replay.loadProgress(
      GLASS_ENCLOSED_CHAMBER.id,
    ) as SavedProgress

    expect(other).toEqual({ levelId: 'another-gallery' })
    replay.saveProgress(started)
    expect(saveProgress).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        version: 2,
        completedBreakableIds: expect.arrayContaining(
          durable.completedBreakableIds,
        ),
        finished: true,
      }),
    )
  })

  it('preserves a portrait and stronger graded attempt across a weaker replay', () => {
    const finalId = GLASSWORKS_JOURNEY.rewards!.grading[0].encounterId
    const portraitId = GLASSWORKS_JOURNEY.rewards!.portrait!.portraitId
    const best = {
      encounterId: finalId,
      grade: 3 as const,
      challengeRevision: 1,
      policyRevision: 1,
      contentRevision: 3,
      evidenceVersion: 'pitch-accuracy-v1' as const,
      reliableSeconds: 1.2,
      meanAbsoluteCents: 18,
    }
    const durable: SavedProgress = {
      version: 2,
      levelId: GLASSWORKS_JOURNEY.id,
      checkpointId: GLASSWORKS_JOURNEY.checkpoints.at(-1)?.id ?? '',
      completedBreakableIds: GLASSWORKS_JOURNEY.exit.requiresCompleted.slice(),
      finished: true,
      rewards: {
        version: 1,
        discoveredEncounterIds: [],
        collectedCoinIds: [],
        qualityResults: [best],
        collectedPortraitIds: [portraitId],
      },
    }
    const saveProgress = vi.fn()
    const host = {
      loadProgress: vi.fn(() => durable),
      saveProgress,
    } as unknown as GlassGameHost
    const replay = createFreshVisitHost(host, GLASSWORKS_JOURNEY)
    const started = replay.loadProgress(GLASSWORKS_JOURNEY.id) as SavedProgress
    replay.saveProgress({
      ...started,
      rewards: {
        ...started.rewards!,
        qualityResults: [
          {
            ...best,
            grade: 1,
            meanAbsoluteCents: 180,
          },
        ],
        collectedPortraitIds: [],
      },
    })

    const saved = saveProgress.mock.calls[0][0] as SavedProgress
    expect(saved.rewards?.qualityResults).toEqual([best])
    expect(saved.rewards?.collectedPortraitIds).toEqual([portraitId])
  })
})
