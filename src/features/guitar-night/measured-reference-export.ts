// ============================================================
// Measured reference export — a transcribed stem line as a score file
// ============================================================
//
// "Transcribe the bass line" puts a measured line on Guitar Night's stage.
// The recorder already writes MIDI and Guitar Pro 7 from its practice score
// (lib/guitar/recording-export.ts), so the line is mapped onto that score
// type and written by the same writers.
//
// Only the notes placed on the neck go in: a note the neck cannot reach
// (`outOfRangeNotes`) was never drawn, and has no string or fret to write.
// The time base is the measured reference's own, one beat a second
// (`MEASURED_REFERENCE_TEMPO`), so MIDI keeps the played timing exactly and
// Guitar Pro rounds it to thirty-second notes of that tempo, 125 ms.

import type { GuitarPracticeScore } from '@/lib/guitar/recording-types'
import type { GuitarNightReference } from './reference-port'

/**
 * The practice score a measured line exports as; null for a reference that
 * was not measured, or a line with no note on the neck.
 */
export function practiceScoreFromMeasuredReference(
  reference: GuitarNightReference,
  songTitle: string,
  now: Date = new Date(),
): GuitarPracticeScore | null {
  if (reference.kind !== 'measured' || reference.notes.length === 0) {
    return null
  }
  const id = `measured:${reference.songId}`
  const stamp = now.toISOString()
  return {
    id,
    recordingId: id,
    revision: 1,
    title: `${songTitle} ${reference.trackName} line`,
    createdAt: stamp,
    updatedAt: stamp,
    bpm: reference.tempoBpm,
    timeSignature: [4, 4],
    grid: 'display',
    // The neck the line was placed on: a bass line read on a guitar was
    // lifted onto the guitar's strings, and its frets are the guitar's.
    instrument: reference.tuning.instrument,
    tuning: [...reference.tuning.openMidi],
    capo: reference.tuning.capo ?? 0,
    attachment: null,
    notes: reference.notes.map((note) => ({
      id: note.id,
      evidenceId: note.id,
      midi: note.midi,
      startBeat: note.startBeat,
      endBeat: note.startBeat + note.duration,
      // The stage counts strings from 0, highest first; a score from 1.
      string: note.stringIndex + 1,
      fret: note.fret,
    })),
  }
}
