import { batch } from 'solid-js'
import type { BaseExerciseController } from '../use-base-exercise'
import type { ExerciseResult } from '../types'
import { EXERCISE_ROUTINE_RUNNER } from '../types'

const PHASES: Array<{ name: string; notes: number[] }> = [
  { name: 'Warm-up', notes: [0, 2, 4, 2, 0] },                    // gentle ascending/descending
  { name: 'Scale Up', notes: [0, 2, 4, 5, 7, 9, 11, 12] },       // full major scale up
  { name: 'Scale Down', notes: [12, 11, 9, 7, 5, 4, 2, 0] },     // full major scale down
  { name: 'Arpeggio', notes: [0, 4, 7, 12, 7, 4, 0] },           // major triad arpeggio
  { name: 'Cool Down', notes: [5, 4, 2, 0] },                     // gentle descent
]

const NOTE_PLAY_DURATION_MS = 600
const GAP_BETWEEN_NOTES_MS = 250
const MATCH_WINDOW_MS = 2000

export function useRoutineRunnerController(
  base: BaseExerciseController,
  audioEngine: { playTone: (freq: number, duration?: number) => Promise<void> },
) {
  let baseMidi = 60
  let phaseIndex = 0
  let noteIndex = 0
  let allScores: number[] = []
  let phaseTimer: ReturnType<typeof setTimeout> | undefined

  const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

  function setBase(midi: number): void {
    baseMidi = midi
    phaseIndex = 0
    allScores = []
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
      // Phase complete, move to next
      phaseIndex++
      phaseTimer = setTimeout(() => startPhase(), 500)
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

    void audioEngine.playTone(midiToFreq(midi), NOTE_PLAY_DURATION_MS).then(() => {
      phaseTimer = setTimeout(() => {
        startMatching(noteIndex)
      }, GAP_BETWEEN_NOTES_MS)
    })
  }

  function startMatching(idx: number): void {
    batch(() => base._updateMetrics({ phase: 2 }))
    phaseTimer = setTimeout(() => evaluateNote(idx), MATCH_WINDOW_MS)
  }

  function evaluateNote(idx: number): void {
    const phase = PHASES[phaseIndex]
    const targetMidi = baseMidi + phase.notes[idx]
    const history = base.pitchHistory()
    const recentSamples = history.slice(-Math.max(1, Math.floor(MATCH_WINDOW_MS / 50)))

    let noteScore = 0
    if (recentSamples.length > 0) {
      const deviations = recentSamples
        .filter((p) => p.freq > 0)
        .map((p) => {
          const midi = 12 * Math.log2(p.freq / 440) + 69
          return Math.abs((midi - targetMidi) * 100)
        })
      if (deviations.length > 0) {
        const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length
        noteScore = Math.round(Math.max(0, 100 - avgDeviation * 1.5))
      }
    }

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
    phaseTimer = setTimeout(() => playCurrentNote(), 400)
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
        metrics: { phasesCompleted: 0, totalNotes: 0, avgAccuracy: 0, bestNote: 0 },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    const bestNote = Math.max(...allScores)

    return {
      type: EXERCISE_ROUTINE_RUNNER,
      score: Math.round(avgAccuracy * 0.6 + bestNote * 0.4),
      metrics: {
        phasesCompleted: PHASES.length,
        totalNotes: allScores.length,
        avgAccuracy,
        bestNote,
      },
      completedAt: Date.now(),
    }
  }

  function stopRoutine(): void {
    if (phaseTimer) clearTimeout(phaseTimer)
    base._setRunning(false)
    finish()
  }

  return { setBase, startRoutine, stopRoutine, computeResult, PHASES }
}
