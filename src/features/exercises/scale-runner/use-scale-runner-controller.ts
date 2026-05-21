import { batch } from 'solid-js'
import type { BaseExerciseController } from '../use-base-exercise'
import type { ExerciseResult } from '../types'
import { EXERCISE_SCALE_RUNNER } from '../types'
import { getScaleDegrees } from '@/lib/scale-data'

type ScaleType = 'major' | 'minor' | 'pentatonic' | 'chromatic'

const NOTE_PLAY_DURATION_MS = 700
const GAP_BETWEEN_NOTES_MS = 250
const MATCH_WINDOW_MS = 2000

function buildScaleNotes(baseMidi: number, scaleType: ScaleType, direction: 'up' | 'down'): number[] {
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
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  base._registerDispose(() => { clearTimeout(phaseTimer); phaseTimer = undefined })

  const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

  function setScale(baseMidi: number, scaleType: ScaleType = 'major', direction: 'up' | 'down' = 'up'): void {
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
    const targetMidi = scaleNotes[idx]
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
    phaseTimer = setTimeout(() => playCurrentNote(), 400)
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
        metrics: { notesCompleted: 0, avgAccuracy: 0, bestNote: 0 },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(noteScores.reduce((a, b) => a + b, 0) / noteScores.length)
    const bestNote = Math.max(...noteScores)

    const score = Math.round(avgAccuracy * 0.6 + bestNote * 0.4)

    return {
      type: EXERCISE_SCALE_RUNNER,
      score,
      metrics: {
        notesCompleted: noteScores.length,
        avgAccuracy,
        bestNote,
      },
      completedAt: Date.now(),
    }
  }

  function stopScale(): void {
    if (phaseTimer) clearTimeout(phaseTimer)
    base._setRunning(false)
    finish()
  }

  return { setScale, startScale, stopScale, computeResult }
}
