// Glassworks web-host tests — pin its URL and persistence namespace boundaries.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMercuryGlassHost, MERCURY_GLASS_STORAGE_PREFIX } from './host'

describe('MercuryPitch Glassworks host', () => {
  beforeEach(() => localStorage.clear())

  it('resolves museum assets beneath the standalone allowlisted route', () => {
    const host = createMercuryGlassHost(vi.fn())

    expect(host.assetUrl('museum-window-v4')).toBe(
      '/glass-game-assets/adventure-v4/museum-window-bay.glb',
    )
  })

  it('saves progress without reading or overwriting Beside Cue', () => {
    const foreignKey = 'beside-cue:glass-adventure:progress:glassworks-chamber'
    localStorage.setItem(foreignKey, '{"foreign":true}')
    const host = createMercuryGlassHost(vi.fn())
    const progress = {
      version: 1 as const,
      levelId: 'glassworks-chamber',
      checkpointId: 'glassworks-chamber/chamber/checkpoint/spawn',
      completedBreakableIds: ['glassworks-chamber/chamber/encounter/first'],
    }

    expect(host.loadProgress(progress.levelId)).toBeNull()
    host.saveProgress(progress)

    expect(localStorage.getItem(foreignKey)).toBe('{"foreign":true}')
    expect(
      localStorage.getItem(
        `${MERCURY_GLASS_STORAGE_PREFIX}:progress:${progress.levelId}`,
      ),
    ).toBe(JSON.stringify(progress))
  })

  it('delegates leaving the museum to the page shell', () => {
    const onExit = vi.fn()
    createMercuryGlassHost(onExit).onExit()

    expect(onExit).toHaveBeenCalledOnce()
  })
})
