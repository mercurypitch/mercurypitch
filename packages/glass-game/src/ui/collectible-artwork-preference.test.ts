// Artwork tuning tests — release isolation, persistence and current paused-frame rendering.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SINGING_CURRENT } from '../runner/first-course'
import { createSongRunnerGame } from '../runner/game'
import { COLLECTIBLE_ARTWORK_SCALE_PREFERENCE, createCollectibleArtworkPreference, } from './collectible-artwork-preference'

function fixture(developmentTuning = true, stored: string | null = null) {
  const saved = new Map<string, string>()
  if (stored !== null) saved.set(COLLECTIBLE_ARTWORK_SCALE_PREFERENCE, stored)
  const host = {
    developmentTuning,
    readPreference: vi.fn((key: string) => saved.get(key) ?? null),
    writePreference: vi.fn((key: string, value: string) => {
      saved.set(key, value)
    }),
  }
  const game = createSongRunnerGame(SINGING_CURRENT, { comfortableMidi: 60 })
  const renderer = {
    setCollectibleArtworkScale: vi.fn(),
    render: vi.fn(() => true),
  }
  const presentation = {
    renderer: vi.fn(() => renderer),
    snapshot: vi.fn(() => game.snapshot()),
    canRender: vi.fn(() => true),
    disposed: vi.fn(() => false),
    failed: vi.fn(),
  }
  return { saved, host, game, renderer, presentation }
}

describe('collectible artwork preference', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('keeps a saved scale and persists a normalized independent choice for the next visit', () => {
    const test = fixture(true, '1.3')
    test.saved.set('shatter-playback-speed:v1', '0.6')
    const preference = createCollectibleArtworkPreference(
      test.host,
      test.presentation,
    )
    expect(preference.collectibleArtworkScale()).toBe(1.3)
    expect(test.host.writePreference).not.toHaveBeenCalled()
    expect(test.renderer.render).not.toHaveBeenCalled()
    preference.changeCollectibleArtworkScale(99)
    expect(preference.collectibleArtworkScale()).toBe(1.6)
    expect(test.host.writePreference).toHaveBeenLastCalledWith(
      COLLECTIBLE_ARTWORK_SCALE_PREFERENCE,
      '1.6',
    )
    expect(test.saved.get('shatter-playback-speed:v1')).toBe('0.6')
    expect(
      createCollectibleArtworkPreference(
        test.host,
        test.presentation,
      ).collectibleArtworkScale(),
    ).toBe(1.6)
  })

  it('ignores saved overrides and stale change callbacks in release hosts even on a dev server', () => {
    vi.stubEnv('DEV', true)
    const test = fixture(false, '1.6')
    const preference = createCollectibleArtworkPreference(
      test.host,
      test.presentation,
    )
    preference.changeCollectibleArtworkScale(0.8)
    expect(preference.collectibleArtworkScale()).toBe(1.2)
    expect(test.host.readPreference).not.toHaveBeenCalled()
    expect(test.host.writePreference).not.toHaveBeenCalled()
    expect(test.presentation.renderer).not.toHaveBeenCalled()
  })

  it.each([null, '', '  ', 'oops', 'Infinity'])(
    'defaults invalid saved value %s and resets invalid live input to 120 percent',
    (stored) => {
      const test = fixture(true, stored)
      const preference = createCollectibleArtworkPreference(
        test.host,
        test.presentation,
      )
      expect(preference.collectibleArtworkScale()).toBe(1.2)
      preference.changeCollectibleArtworkScale(NaN)
      expect(test.renderer.setCollectibleArtworkScale).toHaveBeenLastCalledWith(
        1.2,
      )
    },
  )

  it('reads the latest paused snapshot on every change and redraws with zero elapsed time', () => {
    const test = fixture()
    const preference = createCollectibleArtworkPreference(
      test.host,
      test.presentation,
    )
    expect(test.game.beginEpoch('artwork-test').ok).toBe(true)
    for (let step = 1; step <= 4; step++)
      test.game.advanceTo('artwork-test', step * 0.05)
    test.game.pause()
    const paused = test.game.snapshot()
    const advance = vi.spyOn(test.game, 'advanceTo')
    preference.changeCollectibleArtworkScale(1.4)
    expect(test.renderer.render).toHaveBeenLastCalledWith(paused, 0)
    expect(paused.courseSeconds).toBeGreaterThan(0)
    expect(paused.status).toBe('paused')
    expect(test.game.snapshot()).toEqual(paused)
    expect(advance).not.toHaveBeenCalled()
    expect(test.game.beginEpoch('artwork-retry').ok).toBe(true)
    for (let step = 1; step <= 2; step++)
      test.game.advanceTo('artwork-retry', step * 0.05)
    test.game.pause()
    const restarted = test.game.snapshot()
    advance.mockClear()
    preference.changeCollectibleArtworkScale(0.8)
    expect(test.renderer.render).toHaveBeenLastCalledWith(restarted, 0)
    expect(restarted.epoch).not.toBe(paused.epoch)
    expect(test.game.snapshot()).toEqual(restarted)
    expect(advance).not.toHaveBeenCalled()
  })

  it('updates the pending size without rendering during load and ignores retired callbacks', () => {
    const test = fixture()
    const preference = createCollectibleArtworkPreference(
      test.host,
      test.presentation,
    )
    test.presentation.canRender.mockReturnValue(false)
    preference.changeCollectibleArtworkScale(1.5)
    expect(test.renderer.setCollectibleArtworkScale).toHaveBeenLastCalledWith(
      1.5,
    )
    expect(test.renderer.render).not.toHaveBeenCalled()
    expect(test.presentation.snapshot).not.toHaveBeenCalled()
    test.presentation.disposed.mockReturnValue(true)
    test.host.writePreference.mockClear()
    test.renderer.setCollectibleArtworkScale.mockClear()
    preference.changeCollectibleArtworkScale(0.8)
    expect(preference.collectibleArtworkScale()).toBe(1.5)
    expect(test.host.writePreference).not.toHaveBeenCalled()
    expect(test.renderer.setCollectibleArtworkScale).not.toHaveBeenCalled()
  })

  it.each(['throw', 'unusable'] as const)(
    'forwards a %s frame through the existing failure owner',
    (failure) => {
      const test = fixture()
      const cause = new Error('Graphics unavailable')
      if (failure === 'throw')
        test.renderer.setCollectibleArtworkScale.mockImplementation(() => {
          throw cause
        })
      else test.renderer.render.mockReturnValue(false)
      const preference = createCollectibleArtworkPreference(
        test.host,
        test.presentation,
      )
      expect(() => preference.changeCollectibleArtworkScale(1.5)).not.toThrow()
      expect(test.presentation.failed).toHaveBeenCalledTimes(1)
      expect(test.presentation.failed.mock.calls[0]?.[0]).toEqual(
        failure === 'throw'
          ? cause
          : new Error('No usable frame for artwork size change'),
      )
    },
  )

  it('keeps the visit usable if optional preference storage fails', () => {
    const test = fixture()
    test.host.readPreference.mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    test.host.writePreference.mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    const preference = createCollectibleArtworkPreference(
      test.host,
      test.presentation,
    )
    expect(preference.collectibleArtworkScale()).toBe(1.2)
    expect(() => preference.changeCollectibleArtworkScale(1.3)).not.toThrow()
    expect(test.renderer.setCollectibleArtworkScale).toHaveBeenLastCalledWith(
      1.3,
    )
    expect(test.renderer.render).toHaveBeenCalledOnce()
    expect(test.presentation.failed).not.toHaveBeenCalled()
  })
})
