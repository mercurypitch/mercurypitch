// ============================================================
// RiffTrackerState — record & score guitar riffs from mic input.
//
// Free-form recording: the player plays a riff on guitar, each
// detected note is captured with its pitch + timestamp. After
// recording, the riff is displayed as a note sequence and can be
// scored against a target melody.
// ============================================================

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import { midiToNoteName } from '@/lib/frequency-to-note'

// ── Types ──────────────────────────────────────────────────────

export interface RiffNote {
  /** MIDI note number. */
  midi: number
  /** Note name (e.g. "E4"). */
  noteName: string
  /** Time offset from recording start (ms). */
  timeMs: number
  /** Detected frequency (Hz). */
  frequency: number
  /** Detection clarity 0–1. */
  clarity: number
}

export type RiffPhase = 'idle' | 'recording' | 'reviewing' | 'scoring'

export interface RiffTrackerState {
  /** Current phase. */
  phase: Accessor<RiffPhase>
  /** Recorded notes. */
  recordedNotes: Accessor<RiffNote[]>
  /** Target melody notes (for scoring). */
  targetNotes: Accessor<number[]>
  /** Scoring results per note. */
  noteResults: Accessor<Array<'correct' | 'wrong' | 'pending'>>
  /** Total score. */
  score: Accessor<number>
  /** Recording start time (performance.now()). */
  recordingStartMs: Accessor<number>
  /** Recording duration in ms. */
  recordingDuration: Accessor<number>

  /** Start recording a new riff. */
  startRecording: () => void
  /** Stop recording and review. */
  stopRecording: () => void
  /** Add a detected note during recording. */
  addNote: (midi: number, frequency: number, clarity: number) => void
  /** Set a target melody to score against. */
  setTargetMelody: (midis: number[]) => void
  /** Score the recorded riff against the target. */
  scoreRiff: () => void
  /** Reset everything. */
  reset: () => void
}

// ── Constants ──────────────────────────────────────────────────

/** Minimum ms between notes to count as separate articulations. */
export const RIFF_MIN_NOTE_GAP_MS = 120

/** Max semitone distance (octave-folded) for a note match. */
const MAX_MATCH_SEMITONES = 1

/** Bonus points awarded when ALL target notes are correct. */
const ALL_CORRECT_BONUS = 25
/** Points per exact match (0 semitones). */
const EXACT_MATCH_POINTS = 25
/** Points per near match (1 semitone). */
const NEAR_MATCH_POINTS = 15

// ── Helpers ────────────────────────────────────────────────────

/** Octave-folded semitone distance between two MIDI note numbers. */
function octaveFoldedDistance(a: number, b: number): number {
  const diff = Math.abs((a % 12) - (b % 12))
  return Math.min(diff, 12 - diff)
}

// ── Factory ────────────────────────────────────────────────────

export function createRiffTracker(): RiffTrackerState {
  const [phase, setPhase] = createSignal<RiffPhase>('idle')
  const [recordedNotes, setRecordedNotes] = createSignal<RiffNote[]>([])
  const [targetNotes, setTargetNotes] = createSignal<number[]>([])
  const [noteResults, setNoteResults] = createSignal<
    Array<'correct' | 'wrong' | 'pending'>
  >([])
  const [score, setScore] = createSignal(0)
  const [recordingStartMs, setRecordingStartMs] = createSignal(0)
  const [recordingDuration, setRecordingDuration] = createSignal(0)

  let lastNoteMidi: number | null = null
  let lastNoteTimeMs = 0

  const startRecording = () => {
    setRecordedNotes([])
    setNoteResults([])
    setScore(0)
    setPhase('recording')
    setRecordingStartMs(performance.now())
    setRecordingDuration(0)
    lastNoteMidi = null
    lastNoteTimeMs = 0
  }

  const stopRecording = () => {
    const start = recordingStartMs()
    setRecordingDuration(performance.now() - start)
    setPhase('reviewing')
  }

  const addNote = (midi: number, frequency: number, clarity: number) => {
    if (phase() !== 'recording') return

    const now = performance.now()
    const timeMs = now - recordingStartMs()

    // Debounce: skip if same note within the gap window
    if (
      midi === lastNoteMidi &&
      timeMs - lastNoteTimeMs < RIFF_MIN_NOTE_GAP_MS
    ) {
      return
    }

    lastNoteMidi = midi
    lastNoteTimeMs = timeMs

    const riffNote: RiffNote = {
      midi,
      noteName: midiToNoteName(midi),
      timeMs,
      frequency,
      clarity,
    }

    setRecordedNotes((prev) => [...prev, riffNote])
  }

  const setTargetMelody = (midis: number[]) => {
    setTargetNotes(midis)
    setNoteResults(new Array(midis.length).fill('pending'))
  }

  const scoreRiff = () => {
    const recorded = recordedNotes()
    const targets = targetNotes()

    if (recorded.length === 0 || targets.length === 0) return

    setPhase('scoring')

    // Greedy alignment: each target note matches the best available
    // recorded note by octave-folded semitone distance.
    const results: Array<'correct' | 'wrong' | 'pending'> = []
    let totalScore = 0
    const used = new Set<number>()

    for (const target of targets) {
      let bestIdx = -1
      let bestDist = Infinity

      for (let j = 0; j < recorded.length; j++) {
        if (used.has(j)) continue
        const dist = octaveFoldedDistance(recorded[j].midi, target)
        if (dist < bestDist) {
          bestDist = dist
          bestIdx = j
        }
      }

      if (bestIdx >= 0 && bestDist <= MAX_MATCH_SEMITONES) {
        results.push('correct')
        used.add(bestIdx)
        totalScore += bestDist === 0 ? EXACT_MATCH_POINTS : NEAR_MATCH_POINTS
      } else {
        results.push('wrong')
      }
    }

    if (results.every((r) => r === 'correct')) {
      totalScore += ALL_CORRECT_BONUS
    }

    setNoteResults(results)
    setScore(totalScore)
  }

  const reset = () => {
    setPhase('idle')
    setRecordedNotes([])
    setTargetNotes([])
    setNoteResults([])
    setScore(0)
  }

  return {
    phase,
    recordedNotes,
    targetNotes,
    noteResults,
    score,
    recordingStartMs,
    recordingDuration,
    startRecording,
    stopRecording,
    addNote,
    setTargetMelody,
    scoreRiff,
    reset,
  }
}
