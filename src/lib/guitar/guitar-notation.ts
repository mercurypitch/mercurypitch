// ============================================================
// Guitar notation — source-authored marks that survive the import pipeline
// ============================================================
//
// These values describe only what the score explicitly carries. They stay
// optional so plain MIDI files, measured audio, and songs saved before this
// contract existed remain valid without invented technique information.

export type GuitarBendType =
  | 'custom'
  | 'bend'
  | 'release'
  | 'bend-release'
  | 'hold'
  | 'prebend'
  | 'prebend-bend'
  | 'prebend-release'

export interface GuitarBendPoint {
  /** Position within the note, normalised from 0 (attack) to 1 (release). */
  at: number
  /** Signed pitch offset from the fretted note. */
  semitones: number
}

export type GuitarSlideType =
  | 'into-from-below'
  | 'into-from-above'
  | 'shift'
  | 'legato'
  | 'out-up'
  | 'out-down'
  | 'pick-slide-down'
  | 'pick-slide-up'

export type GuitarTechnique =
  | {
      kind: 'bend'
      bendType: GuitarBendType
      /** Largest authored pitch displacement, in semitones. */
      semitones: number
      /** The authored bend contour when the source supplied one. */
      points?: readonly GuitarBendPoint[]
    }
  | {
      kind: 'slide'
      slideType: GuitarSlideType
      /** Destination for connected slides; absent for open-ended slide marks. */
      toFret?: number
      /** Stable score-local target id when alphaTab exposes a destination. */
      toNoteId?: string
    }
  | {
      kind: 'hammer-on' | 'pull-off'
      toFret?: number
      toNoteId?: string
    }
  | { kind: 'vibrato'; width: 'slight' | 'wide' }
  | { kind: 'palm-mute' }
  | { kind: 'let-ring' }

export interface GuitarNoteNotation {
  /** A chord name written into the source score, never an inferred label. */
  chordLabel?: string
  /** Technique marks written on this note or its containing beat. */
  techniques?: readonly GuitarTechnique[]
}
