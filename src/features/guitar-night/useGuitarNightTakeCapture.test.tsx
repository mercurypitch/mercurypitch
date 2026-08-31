// ============================================================
// Guitar Night Take Capture tests — run boundaries, privacy, and explicit Keep
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarScoreTakeSummary } from '@/lib/guitar/guitar-score-history'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import type { TakeRecorder } from '@/lib/voice-capture'
import type { GuitarNightReference } from './reference-port'
import type { GuitarNightScoreLiveBoundary } from './useGuitarNightScoreRoomController'
import { guitarNightTakeComparisonKey, guitarNightTakeKeepInput, useGuitarNightTakeCapture, } from './useGuitarNightTakeCapture'

const REFERENCE: GuitarNightReference = {
  kind: 'authored',
  songId: 'song:velvet',
  title: 'Velvet Changes',
  trackId: 'lead/one',
  trackName: 'Lead guitar',
  tempoBpm: 90,
  tuning: DEFAULT_GUITAR_TUNING,
  outOfRangeNotes: 0,
  tracks: [{ id: 'lead/one', name: 'Lead guitar', noteCount: 4 }],
  notes: [],
}

function boundary(id = 'live-1'): GuitarNightScoreLiveBoundary {
  return {
    id,
    reference: REFERENCE,
    range: { start: 1.25, end: 5.5 },
    tempoBpm: 72,
    scoreTempoBpm: 90,
    countInBeats: 4,
    sampleRate: 48_000,
    startedAtSeconds: 1,
    completedAtSeconds: 2,
    beatToSeconds: (beat) => beat,
  }
}

function summary(
  overrides: Partial<GuitarScoreTakeSummary> = {},
): GuitarScoreTakeSummary {
  return {
    schemaVersion: 1,
    savedAt: 1_725_000_002_000,
    status: 'completed',
    pieceLabel: REFERENCE.title,
    trackLabel: REFERENCE.trackName,
    range: { startBeat: 1.25, endBeat: 5.5 },
    inputKind: 'interface',
    basis: 'cumulative',
    score: 92,
    grade: 'A',
    counts: {
      targetCount: 6,
      judgedTargets: 5,
      hitTargets: 4,
      missedTargets: 1,
      skippedTargets: 1,
    },
    bestStreak: 3,
    evidence: { status: 'complete', detectedGapCount: 0 },
    recentOutcomes: [],
    ...overrides,
  }
}

function recorder(blob = new Blob(['guitar'], { type: 'audio/webm' })) {
  const value: TakeRecorder = {
    start: vi.fn(() => true),
    pause: vi.fn(async () => true),
    resume: vi.fn(async () => true),
    stop: vi.fn(async () => blob),
    discard: vi.fn(),
    dispose: vi.fn(),
  }
  return value
}

function controlledVisibilityTarget() {
  let hidden = false
  const listeners = new Set<EventListener>()
  const target = {
    get hidden() {
      return hidden
    },
    addEventListener: vi.fn(
      (type: string, listener: EventListenerOrEventListenerObject): void => {
        if (type === 'visibilitychange') {
          listeners.add(listener as EventListener)
        }
      },
    ),
    removeEventListener: vi.fn(
      (type: string, listener: EventListenerOrEventListenerObject): void => {
        if (type === 'visibilitychange') {
          listeners.delete(listener as EventListener)
        }
      },
    ),
  } as unknown as Pick<
    Document,
    'hidden' | 'addEventListener' | 'removeEventListener'
  >

  return {
    target,
    hide(): void {
      hidden = true
      for (const listener of listeners) {
        listener({ type: 'visibilitychange' } as Event)
      }
    },
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Guitar Night performance-take payload', () => {
  it('uses one stable authored-part key and excludes run or device identity', () => {
    const run = boundary('private-run-id')
    const input = guitarNightTakeKeepInput({
      boundary: run,
      inputKind: 'interface',
      summary: summary(),
      audio: {
        blob: new Blob(['guitar']),
        durationMs: 1_000,
        peaks: new Float32Array([0.25, 1]),
        capturedAt: '2026-08-31T10:00:00.000Z',
      },
    })

    expect(guitarNightTakeComparisonKey(run)).toBe(
      'guitar-night:song%3Avelvet:lead%2Fone:1.25-5.5:v1',
    )
    expect(input).toMatchObject({
      source: 'guitar-night',
      title: 'Velvet Changes',
      context: {
        kind: 'guitar-night-score-take',
        songId: 'song:velvet',
        trackId: 'lead/one',
        inputKind: 'interface',
        tempoBpm: 72,
        scoreTempoBpm: 90,
      },
      metrics: {
        score: 92,
        grade: 'A',
        hitTargets: 4,
        missedTargets: 1,
        skippedTargets: 1,
        bestStreak: 3,
      },
    })
    const serialized = JSON.stringify({
      context: input.context,
      metrics: input.metrics,
    })
    expect(serialized).not.toContain('private-run-id')
    expect(serialized).not.toMatch(/device|eventId|targetId/i)
  })
})

