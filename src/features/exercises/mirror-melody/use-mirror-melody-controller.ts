import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import { midiToFrequency as midiToFreq } from '@/lib/frequency-to-note'
import { approximateRichness } from '@/lib/vocal-analyzer'
import { scoreNoteAccuracy } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_MIRROR_MELODY } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

// Baselines below are the difficulty-5 defaults; adaptive scaling in
// `setMelody` reproduces them exactly when difficultyFactor === 1.0.
const MATCH_WINDOW_MS = 2500
const TONE_DURATION_MS = 1200
const GAP_BEFORE_MATCH_MS = 400
const MELODY_LENGTH = 5
const SCORE_ACCURACY_WEIGHT = 0.35
const SCORE_BEST_NOTE_WEIGHT = 0.15
const SCORE_CONSISTENCY_WEIGHT = 0.25
const SCORE_RICHNESS_WEIGHT = 0.25

function generateMelody(baseMidi: number, length: number): number[] {
  const pool = [-4, -2, 0, 2, 4, 7, 9]
  const notes: number[] = [baseMidi]
  for (let i = 1; i < length; i++) {
    const prev = notes[i - 1]
    const step = pool[Math.floor(Math.random() * pool.length)]
    notes.push(Math.max(36, Math.min(84, prev + step)))
  }
  return notes
}

export function useMirrorMelodyController(
  base: BaseExerciseController,
  audioEngine: { playTone: (freq: number, duration?: number) => Promise<void> },
) {
  let melody: number[] = []
  let noteIndex = 0
  let noteScores: number[] = []
  // Adaptive params, set per-round in `setMelody`; default to d5 baselines.
  let matchWindowMs = MATCH_WINDOW_MS
  let toneDurationMs = TONE_DURATION_MS
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  base._registerDispose(() => {
    clearTimeout(phaseTimer)
    phaseTimer = undefined
  })
  let _cancelled = false

  function setMelody(baseMidi: number): void {
    _cancelled = false
    // Read effective difficulty as the round is set up (drill override or
    // stored level). difficultyFactor(5) === 1.0 → all values below equal
    // their d5 baselines; harder (d>5) = tighter window, faster tone,
    // longer melody; easier (d<5) = the inverse.
    const d = launchDifficulty(EXERCISE_MIRROR_MELODY)
    const factor = difficultyFactor(d)
    // Window/tempo shrink as difficulty rises (multiply by factor < 1).
    matchWindowMs = MATCH_WINDOW_MS * factor
    toneDurationMs = TONE_DURATION_MS * factor
    // More notes to mirror when harder: 2 - factor > 1 above d5.
    const length = Math.round(MELODY_LENGTH * (2 - factor))
    melody = generateMelody(baseMidi, length)
    noteIndex = 0
    noteScores = []
    base._setTargetPitch(baseMidi)
  }

  function startSequence(): void {
    playCurrentNote()
  }

  function playCurrentNote(): void {
    if (noteIndex >= melody.length) {
      finish()
      return
    }

    const midi = melody[noteIndex]
    batch(() => {
      base._setTargetPitch(midiToFreq(midi))
      base._updateMetrics({
        noteIndex,
        melodyLength: melody.length,
        currentMidi: midi,
      })
    })

    void audioEngine.playTone(midiToFreq(midi), toneDurationMs).then(() => {
      if (_cancelled) return
      phaseTimer = setTimeout(() => {
        if (_cancelled) return
        startMatching()
      }, GAP_BEFORE_MATCH_MS)
    })
  }

  function startMatching(): void {
    if (_cancelled) return
    base._updateMetrics({ phase: 2 }) // matching phase indicator

    phaseTimer = setTimeout(() => {
      if (_cancelled) return
      evaluateMatch()
    }, matchWindowMs)
  }

  function evaluateMatch(): void {
    const targetMidi = melody[noteIndex]
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
    }, 600)
  }

  function finish(): void {
    const result = computeResult()
    base._completeWithResult(result)
  }

  function computeResult(): ExerciseResult {
    if (noteScores.length === 0) {
      return {
        type: EXERCISE_MIRROR_MELODY,
        score: 0,
        metrics: {
          notesCompleted: 0,
          avgAccuracy: 0,
          bestNote: 0,
          consistency: 0,
          richnessScore: 0,
        },
        completedAt: Date.now(),
      }
    }

    const avgAccuracy = Math.round(
      noteScores.reduce((a, b) => a + b, 0) / noteScores.length,
    )
    const bestNote = Math.max(...noteScores)
    const consistency = (() => {
      const mean = avgAccuracy
      const variance =
        noteScores.reduce((s, v) => s + (v - mean) ** 2, 0) / noteScores.length
      return Math.round(Math.max(0, 100 - Math.sqrt(variance) * 2))
    })()

    const history = base.pitchHistory()
    const claritySamples = history
      .filter((p) => p.freq > 0 && p.clarity !== undefined)
      .map((p) => ({ freq: p.freq, clarity: p.clarity! }))
    const richness =
      claritySamples.length > 2
        ? approximateRichness(claritySamples).richnessScore
        : 0

    const score = Math.round(
      avgAccuracy * SCORE_ACCURACY_WEIGHT +
        bestNote * SCORE_BEST_NOTE_WEIGHT +
        consistency * SCORE_CONSISTENCY_WEIGHT +
        richness * SCORE_RICHNESS_WEIGHT,
    )

    return {
      type: EXERCISE_MIRROR_MELODY,
      score,
      metrics: {
        notesCompleted: noteScores.length,
        avgAccuracy,
        bestNote,
        consistency,
        richnessScore: Math.round(richness),
      },
      completedAt: Date.now(),
    }
  }

  function stopSequence(): void {
    _cancelled = true
    if (phaseTimer) clearTimeout(phaseTimer)
    base._setRunning(false)
    finish()
  }

  return {
    setMelody,
    startSequence,
    stopSequence,
    computeResult,
  }
}
