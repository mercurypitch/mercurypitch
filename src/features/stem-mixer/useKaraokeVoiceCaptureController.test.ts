import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { TakeRecorder } from '@/lib/voice-capture'
import type { KaraokeVoiceCaptureState } from './useKaraokeVoiceCaptureController'
import { syncKaraokeCaptureWithMic, useKaraokeVoiceCaptureController, } from './useKaraokeVoiceCaptureController'

const SCORE = {
  totalNotes: 100,
  matchedNotes: 40,
  accuracyPct: 40,
  avgCentsOff: 62,
  grade: 'D' as const,
  notesTotal: 12,
  notesHit: 5,
}

describe('karaoke voice capture controller', () => {
  it('discards only an active mic window and starts fresh when scoring returns', () => {
    let state: KaraokeVoiceCaptureState = 'recording'
    const capture = {
      state: () => state,
      startPlayback: vi.fn(),
      dismiss: vi.fn(),
    }

    syncKaraokeCaptureWithMic(capture, false, true)
    expect(capture.dismiss).toHaveBeenCalledOnce()
    expect(capture.startPlayback).not.toHaveBeenCalled()

    state = 'paused'
    syncKaraokeCaptureWithMic(capture, false, false)
    expect(capture.dismiss).toHaveBeenCalledTimes(2)

    state = 'processing'
    syncKaraokeCaptureWithMic(capture, false, false)
    expect(capture.dismiss).toHaveBeenCalledTimes(2)

    state = 'ready'
    syncKaraokeCaptureWithMic(capture, false, false)
    expect(capture.dismiss).toHaveBeenCalledTimes(2)

    syncKaraokeCaptureWithMic(capture, true, true)
    expect(capture.startPlayback).toHaveBeenCalledOnce()

    syncKaraokeCaptureWithMic(capture, true, false)
    expect(capture.startPlayback).toHaveBeenCalledOnce()
  })

  it('pauses with transport and explicitly keeps the scored replay', async () => {
    let clockMs = 1_000
    const start = vi.fn(() => true)
    const pause = vi.fn(async () => true)
    const resume = vi.fn(async () => true)
    const stop = vi.fn(async () =>
      Promise.resolve(new Blob(['voice'], { type: 'audio/webm' })),
    )
    const recorder: TakeRecorder = {
      start,
      pause,
      resume,
      stop,
      discard: vi.fn(),
      dispose: vi.fn(),
    }
    const inspectTake = vi.fn(async () => ({
      durationMs: 2_000,
      peaks: new Float32Array([0.2, 0.8]),
    }))
    const saveTake = vi.fn(async () => ({
      ok: true,
      quotaExceeded: false,
      roomAvailable: true,
      value: {} as never,
    }))

    await createRoot(async (dispose) => {
      const capture = useKaraokeVoiceCaptureController({
        sessionId: 'song-session-42',
        songTitle: 'Heaven Can Wait.flac',
        getStream: () => ({}) as MediaStream,
        getAudioContext: () => ({}) as AudioContext,
        createRecorder: () => recorder,
        inspectTake,
        saveTake,
        nowMs: () => clockMs,
        nowIso: () => '2026-08-03T10:00:00.000Z',
      })

      capture.startPlayback()
      expect(capture.state()).toBe('recording')
      clockMs = 1_500
      capture.pushMicFrame({ f0: 220, conf: 0.8, rms: 0.3 })

      clockMs = 2_000
      capture.pausePlayback()
      expect(capture.state()).toBe('recording')
      await vi.waitFor(() => expect(capture.state()).toBe('paused'))
      clockMs = 3_000
      capture.startPlayback()
      await vi.waitFor(() => expect(capture.state()).toBe('recording'))
      clockMs = 3_500
      capture.pushMicFrame({ f0: 230, conf: 0.75, rms: 0.4 })
      clockMs = 4_000
      capture.finishScoredPlayback(SCORE)

      expect(capture.state()).toBe('processing')
      await vi.waitFor(() => expect(capture.state()).toBe('ready'))
      expect(start).toHaveBeenCalledOnce()
      expect(pause).toHaveBeenCalledOnce()
      expect(resume).toHaveBeenCalledOnce()
      expect(inspectTake).toHaveBeenCalledWith(
        expect.any(Blob),
        expect.anything(),
        2_000,
      )

      await expect(capture.keep()).resolves.toBe(true)
      expect(capture.state()).toBe('saved')
      expect(saveTake).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'song-session-42',
          songTitle: 'Heaven Can Wait.flac',
          take: expect.objectContaining({
            durationMs: 2_000,
            capturedAt: '2026-08-03T10:00:00.000Z',
            score: SCORE,
            contour: expect.objectContaining({
              p: [
                [500, 5700, 204, 77],
                [1500, 5777, 191, 102],
              ],
            }),
          }),
        }),
      )
      dispose()
    })
  })

  it('reconciles a quick transport resume after a queued pause is ready', async () => {
    let clockMs = 1_000
    let resolvePause!: (ready: boolean) => void
    const pause = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolvePause = resolve
        }),
    )
    const resume = vi.fn(async () => true)
    const recorder: TakeRecorder = {
      start: () => true,
      pause,
      resume,
      stop: vi.fn(async () => null),
      discard: vi.fn(),
      dispose: vi.fn(),
    }

    await createRoot(async (dispose) => {
      const capture = useKaraokeVoiceCaptureController({
        sessionId: 'song-session-42',
        songTitle: 'Heaven Can Wait',
        getStream: () => ({}) as MediaStream,
        getAudioContext: () => null,
        createRecorder: () => recorder,
        nowMs: () => clockMs,
      })

      capture.startPlayback()
      clockMs = 1_500
      capture.pausePlayback()
      clockMs = 1_600
      capture.startPlayback()
      resolvePause(true)

      await vi.waitFor(() => expect(resume).toHaveBeenCalledOnce())
      expect(capture.state()).toBe('recording')
      expect(pause).toHaveBeenCalledOnce()
      expect(resume).toHaveBeenCalledOnce()
      dispose()
    })
  })

  it('discards an unscored run instead of exposing a keep action', () => {
    createRoot((dispose) => {
      const recorder: TakeRecorder = {
        start: () => true,
        pause: async () => true,
        resume: async () => true,
        stop: vi.fn(async () => null),
        discard: vi.fn(),
        dispose: vi.fn(),
      }
      const capture = useKaraokeVoiceCaptureController({
        sessionId: 'song-session-42',
        songTitle: 'Heaven Can Wait',
        getStream: () => ({}) as MediaStream,
        getAudioContext: () => null,
        createRecorder: () => recorder,
      })

      capture.startPlayback()
      capture.finishScoredPlayback(null)

      expect(capture.state()).toBe('idle')
      expect(recorder.discard).toHaveBeenCalledOnce()
      dispose()
    })
  })
})
