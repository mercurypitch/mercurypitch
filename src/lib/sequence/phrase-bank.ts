// ============================================================
// Phrase bank — Echo's short phrases, written as scale degrees (pure)
// ============================================================
//
// Merc's phrases are motifs written as scale degrees, sung from a root
// that the singer's range sets (phrase-fit.ts). The motifs are the
// design's (DESIGN-echo.md §2), keyed by the accuracy tier ids as the Long
// note lantern's levels are: steps and thirds within a fifth at Learning,
// up to a sixth at Singer, up to an octave with leaps and one chromatic
// neighbour at Professional. Two rules hold for every motif:
//
// - No two adjacent notes are the same: a repeated note would land again
//   without a new onset (sequence-engine.ts). And at a level that folds
//   octaves no two adjacent notes are an octave apart, or the voice still
//   on one note would land the next.
// - Nothing from a real song: these are scale fragments of a few notes.
//
// Each motif has a minor variant, flat 3 and flat 6. A run opens in major;
// minor variants mix in from the third phrase, at least one of them.
//
// The random is seeded, so a run, a test and the demo come out the same
// every time for the same seed.

import type { EchoLevelId, Phrase } from './sequence-engine'

/** A scale degree: 1 is the root, 8 the octave above it. */
export type ScaleDegree = 1 | 2 | 3 | '#4' | 4 | 5 | 6 | 7 | 8
export type Motif = readonly ScaleDegree[]
export type PhraseMode = 'major' | 'minor'

const MAJOR_STEPS: Readonly<Record<ScaleDegree, number>> = {
  1: 0,
  2: 2,
  3: 4,
  4: 5,
  '#4': 6,
  5: 7,
  6: 9,
  7: 11,
  8: 12,
}

/** The minor variant: flat 3 and flat 6, everything else as in major. */
const MINOR_STEPS: Readonly<Record<ScaleDegree, number>> = {
  ...MAJOR_STEPS,
  3: 3,
  6: 8,
}

/** Echo's motifs at each level, keyed by the tier ids as ECHO_LEVELS is. */
export const ECHO_MOTIFS: Readonly<Record<EchoLevelId, readonly Motif[]>> = {
  learning: [
    [1, 2, 3],
    [3, 2, 1],
    [1, 3, 2],
    [5, 3, 1],
    [1, 3, 5],
  ],
  singer: [
    [1, 3, 5, 3],
    [5, 4, 3, 1],
    [1, 2, 3, 5],
    [1, 5, 3, 1],
    [3, 5, 6, 5],
  ],
  professional: [
    [1, 5, 8, 5, 3],
    [8, 7, 5, 3, 1],
    [1, 3, 6, 5, 1],
    [5, '#4', 5, 3, 1],
  ],
}

/** Semitones above the root, note by note. */
export function motifSemitones(motif: Motif, mode: PhraseMode): number[] {
  const steps = mode === 'minor' ? MINOR_STEPS : MAJOR_STEPS
  return motif.map((degree) => steps[degree])
}

/** One of Echo's phrases: a motif on a root, with Merc's even rhythm. */
export interface EchoPhrase extends Phrase {
  /** Scale degree 1, MIDI. */
  readonly root: number
  readonly mode: PhraseMode
  readonly motif: Motif
}

/**
 * A motif sung from `root`: each note `noteSeconds` long, one straight
 * after the other (Merc's note length at the level, ECHO_LEVELS).
 */
export function echoPhrase(
  motif: Motif,
  mode: PhraseMode,
  root: number,
  noteSeconds: number,
): EchoPhrase {
  return {
    root,
    mode,
    motif,
    notes: motifSemitones(motif, mode).map((semitones, i) => ({
      midi: root + semitones,
      at: i * noteSeconds,
      seconds: noteSeconds,
    })),
  }
}

/** mulberry32: a small seeded generator, uniform on [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The phrase from which minor variants may come, zero-based: the third. */
export const FIRST_MINOR_PHRASE = 2

/**
 * Major or minor for each phrase of a run: the first two major; from the
 * third, each a coin toss, and the last minor when the tosses gave none.
 */
export function phraseModes(count: number, random: () => number): PhraseMode[] {
  const modes: PhraseMode[] = []
  for (let i = 0; i < count; i++) {
    const mixed = i >= FIRST_MINOR_PHRASE
    modes.push(mixed && random() < 0.5 ? 'minor' : 'major')
  }
  if (count > FIRST_MINOR_PHRASE && !modes.includes('minor')) {
    modes[count - 1] = 'minor'
  }
  return modes
}
