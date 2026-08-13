import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildChallengeStageVoiceTake, recordChallengeStageResult, } from './challenge-stage-voice-take'

const { recordExerciseResultMock } = vi.hoisted(() => ({
  recordExerciseResultMock: vi.fn(),
}))

vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: recordExerciseResultMock,
}))

const result = {
  type: 'sight-singing' as const,
  score: 84,
  metrics: { durationMs: 6200, notesScored: 3 },
  completedAt: Date.UTC(2026, 7, 1, 12),
}

const capture = {
  blob: new Blob(['legend voice'], { type: 'audio/webm' }),
  durationMs: 6200,
  peaks: new Float32Array([0.2, 0.7]),
  capturedAt: '2026-08-01T12:00:00.000Z',
  frames: [
    { t: 0, f0: 196, conf: 0.91, rms: 0.2 },
    { t: 0.04, f0: 220, conf: 0.93, rms: 0.3 },
  ],
  segments: [],
  peakAmplitude: 0.7,
  pitchAnalysisAvailable: true,
  microphoneContinuous: true,
  sampleRateHz: 48_000,
}

describe('Weekly Legend challenge-stage voice handoff', () => {
  beforeEach(() => {
    recordExerciseResultMock.mockReset()
  })

  it('keeps the exact challenge context beside the dry stage recording', () => {
    const take = buildChallengeStageVoiceTake({
      capture,
      challengeId: 'week-31',
      targetNotes: ['G3', 'A3', 'B3'],
      result,
    })

    expect(take).toMatchObject({
      blob: capture.blob,
      durationMs: 6200,
      capturedAt: capture.capturedAt,
      config: {
        type: 'sight-singing',
        targetNotes: ['G3', 'A3', 'B3'],
        pattern: 'legend:week-31',
      },
      result,
    })
    expect(take.contour.s).toBe('f0-stream-yin-v1')
    expect(take.contour.p).not.toHaveLength(0)
  })

  it('finishes capture before publishing the scored weekly result', async () => {
    const stop = vi.fn(async () => capture)

    await recordChallengeStageResult({
      voiceCapture: { capture: () => null, state: () => 'recording', stop },
      challengeId: 'week-31',
      targetNotes: ['G3', 'A3', 'B3'],
      result,
    })

    expect(stop).toHaveBeenCalledOnce()
    expect(recordExerciseResultMock).toHaveBeenCalledWith(result, {
      weeklyVoiceCapture: expect.objectContaining({
        state: 'ready',
        take: expect.objectContaining({ blob: capture.blob }),
      }),
    })
  })

  it('reuses a take already finalized by the recorder duration cap', async () => {
    const stop = vi.fn(async () => null)

    await recordChallengeStageResult({
      voiceCapture: { capture: () => capture, state: () => 'ready', stop },
      challengeId: 'week-31',
      targetNotes: ['G3', 'A3', 'B3'],
      result,
    })

    expect(stop).not.toHaveBeenCalled()
    expect(recordExerciseResultMock).toHaveBeenCalledWith(result, {
      weeklyVoiceCapture: expect.objectContaining({
        state: 'ready',
        take: expect.objectContaining({ blob: capture.blob }),
      }),
    })
  })

  it('still publishes the score when this browser cannot record audio', async () => {
    await recordChallengeStageResult({
      voiceCapture: {
        capture: () => null,
        state: () => 'unsupported',
        stop: vi.fn(async () => null),
      },
      challengeId: 'week-31',
      targetNotes: ['G3'],
      result,
    })

    expect(recordExerciseResultMock).toHaveBeenCalledWith(result, {
      weeklyVoiceCapture: { state: 'unsupported', take: null },
    })
  })

  it('does not lose the score when capture finalization throws', async () => {
    await recordChallengeStageResult({
      voiceCapture: {
        capture: () => null,
        state: () => 'idle',
        stop: vi.fn(async () => {
          throw new Error('decoder failed')
        }),
      },
      challengeId: 'week-31',
      targetNotes: ['G3'],
      result,
    })

    expect(recordExerciseResultMock).toHaveBeenCalledWith(result, {
      weeklyVoiceCapture: { state: 'error', take: null },
    })
  })
})
