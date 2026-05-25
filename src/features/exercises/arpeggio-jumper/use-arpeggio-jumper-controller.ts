import { batch } from 'solid-js'
import type { BaseExerciseController } from '../use-base-exercise'
import type { ExerciseResult } from '../types'
import { EXERCISE_ARPEGGIO_JUMPER } from '../types'
import { approximateRichness } from '@/lib/vocal-analyzer'

type ArpeggioType = 'major' | 'minor' | 'diminished' | 'augmented'

const ARPEGGIO_DEGREES: Record<ArpeggioType, number[]> = {
  major: [0, 4, 7, 12],
  minor: [0, 3, 7, 12],
  diminished: [0, 3, 6, 12],
  augmented: [0, 4, 8, 12],
}

const NOTE_PLAY_DURATION_MS = 700
const GAP_BETWEEN_NOTES_MS = 250
const MATCH_WINDOW_MS = 2000

function buildArpeggioNotes(
  baseMidi: number,
  arpeggioType: ArpeggioType,
  direction: 'up' | 'down',
): number[] {
  const degrees = ARPEGGIO_DEGREES[arpeggioType]
  let notes = degrees.map((d) => baseMidi + d)
  if (direction === 'down') {
    notes = [...notes].reverse()
  }
  return notes
}

export function useArpeggioJumperController(
  base: BaseExerciseController,
  audioEngine: { playTone: (freq: number, duration?: number) => Promise<void> },
) {
  let arpeggioNotes: number[] = []
  let noteIndex = 0
  let noteScores: number[] = []
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  base._registerDispose(() => { clearTimeout(phaseTimer); phaseTimer = undefined })
  let _cancelled = false

  const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

  function setArpeggio(
    baseMidi: number,
    arpeggioType: ArpeggioType = 'major',
    direction: 'up' | 'down' = 'up',
  ): void {
    _cancelled = false
    arpeggioNotes = buildArpeggioNotes(baseMidi, arpeggioType, direction)
    noteIndex = 0
    noteScores = []
  }

  function startArpeggio(): void {
    playCurrentNote()
  }

  function playCurrentNote(): void {
    if (noteIndex >= arpeggioNotes.length) {
      finish()
      return
    }

    const midi = arpeggioNotes[noteIndex]
    batch(() => {
      base._setTargetPitch(midiToFreq(midi))
      base._updateMetrics({
        noteIndex,
        arpeggioLength: arpeggioNotes.length,
        currentMidi: midi,
        phase: 1,
      })
    })

    void audioEngine.playTone(midiToFreq(midi), NOTE_PLAY_DURATION_MS).then(() => {
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
    phaseTimer = setTimeout(() => { if (_cancelled) return; evaluateNote(idx) }, MATCH_WINDOW_MS)
  }

  function evaluateNote(idx: number): void {
    const targetMidi = arpeggioNotes[idx]
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
    phaseTimer = setTimeout(() => { if (_cancelled) return; playCurrentNote() }, 400)
  }

  function finish(): void {
    const result = computeResult()
    base._completeWithResult(result)
  }

  function computeResult(): ExerciseResult {
    if (noteScores.length === 0) {
      return {
        type: EXERCISE_ARPEGGIO_JUMPER,
        score: 0,
        metrics: { notesCompleted: 0, avgAccuracy: 0, bestNote: 0 },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(noteScores.reduce((a, b) => a + b, 0) / noteScores.length)
    const bestNote = Math.max(...noteScores)

    const history = base.pitchHistory()
    const claritySamples = history
      .filter((p) => p.freq > 0 && p.clarity !== undefined)
      .map((p) => ({ freq: p.freq, clarity: p.clarity! }))
    const richness = claritySamples.length > 2
      ? approximateRichness(claritySamples).richnessScore
      : 0

    return {
      type: EXERCISE_ARPEGGIO_JUMPER,
      score: Math.round(avgAccuracy * 0.45 + bestNote * 0.3 + richness * 0.25),
      metrics: {
        notesCompleted: noteScores.length,
        avgAccuracy,
        bestNote,
        richnessScore: Math.round(richness),
      },
      completedAt: Date.now(),
    }
  }

  function stopArpeggio(): void {
    _cancelled = true
    if (phaseTimer) clearTimeout(phaseTimer)
    base._setRunning(false)
    finish()
  }

  return { setArpeggio, startArpeggio, stopArpeggio, computeResult }
}
