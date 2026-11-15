// ============================================================
// Chord Stacker's run: five chords, each heard a note at a time and sung back
// ============================================================
//
// A round plays its chord from the bottom note up, each note in full, then
// asks for each note back on its own, nothing sounding. Which chords a run
// deals from, and whether it turns them over, is the setup's choice or a
// launch's (chord-stacker-chords.ts); the five sevenths in root position
// are the run every run was before the choice existed.

import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import { midiToFrequency as midiToFreq } from '@/lib/frequency-to-note'
import { EMPTY_NOTE_TALLY, tallyFromDeviations } from '../exercise-note-tally'
import { noteDeviationCents, scoreNoteAccuracy, } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_CHORD_STACKER, stoppedEarlyMark } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'
import type { ChordRound, ChordStackerChord } from './chord-stacker-chords'
import { CHORD_SETS, CHORD_STACKER_CHORDS, chordMask, chordNotes, dealChordRounds, DEFAULT_CHORD_SET, } from './chord-stacker-chords'

/** What a run deals from: the chords, and whether it turns them over. */
export interface ChordStackerChoice {
  chords: readonly ChordStackerChord[]
  inversions: boolean
}

const DEFAULT_CHOICE: ChordStackerChoice = {
  chords: CHORD_SETS[DEFAULT_CHORD_SET],
  inversions: false,
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

export function useChordStackerController(
  base: BaseExerciseController,
  audioEngine: { playTone: (freq: number, duration?: number) => Promise<void> },
) {
  let choice: ChordStackerChoice = DEFAULT_CHOICE
  let rounds: ChordRound[] = []
  // The notes of the round being played or sung, low to high.
  let roundNotes: number[] = []
  let roundIndex = 0
  let noteIndex = 0
  let noteScores: number[] = []
  let allRoundScores: number[] = []
  // Run-level, NOT per-round: noteScores is cleared for each new chord, so
  // a per-round array would report only the last chord's notes. One entry
  // per note presented across the whole run.
  let noteDeviations: (number | null)[] = []
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  let baseMidi = 60
  // Set by Stop before the last round is graded: the result is then
  // practice, not a run (exercise-comparability.ts).
  let stoppedEarly = false
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

  /** Deal a run on `midi`'s chords: the five sevenths in root position
   *  unless the setup or a launch chose others. */
  function setBase(
    midi: number,
    chosen: ChordStackerChoice = DEFAULT_CHOICE,
  ): void {
    _cancelled = false
    baseMidi = midi
    choice = chosen
    rounds = dealChordRounds(chosen.chords, chosen.inversions)
    roundIndex = 0
    allRoundScores = []
    noteDeviations = []
    stoppedEarly = false

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
    if (roundIndex >= rounds.length) {
      finish()
      return
    }

    const { chord, position } = rounds[roundIndex]
    roundNotes = chordNotes(baseMidi, chord, position)
    noteIndex = 0
    noteScores = []

    batch(() => {
      base._updateMetrics({
        round: roundIndex,
        totalRounds: rounds.length,
        chordLength: roundNotes.length,
        // The round's chord, for its name on the stage: which of the
        // table's chords, on which root, in which position (-1 while the
        // run plays every chord in root position, so none is named).
        chordIndex: CHORD_STACKER_CHORDS.indexOf(chord),
        rootMidi: baseMidi,
        chordPosition: choice.inversions ? position : -1,
        phase: 1,
      })
    })

    playChordNotes()
  }

  // Tracked via `phaseTimer` (like every other scheduled delay in this
  // controller) so stopRounds()/reset() can cancel a tone's wait or an
  // inter-note gap immediately instead of leaving an untracked native
  // timer to fire on an already-stopped exercise.
  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      phaseTimer = setTimeout(resolve, ms)
    })
  }

  async function playChordNotes(): Promise<void> {
    if (_cancelled) return
    for (let i = 0; i < roundNotes.length; i++) {
      const midi = roundNotes[i]
      batch(() => base._updateMetrics({ currentMidi: midi }))
      await audioEngine.playTone(midiToFreq(midi), notePlayDurationMs)
      if (_cancelled) return
      // The promise settles when the tone is scheduled, and the next
      // playTone releases the one before it. Wait it out, so each note
      // sounds in full before the gap, and the last one ends before the
      // singing starts.
      await delay(notePlayDurationMs)
      if (_cancelled) return
      if (i < roundNotes.length - 1) {
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
    if (noteIndex >= roundNotes.length) {
      evaluateChordRound()
      return
    }

    const midi = roundNotes[noteIndex]
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
    const targetMidi = roundNotes[noteIndex]
    const noteScore = scoreNoteAccuracy(
      base.pitchHistory(),
      targetMidi,
      matchWindowMs,
    )

    noteScores.push(noteScore)
    noteDeviations.push(
      noteDeviationCents(base.pitchHistory(), targetMidi, matchWindowMs),
    )

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

  /** Each chord's average round score, `maj7Avg` for the major seventh:
   *  0 for a chord the run did not reach or does not deal. */
  function chordAverages(): Record<string, number> {
    const byChord = new Map<ChordStackerChord, number[]>()
    allRoundScores.forEach((score, i) => {
      const chord = rounds[i]?.chord
      if (chord !== undefined)
        byChord.set(chord, [...(byChord.get(chord) ?? []), score])
    })
    return Object.fromEntries(
      CHORD_STACKER_CHORDS.map((c) => [`${c}Avg`, avgOf(byChord.get(c) ?? [])]),
    )
  }

  /** What the run dealt from, as numbers a result's metrics can carry:
   *  which record it belongs to (exercise-comparability.ts). */
  function choiceMetrics(): Record<string, number> {
    return {
      chordMask: chordMask(choice.chords),
      inversions: choice.inversions ? 1 : 0,
    }
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
          ...chordAverages(),
          ...choiceMetrics(),
          ...EMPTY_NOTE_TALLY,
          ...stoppedEarlyMark(stoppedEarly),
        },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(
      allRoundScores.reduce((a, b) => a + b, 0) / allRoundScores.length,
    )
    const bestRound = Math.max(...allRoundScores)

    return {
      type: EXERCISE_CHORD_STACKER,
      score: Math.round(avgAccuracy * 0.7 + bestRound * 0.3),
      metrics: {
        roundsCompleted: allRoundScores.length,
        avgAccuracy,
        bestRound,
        ...chordAverages(),
        ...choiceMetrics(),
        ...tallyFromDeviations(noteDeviations),
        ...stoppedEarlyMark(stoppedEarly),
      },
      completedAt: Date.now(),
    }
  }

  function stopRounds(): void {
    _cancelled = true
    if (phaseTimer) clearTimeout(phaseTimer)
    stoppedEarly = allRoundScores.length < rounds.length
    base._setRunning(false)
    finish()
  }

  return { setBase, startRounds, stopRounds, computeResult }
}
