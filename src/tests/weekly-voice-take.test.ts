import { beforeEach, describe, expect, it, vi } from 'vitest'
import { keepWeeklyLegendVoiceTake, weeklyLegendComparisonKey, weeklyLegendThreadTitle, } from '@/features/challenges/weekly-voice-take'
import type { ExerciseSessionVoiceTake } from '@/features/exercises/use-base-exercise'
import { encodeVoiceAtlasContour } from '@/lib/voice-contour'

const { saveVoiceTakeMock } = vi.hoisted(() => ({
  saveVoiceTakeMock: vi.fn(),
}))

vi.mock('@/db/services/voice-take-service', () => ({
  saveVoiceTake: saveVoiceTakeMock,
}))

const take: ExerciseSessionVoiceTake = {
  blob: new Blob(['legend voice'], { type: 'audio/webm' }),
  durationMs: 6200,
  peaks: new Float32Array([0.2, 0.7]),
  capturedAt: '2026-08-01T12:00:00.000Z',
  contour: encodeVoiceAtlasContour([], { source: 'practice-engine-v1' }),
  config: {
    type: 'sight-singing',
    targetNotes: ['G4', 'A4', 'B4'],
    pattern: 'legend:week-31',
  },
  result: {
    type: 'sight-singing',
    score: 84,
    metrics: { notesScored: 3, avgAccuracy: 84 },
    completedAt: Date.UTC(2026, 7, 1, 12),
  },
}

describe('Weekly Legend voice take', () => {
  beforeEach(() => {
    saveVoiceTakeMock.mockReset()
    saveVoiceTakeMock.mockResolvedValue({
      ok: true,
      quotaExceeded: false,
      roomAvailable: true,
      value: {},
    })
  })

  it('uses the challenge id as the comparison boundary', () => {
    expect(weeklyLegendComparisonKey('week-31')).toBe(
      weeklyLegendComparisonKey('week-31'),
    )
    expect(weeklyLegendComparisonKey('week-32')).not.toBe(
      weeklyLegendComparisonKey('week-31'),
    )
  })

  it('names the thread from the weekly title snapshot', () => {
    expect(weeklyLegendThreadTitle('The Impossible Note')).toBe(
      'Weekly Legend · The Impossible Note',
    )
  })

  it('keeps score, tier, and configuration with local Legend audio', async () => {
    await keepWeeklyLegendVoiceTake({
      context: {
        challengeId: 'week-31',
        title: 'The Impossible Note',
        score: 84,
        targetScore: 70,
        tier: 'completed',
      },
      take,
    })

    expect(saveVoiceTakeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'legend',
        comparisonKey: 'legend:week-31:v1',
        capturedAt: take.capturedAt,
        blob: take.blob,
        contour: take.contour,
        context: expect.objectContaining({
          weeklyChallengeId: 'week-31',
          challengeTitle: 'The Impossible Note',
          score: 84,
          targetScore: 70,
          tier: 'completed',
          configuration: take.config,
        }),
        metrics: expect.objectContaining({
          score: 84,
          targetScore: 70,
          tier: 'completed',
        }),
      }),
    )
  })
})
