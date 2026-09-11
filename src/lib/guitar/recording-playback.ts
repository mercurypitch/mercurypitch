// Recording audition separates original input, corrected-note synthesis and reversible amp choices.
import type { GuitarRecordingDraft } from '@/db/services/guitar-recording-service'
import type { GuitarElectricAmpParameters } from './guitar-electric-amp'
import { normalizeGuitarElectricAmpParameters } from './guitar-electric-amp'
import type { RecordingPlaybackNote } from './recording-note-player'
import type { GuitarPracticeScore } from './recording-types'
import { GUITAR_RECORDING_LIMIT_SECONDS } from './recording-types'

export type GuitarRecordingPlaybackSource = 'recording' | 'notes'
export type GuitarRecordingPlaybackTone = 'current-amp' | 'clean' | 'saved-amp'

/** Audition needs valid pitch/time, not a playable assignment to this neck. */
export function recordingPlaybackNotes(
  draft: GuitarRecordingDraft,
  corrections: GuitarPracticeScore | null,
): RecordingPlaybackNote[] {
  const score =
    corrections?.recordingId === draft.recording.id
      ? corrections
      : (draft.editableScore ?? draft.acceptedScore)
  const raw =
    score === undefined
      ? draft.notes.map((note) => ({
          midi: note.midi,
          startSeconds: note.startFrame / draft.recording.sampleRate,
          endSeconds: note.endFrame / draft.recording.sampleRate,
        }))
      : score.notes.map((note) => ({
          midi: note.midi,
          startSeconds: (note.startBeat * 60) / score.bpm,
          endSeconds: (note.endBeat * 60) / score.bpm,
        }))
  return raw
    .filter(
      (note) =>
        Number.isInteger(note.midi) &&
        note.midi >= 0 &&
        note.midi <= 127 &&
        Number.isFinite(note.startSeconds) &&
        Number.isFinite(note.endSeconds) &&
        note.startSeconds >= 0 &&
        note.endSeconds > note.startSeconds &&
        note.endSeconds <= GUITAR_RECORDING_LIMIT_SECONDS,
    )
    .sort((a, b) => a.startSeconds - b.startSeconds)
}

export function recordingPlaybackAmp(
  tone: GuitarRecordingPlaybackTone,
  current: GuitarElectricAmpParameters,
  saved: GuitarElectricAmpParameters | null,
): GuitarElectricAmpParameters | null {
  if (tone === 'saved-amp' && saved === null) return null
  return normalizeGuitarElectricAmpParameters(
    tone === 'clean'
      ? { ...current, enabled: false }
      : tone === 'saved-amp'
        ? saved!
        : current,
  )
}
