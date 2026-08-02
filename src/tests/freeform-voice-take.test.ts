import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFreeformThreadTarget, keepFreeformVoiceTake, } from '@/features/voice-history/freeform-voice-take'

const { saveVoiceTakeMock } = vi.hoisted(() => ({
  saveVoiceTakeMock: vi.fn(),
}))

vi.mock('@/db/services/voice-take-service', () => ({
  saveVoiceTake: saveVoiceTakeMock,
}))

describe('freeform voice-take context', () => {
  beforeEach(() => {
    saveVoiceTakeMock.mockReset()
    saveVoiceTakeMock.mockResolvedValue({
      ok: true,
      quotaExceeded: false,
      roomAvailable: true,
      value: {},
    })
  })

  it('creates a private comparison boundary for each new thread', () => {
    const first = createFreeformThreadTarget()
    const second = createFreeformThreadTarget()

    expect(first.title).toBe('')
    expect(first.comparisonKey).toMatch(/^freeform:.+:v1$/)
    expect(second.comparisonKey).not.toBe(first.comparisonKey)
  })

  it('keeps dry capture metadata in the selected thread without a score', async () => {
    const target = {
      comparisonKey: 'freeform:chorus-thread:v1',
      title: '',
    }
    const take = {
      blob: new Blob(['voice'], { type: 'audio/webm' }),
      durationMs: 4800,
      peaks: new Float32Array([0.2, 0.8]),
      capturedAt: '2026-08-02T12:00:00.000Z',
    }

    await keepFreeformVoiceTake({
      target,
      threadTitle: '  First chorus after warm-up  ',
      take,
    })

    expect(saveVoiceTakeMock).toHaveBeenCalledWith({
      source: 'freeform',
      comparisonKey: target.comparisonKey,
      contextVersion: 1,
      capturedAt: take.capturedAt,
      durationMs: take.durationMs,
      blob: take.blob,
      peaks: take.peaks,
      title: 'First chorus after warm-up',
      context: {
        threadTitle: 'First chorus after warm-up',
        prompt: 'First chorus after warm-up',
      },
    })
  })
})
