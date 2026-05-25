import { batch } from 'solid-js'
import type { BaseExerciseController } from '../use-base-exercise'
import type { ExerciseResult } from '../types'
import { EXERCISE_MIRROR_MELODY } from '../types'
import { approximateRichness } from '@/lib/vocal-analyzer'

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
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  base._registerDispose(() => { clearTimeout(phaseTimer); phaseTimer = undefined })
  let _cancelled = false

  const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

  function setMelody(baseMidi: number): void {
    _cancelled = false
    melody = generateMelody(baseMidi, MELODY_LENGTH)
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

    void audioEngine.playTone(midiToFreq(midi), TONE_DURATION_MS).then(() => {
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
    }, MATCH_WINDOW_MS)
  }

  function evaluateMatch(): void {
    const targetMidi = melody[noteIndex]
    const history = base.pitchHistory()

    const recentSamples = history.slice(
      -Math.max(1, Math.floor(MATCH_WINDOW_MS / 50)),
    )

    let noteScore = 0
    if (recentSamples.length > 0) {
      const deviations = recentSamples
        .filter((p) => p.freq > 0)
        .map((p) => {
          const midi = 12 * Math.log2(p.freq / 440) + 69
          return Math.abs((midi - targetMidi) * 100)
        })

      if (deviations.length > 0) {
        const avgDeviation =
          deviations.reduce((a, b) => a + b, 0) / deviations.length
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
    phaseTimer = setTimeout(() => { if (_cancelled) return; playCurrentNote() }, 600)
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
        metrics: { notesCompleted: 0, avgAccuracy: 0, bestNote: 0 },
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
    const richness = claritySamples.length > 2
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