describe('useGuitarNightTakeCapture', () => {
  it('records only between the authored run boundaries and keeps explicitly', async () => {
    vi.useFakeTimers()
    await createRoot(async (dispose) => {
      const clock = { currentTime: 0 }
      const context = clock as AudioContext
      const takeRecorder = recorder()
      const saveTake = vi.fn(async () => ({
        ok: true,
        quotaExceeded: false,
        roomAvailable: true,
      }))
      const inspectTake = vi.fn(async () => ({
        durationMs: 1_040,
        peaks: new Float32Array([0.2, 1]),
      }))
      const controller = useGuitarNightTakeCapture({
        getStream: () => ({}) as MediaStream,
        getAudioContext: () => context,
        createRecorder: () => takeRecorder,
        inspectTake,
        saveTake,
        nowIso: () => '2026-08-31T10:00:00.000Z',
      })

      expect(controller.begin(boundary(), 'interface')).toBe(true)
      expect(controller.state()).toBe('capturing')
      expect(takeRecorder.start).not.toHaveBeenCalled()
      expect(controller.attachCompletedSummary('live-1', summary())).toBe(true)

      clock.currentTime = 1
      await vi.advanceTimersByTimeAsync(1_000)
      expect(takeRecorder.start).toHaveBeenCalledOnce()

      clock.currentTime = 2
      await vi.advanceTimersByTimeAsync(1_000)
      await Promise.resolve()
      expect(takeRecorder.stop).toHaveBeenCalledOnce()
      expect(inspectTake).toHaveBeenCalledWith(expect.any(Blob), context, 1_000)
      expect(controller.state()).toBe('ready')

      expect(await controller.keep()).toBe(true)
      expect(controller.state()).toBe('saved')
      expect(saveTake).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'guitar-night',
          comparisonKey: 'guitar-night:song%3Avelvet:lead%2Fone:1.25-5.5:v1',
          audio: expect.objectContaining({
            durationMs: 1_040,
            capturedAt: '2026-08-31T10:00:00.000Z',
          }),
        }),
      )
      dispose()
    })
  })

  it('discards a replay when the scheduled start callback is materially late', async () => {
    vi.useFakeTimers()
    await createRoot(async (dispose) => {
      const clock = { currentTime: 0 }
      const takeRecorder = recorder()
      const saveTake = vi.fn()
      const inspectTake = vi.fn()
      const controller = useGuitarNightTakeCapture({
        getStream: () => ({}) as MediaStream,
        getAudioContext: () => clock as AudioContext,
        createRecorder: () => takeRecorder,
        inspectTake,
        saveTake,
      })

      expect(controller.begin(boundary(), 'microphone')).toBe(true)
      expect(controller.attachCompletedSummary('live-1', summary())).toBe(true)
      clock.currentTime = 1.5
      await vi.advanceTimersByTimeAsync(1_000)

      expect(controller.state()).toBe('error')
      expect(controller.message()).toMatch(/score is safe.*timing/i)
      expect(takeRecorder.start).not.toHaveBeenCalled()
      expect(takeRecorder.discard).toHaveBeenCalledOnce()
      expect(takeRecorder.dispose).toHaveBeenCalledOnce()
      expect(inspectTake).not.toHaveBeenCalled()
      expect(saveTake).not.toHaveBeenCalled()
      expect(controller.boundaryId()).toBe('live-1')
      dispose()
    })
  })

  it('discards a replay when the scheduled stop callback is materially late', async () => {
    vi.useFakeTimers()
    await createRoot(async (dispose) => {
      const clock = { currentTime: 0 }
      const takeRecorder = recorder()
      const saveTake = vi.fn()
      const inspectTake = vi.fn()
      const controller = useGuitarNightTakeCapture({
        getStream: () => ({}) as MediaStream,
        getAudioContext: () => clock as AudioContext,
        createRecorder: () => takeRecorder,
        inspectTake,
        saveTake,
      })

      expect(controller.begin(boundary(), 'interface')).toBe(true)
      expect(controller.attachCompletedSummary('live-1', summary())).toBe(true)
      clock.currentTime = 1
      await vi.advanceTimersByTimeAsync(1_000)
      expect(takeRecorder.start).toHaveBeenCalledOnce()

      clock.currentTime = 2.5
      await vi.advanceTimersByTimeAsync(1_000)

      expect(controller.state()).toBe('error')
      expect(controller.message()).toMatch(/score is safe.*timing/i)
      expect(takeRecorder.stop).not.toHaveBeenCalled()
      expect(takeRecorder.discard).toHaveBeenCalledOnce()
      expect(takeRecorder.dispose).toHaveBeenCalledOnce()
      expect(inspectTake).not.toHaveBeenCalled()
      expect(saveTake).not.toHaveBeenCalled()
      expect(controller.boundaryId()).toBe('live-1')
      dispose()
    })
  })

  it('discards temporary replay audio when the page is backgrounded', async () => {
    vi.useFakeTimers()
    await createRoot(async (dispose) => {
      const clock = { currentTime: 0 }
      const takeRecorder = recorder()
      const visibility = controlledVisibilityTarget()
      const saveTake = vi.fn()
      const controller = useGuitarNightTakeCapture({
        getStream: () => ({}) as MediaStream,
        getAudioContext: () => clock as AudioContext,
        createRecorder: () => takeRecorder,
        inspectTake: vi.fn(),
        saveTake,
        visibilityTarget: visibility.target,
      })

      expect(controller.begin(boundary(), 'microphone')).toBe(true)
      expect(controller.attachCompletedSummary('live-1', summary())).toBe(true)
      clock.currentTime = 1
      await vi.advanceTimersByTimeAsync(1_000)
      expect(takeRecorder.start).toHaveBeenCalledOnce()

      visibility.hide()
      await vi.runAllTimersAsync()

      expect(controller.state()).toBe('error')
      expect(controller.message()).toMatch(/score is safe.*foreground/i)
      expect(takeRecorder.stop).not.toHaveBeenCalled()
      expect(takeRecorder.discard).toHaveBeenCalledOnce()
      expect(takeRecorder.dispose).toHaveBeenCalledOnce()
      expect(saveTake).not.toHaveBeenCalled()
      expect(controller.boundaryId()).toBe('live-1')
      dispose()
      expect(visibility.target.removeEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function),
      )
    })
  })

  it('uses the accepted recorder interval as the Blob duration fallback', async () => {
    vi.useFakeTimers()
    await createRoot(async (dispose) => {
      const clock = { currentTime: 0 }
      const context = clock as AudioContext
      const takeRecorder = recorder()
      const inspectTake = vi.fn(async () => ({
        durationMs: 1_100,
        peaks: new Float32Array([0.5]),
      }))
      const controller = useGuitarNightTakeCapture({
        getStream: () => ({}) as MediaStream,
        getAudioContext: () => context,
        createRecorder: () => takeRecorder,
        inspectTake,
      })

      controller.begin(boundary(), 'interface')
      controller.attachCompletedSummary('live-1', summary())
      clock.currentTime = 1.1
      await vi.advanceTimersByTimeAsync(1_000)
      clock.currentTime = 2.2
      await vi.advanceTimersByTimeAsync(900)
      await Promise.resolve()

      expect(inspectTake).toHaveBeenCalledWith(expect.any(Blob), context, 1_100)
      expect(controller.state()).toBe('ready')
      dispose()
    })
  })

  it('marks MIDI unsupported without constructing an audio recorder', () => {
    createRoot((dispose) => {
      const createRecorder = vi.fn(() => recorder())
      const controller = useGuitarNightTakeCapture({
        getStream: () => ({}) as MediaStream,
        getAudioContext: () => ({ currentTime: 0 }) as AudioContext,
        createRecorder,
      })

      expect(controller.begin(boundary(), 'midi')).toBe(false)
      expect(controller.state()).toBe('unsupported')
      expect(controller.message()).toMatch(/not MIDI/i)
      expect(controller.boundaryId()).toBe('live-1')
      expect(createRecorder).not.toHaveBeenCalled()
      dispose()
    })
  })

  it('discards held runs before count-in ends', async () => {
    vi.useFakeTimers()
    await createRoot(async (dispose) => {
      const takeRecorder = recorder()
      const controller = useGuitarNightTakeCapture({
        getStream: () => ({}) as MediaStream,
        getAudioContext: () => ({ currentTime: 0 }) as AudioContext,
        createRecorder: () => takeRecorder,
      })

      controller.begin(boundary(), 'microphone')
      expect(controller.discard('live-1')).toBe(true)
      await vi.runAllTimersAsync()

      expect(takeRecorder.start).not.toHaveBeenCalled()
      expect(takeRecorder.discard).toHaveBeenCalledOnce()
      expect(controller.boundaryId()).toBeNull()
      expect(controller.state()).toBe('idle')
      dispose()
    })
  })

  it('ignores an older recorder result after a replacement run begins', async () => {
    vi.useFakeTimers()
    await createRoot(async (dispose) => {
      const clock = { currentTime: 1 }
      const context = clock as AudioContext
      let resolveStop!: (blob: Blob | null) => void
      const first = recorder()
      first.stop = vi.fn(
        () => new Promise<Blob | null>((resolve) => (resolveStop = resolve)),
      )
      const second = recorder()
      const recorders = [first, second]
      const controller = useGuitarNightTakeCapture({
        getStream: () => ({}) as MediaStream,
        getAudioContext: () => context,
        createRecorder: () => recorders.shift() ?? null,
        inspectTake: vi.fn(async () => ({
          durationMs: 1_000,
          peaks: new Float32Array([1]),
        })),
      })

      controller.begin(boundary('live-old'), 'interface')
      await vi.runOnlyPendingTimersAsync()
      clock.currentTime = 2
      expect(controller.finish('live-old')).toBe(true)
      expect(controller.state()).toBe('processing')

      controller.begin(boundary('live-new'), 'interface')
      resolveStop(new Blob(['old']))
      await Promise.resolve()
      await Promise.resolve()

      expect(controller.boundaryId()).toBe('live-new')
      expect(controller.state()).toBe('capturing')
      dispose()
    })
  })
})
