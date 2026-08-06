// Guitar first-win controller tests protect explicit audio start and timing-aware input.
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarRoomBand, GuitarRoomBandStartOptions, } from '@/features/guitar/backing/guitar-room-band'
import { DEFAULT_GUITAR_FIRST_WIN_CONFIG } from './first-win-config'
import { useGuitarFirstWinController } from './useGuitarFirstWinController'

function createBandHarness(expectedHitTimesMs = [1_000, 1_500, 2_000, 2_500]) {
  let callbacks: GuitarRoomBandStartOptions | null = null
  const band: GuitarRoomBand = {
    start: vi.fn(async (options) => {
      callbacks = options
      return { expectedHitTimesMs }
    }),
    stop: vi.fn(),
    getAudioGraph: () => null,
    dispose: vi.fn(async () => undefined),
  }
  return {
    band,
    getCallbacks: () => callbacks,
  }
}

describe('useGuitarFirstWinController', () => {
  afterEach(() => localStorage.clear())

  it('keeps audio inert while touch input completes the first bar', () => {
    const harness = createBandHarness()

    createRoot((dispose) => {
      const controller = useGuitarFirstWinController({
        config: () => DEFAULT_GUITAR_FIRST_WIN_CONFIG,
        createBand: () => harness.band,
      })

      expect(controller.notes()).toHaveLength(4)
      expect(harness.band.start).not.toHaveBeenCalled()
      for (let hit = 0; hit < 4; hit += 1) {
        expect(controller.registerHit('touch')).toBe(true)
      }
      expect(controller.status()).toBe('complete')
      expect(controller.progress().status).toBe('completed')
      expect(harness.band.start).not.toHaveBeenCalled()
      dispose()
    })
  })

  it('accepts a hit inside the configured pulse window and rejects a late one', async () => {
    const harness = createBandHarness()
    let now = 1_030

    await new Promise<void>((resolve) => {
      createRoot((dispose) => {
        const controller = useGuitarFirstWinController({
          config: () => DEFAULT_GUITAR_FIRST_WIN_CONFIG,
          createBand: () => harness.band,
          now: () => now,
        })

        void controller.startGroove().then(() => {
          harness.getCallbacks()?.onBeat?.(0, 'exercise')
          expect(controller.registerHit('keyboard')).toBe(true)
          expect(
            controller.progress().bestAbsoluteTimingMsByStep['open-low-e'],
          ).toBe(30)

          now = 1_300
          expect(controller.registerHit('keyboard')).toBe(false)
          expect(controller.hits()).toBe(1)
          dispose()
          resolve()
        })
      })
    })
  })
})
