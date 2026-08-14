import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeVoiceAtlasContour } from '@/lib/voice-contour'
import { karaokeComparisonKey, karaokeThreadTitle, keepKaraokeVoiceTake, } from './karaoke-voice-take'

const { saveVoiceTakeMock } = vi.hoisted(() => ({
  saveVoiceTakeMock: vi.fn(),
}))

vi.mock('@/db/services/voice-take-service', () => ({
  saveVoiceTake: saveVoiceTakeMock,
}))

describe('karaoke voice-take context', () => {
  beforeEach(() => {
    saveVoiceTakeMock.mockReset()
    saveVoiceTakeMock.mockResolvedValue({
      ok: true,
      quotaExceeded: false,
      roomAvailable: true,
      value: {},
    })
  })

  it('keeps repeated performances of one local song in one thread', () => {
    expect(karaokeComparisonKey('song-session-42')).toBe(
      'karaoke:song-session-42:v1',
    )
    expect(karaokeThreadTitle('Heaven Can Wait.flac')).toBe('Heaven Can Wait')
  })

  it('stores only the dry microphone take with its local score context', async () => {
    const take = {
      blob: new Blob(['voice'], { type: 'audio/webm' }),
      durationMs: 20_400,
      peaks: new Float32Array([0.2, 0.9]),
      capturedAt: '2026-08-03T10:00:00.000Z',
      contour: encodeVoiceAtlasContour(
        [{ t: 0, f0: 220, conf: 0.8, rms: 0.3 }],
        { source: 'f0-stream-yin-v1' },
      ),
      score: {
        totalNotes: 100,
        matchedNotes: 40,
        accuracyPct: 40,
        avgCentsOff: 62,
        grade: 'D' as const,
        notesTotal: 12,
        notesHit: 5,
      },
    }

    await keepKaraokeVoiceTake({
      sessionId: 'song-session-42',
      songTitle: 'Heaven Can Wait.flac',
      take,
    })

    expect(saveVoiceTakeMock).toHaveBeenCalledWith({
      source: 'karaoke',
      comparisonKey: 'karaoke:song-session-42:v1',
      contextVersion: 1,
      capturedAt: take.capturedAt,
      durationMs: take.durationMs,
      blob: take.blob,
      peaks: take.peaks,
      contour: take.contour,
      title: 'Heaven Can Wait',
      context: {
        threadTitle: 'Heaven Can Wait',
        sessionId: 'song-session-42',
        songTitle: 'Heaven Can Wait.flac',
        score: 40,
        grade: 'D',
      },
      metrics: {
        accuracyPct: 40,
        averageCentsOff: 62,
        matchedSamples: 40,
        judgedSamples: 100,
        notesHit: 5,
        notesTotal: 12,
        grade: 'D',
      },
      metricsVersion: 1,
    })
  })
})
