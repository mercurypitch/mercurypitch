// Drum performance capture tests — segmented live-lane recording and explicit Keep.

import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { isLocalSaveNavigationLocked } from '@/lib/local-save-navigation-lock'
import type { TakeRecorder } from '@/lib/voice-capture'
import type { DrumTakeSummary } from './persistence/drum-take-summary'
import { useDrumPerformanceTakeCaptureController } from './useDrumPerformanceTakeCaptureController'

function summary(): DrumTakeSummary {
  return {
    schemaVersion: 1,
    id: 'take-1',
    projectId: 'project-1',
    projectRevision: 2,
    projectFingerprint: 'drum-v1-0123456789abcdef',
    completedAt: '2026-08-26T11:00:00.000Z',
    variationId: 'source',
    startBeat: 0,
    endBeat: 8,
    tempoBpm: 84,
    speedScale: 1,
    inputSources: ['keyboard'],
    evidencePolicy: {
      version: 1,
      matchWindowMs: 120,
      centredWindowMs: 30,
      minimumConfidence: 0.55,
      minimumMatchedHits: 2,
    },
    status: 'ready',
    evidenceScope: 'timing-and-dynamics',
    confidence: 0.9,
    targetHitCount: 8,
    capturedHitCount: 7,
    omittedCaptureHitCount: 0,
    matchedHitCount: 6,
    unmatchedTargetCount: 2,
    unmatchedCaptureCount: 1,
    uncertainTimingCount: 1,
    earlyCount: 1,
    centredCount: 3,
    lateCount: 1,
    meanTimingOffsetMs: -2,
    meanAbsoluteTimingOffsetMs: 18,
    meanVelocityOffset: 3,
    meanAbsoluteVelocityOffset: 7,
    recovery: null,
  }
}

function recorderHarness(
  blob = new Blob(['live-kit'], { type: 'audio/webm' }),
) {
  const recorder: TakeRecorder = {
    start: vi.fn(() => true),
    pause: vi.fn(async () => true),
    resume: vi.fn(async () => true),
    stop: vi.fn(async () => blob),
    discard: vi.fn(),
    dispose: vi.fn(),
  }
  return recorder
}

