import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import { midiToFrequency as midiToFreq } from '@/lib/frequency-to-note'
import type { FatigueCheckpoint } from '@/lib/vocal-analyzer'
import { analyzeFatigue, approximateRichness } from '@/lib/vocal-analyzer'
import { freqToExactMidi, scoreNoteAccuracy, trailingSamplesByTime, } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_ROUTINE_RUNNER } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

const PHASES: Array<{ name: string; notes: number[] }> = [
  { name: 'Warm-up', notes: [0, 2, 4, 2, 0] }, // gentle ascending/descending
  { name: 'Scale Up', notes: [0, 2, 4, 5, 7, 9, 11, 12] }, // full major scale up
  { name: 'Scale Down', notes: [12, 11, 9, 7, 5, 4, 2, 0] }, // full major scale down
  { name: 'Arpeggio', notes: [0, 4, 7, 12, 7, 4, 0] }, // major triad arpeggio
  { name: 'Cool Down', notes: [5, 4, 2, 0] }, // gentle descent
]

const NOTE_PLAY_DURATION_MS = 600
const GAP_BETWEEN_NOTES_MS = 250
const MATCH_WINDOW_MS = 2000
// Baseline rest between phases (segment transition). The only meta-level knob
// this runner owns that isn't already scaled by its sub-segments' own
// difficulty: harder = shorter recovery between phases, easier = longer.
const PHASE_REST_MS = 500

