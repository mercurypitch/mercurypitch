import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { TakeRecorder } from '@/lib/voice-capture'
import { useKaraokeVoiceCaptureController } from './useKaraokeVoiceCaptureController'

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
  it('pauses with transport and explicitly keeps the scored replay', async () => {
    let clockMs = 1_000
    const start = vi.fn(() => true)
    const pause = vi.fn(() => true)
    const resume = vi.fn(() => true)
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
      expect(capture.state()).toBe('paused')
      clockMs = 3_000
      capture.startPlayback()
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

  it('discards an unscored run instead of exposing a keep action', () => {
    createRoot((dispose) => {
      const recorder: TakeRecorder = {
        start: () => true,
        pause: () => true,
        resume: () => true,
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
