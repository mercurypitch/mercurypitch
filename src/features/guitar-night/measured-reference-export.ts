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

import type { GuitarPracticeScore } from '@/lib/guitar/recording-types'
import type { GuitarNightReference } from './reference-port'

/**
 * The tempo a measured line is written at: the score room's fastest, 220 BPM
 * (`GUITAR_ROOM_BAND_MAX_TEMPO_BPM`), so the file plays there at its own
 * tempo. The room holds every score to its band's range, and a line written
 * at 240 BPM played 8 % slow.
 *
 * The line was heard in seconds and has no tempo of its own; the stage reads
 * it at one beat a second (`MEASURED_REFERENCE_TEMPO`). Guitar Pro rounds to
 * thirty-second notes of the score's tempo, 125 ms at 60 BPM, and real lines
 * play faster than that: the bass line read from Dance of Death's stem has
 * 335 attacks closer together, its guitar line 59, and the writer refused
 * both. At 220 BPM the grid is 34 ms. The transcriber keeps no note shorter
 * than 50 ms, so two attacks never share a cell; Dance of Death's closest on
 * one string are 60 ms apart, and both lines write. MIDI keeps the same
 * seconds at any tempo, so both formats share this score.
 */
export const MEASURED_EXPORT_BPM = 220

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
  // The reference's beats, at its own tempo, in the export's beats.
  const scale = MEASURED_EXPORT_BPM / reference.tempoBpm
  return {
    id,
    recordingId: id,
    revision: 1,
    title: `${songTitle} ${reference.trackName} line`,
    createdAt: stamp,
    updatedAt: stamp,
    bpm: MEASURED_EXPORT_BPM,
    timeSignature: [4, 4],
    grid: 'display',
    // The neck the line was placed on: a bass line read on a guitar was
    // lifted onto the guitar's strings, and its frets are the guitar's.
    instrument: reference.tuning.instrument,
    tuning: [...reference.tuning.openMidi],
    capo: reference.tuning.capo ?? 0,
    attachment: null,
    // Held to the score limit, not to a take's five minutes.
    origin: 'measured-line',
    notes: reference.notes.map((note) => ({
      id: note.id,
      evidenceId: note.id,
      midi: note.midi,
      startBeat: note.startBeat * scale,
      endBeat: (note.startBeat + note.duration) * scale,
      // The stage counts strings from 0, highest first; a score from 1.
      string: note.stringIndex + 1,
      fret: note.fret,
    })),
  }
}
