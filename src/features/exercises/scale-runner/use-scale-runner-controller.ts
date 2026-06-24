import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import { midiToFrequency as midiToFreq } from '@/lib/frequency-to-note'
import { getScaleDegrees } from '@/lib/scale-data'
import { approximateRichness } from '@/lib/vocal-analyzer'
import { scoreNoteAccuracy } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_SCALE_RUNNER } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

type ScaleType = 'major' | 'minor' | 'pentatonic' | 'chromatic'

// Baselines reproduced exactly at difficulty 5 (difficultyFactor(5) === 1.0).
const NOTE_PLAY_DURATION_MS = 700
const GAP_BETWEEN_NOTES_MS = 250
const MATCH_WINDOW_MS = 2000

function buildScaleNotes(
  baseMidi: number,
  scaleType: ScaleType,
  direction: 'up' | 'down',
): number[] {
  const degrees = getScaleDegrees(scaleType)
  let notes = [baseMidi]
  for (const deg of degrees.slice(1)) {
    notes.push(baseMidi + deg)
  }
  // Add octave
  notes.push(baseMidi + 12)
  if (direction === 'down') {
    notes = [...notes].reverse()
  }
  return notes
}

export function useScaleRunnerController(
  base: BaseExerciseController,
  audioEngine: { playTone: (freq: number, duration?: number) => Promise<void> },
) {
  let scaleNotes: number[] = []
  let noteIndex = 0
  let noteScores: number[] = []
  // Difficulty-scaled timings; default to baselines (== difficulty 5).
  let notePlayDurationMs = NOTE_PLAY_DURATION_MS
  let gapBetweenNotesMs = GAP_BETWEEN_NOTES_MS
  let matchWindowMs = MATCH_WINDOW_MS
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  base._registerDispose(() => {
    clearTimeout(phaseTimer)
    phaseTimer = undefined
  })
  let _cancelled = false

  function setScale(
    baseMidi: number,
    scaleType: ScaleType = 'major',
    direction: 'up' | 'down' = 'up',
  ): void {
    _cancelled = false
    // Harder = faster notes and a tighter match window (factor < 1 above d5,
    // > 1 below). At difficulty 5 the factor is 1.0, so timings == baselines.
    const difficulty = launchDifficulty(EXERCISE_SCALE_RUNNER)
    const factor = difficultyFactor(difficulty)
    notePlayDurationMs = Math.round(NOTE_PLAY_DURATION_MS * factor)
    gapBetweenNotesMs = Math.round(GAP_BETWEEN_NOTES_MS * factor)
    matchWindowMs = Math.round(MATCH_WINDOW_MS * factor)
    scaleNotes = buildScaleNotes(baseMidi, scaleType, direction)
    noteIndex = 0
    noteScores = []
  }

  function startScale(): void {
    playCurrentNote()
  }

  function playCurrentNote(): void {
    if (noteIndex >= scaleNotes.length) {
      finish()
      return
    }

    const midi = scaleNotes[noteIndex]
    batch(() => {
      base._setTargetPitch(midiToFreq(midi))
      base._updateMetrics({
        noteIndex,
        scaleLength: scaleNotes.length,
        currentMidi: midi,
        phase: 1,
      })
    })

    void audioEngine.playTone(midiToFreq(midi), notePlayDurationMs).then(() => {
      if (_cancelled) return
      phaseTimer = setTimeout(() => {
        if (_cancelled) return
        startMatching(noteIndex)
      }, gapBetweenNotesMs)
    })
  }

  function startMatching(idx: number): void {
    if (_cancelled) return
    batch(() => base._updateMetrics({ phase: 2 }))
    phaseTimer = setTimeout(() => {
      if (_cancelled) return
      evaluateNote(idx)
    }, matchWindowMs)
  }

  function evaluateNote(idx: number): void {
    const targetMidi = scaleNotes[idx]
    const noteScore = scoreNoteAccuracy(
      base.pitchHistory(),
      targetMidi,
      matchWindowMs,
    )

    noteScores.push(noteScore)

    if (noteScores.length > 0) {
      const avg = noteScores.reduce((a, b) => a + b, 0) / noteScores.length
      batch(() => {
        base._updateScore(Math.round(avg))
        base._updateMetrics({
          lastNoteScore: noteScore,
          notesCompleted: noteScores.length,
        })
      })
    }

    noteIndex++
    phaseTimer = setTimeout(() => {
      if (_cancelled) return
      playCurrentNote()
    }, 400)
  }

  function finish(): void {
    const result = computeResult()
    base._completeWithResult(result)
  }

  function computeResult(): ExerciseResult {
    if (noteScores.length === 0) {
      return {
        type: EXERCISE_SCALE_RUNNER,
        score: 0,
        metrics: {
          notesCompleted: 0,
          avgAccuracy: 0,
          bestNote: 0,
          evennessStdDev: 0,
          richnessScore: 0,
        },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(
      noteScores.reduce((a, b) => a + b, 0) / noteScores.length,
    )
    const bestNote = Math.max(...noteScores)

    const evennessStdDev = (() => {
      if (noteScores.length < 2) return 0
      const mean = avgAccuracy
      const variance =
        noteScores.reduce((s, v) => s + (v - mean) ** 2, 0) / noteScores.length
      return Math.round(Math.sqrt(variance) * 10) / 10
    })()
    const evennessScore = Math.max(0, Math.min(100, 100 - evennessStdDev * 3))

    const history = base.pitchHistory()
    const claritySamples = history
      .filter((p) => p.freq > 0 && p.clarity !== undefined)
      .map((p) => ({ freq: p.freq, clarity: p.clarity! }))
    const richness =
      claritySamples.length > 2
        ? approximateRichness(claritySamples).richnessScore
        : 0

    const score = Math.round(
      avgAccuracy * 0.4 +
        bestNote * 0.15 +
        evennessScore * 0.25 +
        richness * 0.2,
    )

    return {
      type: EXERCISE_SCALE_RUNNER,
      score,
      metrics: {
        notesCompleted: noteScores.length,
        avgAccuracy,
        bestNote,
        evennessStdDev,
        richnessScore: Math.round(richness),
      },
      completedAt: Date.now(),
    }
  }

  function stopScale(): void {
    _cancelled = true
    if (phaseTimer) clearTimeout(phaseTimer)
    base._setRunning(false)
    finish()
  }

  return { setScale, startScale, stopScale, computeResult }
}
