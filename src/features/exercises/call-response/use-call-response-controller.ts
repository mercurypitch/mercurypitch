import { batch } from 'solid-js'
import type { BaseExerciseController } from '../use-base-exercise'
import type { ExerciseResult } from '../types'
import { EXERCISE_CALL_RESPONSE } from '../types'
import { approximateRichness } from '@/lib/vocal-analyzer'

const ROUNDS = 5
const NOTE_PLAY_DURATION_MS = 500
const GAP_BETWEEN_NOTES_MS = 200
const GAP_BEFORE_MATCH_MS = 600
const MATCH_WINDOW_MS = 3000

interface PhraseNote {
  midi: number
  durationMs: number
}

function generatePhrase(baseMidi: number, length: number): PhraseNote[] {
  const notes: PhraseNote[] = [{ midi: baseMidi, durationMs: 500 }]
  for (let i = 1; i < length; i++) {
    const prev = notes[i - 1].midi
    const dir = Math.random() > 0.5 ? 1 : -1
    const steps = [0, 2, 3, 4, 5, 7]
    const step = steps[Math.floor(Math.random() * steps.length)]
    notes.push({ midi: prev + dir * step, durationMs: 400 + Math.floor(Math.random() * 300) })
  }
  return notes
}

export function useCallResponseController(
  base: BaseExerciseController,
  audioEngine: { playTone: (freq: number, duration?: number) => Promise<void> },
) {
  let phrases: PhraseNote[][] = []
  let roundIndex = 0
  let roundScores: number[] = []
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  base._registerDispose(() => { clearTimeout(phaseTimer); phaseTimer = undefined })
  let matchStartTime = 0
  let _cancelled = false

  const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

  function setBase(baseMidi: number): void {
    _cancelled = false
    phrases = Array.from({ length: ROUNDS }, () => generatePhrase(baseMidi, 3 + Math.floor(Math.random() * 2)))
    roundIndex = 0
    roundScores = []
  }

  function startRounds(): void {
    playRound()
  }

  async function playRound(): Promise<void> {
    if (_cancelled) return
    if (roundIndex >= phrases.length) {
      finish()
      return
    }

    const phrase = phrases[roundIndex]

    batch(() => {
      base._updateMetrics({
        round: roundIndex,
        totalRounds: phrases.length,
        currentMidi: phrase[0].midi,
        phraseLength: phrase.length,
        phase: 1, // listening
      })
    })

    // Play call phrase
    for (let i = 0; i < phrase.length; i++) {
      const note = phrase[i]
      base._updateMetrics({ currentMidi: note.midi })
      await audioEngine.playTone(midiToFreq(note.midi), NOTE_PLAY_DURATION_MS)
      if (i < phrase.length - 1) {
        await new Promise((r) => setTimeout(r, GAP_BETWEEN_NOTES_MS))
      }
    }

    // Gap before user responds
    await new Promise((r) => setTimeout(r, GAP_BEFORE_MATCH_MS))

    if (_cancelled) return
    // Start matching phase
    startMatching()
  }

  function startMatching(): void {
    if (_cancelled) return
    matchStartTime = performance.now()
    batch(() => {
      base._updateMetrics({ phase: 2 }) // response phase
    })
    phaseTimer = setTimeout(() => { if (_cancelled) return; evaluateRound() }, MATCH_WINDOW_MS)
  }

  function evaluateRound(): void {
    const phrase = phrases[roundIndex]
    const history = base.pitchHistory()
    const now = performance.now()
    const recentSamples = history.filter((p) => {
      const t = p.time * 1000
      return t >= matchStartTime - 100 && t <= now
    })

    // Score each note of the phrase
    const noteScores: number[] = []
    if (recentSamples.length > 0) {
      for (const target of phrase) {
        const deviations = recentSamples
          .filter((p) => p.freq > 0)
          .map((p) => {
            const midi = 12 * Math.log2(p.freq / 440) + 69
            return Math.abs((midi - target.midi) * 100)
          })
        if (deviations.length > 0) {
          const best = Math.min(...deviations)
          noteScores.push(Math.round(Math.max(0, 100 - best * 1.5)))
        } else {
          noteScores.push(0)
        }
      }
    }

    const roundScore = noteScores.length > 0
      ? Math.round(noteScores.reduce((a, b) => a + b, 0) / noteScores.length)
      : 0
    roundScores.push(roundScore)

    const avg = roundScores.reduce((a, b) => a + b, 0) / roundScores.length
    batch(() => {
      base._updateScore(Math.round(avg))
      base._updateMetrics({
        lastRoundScore: roundScore,
        roundsCompleted: roundScores.length,
      })
    })

    roundIndex++
    phaseTimer = setTimeout(() => {
      if (_cancelled) return
      void playRound()
    }, 600)
  }

  function finish(): void {
    const result = computeResult()
    base._completeWithResult(result)
  }

  function computeResult(): ExerciseResult {
    if (roundScores.length === 0) {
      return {
        type: EXERCISE_CALL_RESPONSE,
        score: 0,
        metrics: { roundsCompleted: 0, avgAccuracy: 0, bestRound: 0 },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(roundScores.reduce((a, b) => a + b, 0) / roundScores.length)
    const bestRound = Math.max(...roundScores)

    const history = base.pitchHistory()
    const claritySamples = history
      .filter((p) => p.freq > 0 && p.clarity !== undefined)
      .map((p) => ({ freq: p.freq, clarity: p.clarity! }))
    const richness = claritySamples.length > 2
      ? approximateRichness(claritySamples).richnessScore
      : 0

    return {
      type: EXERCISE_CALL_RESPONSE,
      score: Math.round(avgAccuracy * 0.5 + bestRound * 0.25 + richness * 0.25),
      metrics: {
        roundsCompleted: roundScores.length,
        avgAccuracy,
        bestRound,
        richnessScore: Math.round(richness),
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

  return { setBase, startRounds, stopRounds, computeResult }
}
