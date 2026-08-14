import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exerciseComparisonKey, exerciseThreadTitle, keepExerciseVoiceTake, } from '@/features/exercises/exercise-voice-take'
import type { ExerciseSessionVoiceTake } from '@/features/exercises/use-base-exercise'
import { encodeVoiceAtlasContour } from '@/lib/voice-contour'

const { saveVoiceTakeMock } = vi.hoisted(() => ({
  saveVoiceTakeMock: vi.fn(),
}))

vi.mock('@/db/services/voice-take-service', () => ({
  saveVoiceTake: saveVoiceTakeMock,
}))

describe('exercise voice-take context', () => {
  beforeEach(() => {
    saveVoiceTakeMock.mockReset()
    saveVoiceTakeMock.mockResolvedValue({
      ok: true,
      quotaExceeded: false,
      roomAvailable: true,
      value: {},
    })
  })

  it('keeps equivalent configurations in one comparison thread', () => {
    const first = exerciseComparisonKey({
      type: 'slide',
      targetNotes: ['C4', 'E4'],
      pattern: 'smooth',
    })
    const equivalent = exerciseComparisonKey({
      pattern: 'smooth',
      targetNotes: ['C4', 'E4'],
      type: 'slide',
    })

    expect(equivalent).toBe(first)
    expect(first).toMatch(/^exercise:slide:[a-z0-9]+:v1$/)
  })

  it('separates different targets and exercise variants', () => {
    const baseline = exerciseComparisonKey({
      type: 'vibrato',
      targetNote: 'C4',
      pattern: 'natural',
    })

    expect(
      exerciseComparisonKey({
        type: 'vibrato',
        targetNote: 'D4',
        pattern: 'natural',
      }),
    ).not.toBe(baseline)
    expect(
      exerciseComparisonKey({
        type: 'vibrato',
        targetNote: 'C4',
        pattern: 'wide',
      }),
    ).not.toBe(baseline)
  })

  it('names a thread from its repeatable musical context', () => {
    expect(
      exerciseThreadTitle('Long Note Practice', {
        type: 'long-note',
        targetNote: 'A3',
      }),
    ).toBe('Long Note Practice · A3')
    expect(
      exerciseThreadTitle('Slide Practice', {
        type: 'slide',
        targetNotes: ['C4', 'G4'],
      }),
    ).toBe('Slide Practice · C4 to G4')
  })

  it('keeps the captured practice contour beside the dry audio', async () => {
    const take: ExerciseSessionVoiceTake = {
      blob: new Blob(['voice'], { type: 'audio/webm' }),
      durationMs: 4200,
      peaks: new Float32Array([0.2, 0.8]),
      capturedAt: '2026-08-02T12:00:00.000Z',
      contour: encodeVoiceAtlasContour(
        [{ t: 0, f0: 220, conf: 0.8, rms: 0.3 }],
        { source: 'practice-engine-v1' },
      ),
      config: { type: 'long-note', targetNote: 'A3' },
      result: {
        type: 'long-note',
        score: 84,
        metrics: { steadyZonePct: 78 },
        completedAt: Date.UTC(2026, 7, 2, 12),
      },
    }

    await keepExerciseVoiceTake({
      exerciseTitle: 'Long Note Practice',
      take,
    })

    expect(saveVoiceTakeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'exercise',
        contour: take.contour,
      }),
    )
  })
})
