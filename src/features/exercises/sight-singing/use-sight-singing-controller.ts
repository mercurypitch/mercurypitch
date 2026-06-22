// ============================================================
// Sight-Singing Controller — generate notes, score accuracy
// ============================================================

import type { ScaleDegree } from '@/types'
import { freqToExactMidi } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_SIGHT_SINGING } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

export interface SightSingingNote {
  midi: number
  name: string
  octave: number
  freq: number
  /** Index in the sequence, 0-based */
  index: number
}

const NOTES_PER_ROUND = 5
const NOTE_DURATION_MS = 2000 // 2 seconds per note

export function useSightSingingController(base: BaseExerciseController) {
  let sequence: SightSingingNote[] = []
  let currentIndex = 0
  let noteStartTime = 0
  let noteTimer: ReturnType<typeof setInterval> | undefined
  let noteScores: number[] = []

  base._registerDispose(() => {
    clearInterval(noteTimer)
    noteTimer = undefined
  })

  function generateSequence(
    scale: ScaleDegree[],
    count = NOTES_PER_ROUND,
  ): SightSingingNote[] {
    const notes: SightSingingNote[] = []
    for (let i = 0; i < count; i++) {
      const degree = scale[Math.floor(Math.random() * scale.length)]
      notes.push({
        midi: degree.midi,
        name: degree.name,
        octave: degree.octave,
        freq: degree.freq,
        index: i,
      })
    }
    return notes
  }

  function setScale(scale: ScaleDegree[]): void {
    sequence = generateSequence(scale)
    currentIndex = 0
    noteScores = []
  }

  function startRounds(): void {
    if (sequence.length === 0) return
    advanceToNote(0)
  }

  function advanceToNote(idx: number): void {
    if (idx >= sequence.length) {
      stopAndCompute()
      return
    }
    currentIndex = idx
    const note = sequence[idx]
    base._setTargetPitch(note.midi)
    noteStartTime = performance.now()

    // Move to next note after duration
    clearInterval(noteTimer)
    noteTimer = setInterval(() => {
      advanceToNote(currentIndex + 1)
    }, NOTE_DURATION_MS)
  }

  function stopRounds(): void {
    clearInterval(noteTimer)
    noteTimer = undefined
    base._setRunning(false)
    const result = computeResult()
    base._completeWithResult(result)
  }

  function stopAndCompute(): void {
    clearInterval(noteTimer)
    noteTimer = undefined
    base._setRunning(false)
    const result = computeResult()
    base._completeWithResult(result)
  }

  function computeResult(): ExerciseResult {
    const history = base.pitchHistory()

    if (history.length < 2 || sequence.length === 0) {
      return {
        type: EXERCISE_SIGHT_SINGING,
        score: 0,
        metrics: {
          notesAttempted: sequence.length,
          notesScored: 0,
          avgAccuracy: 0,
          bestNote: 0,
        },
        completedAt: Date.now(),
      }
    }

    // Score each note by checking pitch accuracy during its time window
    const scored: number[] = []
    for (let i = 0; i < sequence.length; i++) {
      const note = sequence[i]
      const windowStart = i * NOTE_DURATION_MS
      const windowEnd = windowStart + NOTE_DURATION_MS

      const samples = history.filter(
        (p) =>
          p.time * 1000 >= windowStart &&
          p.time * 1000 < windowEnd &&
          p.freq > 0,
      )

      if (samples.length < 3) {
        scored.push(0)
        continue
      }

      // Average cents deviation for this note
      const deviations = samples.map((p) => {
        const midi = freqToExactMidi(p.freq)
        return Math.abs((midi - note.midi) * 100)
      })
      const avgDeviation =
        deviations.reduce((a, b) => a + b, 0) / deviations.length

      // Score: 0¢ = 100, ~50¢ = 0
      const noteScore = Math.max(0, Math.round(100 - avgDeviation * 2))
      scored.push(noteScore)
    }

    noteScores = scored.filter((s) => s > 0)
    const avgAccuracy =
      noteScores.length > 0
        ? Math.round(noteScores.reduce((a, b) => a + b, 0) / noteScores.length)
        : 0
    const bestNote = noteScores.length > 0 ? Math.max(...noteScores) : 0
    const score = avgAccuracy

    return {
      type: EXERCISE_SIGHT_SINGING,
      score,
      metrics: {
        notesAttempted: sequence.length,
        notesScored: noteScores.length,
        avgAccuracy,
        bestNote,
      },
      completedAt: Date.now(),
    }
  }

  return {
    setScale,
    startRounds,
    stopRounds,
    stopAndCompute,
    getSequence: () => sequence,
    getCurrentIndex: () => currentIndex,
    getNoteStartTime: () => noteStartTime,
  }
}
