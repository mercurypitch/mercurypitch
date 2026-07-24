import type { SessionPitchData } from '@/db/services/session-pitch-analysis-service'
import { detectKeyFromNotes } from '@/lib/key-detection'
import { midiToNote } from '@/lib/scale-data'

export interface MobileAnalysisSummary {
  rawNoteCount: number
  cleanedNoteCount: number
  voicedSeconds: number
  spanSeconds: number
  coveragePercent: number
  lowNote: string
  highNote: string
  rangeSemitones: number
  keyLabel: string
  keyRegionCount: number
  manualEditCount: number
}

function noteLabel(midi: number): string {
  const note = midiToNote(midi)
  return `${note.name}${note.octave}`
}

/** Build the compact, phone-safe facts shown for a cached UVR pitch pass. */
export function buildMobileAnalysisSummary(
  data: SessionPitchData,
): MobileAnalysisSummary | null {
  const notes =
    data.segmentedNotes.length > 0 ? data.segmentedNotes : data.mergedNotes
  if (notes.length === 0) return null

  let lowMidi = Infinity
  let highMidi = -Infinity
  let startSec = Infinity
  let endSec = -Infinity
  let voicedSeconds = 0

  for (const note of notes) {
    lowMidi = Math.min(lowMidi, note.midi)
    highMidi = Math.max(highMidi, note.midi)
    startSec = Math.min(startSec, note.startSec)
    endSec = Math.max(endSec, note.endSec)
    voicedSeconds += Math.max(0, note.endSec - note.startSec)
  }

  const spanSeconds = Math.max(0, endSec - startSec)
  const key = detectKeyFromNotes(notes)
  const mode = key.mode === 'major' ? 'major' : 'minor'

  return {
    rawNoteCount: data.mergedNotes.length,
    cleanedNoteCount: notes.length,
    voicedSeconds,
    spanSeconds,
    coveragePercent:
      spanSeconds > 0
        ? Math.min(100, Math.round((voicedSeconds / spanSeconds) * 100))
        : 0,
    lowNote: noteLabel(lowMidi),
    highNote: noteLabel(highMidi),
    rangeSemitones: Math.max(0, Math.round(highMidi - lowMidi)),
    keyLabel: `${key.keyName} ${mode}`,
    keyRegionCount: data.keyRegions?.length ?? 0,
    manualEditCount:
      (data.editLayer?.manual.length ?? 0) +
      (data.editLayer?.deleted.length ?? 0),
  }
}
