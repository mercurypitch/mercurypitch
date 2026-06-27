// ============================================================
// Sight-Singing Controller — generate notes, advance on a correct
// sung pitch (with a timeout fallback), and score per note.
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

const NOTES_PER_ROUND = 6
const POLL_MS = 80
/** How long the sung pitch must stay within tolerance to pass a note. */
const HOLD_TO_PASS_MS = 450
const TOLERANCE_CENTS = 60
/** Give up on a note after this long so the run can't hang on an unreachable one. */
const MAX_NOTE_MS = 8000

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

function noteFromMidi(midi: number, index: number): SightSingingNote {
  return {
    midi,
    name: NOTE_NAMES[((midi % 12) + 12) % 12]!,
    octave: Math.floor(midi / 12) - 1,
    freq: 440 * 2 ** ((midi - 69) / 12),
    index,
  }
}

export function useSightSingingController(base: BaseExerciseController) {
  let sequence: SightSingingNote[] = []
  let currentIndex = 0
  let noteStartTime = 0
  let noteStartMs: number[] = []
  // Per-note score, sparse until that note is reached.
  const noteScores: number[] = []
  let holdMs = 0
  let lastPollTs = 0
  let pollTimer: ReturnType<typeof setInterval> | undefined

  base._registerDispose(() => {
    clearInterval(pollTimer)
    pollTimer = undefined
  })

  /**
   * Pick `count` scale notes that lie inside the singer's comfortable range,
   * preferring small (stepwise) moves between consecutive notes.
   */
  function generateSequence(
    scale: ScaleDegree[],
    rangeMin: number,
    rangeMax: number,
    count = NOTES_PER_ROUND,
  ): SightSingingNote[] {
    const pcs = [...new Set(scale.map((d) => ((d.midi % 12) + 12) % 12))]
    if (pcs.length === 0) return []
    const pool: number[] = []
    for (let m = Math.ceil(rangeMin); m <= Math.floor(rangeMax); m++) {
      if (pcs.includes(((m % 12) + 12) % 12)) pool.push(m)
    }
    if (pool.length === 0) return []

    const notes: SightSingingNote[] = []
    let prev = pool[Math.floor(Math.random() * pool.length)]!
    for (let i = 0; i < count; i++) {
      const near = pool.filter((m) => m !== prev && Math.abs(m - prev) <= 7)
      const choices = near.length > 0 ? near : pool
      const m = choices[Math.floor(Math.random() * choices.length)]!
      notes.push(noteFromMidi(m, i))
      prev = m
    }
    return notes
  }

  function setScale(
    scale: ScaleDegree[],
    rangeMin: number,
    rangeMax: number,
  ): void {
    sequence = generateSequence(scale, rangeMin, rangeMax)
    currentIndex = 0
    noteScores.length = 0
    noteStartMs = []
  }

  function startRounds(): void {
    if (sequence.length === 0) return
    advanceToNote(0)
  }

  function advanceToNote(idx: number): void {
    clearInterval(pollTimer)
    if (idx >= sequence.length) {
      stopAndCompute()
      return
    }
    currentIndex = idx
    base._setTargetPitch(sequence[idx]!.midi)
    noteStartTime = performance.now()
    noteStartMs[idx] = base._getElapsed()
    holdMs = 0
    lastPollTs = performance.now()
    base._updateMetrics({
      noteIndex: idx,
      totalNotes: sequence.length,
      targetMidi: sequence[idx]!.midi,
      holdPct: 0,
      detectedMidi: 0,
      centsOff: 0,
      matched: 0,
    })
    pollTimer = setInterval(pollNote, POLL_MS)
  }

  function pollNote(): void {
    if (!base._isRunning()) return
    const now = performance.now()
    const dt = now - lastPollTs
    lastPollTs = now
    const target = sequence[currentIndex]!.midi
    const p = base.currentPitch()
    let detectedMidi = 0
    let centsOff = 0
    if (p && p.freq > 0) {
      detectedMidi = freqToExactMidi(p.freq)
      centsOff = (detectedMidi - target) * 100
      if (Math.abs(centsOff) <= TOLERANCE_CENTS) holdMs += dt
      else holdMs = Math.max(0, holdMs - dt * 0.5)
    } else {
      holdMs = Math.max(0, holdMs - dt * 0.5)
    }

    base._updateMetrics({
      detectedMidi: detectedMidi > 0 ? Math.round(detectedMidi * 10) / 10 : 0,
      centsOff: Math.round(centsOff),
      holdPct: Math.min(100, Math.round((holdMs / HOLD_TO_PASS_MS) * 100)),
    })

    if (holdMs >= HOLD_TO_PASS_MS) {
      scoreAndAdvance(true)
      return
    }
    if (now - noteStartTime >= MAX_NOTE_MS) {
      scoreAndAdvance(false)
    }
  }

  function scoreAndAdvance(matched: boolean): void {
    const idx = currentIndex
    const note = sequence[idx]!
    const startMs = noteStartMs[idx] ?? 0
    const endMs = base._getElapsed()
    const samples = base
      .pitchHistory()
      .filter(
        (p) => p.time * 1000 >= startMs && p.time * 1000 <= endMs && p.freq > 0,
      )

    let noteScore = 0
    if (samples.length >= 2) {
      const deviations = samples
        .map((p) => Math.abs((freqToExactMidi(p.freq) - note.midi) * 100))
        .sort((a, b) => a - b)
      // Best 30% of the attempt — rewards finding the note even after a scoop.
      const best = deviations.slice(
        0,
        Math.max(1, Math.floor(deviations.length * 0.3)),
      )
      const avgBest = best.reduce((a, b) => a + b, 0) / best.length
      noteScore = Math.max(0, Math.round(100 - avgBest * 1.5))
    }
    if (matched) noteScore = Math.max(noteScore, 70)
    noteScores[idx] = noteScore

    const done = noteScores.filter((s) => typeof s === 'number')
    const avg =
      done.length > 0
        ? Math.round(done.reduce((a, b) => a + b, 0) / done.length)
        : 0
    base._updateScore(avg)
    base._updateMetrics({
      lastNoteScore: noteScore,
      matched: matched ? 1 : 0,
      notesCompleted: done.length,
    })

    advanceToNote(idx + 1)
  }

  function stopRounds(): void {
    clearInterval(pollTimer)
    pollTimer = undefined
    base._setRunning(false)
    base._completeWithResult(computeResult())
  }

  function stopAndCompute(): void {
    clearInterval(pollTimer)
    pollTimer = undefined
    base._setRunning(false)
    base._completeWithResult(computeResult())
  }

  function computeResult(): ExerciseResult {
    const scored = noteScores.filter((s) => typeof s === 'number')
    if (scored.length === 0) {
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
    const avgAccuracy = Math.round(
      scored.reduce((a, b) => a + b, 0) / scored.length,
    )
    const bestNote = Math.max(...scored)

    return {
      type: EXERCISE_SIGHT_SINGING,
      score: avgAccuracy,
      metrics: {
        notesAttempted: sequence.length,
        notesScored: scored.length,
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
    generateSequence,
    getSequence: () => sequence,
    getCurrentIndex: () => currentIndex,
  }
}
