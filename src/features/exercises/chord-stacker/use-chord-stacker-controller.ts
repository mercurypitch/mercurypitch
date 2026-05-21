import { batch } from 'solid-js'
import type { BaseExerciseController } from '../use-base-exercise'
import type { ExerciseResult } from '../types'
import { EXERCISE_CHORD_STACKER } from '../types'

type ChordType = 'maj7' | 'min7' | 'dom7' | 'dim7' | 'maj6'

const CHORD_DEGREES: Record<ChordType, number[]> = {
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  dim7: [0, 3, 6, 9],
  maj6: [0, 4, 7, 9],
}

const CHORD_LABELS: Record<ChordType, string> = {
  maj7: 'Major 7th',
  min7: 'Minor 7th',
  dom7: 'Dominant 7th',
  dim7: 'Diminished 7th',
  maj6: 'Major 6th',
}

const NOTE_PLAY_DURATION_MS = 600
const GAP_BETWEEN_NOTES_MS = 300
const MATCH_WINDOW_MS = 2500

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function useChordStackerController(
  base: BaseExerciseController,
  audioEngine: { playTone: (freq: number, duration?: number) => Promise<void> },
) {
  let chordTypes: ChordType[] = []
  let chordNotes: number[] = []
  let roundIndex = 0
  let noteIndex = 0
  let noteScores: number[] = []
  let allRoundScores: number[] = []
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  let baseMidi = 60

  const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

  function setBase(midi: number): void {
    baseMidi = midi
    chordTypes = shuffleArray(Object.keys(CHORD_DEGREES) as ChordType[])
    roundIndex = 0
    allRoundScores = []
  }

  function startRounds(): void {
    playRound()
  }

  function playRound(): void {
    if (roundIndex >= chordTypes.length) {
      finish()
      return
    }

    const type = chordTypes[roundIndex]
    const degrees = CHORD_DEGREES[type]
    chordNotes = degrees.map((d) => baseMidi + d)
    noteIndex = 0
    noteScores = []

    batch(() => {
      base._updateMetrics({
        round: roundIndex,
        totalRounds: chordTypes.length,
        chordLength: chordNotes.length,
        phase: 1,
      })
    })

    playChordNotes()
  }

  async function playChordNotes(): Promise<void> {
    for (let i = 0; i < chordNotes.length; i++) {
      const midi = chordNotes[i]
      batch(() => base._updateMetrics({ currentMidi: midi }))
      await audioEngine.playTone(midiToFreq(midi), NOTE_PLAY_DURATION_MS)
      if (i < chordNotes.length - 1) {
        await new Promise((r) => setTimeout(r, GAP_BETWEEN_NOTES_MS))
      }
    }

    // Short gap then start matching
    await new Promise((r) => setTimeout(r, 400))
    noteIndex = 0
    startMatchingNote()
  }

  function startMatchingNote(): void {
    if (noteIndex >= chordNotes.length) {
      evaluateChordRound()
      return
    }

    const midi = chordNotes[noteIndex]
    batch(() => {
      base._setTargetPitch(midiToFreq(midi))
      base._updateMetrics({
        currentMidi: midi,
        noteIndex,
        phase: 2,
      })
    })

    phaseTimer = setTimeout(() => {
      scoreCurrentNote()
    }, MATCH_WINDOW_MS)
  }

  function scoreCurrentNote(): void {
    const targetMidi = chordNotes[noteIndex]
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

    const roundAvg = noteScores.reduce((a, b) => a + b, 0) / noteScores.length
    batch(() => {
      base._updateScore(Math.round(roundAvg))
      base._updateMetrics({
        lastNoteScore: noteScore,
        notesCompleted: noteScores.length,
      })
    })

    noteIndex++
    phaseTimer = setTimeout(() => startMatchingNote(), 500)
  }

  function evaluateChordRound(): void {
    const roundScore = noteScores.length > 0
      ? Math.round(noteScores.reduce((a, b) => a + b, 0) / noteScores.length)
      : 0
    allRoundScores.push(roundScore)

    const avg = allRoundScores.reduce((a, b) => a + b, 0) / allRoundScores.length
    batch(() => {
      base._updateScore(Math.round(avg))
      base._updateMetrics({
        lastRoundScore: roundScore,
        roundsCompleted: allRoundScores.length,
      })
    })

    roundIndex++
    phaseTimer = setTimeout(() => playRound(), 600)
  }

  function finish(): void {
    const result = computeResult()
    base._completeWithResult(result)
  }

  function computeResult(): ExerciseResult {
    if (allRoundScores.length === 0) {
      return {
        type: EXERCISE_CHORD_STACKER,
        score: 0,
        metrics: { roundsCompleted: 0, avgAccuracy: 0, bestRound: 0 },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(allRoundScores.reduce((a, b) => a + b, 0) / allRoundScores.length)
    const bestRound = Math.max(...allRoundScores)

    return {
      type: EXERCISE_CHORD_STACKER,
      score: Math.round(avgAccuracy * 0.7 + bestRound * 0.3),
      metrics: {
        roundsCompleted: allRoundScores.length,
        avgAccuracy,
        bestRound,
      },
      completedAt: Date.now(),
    }
  }

  function stopRounds(): void {
    if (phaseTimer) clearTimeout(phaseTimer)
    base._setRunning(false)
    finish()
  }

  return { setBase, startRounds, stopRounds, computeResult, CHORD_LABELS }
}
