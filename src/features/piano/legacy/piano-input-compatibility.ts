// ============================================================
// Piano input compatibility — polyphonic matches for the legacy score loop
// ============================================================

import type { PianoInputSnapshot } from '@/features/piano/input/piano-input-state'

export interface PianoInputPitchMatch {
  readonly matched: boolean
  readonly cents: number | null
}

/**
 * Prefer any normalized sounding voice over the legacy monophonic pitch
 * observation. This keeps every note in a MIDI/touch chord scoreable while
 * preserving microphone cents when no normalized voice owns the target.
 */
export function matchLegacyPianoInputPitch(
  targetMidi: number,
  snapshot: PianoInputSnapshot,
  detectedMidi: number | null,
  detectedCents: number | null,
): PianoInputPitchMatch {
  if (snapshot.soundingNotes.some((note) => note.midi === targetMidi)) {
    return { matched: true, cents: 0 }
  }
  if (detectedMidi === targetMidi) {
    return { matched: true, cents: detectedCents }
  }
  return { matched: false, cents: null }
}
