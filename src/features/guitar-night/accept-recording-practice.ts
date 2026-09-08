// Recording practice admission keeps one immutable revision for unchanged corrections.
// ============================================================

import type { GuitarRecordingDraft } from '@/db/services/guitar-recording-service'
import { createGuitarRecordingStore } from '@/db/services/guitar-recording-service'
import { acceptRecordingScoreRevision, recordingScoreProblem, recordingScoreTuning, } from '@/lib/guitar/recording-score'
import type { GuitarPracticeScore } from '@/lib/guitar/recording-types'

/** Revision identity and timestamps do not change the notes the player accepted. */
export function sameRecordingPractice(
  left: GuitarPracticeScore,
  right: GuitarPracticeScore,
): boolean {
  const content = (score: GuitarPracticeScore) => ({
    recordingId: score.recordingId,
    title: score.title,
    bpm: score.bpm,
    timeSignature: score.timeSignature,
    grid: score.grid,
    instrument: recordingScoreTuning(score).instrument,
    tuning: score.tuning,
    capo: score.capo,
    // Acceptance sorts notes, while the editor can retain its selection order.
    // Neither that order nor property insertion order changes the target.
    notes: [...score.notes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((note) => [
        note.id,
        note.evidenceId,
        note.midi,
        note.startBeat,
        note.endBeat,
        note.string,
        note.fret,
      ]),
    attachment:
      score.attachment === null
        ? null
        : [
            score.attachment.backingId,
            score.attachment.firstSeconds,
            score.attachment.lastSeconds,
          ],
  })
  return JSON.stringify(content(left)) === JSON.stringify(content(right))
}

export async function acceptRecordingPractice(
  draft: GuitarRecordingDraft,
  corrections: GuitarPracticeScore,
  store = createGuitarRecordingStore(),
): Promise<GuitarPracticeScore> {
  const problem = recordingScoreProblem(corrections)
  if (problem !== null) throw new Error(problem)
  if (corrections.recordingId !== draft.recording.id)
    throw new Error('These notes belong to another melody.')
  // Read the durable head: another Review action may already have kept this
  // in-memory draft. The store enforces concurrent revision admission atomically.
  const current = await store.load(draft.recording.id)
  const previous = current.acceptedScore
  if (previous !== undefined && sameRecordingPractice(previous, corrections))
    return previous
  if (
    previous !== undefined &&
    previous.id !== draft.acceptedScore?.id &&
    previous.id !== corrections.id
  )
    throw new Error(
      'These notes changed in another tab. Reopen the melody before accepting another revision.',
    )
  const accepted = acceptRecordingScoreRevision(
    corrections,
    (previous?.revision ?? 0) + 1,
  )
  if (current.recording.state === 'kept') await store.accept(accepted)
  else
    await store.keep(
      {
        ...current,
        recording: { ...current.recording, title: corrections.title },
      },
      accepted,
      corrections,
    )
  return accepted
}
