// ============================================================
// Pitch-Word Test Cases — edge cases for alignment validation
// ============================================================

import type { MergedNote } from '@/lib/midi-generator'
import type { WhisperSegment } from '@/lib/whisper-service'

export interface PitchWordTestCase {
  id: string
  category:
    | 'big_interval'
    | 'short_note'
    | 'long_note'
    | 'rapid_sequence'
    | 'silence_gap'
    | 'mixed'
  description: string
  melody: MergedNote[]
  lyrics: WhisperSegment[]
  expectedMapping: Array<{ wordIndex: number; midi: number }>
}

export const PITCH_WORD_TEST_CASES: PitchWordTestCase[] = [
  // ── big_interval: octave jump mid-phrase ──────────────────
  {
    id: 'big-interval-octave',
    category: 'big_interval',
    description: 'Octave jump C4→C5 mid-phrase ("I will ALWAYS love you")',
    melody: [
      { midi: 60, noteName: 'C4', startSec: 0.0, endSec: 0.5 },
      { midi: 60, noteName: 'C4', startSec: 0.5, endSec: 1.0 },
      { midi: 72, noteName: 'C5', startSec: 1.0, endSec: 2.0 },
      { midi: 67, noteName: 'G4', startSec: 2.0, endSec: 2.5 },
    ],
    lyrics: [
      { text: 'I', timestamp: [0.0, 0.5] },
      { text: 'will', timestamp: [0.5, 1.0] },
      { text: 'always', timestamp: [1.0, 2.0] },
      { text: 'love', timestamp: [2.0, 2.5] },
      { text: 'you', timestamp: [2.5, 3.0] },
    ],
    expectedMapping: [
      { wordIndex: 0, midi: 60 },
      { wordIndex: 1, midi: 60 },
      { wordIndex: 2, midi: 72 },
      { wordIndex: 3, midi: 67 },
    ],
  },

  // ── short_note: fast 16th-note runs ───────────────────────
  {
    id: 'short-note-16ths',
    category: 'short_note',
    description: '16th-note runs at 120bpm (~125ms per note)',
    melody: [
      { midi: 60, noteName: 'C4', startSec: 0.0, endSec: 0.125 },
      { midi: 62, noteName: 'D4', startSec: 0.125, endSec: 0.25 },
      { midi: 64, noteName: 'E4', startSec: 0.25, endSec: 0.375 },
      { midi: 65, noteName: 'F4', startSec: 0.375, endSec: 0.5 },
      { midi: 67, noteName: 'G4', startSec: 0.5, endSec: 0.625 },
    ],
    lyrics: [
      { text: 'la', timestamp: [0.0, 0.25] },
      { text: 'la', timestamp: [0.25, 0.5] },
      { text: 'la', timestamp: [0.5, 0.75] },
    ],
    expectedMapping: [
      { wordIndex: 0, midi: 62 }, // "la" overlaps both C4 and D4, D4 wins by coverage
      { wordIndex: 1, midi: 65 }, // "la" overlaps E4 and F4, F4 wins by coverage
      { wordIndex: 2, midi: 67 }, // "la" overlaps G4
    ],
  },

  // ── long_note: sustained note with single word ────────────
  {
    id: 'long-note-sustain',
    category: 'long_note',
    description: '4-second sustained note with single word',
    melody: [{ midi: 64, noteName: 'E4', startSec: 0.0, endSec: 4.0 }],
    lyrics: [{ text: 'stay', timestamp: [0.0, 4.0] }],
    expectedMapping: [{ wordIndex: 0, midi: 64 }],
  },

  // ── rapid_sequence: melismatic passage ────────────────────
  {
    id: 'rapid-melisma',
    category: 'rapid_sequence',
    description: 'Fast melismatic passage — many notes on one word',
    melody: [
      { midi: 60, noteName: 'C4', startSec: 0.0, endSec: 0.2 },
      { midi: 62, noteName: 'D4', startSec: 0.2, endSec: 0.4 },
      { midi: 64, noteName: 'E4', startSec: 0.4, endSec: 0.6 },
      { midi: 65, noteName: 'F4', startSec: 0.6, endSec: 0.8 },
      { midi: 67, noteName: 'G4', startSec: 0.8, endSec: 1.2 },
    ],
    lyrics: [{ text: 'gloria', timestamp: [0.0, 1.2] }],
    expectedMapping: [{ wordIndex: 0, midi: 67 }], // word covers all notes, G4 has longest duration → highest overlap
  },

  // ── silence_gap: gaps between words ───────────────────────
  {
    id: 'silence-gaps',
    category: 'silence_gap',
    description: 'Words separated by silence with no pitch',
    melody: [
      { midi: 60, noteName: 'C4', startSec: 0.0, endSec: 0.5 },
      { midi: 64, noteName: 'E4', startSec: 2.0, endSec: 2.5 },
    ],
    lyrics: [
      { text: 'hello', timestamp: [0.0, 0.5] },
      { text: 'world', timestamp: [2.0, 2.5] },
    ],
    expectedMapping: [
      { wordIndex: 0, midi: 60 },
      { wordIndex: 1, midi: 64 },
    ],
  },

  // ── silence_gap: partial overlap ──────────────────────────
  {
    id: 'partial-overlap',
    category: 'silence_gap',
    description: 'Word partially overlaps a note (starts before, ends during)',
    melody: [
      { midi: 60, noteName: 'C4', startSec: 0.3, endSec: 0.8 },
      { midi: 64, noteName: 'E4', startSec: 1.0, endSec: 1.5 },
    ],
    lyrics: [
      { text: 'hey', timestamp: [0.0, 0.6] },
      { text: 'there', timestamp: [0.6, 1.5] },
    ],
    expectedMapping: [
      { wordIndex: 0, midi: 60 }, // "hey" [0.0-0.6] overlaps C4 [0.3-0.8] = 0.3s overlap (50%)
      { wordIndex: 1, midi: 64 }, // "there" [0.6-1.5] overlaps C4 [0.3-0.8] = 0.2s, E4 [1.0-1.5] = 0.5s → E4 wins
    ],
  },

  // ── mixed: typical pop vocal phrase ───────────────────────
  {
    id: 'mixed-pop-phrase',
    category: 'mixed',
    description: 'Typical pop vocal phrase with varied note lengths',
    melody: [
      { midi: 64, noteName: 'E4', startSec: 0.0, endSec: 0.5 },
      { midi: 64, noteName: 'E4', startSec: 0.5, endSec: 1.0 },
      { midi: 67, noteName: 'G4', startSec: 1.0, endSec: 1.5 },
      { midi: 69, noteName: 'A4', startSec: 1.5, endSec: 2.5 },
      { midi: 67, noteName: 'G4', startSec: 2.5, endSec: 3.0 },
    ],
    lyrics: [
      { text: 'twin', timestamp: [0.0, 0.5] },
      { text: 'kle', timestamp: [0.5, 1.0] },
      { text: 'twin', timestamp: [1.0, 1.5] },
      { text: 'kle', timestamp: [1.5, 2.5] },
      { text: 'star', timestamp: [2.5, 3.0] },
    ],
    expectedMapping: [
      { wordIndex: 0, midi: 64 },
      { wordIndex: 1, midi: 64 },
      { wordIndex: 2, midi: 67 },
      { wordIndex: 3, midi: 69 },
      { wordIndex: 4, midi: 67 },
    ],
  },

  // ── Edge: no notes at all ─────────────────────────────────
  {
    id: 'no-notes',
    category: 'silence_gap',
    description: 'Words with no pitch notes at all (pure silence)',
    melody: [],
    lyrics: [
      { text: 'silent', timestamp: [0.0, 0.5] },
      { text: 'night', timestamp: [0.5, 1.0] },
    ],
    expectedMapping: [],
  },

  // ── Edge: no words ────────────────────────────────────────
  {
    id: 'no-words',
    category: 'silence_gap',
    description: 'Notes with no word segments',
    melody: [
      { midi: 60, noteName: 'C4', startSec: 0.0, endSec: 1.0 },
    ],
    lyrics: [],
    expectedMapping: [],
  },

  // ── Edge: tiny word fragment ──────────────────────────────
  {
    id: 'tiny-word',
    category: 'short_note',
    description: 'Very short word (50ms) overlapping a longer note',
    melody: [{ midi: 72, noteName: 'C5', startSec: 0.0, endSec: 0.5 }],
    lyrics: [{ text: 't', timestamp: [0.2, 0.25] }],
    expectedMapping: [{ wordIndex: 0, midi: 72 }],
  },
]

/**
 * Validate alignment output against expected mapping.
 * Returns { passed, failures } where failures list mismatches.
 */
export function validateAlignment(
  result: { alignedWords: Array<{ midi: number | null }> },
  expected: Array<{ wordIndex: number; midi: number }>,
): { passed: boolean; failures: string[] } {
  const failures: string[] = []
  const mapped = new Map<number, number | null>()

  for (let i = 0; i < result.alignedWords.length; i++) {
    mapped.set(i, result.alignedWords[i].midi)
  }

  for (const exp of expected) {
    const actual = mapped.get(exp.wordIndex)
    if (actual === undefined) {
      failures.push(
        `wordIndex ${exp.wordIndex}: missing from result (expected midi=${exp.midi})`,
      )
    } else if (actual !== exp.midi) {
      failures.push(
        `wordIndex ${exp.wordIndex}: expected midi=${exp.midi}, got midi=${actual}`,
      )
    }
  }

  return { passed: failures.length === 0, failures }
}
