// ============================================================
// Karaoke Voice Take — stable song threads and local keep adapter
// ============================================================
//
// Karaoke scoring may prepare a dry microphone replay, but only this explicit
// keep boundary writes it to Hear Yourself. Source stems never enter the take.

import type { SaveVoiceTakeResult } from '@/db/services/voice-take-service'
import { saveVoiceTake } from '@/db/services/voice-take-service'
import type { MicScore } from '@/lib/mic-scoring'
import type { VoiceAtlasContourPayloadV1 } from '@/lib/voice-contour'

const KARAOKE_CONTEXT_VERSION = 1

export interface KaraokeVoiceTakeCapture {
  blob: Blob
  durationMs: number
  peaks: Float32Array
  capturedAt: string
  contour: VoiceAtlasContourPayloadV1
  score: MicScore
}

export function karaokeComparisonKey(sessionId: string): string {
  return `karaoke:${sessionId}:v${KARAOKE_CONTEXT_VERSION}`
}

export function karaokeThreadTitle(songTitle: string): string {
  const withoutExtension = songTitle.replace(/\.[^.]+$/, '').trim()
  return withoutExtension === '' ? 'Karaoke take' : withoutExtension
}

export async function keepKaraokeVoiceTake(input: {
  sessionId: string
  songTitle: string
  take: KaraokeVoiceTakeCapture
}): Promise<SaveVoiceTakeResult> {
  const threadTitle = karaokeThreadTitle(input.songTitle)
  return saveVoiceTake({
    source: 'karaoke',
    comparisonKey: karaokeComparisonKey(input.sessionId),
    contextVersion: KARAOKE_CONTEXT_VERSION,
    capturedAt: input.take.capturedAt,
    durationMs: input.take.durationMs,
    blob: input.take.blob,
    peaks: input.take.peaks,
    contour: input.take.contour,
    title: threadTitle,
    context: {
      threadTitle,
      sessionId: input.sessionId,
      songTitle: input.songTitle,
      score: input.take.score.accuracyPct,
      grade: input.take.score.grade,
    },
    metrics: {
      accuracyPct: input.take.score.accuracyPct,
      averageCentsOff: input.take.score.avgCentsOff,
      matchedSamples: input.take.score.matchedNotes,
      judgedSamples: input.take.score.totalNotes,
      notesHit: input.take.score.notesHit ?? null,
      notesTotal: input.take.score.notesTotal ?? null,
      grade: input.take.score.grade,
    },
    metricsVersion: 1,
  })
}
