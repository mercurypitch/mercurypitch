// Naming a chord from the notes themselves.
// ============================================================
//
// Guitar Pro files carry a chord name per beat and the highway draws it. A MIDI
// file carries no such thing, so a tab imported from MIDI shows two bare notes
// on two strings and leaves the player to work out that `0 2` is E5 — which, on
// a fast passage, is a bar's worth of reading time nobody has.
//
// This is deliberately not the chroma detector in @/lib/chord-detector. That one
// scores 48 templates against audio chroma frames and belongs to the Lab; its
// vocabulary is maj/min/dim/aug, which cannot name a power chord at all because
// a root and a fifth have no third to classify. Authored notes are exact, so
// naming them is set matching rather than estimation.
//
// Tests: src/lib/guitar/chord-naming.test.ts.

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const

/**
 * Interval sets, in semitones above the root, longest first.
 *
 * Order is the priority order: a longer set is a more specific claim, so it is
 * tried first and only falls back to the shorter reading. Power chords sit near
 * the bottom because {0,7} is a subset of nearly everything above them.
 */
const SHAPES: readonly { intervals: readonly number[]; suffix: string }[] = [
  { intervals: [0, 4, 7, 11], suffix: 'maj7' },
  { intervals: [0, 3, 7, 10], suffix: 'm7' },
  { intervals: [0, 4, 7, 10], suffix: '7' },
  { intervals: [0, 3, 6, 10], suffix: 'm7b5' },
  { intervals: [0, 3, 6, 9], suffix: 'dim7' },
  { intervals: [0, 4, 7], suffix: '' },
  { intervals: [0, 3, 7], suffix: 'm' },
  { intervals: [0, 3, 6], suffix: 'dim' },
  { intervals: [0, 4, 8], suffix: 'aug' },
  { intervals: [0, 2, 7], suffix: 'sus2' },
  { intervals: [0, 5, 7], suffix: 'sus4' },
  { intervals: [0, 7], suffix: '5' },
  { intervals: [0, 5], suffix: '5' },
]

function pitchClassSet(midis: readonly number[]): number[] {
  return [...new Set(midis.map((midi) => ((midi % 12) + 12) % 12))].sort(
    (left, right) => left - right,
  )
}

/**
 * A chord name for these notes, or null when they do not form one.
 *
 * The lowest sounding note picks the bass, which is what a guitarist reads:
 * a root-position E5 and its inversion are different shapes under the hand even
 * though they share a pitch-class set. A slash is added only when the bass is
 * not the root.
 */
export function chordLabelForMidis(midis: readonly number[]): string | null {
  if (midis.length < 2) return null
  const classes = pitchClassSet(midis)
  // Two notes an octave apart are one note played twice, not a chord.
  if (classes.length < 2) return null
  const bass = ((Math.min(...midis) % 12) + 12) % 12

  const fits = (
    shape: (typeof SHAPES)[number],
    candidateRoot: number,
  ): boolean => {
    if (shape.intervals.length !== classes.length) return false
    const wanted = shape.intervals
      .map((interval) => (candidateRoot + interval) % 12)
      .sort((left, right) => left - right)
    return wanted.every((pitch, index) => pitch === classes[index])
  }

  // The bass wins ties before any shape does. {C,F,G} reads as Csus4 or Fsus2
  // equally well on paper, but the player is holding C underneath, and naming
  // it after a root they are not playing sends them to the wrong shape.
  for (const shape of SHAPES) {
    if (fits(shape, bass)) return `${NOTE_NAMES[bass] ?? '?'}${shape.suffix}`
  }
  for (const shape of SHAPES) {
    for (const candidateRoot of classes) {
      if (!fits(shape, candidateRoot)) continue
      const name = `${NOTE_NAMES[candidateRoot] ?? '?'}${shape.suffix}`
      return `${name}/${NOTE_NAMES[bass] ?? '?'}`
    }
  }
  return null
}
