import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import { midiToFrequency as midiToFreq } from '@/lib/frequency-to-note'
import { scoreNoteAccuracy } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_CHORD_STACKER } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

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

// Baselines at difficulty 5 (difficultyFactor(5) === 1.0). Harder levels
// shorten the playback/hold and match window (factor < 1); easier lengthen them.
const NOTE_PLAY_DURATION_BASE_MS = 600
const GAP_BETWEEN_NOTES_MS = 300
const MATCH_WINDOW_BASE_MS = 2500

function avgOf(arr: number[]): number {
  return arr.length > 0
    ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
    : 0
}

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
  let _cancelled = false
  // Guards against a double-invoked startRounds() (e.g. a double-click on
  // Start racing base.start()'s own async guard) kicking off a second,
  // concurrent round/timer chain that stomps on the same shared state.
  let _active = false
  base._registerDispose(() => {
    clearTimeout(phaseTimer)
    phaseTimer = undefined
    // reset()/_setRunning(false) can fire while playChordNotes() is
    // awaiting playTone()/delay() — those await points are real async
    // gaps, so without this the continuation would resume with
    // _cancelled still false and keep playing/scheduling on an
    // already-torn-down exercise.
    _cancelled = true
    _active = false
  })
  // Adaptive timing for this session's chord set, set when it is generated.
  let notePlayDurationMs = NOTE_PLAY_DURATION_BASE_MS
  let matchWindowMs = MATCH_WINDOW_BASE_MS

  function setBase(midi: number): void {
    _cancelled = false
    baseMidi = midi
    chordTypes = shuffleArray(Object.keys(CHORD_DEGREES) as ChordType[])
    roundIndex = 0
    allRoundScores = []

    // Scale playback/hold and match window by difficulty (5 == baseline).
    const difficulty = launchDifficulty(EXERCISE_CHORD_STACKER)
    const factor = difficultyFactor(difficulty)
    notePlayDurationMs = Math.round(NOTE_PLAY_DURATION_BASE_MS * factor)
    matchWindowMs = Math.round(MATCH_WINDOW_BASE_MS * factor)
  }

  function startRounds(): void {
    if (_active) {
      console.warn('[chord-stacker] startRounds() called while already active')
      return
    }
    _active = true
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

  // Tracked via `phaseTimer` (like every other scheduled delay in this
  // controller) so stopRounds()/reset() can cancel an inter-note gap
  // immediately instead of leaving an untracked native timer to fire on
  // an already-stopped exercise.
  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      phaseTimer = setTimeout(resolve, ms)
    })
  }

  async function playChordNotes(): Promise<void> {
    if (_cancelled) return
    for (let i = 0; i < chordNotes.length; i++) {
      const midi = chordNotes[i]
      batch(() => base._updateMetrics({ currentMidi: midi }))
      await audioEngine.playTone(midiToFreq(midi), notePlayDurationMs)
      if (_cancelled) return
      if (i < chordNotes.length - 1) {
        await delay(GAP_BETWEEN_NOTES_MS)
        if (_cancelled) return
      }
    }

    // Short gap then start matching
    await delay(400)
    if (_cancelled) return
    noteIndex = 0
    startMatchingNote()
  }

  function startMatchingNote(): void {
    if (_cancelled) return
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
      if (_cancelled) return
      scoreCurrentNote()
    }, matchWindowMs)
  }

  function scoreCurrentNote(): void {
    const targetMidi = chordNotes[noteIndex]
    const noteScore = scoreNoteAccuracy(
      base.pitchHistory(),
      targetMidi,
      matchWindowMs,
    )

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
    phaseTimer = setTimeout(() => {
      if (_cancelled) return
      startMatchingNote()
    }, 500)
  }

  function evaluateChordRound(): void {
    const roundScore =
      noteScores.length > 0
        ? Math.round(noteScores.reduce((a, b) => a + b, 0) / noteScores.length)
        : 0
    allRoundScores.push(roundScore)

    const avg =
      allRoundScores.reduce((a, b) => a + b, 0) / allRoundScores.length
    batch(() => {
      base._updateScore(Math.round(avg))
      base._updateMetrics({
        lastRoundScore: roundScore,
        roundsCompleted: allRoundScores.length,
      })
    })

    roundIndex++
    phaseTimer = setTimeout(() => {
      if (_cancelled) return
      playRound()
    }, 600)
  }

  function finish(): void {
    _active = false
    const result = computeResult()
    base._completeWithResult(result)
  }

  function computeResult(): ExerciseResult {
    if (allRoundScores.length === 0) {
      return {
        type: EXERCISE_CHORD_STACKER,
        score: 0,
        metrics: {
          roundsCompleted: 0,
          avgAccuracy: 0,
          bestRound: 0,
          maj7Avg: 0,
          min7Avg: 0,
          dom7Avg: 0,
          dim7Avg: 0,
          maj6Avg: 0,
        },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(
      allRoundScores.reduce((a, b) => a + b, 0) / allRoundScores.length,
    )
    const bestRound = Math.max(...allRoundScores)

    // Per-chord-type breakdown
    const chordScores: Record<ChordType, number[]> = {
      maj7: [],
      min7: [],
      dom7: [],
      dim7: [],
      maj6: [],
    }
    for (
      let i = 0;
      i < Math.min(chordTypes.length, allRoundScores.length);
      i++
    ) {
      chordScores[chordTypes[i]].push(allRoundScores[i])
    }
    const chordAvgs = {
      maj7Avg: avgOf(chordScores.maj7),
      min7Avg: avgOf(chordScores.min7),
      dom7Avg: avgOf(chordScores.dom7),
      dim7Avg: avgOf(chordScores.dim7),
      maj6Avg: avgOf(chordScores.maj6),
    }

    return {
      type: EXERCISE_CHORD_STACKER,
      score: Math.round(avgAccuracy * 0.7 + bestRound * 0.3),
      metrics: {
        roundsCompleted: allRoundScores.length,
        avgAccuracy,
        bestRound,
        ...chordAvgs,
      },
      completedAt: Date.now(),
    }
  }

  function stopRounds(): void {
    _cancelled = true
    if (phaseTimer) clearTimeout(phaseTimer)
    base._setRunning(false)
    finish()
  }

  return { setBase, startRounds, stopRounds, computeResult, CHORD_LABELS }
}
