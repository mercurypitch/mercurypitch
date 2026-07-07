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

// ── Helpers ────────────────────────────────────────────────────

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
]

function midiToNoteName(midi: number): string {
  const name = NOTE_NAMES[midi % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${name}${octave}`
}

/** Minimum ms between notes to count as separate articulations. */
const MIN_NOTE_GAP_MS = 120

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

    // Debounce: skip if same note within MIN_NOTE_GAP_MS
    if (midi === lastNoteMidi && timeMs - lastNoteTimeMs < MIN_NOTE_GAP_MS) {
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

    // Align recorded notes to target notes using simple greedy matching.
    // Each target note is compared to the closest recorded note in MIDI space,
    // allowing for octave equivalence.
    const results: Array<'correct' | 'wrong' | 'pending'> = []
    let totalScore = 0
    const used = new Set<number>()

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]
      let bestIdx = -1
      let bestDist = Infinity

      for (let j = 0; j < recorded.length; j++) {
        if (used.has(j)) continue
        const rMidi = recorded[j].midi
        // Octave-folded distance (0–6 semitones)
        const dist = Math.min(
          Math.abs((rMidi % 12) - (target % 12)),
          12 - Math.abs((rMidi % 12) - (target % 12)),
        )
        if (dist < bestDist) {
          bestDist = dist
          bestIdx = j
        }
      }

      if (bestIdx >= 0 && bestDist <= 1) {
        results.push('correct')
        used.add(bestIdx)
        totalScore += bestDist === 0 ? 25 : 15
      } else {
        results.push('wrong')
      }
    }

    // Bonus for getting all notes
    if (results.every((r) => r === 'correct')) {
      totalScore += 25
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
