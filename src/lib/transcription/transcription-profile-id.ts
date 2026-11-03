// ============================================================
// Transcription profile id — which range a stem is read in
// ============================================================
//
// A leaf: Guitar Night names the profile while the room loads, and the
// transcriber itself (stem-transcription.ts) loads only when a stem is read.

/** The instrument ranges a stem can be read in. */
export type TranscriptionProfileId = 'bass' | 'guitar'

/**
 * The range to read a stem in. A guitar stem gets the guitar's; every other
 * stem keeps the bass profile it has always been read with.
 */
export function transcriptionProfileFor(
  stemKind: string,
): TranscriptionProfileId {
  return stemKind === 'guitar' ? 'guitar' : 'bass'
}
