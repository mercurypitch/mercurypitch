// GuitarNightFirstWin interaction tests protect loop-boundary touch input.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarRoomBand, GuitarRoomBandStartOptions, } from '@/features/guitar/backing/guitar-room-band'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { DEFAULT_GUITAR_FIRST_WIN_CONFIG } from './first-win-config'
import { GuitarNightFirstWin } from './GuitarNightFirstWin'
import { useGuitarFirstWinController } from './useGuitarFirstWinController'

vi.mock('./GuitarNightStage', () => ({
  GuitarNightStage: () => <div data-testid="first-win-stage" />,
}))

describe('GuitarNightFirstWin', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('keeps the touch marker active for an early hit after a full loop lap', async () => {
    let callbacks: GuitarRoomBandStartOptions | null = null
    let now = 1_000
    const band: GuitarRoomBand = {
      start: vi.fn(async (options) => {
        callbacks = options
        return {
          expectedHitTimesMs: [],
          exerciseStartedAtSeconds: null,
          completedAtSeconds: null,
        }
      }),
      activate: vi.fn(async () => null),
      setPercussionTrackAudible: vi.fn(),
      stop: vi.fn(),
      getAudioGraph: () => null,
      dispose: vi.fn(async () => undefined),
    }
    const requireCallbacks = (): GuitarRoomBandStartOptions => {
      if (callbacks === null) throw new Error('The groove did not start.')
      return callbacks
    }
    let controller!: ReturnType<typeof useGuitarFirstWinController>
    const onHit = vi.fn(() => controller.registerHit('touch'))

    render(() => {
      controller = useGuitarFirstWinController({
        config: () => DEFAULT_GUITAR_FIRST_WIN_CONFIG,
        createBand: () => band,
        now: () => now,
      })
      return (
        <GuitarNightFirstWin
          controller={controller}
          stage={{} as GuitarPerformanceStageSource}
          tuning={() => DEFAULT_GUITAR_TUNING}
          active={() => true}
          completionAction={() => 'load-song'}
          headingRef={() => undefined}
          onHit={onHit}
          onBack={() => undefined}
          onSkip={() => undefined}
          onAdvance={() => undefined}
          onComplete={() => undefined}
        />
      )
    })

    expect(controller.setLoopEnabled(true)).toBe(true)
    await controller.startGroove()
    const activeCallbacks = requireCallbacks()
    activeCallbacks.onBeat?.(0, 'exercise', 0)
    for (let beatIndex = 0; beatIndex < 4; beatIndex += 1) {
      activeCallbacks.onExerciseBeatScheduled?.({
        beatIndex,
        iteration: 0,
        scheduledAtSeconds: beatIndex / 2,
        expectedAtPerformanceMs: now,
      })
      expect(controller.registerHit('touch')).toBe(true)
      now += 500
    }
    expect(controller.stepFinished()).toBe(true)
    expect(controller.status()).toBe('playing')

    activeCallbacks.onExerciseBeatScheduled?.({
      beatIndex: 0,
      iteration: 1,
      scheduledAtSeconds: 2,
      expectedAtPerformanceMs: now,
    })
    const marker = screen.getByRole('button', { name: 'Mark next lap' })
    expect(marker).toBeEnabled()
    fireEvent.click(marker)

    expect(onHit).toHaveBeenCalledOnce()
    expect(controller.hits()).toBe(4)
    expect(controller.lastFeedback()).toBe('Next lap · 1 of 4 marked early.')
  })
})
