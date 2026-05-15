import type { PlaybackMode } from '@/features/tabs/constants'
import type { AccuracyRating, MelodyItem, MelodyNote, NoteName, NoteResult, PracticeResult, SessionResult } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _idCounter = 1000

function nextId(): number {
  return _idCounter++
}

const NOTE_NAMES: NoteName[] = [
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

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

function midiToNoteName(midi: number): NoteName {
  return NOTE_NAMES[midi % 12]
}

function midiToOctave(midi: number): number {
  return Math.floor(midi / 12) - 1
}

function makeNote(midi: number): MelodyNote {
  return {
    midi,
    name: midiToNoteName(midi),
    octave: midiToOctave(midi),
    freq: midiToFreq(midi),
  }
}

function makeMelodyItem(
  midi: number,
  duration: number,
  startBeat: number,
): MelodyItem {
  return {
    id: nextId(),
    note: makeNote(midi),
    duration,
    startBeat,
    velocity: 100,
  }
}

// ---------------------------------------------------------------------------
// Melody patterns (MIDI note sequences)
// ---------------------------------------------------------------------------

const MELODIES: Array<{ name: string; notes: number[]; mode: PlaybackMode }> = [
  {
    name: 'C Major Scale (Ascending)',
    notes: [60, 62, 64, 65, 67, 69, 71, 72],
    mode: 'session' as PlaybackMode,
  },
  {
    name: 'Arpeggio in C',
    notes: [60, 64, 67, 72, 67, 64, 60, 55],
    mode: 'session' as PlaybackMode,
  },
  {
    name: 'Pop Melody Snippet',
    notes: [60, 62, 64, 65, 67, 65, 64, 62, 60, 62, 64, 67, 65, 64, 62, 60],
    mode: 'repeat' as PlaybackMode,
  },
  {
    name: 'Vibrato Practice (Sustain)',
    notes: [62, 62, 62, 65, 65, 65, 67, 67, 67, 65, 65, 65],
    mode: 'session' as PlaybackMode,
  },
  {
    name: 'Wide Interval Jumps',
    notes: [60, 72, 62, 74, 64, 76, 65, 77, 67, 79, 71, 72],
    mode: 'session' as PlaybackMode,
  },
]

// ---------------------------------------------------------------------------
// Clarity / accuracy patterns per session
// ---------------------------------------------------------------------------

function ratingFromCents(cents: number): AccuracyRating {
  const abs = Math.abs(cents)
  if (abs < 10) return 'perfect'
  if (abs < 25) return 'excellent'
  if (abs < 40) return 'good'
  if (abs < 60) return 'okay'
  return 'off'
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

// ── Public API ────────────────────────────────────────────────
/**
 * Generate mock session results for demo purposes.
 * Creates 5 varied sessions with realistic pitch data, clarity scores,
 * and recent timestamps to exercise all vocal analysis cards.
 */
export function generateMockSessions(): SessionResult[] {
  const now = Date.now()
  const DAY = 86400000

  return MELODIES.map((melody, sessionIdx) => {
    const daysAgo = 6 - sessionIdx // spread across 6 days
    const hourOffset = (sessionIdx * 3) % 12 // varied times of day
    const completedAt = now - daysAgo * DAY - hourOffset * 3600000

    // Each "note" in the melody becomes a practice item result
    const noteResults: NoteResult[] = melody.notes.map((midi, noteIdx) => {
      const targetFreq = midiToFreq(midi)
      // Introduce realistic pitch variation: ±30 cents
      const centsOff =
        Math.sin(noteIdx * 1.7 + sessionIdx) * 25 + (Math.random() - 0.5) * 20
      const actualFreq = targetFreq * Math.pow(2, centsOff / 1200)
      // Clarity decays slightly across session (fatigue simulation)
      const baseClarity = 85 - sessionIdx * 5 - noteIdx * 0.3
      const clarity = Math.max(
        10,
        Math.min(98, baseClarity + (Math.random() - 0.5) * 15),
      )

      return {
        item: makeMelodyItem(midi, 1, noteIdx),
        pitchFreq: actualFreq,
        pitchCents: Math.round(centsOff),
        time: 800 + Math.round(Math.random() * 400), // 800-1200ms per note
        rating: ratingFromCents(centsOff),
        avgCents: Math.round(clarity),
        targetNote: midiToNoteName(midi) + midiToOctave(midi).toString(),
      }
    })

    const practiceResult: PracticeResult = {
      score: Math.round(65 + sessionIdx * 3 + Math.random() * 15),
      noteCount: noteResults.length,
      avgCents: Math.round(
        noteResults.reduce((a, r) => a + r.avgCents, 0) / noteResults.length,
      ),
      itemsCompleted: noteResults.length,
      totalItems: noteResults.length,
      name: melody.name,
      mode: melody.mode,
      completedAt,
      noteResult: noteResults,
    }

    const totalCents = noteResults.reduce((a, r) => a + r.avgCents, 0)
    const avgCents = Math.round(totalCents / noteResults.length)

    return {
      sessionId: `demo-session-${sessionIdx + 1}`,
      name: melody.name,
      sessionName: melody.name,
      score: practiceResult.score,
      totalItems: noteResults.length,
      itemsCompleted: noteResults.length,
      completedAt,
      avgCents,
      rating: ratingFromCents(avgCents),
      practiceItemResult: [practiceResult],
    }
  })
}