describe('useDrumPerformanceTakeCaptureController', () => {
  it('pools only active playing segments and exposes an explicit Keep boundary', async () => {
    let clockMs = 1_000
    const recorder = recorderHarness()
    const inspectTake = vi.fn(async () => ({
      durationMs: 1_100,
      peaks: new Float32Array([0.2, 1]),
      peakAmplitude: 0.7,
    }))
    const saveTake = vi.fn(async () => ({
      ok: true as const,
      quotaExceeded: false,
      roomAvailable: true,
      value: {} as never,
    }))

    await createRoot(async (dispose) => {
      const capture = useDrumPerformanceTakeCaptureController({
        getStream: () => ({ id: 'live-only' }) as MediaStream,
        getAudioContext: () => ({}) as AudioContext,
        createRecorder: () => recorder,
        inspectTake,
        saveTake,
        nowMs: () => clockMs,
        nowIso: () => '2026-08-26T10:59:58.000Z',
      })

      capture.startPlayback()
      expect(capture.state()).toBe('capturing')
      clockMs = 1_600
      capture.pausePlayback()
      await vi.waitFor(() => expect(recorder.pause).toHaveBeenCalledOnce())
      await Promise.resolve()

      clockMs = 4_000
      capture.startPlayback()
      await vi.waitFor(() => expect(recorder.resume).toHaveBeenCalledOnce())
      await Promise.resolve()
      clockMs = 4_500
      capture.pausePlayback()
      await vi.waitFor(() => expect(recorder.pause).toHaveBeenCalledTimes(2))
      await Promise.resolve()

      capture.finish(summary(), 'Backbeat Study')
      expect(capture.state()).toBe('processing')
      await vi.waitFor(() => expect(capture.state()).toBe('ready'))
      expect(inspectTake).toHaveBeenCalledWith(
        expect.any(Blob),
        expect.anything(),
        1_100,
      )
      expect(saveTake).not.toHaveBeenCalled()

      await expect(capture.keep()).resolves.toBe(true)
      expect(capture.state()).toBe('saved')
      expect(saveTake).toHaveBeenCalledWith({
        summary: expect.objectContaining({ id: 'take-1' }),
        projectTitle: 'Backbeat Study',
        audio: expect.objectContaining({
          durationMs: 1_100,
          capturedAt: '2026-08-26T10:59:58.000Z',
        }),
      })
      dispose()
    })
  })

  it('follows the latest transport intent through an in-flight pause', async () => {
    let resolvePause!: (ready: boolean) => void
    const recorder = recorderHarness()
    recorder.pause = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolvePause = resolve
        }),
    )

    await createRoot(async (dispose) => {
      const capture = useDrumPerformanceTakeCaptureController({
        getStream: () => ({}) as MediaStream,
        getAudioContext: () => null,
        createRecorder: () => recorder,
      })

      capture.startPlayback()
      capture.pausePlayback()
      capture.startPlayback()
      resolvePause(true)

      await vi.waitFor(() => expect(recorder.resume).toHaveBeenCalledOnce())
      expect(capture.state()).toBe('capturing')
      dispose()
    })
  })

  it('fails the replay instead of encoding a gap when MediaRecorder cannot pause', async () => {
    const recorder = recorderHarness()
    recorder.pause = vi.fn(async () => false)

    await createRoot(async (dispose) => {
      const capture = useDrumPerformanceTakeCaptureController({
        getStream: () => ({}) as MediaStream,
        getAudioContext: () => null,
        createRecorder: () => recorder,
      })
      capture.startPlayback()
      capture.pausePlayback()

      await vi.waitFor(() => expect(capture.state()).toBe('error'))
      expect(capture.message()).toMatch(/follow the transport/i)
      expect(recorder.discard).toHaveBeenCalledOnce()
      expect(recorder.dispose).toHaveBeenCalledOnce()
      dispose()
    })
  })

  it('reports unsupported or silent replay without throwing away scalar-summary success', async () => {
    await createRoot(async (dispose) => {
      const unsupported = useDrumPerformanceTakeCaptureController({
        getStream: () => null,
        getAudioContext: () => null,
      })
      unsupported.startPlayback()
      expect(unsupported.state()).toBe('unsupported')
      expect(() => unsupported.finish(summary(), 'Pocket')).not.toThrow()
      expect(unsupported.message()).toMatch(/summary still works/i)
      dispose()
    })

    await createRoot(async (dispose) => {
      const silent = useDrumPerformanceTakeCaptureController({
        getStream: () => ({}) as MediaStream,
        getAudioContext: () => ({}) as AudioContext,
        createRecorder: () => recorderHarness(),
        inspectTake: async () => ({
          durationMs: 900,
          peaks: new Float32Array([0, 0]),
          peakAmplitude: 0,
        }),
      })
      silent.startPlayback()
      silent.finish(summary(), 'Pocket')
      await vi.waitFor(() => expect(silent.state()).toBe('error'))
      expect(silent.message()).toMatch(/summary is safe/i)
      await expect(silent.keep()).resolves.toBe(false)
      dispose()
    })
  })

  it('cannot dismiss an in-flight Keep and restores the ready candidate after a failed write', async () => {
    let resolveSave!: (result: {
      ok: false
      quotaExceeded: boolean
      roomAvailable: boolean
    }) => void
    const saveTake = vi.fn(
      () =>
        new Promise<{
          ok: false
          quotaExceeded: boolean
          roomAvailable: boolean
        }>((resolve) => {
          resolveSave = resolve
        }),
    )

    await createRoot(async (dispose) => {
      const capture = useDrumPerformanceTakeCaptureController({
        getStream: () => ({}) as MediaStream,
        getAudioContext: () => null,
        createRecorder: () => recorderHarness(),
        inspectTake: async () => ({
          durationMs: 900,
          peaks: new Float32Array(),
          peakAmplitude: null,
        }),
        saveTake,
      })
      capture.startPlayback()
      capture.finish(summary(), 'Pocket')
      await vi.waitFor(() => expect(capture.state()).toBe('ready'))

      const saving = capture.keep()
      expect(capture.state()).toBe('saving')
      expect(isLocalSaveNavigationLocked()).toBe(true)
      expect(capture.dismiss()).toBe(false)
      resolveSave({ ok: false, quotaExceeded: false, roomAvailable: true })
      await expect(saving).resolves.toBe(false)
      expect(capture.state()).toBe('ready')
      expect(isLocalSaveNavigationLocked()).toBe(false)
      expect(saveTake).toHaveBeenCalledOnce()
      dispose()
    })
  })
})
