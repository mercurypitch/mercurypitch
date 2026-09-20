// Fresh visit host regressions — loading a replay never mutates the completed durable save.
import { describe, expect, it, vi } from 'vitest'
import { GLASS_ENCLOSED_CHAMBER } from '../content/enclosed-chamber'
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
      version: 1,
      levelId: GLASS_ENCLOSED_CHAMBER.id,
      checkpointId:
        GLASS_ENCLOSED_CHAMBER.spawn.checkpointId ??
        GLASS_ENCLOSED_CHAMBER.checkpoints[0]?.id ??
        '',
      completedBreakableIds: [],
      finished: false,
    })
    expect(saveProgress).not.toHaveBeenCalled()
    expect(host.loadProgress(GLASS_ENCLOSED_CHAMBER.id)).toBe(durable)
  })

  it('delegates other saves and replaces durable progress only on a real write', () => {
    const { host, saveProgress } = fixture()
    const replay = createFreshVisitHost(host, GLASS_ENCLOSED_CHAMBER)
    const other = replay.loadProgress('another-gallery')
    const started = replay.loadProgress(
      GLASS_ENCLOSED_CHAMBER.id,
    ) as SavedProgress

    expect(other).toEqual({ levelId: 'another-gallery' })
    replay.saveProgress(started)
    expect(saveProgress).toHaveBeenCalledExactlyOnceWith(started)
  })
})
