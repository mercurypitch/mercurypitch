// Guitar first-win controller tests protect explicit audio start, progression, and timing-aware input.
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarRoomBand, GuitarRoomBandStartOptions, } from '@/features/guitar/backing/guitar-room-band'
import { DEFAULT_GUITAR_FIRST_WIN_CONFIG } from './first-win-config'
import { completeGuitarFirstWinStep, readGuitarFirstWinProgress, writeGuitarFirstWinProgress, } from './first-win-progress'
import { buildGuitarFirstWinNotes, useGuitarFirstWinController, } from './useGuitarFirstWinController'

function createBandHarness(expectedHitTimesMs = [1_000, 1_500, 2_000, 2_500]) {
  let callbacks: GuitarRoomBandStartOptions | null = null
  const band: GuitarRoomBand = {
    start: vi.fn(async (options) => {
      callbacks = options
      return {
        expectedHitTimesMs,
        exerciseStartedAtSeconds: null,
        completedAtSeconds: null,
      }
    }),
    activate: vi.fn(async () => null),
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

  it('keeps audio inert while touch advances through both beginner steps', () => {
    const harness = createBandHarness()

    createRoot((dispose) => {
      const controller = useGuitarFirstWinController({
        config: () => DEFAULT_GUITAR_FIRST_WIN_CONFIG,
        createBand: () => harness.band,
      })

      expect(controller.currentStep()?.id).toBe('open-low-e')
      expect(controller.notes()).toHaveLength(4)
      expect(harness.band.start).not.toHaveBeenCalled()

      for (let hit = 0; hit < 3; hit += 1) {
        expect(controller.registerHit('touch')).toBe(true)
      }
      expect(controller.stepPassed()).toBe(true)
      expect(controller.progress().completedStepIds).toEqual(['open-low-e'])
      expect(controller.advanceStep()).toBe(true)

      expect(controller.currentStep()?.id).toBe('first-one-string-tab')
      expect(controller.currentStepIndex()).toBe(1)
      expect(controller.notes()).toHaveLength(15)
      expect(controller.notes()[0]).toMatchObject({
        midi: 68,
        noteName: 'G#4',
        stringIndex: 0,
        fret: 4,
      })
      expect(controller.progress().completedStepIds).toEqual(['open-low-e'])

      for (let hit = 0; hit < 15; hit += 1) {
        expect(controller.registerHit('touch')).toBe(true)
      }
      expect(controller.status()).toBe('complete')
      expect(controller.progress().status).toBe('completed')
      expect(controller.progress().completedStepIds).toEqual([
        'open-low-e',
        'first-one-string-tab',
      ])
      const completedAt = controller.progress().completedAt
      controller.restartStep()
      expect(controller.registerHit('touch')).toBe(true)
      expect(controller.progress().status).toBe('completed')
      expect(controller.progress().completedAt).toBe(completedAt)
      expect(harness.band.start).not.toHaveBeenCalled()
      dispose()
    })
  })

  it('restores directly into the first incomplete configured step', () => {
    const initial = readGuitarFirstWinProgress(DEFAULT_GUITAR_FIRST_WIN_CONFIG)
    writeGuitarFirstWinProgress(
      completeGuitarFirstWinStep(
        initial,
        DEFAULT_GUITAR_FIRST_WIN_CONFIG,
        'open-low-e',
      ),
    )

    createRoot((dispose) => {
      const controller = useGuitarFirstWinController({
        config: () => DEFAULT_GUITAR_FIRST_WIN_CONFIG,
        createBand: () => createBandHarness().band,
      })

      expect(controller.currentStep()?.id).toBe('first-one-string-tab')
      expect(controller.notes()).toHaveLength(15)
      dispose()
    })
  })

  it('replays from step one without erasing earned completion', () => {
    const completed = DEFAULT_GUITAR_FIRST_WIN_CONFIG.exerciseSteps.reduce(
      (progress, step) =>
        completeGuitarFirstWinStep(
          progress,
          DEFAULT_GUITAR_FIRST_WIN_CONFIG,
          step.id,
        ),
      readGuitarFirstWinProgress(DEFAULT_GUITAR_FIRST_WIN_CONFIG),
    )
    writeGuitarFirstWinProgress(completed)

    createRoot((dispose) => {
      const controller = useGuitarFirstWinController({
        config: () => DEFAULT_GUITAR_FIRST_WIN_CONFIG,
        createBand: () => createBandHarness().band,
      })

      expect(controller.progress().status).toBe('completed')
      expect(controller.currentStep()?.id).toBe('first-one-string-tab')

      controller.replayFlow()

      expect(controller.currentStep()?.id).toBe('open-low-e')
      expect(controller.hits()).toBe(0)
      expect(controller.status()).toBe('quiet')
      expect(controller.progress()).toEqual(completed)

      for (let hit = 0; hit < 3; hit += 1) {
        expect(controller.registerHit('touch')).toBe(true)
      }
      expect(controller.advanceStep()).toBe(true)
      expect(controller.currentStep()?.id).toBe('first-one-string-tab')
      expect(controller.progress().status).toBe('completed')
      expect(controller.progress().completedStepIds).toEqual(
        completed.completedStepIds,
      )
      expect(controller.progress().completedAt).toBe(completed.completedAt)
      dispose()
    })
  })

  it('honors explicit configured pitches and names the sounding notes', () => {
    const config = {
      ...DEFAULT_GUITAR_FIRST_WIN_CONFIG,
      exerciseSteps: [
        {
          ...DEFAULT_GUITAR_FIRST_WIN_CONFIG.exerciseSteps[0],
          frets: [0, 2],
          expectedMidi: [41, 45],
        },
      ],
      freshHitsRequested: 2,
      passHits: 2,
    }

    expect(buildGuitarFirstWinNotes(config, config.exerciseSteps[0])).toEqual([
      expect.objectContaining({ midi: 41, noteName: 'F2', fret: 0 }),
      expect.objectContaining({ midi: 45, noteName: 'A2', fret: 2 }),
    ])
  })

  it('schedules the full tab phrase with the configured quiet guide', async () => {
    const expectedTimes = Array.from(
      { length: 15 },
      (_, index) => 1_000 + index * 500,
    )
    const harness = createBandHarness(expectedTimes)
    const initial = readGuitarFirstWinProgress(DEFAULT_GUITAR_FIRST_WIN_CONFIG)
    writeGuitarFirstWinProgress(
      completeGuitarFirstWinStep(
        initial,
        DEFAULT_GUITAR_FIRST_WIN_CONFIG,
        'open-low-e',
      ),
    )

    await new Promise<void>((resolve) => {
      createRoot((dispose) => {
        const controller = useGuitarFirstWinController({
          config: () => DEFAULT_GUITAR_FIRST_WIN_CONFIG,
          createBand: () => harness.band,
        })

        void controller.startGroove().then(() => {
          expect(harness.band.start).toHaveBeenCalledWith(
            expect.objectContaining({
              exerciseBeats: 15,
              feel: 'groove',
              exercisePulse: true,
            }),
          )
          dispose()
          resolve()
        })
      })
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
          harness.getCallbacks()?.onBeat?.(0, 'exercise', 0)
          expect(controller.registerHit('keyboard')).toBe(true)
          expect(controller.playheadBeat()).toBe(0)
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

  it('keeps a passed practice playing and resets markers on the next lap', async () => {
    const harness = createBandHarness([])
    let now = 1_000

    await new Promise<void>((resolve) => {
      createRoot((dispose) => {
        const controller = useGuitarFirstWinController({
          config: () => DEFAULT_GUITAR_FIRST_WIN_CONFIG,
          createBand: () => harness.band,
          now: () => now,
          random: () => 0,
        })

        expect(controller.setLoopEnabled(true)).toBe(true)
        controller.setShuffleBeats(true)
        expect(harness.band.start).not.toHaveBeenCalled()

        void controller.startGroove().then(() => {
          const callbacks = harness.getCallbacks()
          expect(callbacks?.loop).toEqual({ start: 0, end: 4 })
          expect(callbacks?.inputTimingWindowMs).toBe(180)
          const firstBeat = callbacks?.rhythmPresetForIteration?.(0, null)
          const secondBeat = callbacks?.rhythmPresetForIteration?.(
            1,
            firstBeat ?? null,
          )
          expect(firstBeat?.id).toBe('first-win-rock')
          expect(secondBeat?.id).toBe('first-win-pocket')

          controller.setTempoBpm(120)
          controller.setCountInBeats(8)
          expect(controller.tempoBpm()).toBe(78)
          expect(controller.countInBeats()).toBe(4)

          callbacks?.onBeat?.(0, 'exercise', 0)
          for (let hit = 0; hit < 3; hit += 1) {
            callbacks?.onExerciseBeatScheduled?.({
              beatIndex: hit,
              iteration: 0,
              scheduledAtSeconds: hit / 2,
              expectedAtPerformanceMs: now,
            })
            expect(controller.registerHit('touch')).toBe(true)
            now += 500
          }

          expect(controller.status()).toBe('playing')
          expect(controller.stepFinished()).toBe(false)
          expect(controller.stepPassed()).toBe(true)
          expect(controller.progress().completedStepIds).toContain('open-low-e')
          expect(harness.band.stop).toHaveBeenCalledTimes(1)

          callbacks?.onLoopIteration?.(1, 2)
          expect(controller.hits()).toBe(0)
          expect(controller.stepFinished()).toBe(false)
          expect(controller.stepPassed()).toBe(true)
          expect(controller.status()).toBe('playing')

          expect(controller.setLoopEnabled(false)).toBe(true)
          expect(controller.loopEnabled()).toBe(false)
          expect(controller.shuffleBeats()).toBe(false)
          expect(controller.status()).toBe('quiet')
          expect(harness.band.stop).toHaveBeenCalledTimes(2)
          dispose()
          resolve()
        })
      })
    })
  })

  it('keeps the safe fallback visible when a remote primary preset is unknown', () => {
    const config = {
      ...DEFAULT_GUITAR_FIRST_WIN_CONFIG,
      percussionPreset: 'future-kit',
      percussionVariantPresets: ['first-win-pocket'],
    }

    createRoot((dispose) => {
      const controller = useGuitarFirstWinController({
        config: () => config,
        createBand: () => createBandHarness().band,
      })

      expect(controller.selectedRhythmPreset().id).toBe('first-win-rock')
      expect(controller.rhythmPresets().map((preset) => preset.id)).toEqual([
        'first-win-rock',
        'first-win-pocket',
      ])
      dispose()
    })
  })
})
