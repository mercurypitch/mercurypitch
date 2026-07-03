import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import { midiToFrequency as midiToFreq } from '@/lib/frequency-to-note'
import { approximateRichness } from '@/lib/vocal-analyzer'
import { scoreNoteAccuracy } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_ARPEGGIO_JUMPER } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

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
  // Per-round timing knobs, scaled by adaptive difficulty in setArpeggio
  // (default to the unscaled baselines so difficulty 5 == original).
  let notePlayDurationMs = NOTE_PLAY_DURATION_MS
  let matchWindowMs = MATCH_WINDOW_MS
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  let _cancelled = false
  base._registerDispose(() => {
    clearTimeout(phaseTimer)
    phaseTimer = undefined
    // reset()/unmount can fire while a playTone().then() continuation is
    // in flight — clearing the pending timer alone cannot stop it from
    // re-arming the chain (Back kept the sequence playing to the end).
    // The flag makes the continuation's own guards bail instead.
    _cancelled = true
  })

  function setArpeggio(
    baseMidi: number,
    arpeggioType: ArpeggioType = 'major',
    direction: 'up' | 'down' = 'up',
  ): void {
    _cancelled = false
    arpeggioNotes = buildArpeggioNotes(baseMidi, arpeggioType, direction)
    noteIndex = 0
    noteScores = []

    // scale by adaptive difficulty (centred on 5 == 1.0): harder = shorter
    // demo + tighter match/scoring window.
    const difficulty = launchDifficulty(EXERCISE_ARPEGGIO_JUMPER)
    const factor = difficultyFactor(difficulty)
    notePlayDurationMs = Math.round(NOTE_PLAY_DURATION_MS * factor)
    matchWindowMs = Math.round(MATCH_WINDOW_MS * factor)
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
        // report the SCALED acceptance window for the component to display
        matchWindowMs,
      })
    })

    void audioEngine
      .playTone(midiToFreq(midi), notePlayDurationMs) // scale by adaptive difficulty
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
    }, matchWindowMs) // scale by adaptive difficulty
  }

  function evaluateNote(idx: number): void {
    const targetMidi = arpeggioNotes[idx]
    const noteScore = scoreNoteAccuracy(
      base.pitchHistory(),
      targetMidi,
      matchWindowMs, // scale by adaptive difficulty
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
        type: EXERCISE_ARPEGGIO_JUMPER,
        score: 0,
        metrics: {
          notesCompleted: 0,
          avgAccuracy: 0,
          bestNote: 0,
          richnessScore: 0,
        },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(
      noteScores.reduce((a, b) => a + b, 0) / noteScores.length,
    )
    const bestNote = Math.max(...noteScores)

    const history = base.pitchHistory()
    const claritySamples = history
      .filter((p) => p.freq > 0 && p.clarity !== undefined)
      .map((p) => ({ freq: p.freq, clarity: p.clarity! }))
    const richness =
      claritySamples.length > 2
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
