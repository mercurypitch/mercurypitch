// ============================================================
// MIDI Program Family — honest backing-instrument classification
// ============================================================
//
// General MIDI programs are stronger evidence than track names or pitch
// ranges. Keep the small family used by Guitar Night separate from synth
// voice variants so a choir, string section, or lead synth never becomes an
// electric guitar merely because that is the room's historical fallback.

export type MidiProgramFamily =
  | 'acoustic-guitar'
  | 'electric-guitar'
  | 'bass'
  | 'neutral'

export interface MidiProgramFamilyEvidence {
  /** Zero-based General MIDI program. Presence wins over every fallback. */
  readonly sourceProgram?: number
  /** Persisted/imported family evidence when no source program survived. */
  readonly instrumentFamily?: unknown
  /** Legacy saved rows retained only the rendered GM instrument name. */
  readonly instrumentName?: string | null
}

export function normalizeMidiProgram(value: unknown): number | undefined {
  return Number.isInteger(value) &&
    (value as number) >= 0 &&
    (value as number) <= 127
    ? (value as number)
    : undefined
}

/** Strict zero-based General MIDI program classification. */
export function midiProgramFamily(program: number): MidiProgramFamily {
  if (!Number.isInteger(program) || program < 0 || program > 127) {
    return 'neutral'
  }
  if (program >= 24 && program <= 25) return 'acoustic-guitar'
  if (program >= 26 && program <= 31) return 'electric-guitar'
  if (program >= 32 && program <= 39) return 'bass'
  return 'neutral'
}

export function isMidiProgramFamily(
  value: unknown,
): value is MidiProgramFamily {
  return (
    value === 'acoustic-guitar' ||
    value === 'electric-guitar' ||
    value === 'bass' ||
    value === 'neutral'
  )
}

function legacyInstrumentNameFamily(
  instrumentName: string | null | undefined,
): MidiProgramFamily {
  const name = instrumentName?.trim().toLowerCase() ?? ''
  if (name === '') return 'neutral'

  if (
    /\bacoustic\b.*\bguitar\b/.test(name) ||
    /\bnylon guitar\b/.test(name) ||
    /\bsteel guitar\b/.test(name)
  ) {
    return 'acoustic-guitar'
  }
  if (
    /\belectric\b.*\bguitar\b/.test(name) ||
    /\b(jazz|clean|muted|overdriven|distortion) guitar\b/.test(name) ||
    /\bguitar harmonics\b/.test(name)
  ) {
    return 'electric-guitar'
  }
  if (/\bbass\b/.test(name)) return 'bass'
  return 'neutral'
}

/** Resolve imported truth while ensuring an explicit program always wins. */
export function resolveMidiProgramFamily(
  evidence: MidiProgramFamilyEvidence,
): MidiProgramFamily {
  if (evidence.sourceProgram !== undefined) {
    return midiProgramFamily(evidence.sourceProgram)
  }
  if (isMidiProgramFamily(evidence.instrumentFamily)) {
    return evidence.instrumentFamily
  }
  return legacyInstrumentNameFamily(evidence.instrumentName)
}