export function useRoutineRunnerController(
  base: BaseExerciseController,
  audioEngine: { playTone: (freq: number, duration?: number) => Promise<void> },
) {
  let baseMidi = 60
  let phaseIndex = 0
  let noteIndex = 0
  let allScores: number[] = []
  let fatigueCheckpoints: FatigueCheckpoint[] = []
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  base._registerDispose(() => {
    clearTimeout(phaseTimer)
    phaseTimer = undefined
  })
  let _cancelled = false
  // Difficulty-scaled rest between phases; difficultyFactor(5) === 1 → 500ms.
  let phaseRestMs = PHASE_REST_MS

  function setBase(midi: number): void {
    _cancelled = false
    baseMidi = midi
    phaseIndex = 0
    allScores = []
    fatigueCheckpoints = []
    const difficulty = launchDifficulty(EXERCISE_ROUTINE_RUNNER)
    phaseRestMs = Math.round(PHASE_REST_MS * difficultyFactor(difficulty))
  }

  function startRoutine(): void {
    startPhase()
  }

  function startPhase(): void {
    if (phaseIndex >= PHASES.length) {
      finish()
      return
    }

    noteIndex = 0
    const phase = PHASES[phaseIndex]
    batch(() => {
      base._updateMetrics({
        phaseIndex,
        totalPhases: PHASES.length,
        phaseName: phaseIndex, // numeric index, component maps to name
        noteIndex: 0,
        phaseLength: phase.notes.length,
      })
    })

    playCurrentNote()
  }

  function playCurrentNote(): void {
    const phase = PHASES[phaseIndex]
    if (noteIndex >= phase.notes.length) {
      // Collect fatigue checkpoint before advancing
      collectCheckpoint()
      phaseIndex++
      phaseTimer = setTimeout(() => {
        if (_cancelled) return
        startPhase()
      }, phaseRestMs)
      return
    }

    const midi = baseMidi + phase.notes[noteIndex]
    batch(() => {
      base._setTargetPitch(midiToFreq(midi))
      base._updateMetrics({
        currentMidi: midi,
        noteIndex,
        phase: 1,
      })
    })

    void audioEngine
      .playTone(midiToFreq(midi), NOTE_PLAY_DURATION_MS)
      .then(() => {
        if (_cancelled) return
        phaseTimer = setTimeout(() => {
          if (_cancelled) return
          startMatching(noteIndex)
        }, GAP_BETWEEN_NOTES_MS)
      })
  }

  function startMatching(idx: number): void {
    if (_cancelled) return
    batch(() => base._updateMetrics({ phase: 2 }))
    phaseTimer = setTimeout(() => {
      if (_cancelled) return
      evaluateNote(idx)
    }, MATCH_WINDOW_MS)
  }

  function evaluateNote(idx: number): void {
    const phase = PHASES[phaseIndex]
    const targetMidi = baseMidi + phase.notes[idx]
    const noteScore = scoreNoteAccuracy(
      base.pitchHistory(),
      targetMidi,
      MATCH_WINDOW_MS,
    )

    allScores.push(noteScore)

    if (allScores.length > 0) {
      const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length
      batch(() => {
        base._updateScore(Math.round(avg))
        base._updateMetrics({
          lastNoteScore: noteScore,
          totalNotesCompleted: allScores.length,
        })
      })
    }

    noteIndex++
    phaseTimer = setTimeout(() => {
      if (_cancelled) return
      playCurrentNote()
    }, 400)
  }

  function collectCheckpoint(): void {
    const history = base.pitchHistory()
    const recentSamples = trailingSamplesByTime(history, MATCH_WINDOW_MS)
    const claritySamples = recentSamples
      .filter((p) => p.freq > 0 && p.clarity !== undefined)
      .map((p) => ({ freq: p.freq, clarity: p.clarity! }))

    if (claritySamples.length < 3) return

    const avgClarity =
      claritySamples.reduce((s, p) => s + p.clarity, 0) / claritySamples.length
    const hnrDb =
      Math.round(Math.min(35, Math.max(0, avgClarity * 0.35)) * 10) / 10
    const richness = approximateRichness(claritySamples)

    const validMidis = recentSamples
      .filter((p) => p.freq > 0)
      .map((p) => freqToExactMidi(p.freq))
    const pitchStability = (() => {
      if (validMidis.length < 2) return 100
      const mean = validMidis.reduce((a, b) => a + b, 0) / validMidis.length
      const variance =
        validMidis.reduce((s, v) => s + (v - mean) ** 2, 0) / validMidis.length
      const stdDevCents = Math.sqrt(variance) * 100
      return Math.round(Math.max(0, 100 - stdDevCents * 2))
    })()

    fatigueCheckpoints.push({
      time: history[history.length - 1]?.time ?? 0,
      hnrDb,
      richnessScore: richness.richnessScore,
      pitchStability,
    })
  }

  function finish(): void {
    const result = computeResult()
    base._completeWithResult(result)
  }

  function computeResult(): ExerciseResult {
    if (allScores.length === 0) {
      return {
        type: EXERCISE_ROUTINE_RUNNER,
        score: 0,
        metrics: {
          phasesCompleted: 0,
          totalNotes: 0,
          avgAccuracy: 0,
          bestNote: 0,
          fatigueScore: 0,
          richnessScore: 0,
          hnrTrend: 0,
          richnessTrend: 0,
        },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(
      allScores.reduce((a, b) => a + b, 0) / allScores.length,
    )
    const bestNote = Math.max(...allScores)

    // Fatigue analysis
    const fatigueResult = analyzeFatigue(fatigueCheckpoints)
    const fatigueScore = fatigueResult.fatigued
      ? Math.min(100, Math.max(0, 100 + fatigueResult.trends.hnrTrend * 2))
      : 100

    // Richness from all clarity samples
    const history = base.pitchHistory()
    const claritySamples = history
      .filter((p) => p.freq > 0 && p.clarity !== undefined)
      .map((p) => ({ freq: p.freq, clarity: p.clarity! }))
    const richness =
      claritySamples.length > 2
        ? approximateRichness(claritySamples).richnessScore
        : 0

    return {
      type: EXERCISE_ROUTINE_RUNNER,
      score: Math.round(
        avgAccuracy * 0.35 +
          bestNote * 0.15 +
          fatigueScore * 0.3 +
          richness * 0.2,
      ),
      metrics: {
        phasesCompleted: PHASES.length,
        totalNotes: allScores.length,
        avgAccuracy,
        bestNote,
        fatigueScore,
        richnessScore: Math.round(richness),
        hnrTrend: fatigueResult.trends.hnrTrend,
        richnessTrend: fatigueResult.trends.richnessTrend,
      },
      completedAt: Date.now(),
    }
  }

  function stopRoutine(): void {
    _cancelled = true
    if (phaseTimer) clearTimeout(phaseTimer)
    base._setRunning(false)
    finish()
  }

  return { setBase, startRoutine, stopRoutine, computeResult, PHASES }
}
