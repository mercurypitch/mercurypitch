import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import { midiToFrequency as midiToFreq } from '@/lib/frequency-to-note'
import { computeGlideCoverage } from '@/lib/glide-coverage'
import { freqToExactMidi, trailingSamplesByTime, } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_SIREN } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

const ROUNDS = 6
const NOTE_PLAY_DURATION_MS = 600
const GAP_BETWEEN_NOTES_MS = 400
const MATCH_WINDOW_MS = 4000

/**
 * A counted beat between hearing the pair and having to sing it.
 *
 * The glide window used to open 400ms after the second reference note,
 * so a singer went from listening to "follow the dot" with no breath and
 * no warning, six times in a row (owner testing). Three seconds is also
 * the rest between rounds that a siren drill needs and did not have —
 * the old gap was 600ms.
 *
 * Fixed for now. Making it a choice ("straight on" vs a pause) is a
 * settings question, deliberately left for later.
 */
const READY_SEC = 3
const READY_TICK_MS = 1000

/** Metric values for `phase`, shared with SirenExercise. */
export const SIREN_PHASE_LISTEN = 1
export const SIREN_PHASE_GLIDE = 2
export const SIREN_PHASE_READY = 3

/** How long the guide dot takes to travel start → end → start. */
export const SIREN_GUIDE_PERIOD_MS = 2500

/**
 * A glide moves at most 6 times the dot's pace: twice a quick glide's speed,
 * slower than a jump.
 */
export const SIREN_GLIDE_PACE_LIMIT = 6

/**
 * The dot crosses the span in half a period, so the fastest a step may
 * glide, in semitones a second, grows with the span.
 */
export function sirenGlideMaxRate(startMidi: number, endMidi: number): number {
  return (
    (SIREN_GLIDE_PACE_LIMIT * Math.abs(endMidi - startMidi)) /
    (SIREN_GUIDE_PERIOD_MS / 2 / 1000)
  )
}

/**
 * Where the guide dot sits, `sinceMs` into the glide window.
 *
 * `sinceMs` is measured from the moment the window OPENED, which is the
 * whole point: driven off the run's elapsed clock instead, the dot
 * picked the triangle up wherever it happened to be — often already at
 * the far end, or travelling back down — under a caption reading
 * "follow the dot". It now always leaves from the start note.
 */
export function sirenGuideMidi(
  from: number,
  to: number,
  sinceMs: number,
): number {
  const ph =
    (Math.max(0, sinceMs) % SIREN_GUIDE_PERIOD_MS) / SIREN_GUIDE_PERIOD_MS
  const tri = ph < 0.5 ? ph * 2 : (1 - ph) * 2
  return from + (to - from) * tri
}
// Baseline cents-deviation slope: roundScore = 100 - avgBestCents * K.
const SCORE_SLOPE_K = 1.5

interface SirenRound {
  startMidi: number
  endMidi: number
}

/**
 * Build the siren glides centred on `baseMidi`, alternating up/down, keeping
 * BOTH endpoints inside the singer's comfortable range [rangeMin, rangeMax].
 * The whole interval is shifted into range (never clamped end-by-end, which
 * previously distorted spans and could yield sub-audible notes like "G0").
 */
export function generateSirens(
  baseMidi: number,
  difficulty: number,
  rangeMin: number,
  rangeMax: number,
): SirenRound[] {
  // Singable glide spans (semitones), up to roughly an octave.
  const intervals = [3, 5, 7, 9, 12, 7]
  const rounds: SirenRound[] = []
  // Widen the glide a little when harder (1.0 at d5).
  const spanScale = 2 - difficultyFactor(difficulty)
  const span = Math.max(1, rangeMax - rangeMin)

  for (let i = 0; i < ROUNDS; i++) {
    let interval = Math.round(intervals[i % intervals.length] * spanScale)
    interval = Math.max(2, Math.min(12, Math.min(interval, span)))
    const direction = i % 2 === 0 ? 1 : -1
    // Centre the glide on the base note, then shift the pair into range.
    let start =
      direction === 1
        ? baseMidi - Math.floor(interval / 2)
        : baseMidi + Math.ceil(interval / 2)
    let end = start + direction * interval
    const lo = Math.min(start, end)
    const hi = Math.max(start, end)
    const shift =
      lo < rangeMin ? rangeMin - lo : hi > rangeMax ? rangeMax - hi : 0
    start += shift
    end += shift
    rounds.push({ startMidi: start, endMidi: end })
  }

  return rounds
}

export function useSirenController(
  base: BaseExerciseController,
  audioEngine: { playTone: (freq: number, duration?: number) => Promise<void> },
) {
  let rounds: SirenRound[] = []
  let roundIndex = 0
  let roundScores: number[] = []
  // Each round's glide, 0-100, beside its roundScore; see evaluateRound.
  let glideScores: number[] = []
  // Rounds whose window held a voiced line to measure at all.
  let voicedGlides = 0
  // When the open glide window began, on the run's elapsed clock (ms).
  let glideFromMs = 0
  // Effective difficulty for this run; read fresh at setup (not module load).
  let difficulty = 5
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

  function setBase(baseMidi: number, rangeMin: number, rangeMax: number): void {
    _cancelled = false
    difficulty = launchDifficulty(EXERCISE_SIREN)
    rounds = generateSirens(baseMidi, difficulty, rangeMin, rangeMax)
    roundIndex = 0
    roundScores = []
    glideScores = []
    voicedGlides = 0
  }

  function startRounds(): void {
    playRound()
  }

  function playRound(): void {
    if (roundIndex >= rounds.length) {
      finish()
      return
    }

    const round = rounds[roundIndex]
    batch(() => {
      base._updateMetrics({
        round: roundIndex,
        totalRounds: rounds.length,
        startMidi: round.startMidi,
        endMidi: round.endMidi,
        currentMidi: round.startMidi,
        phase: SIREN_PHASE_LISTEN,
        readyIn: 0,
      })
    })

    // Play start note
    void audioEngine
      .playTone(midiToFreq(round.startMidi), NOTE_PLAY_DURATION_MS)
      .then(() => {
        if (_cancelled) return
        // Play end note
        base._updateMetrics({ currentMidi: round.endMidi })
        void audioEngine
          .playTone(midiToFreq(round.endMidi), NOTE_PLAY_DURATION_MS)
          .then(() => {
            if (_cancelled) return
            phaseTimer = setTimeout(() => {
              if (_cancelled) return
              beginReady()
            }, GAP_BETWEEN_NOTES_MS)
          })
      })
  }

  /** "Get ready — 3, 2, 1", then the glide window opens. */
  function beginReady(): void {
    let left = READY_SEC
    base._updateMetrics({ phase: SIREN_PHASE_READY, readyIn: left })
    const tick = (): void => {
      if (_cancelled) return
      left -= 1
      if (left <= 0) {
        startMatching()
        return
      }
      base._updateMetrics({ readyIn: left })
      phaseTimer = setTimeout(tick, READY_TICK_MS)
    }
    phaseTimer = setTimeout(tick, READY_TICK_MS)
  }

  function startMatching(): void {
    if (_cancelled) return
    const round = rounds[roundIndex]
    glideFromMs = base.state().elapsedMs
    batch(() => {
      base._setTargetPitch(midiToFreq(round.endMidi))
      base._updateMetrics({
        phase: SIREN_PHASE_GLIDE,
        readyIn: 0,
        // Anchor the guide dot to THIS window. It is drawn from the
        // run's elapsed clock, so with no anchor every round picked the
        // triangle up wherever it happened to be — the dot could appear
        // halfway along, travelling the wrong way, under a caption that
        // says "follow the dot".
        glideFromMs,
      })
    })
    phaseTimer = setTimeout(() => {
      if (_cancelled) return
      evaluateRound()
    }, MATCH_WINDOW_MS)
  }

  function evaluateRound(): void {
    const round = rounds[roundIndex]
    const history = base.pitchHistory()
    const recentSamples = trailingSamplesByTime(history, MATCH_WINDOW_MS)

    // Score how close user got to the target end note
    let roundScore = 0
    if (recentSamples.length > 0) {
      const deviations = recentSamples
        .filter((p) => p.freq > 0)
        .map((p) => {
          const midi = freqToExactMidi(p.freq)
          return Math.abs((midi - round.endMidi) * 100)
        })
      if (deviations.length > 0) {
        // Take the best 20% of samples (closest to target)
        const sorted = [...deviations].sort((a, b) => a - b)
        const bestCount = Math.max(1, Math.floor(sorted.length * 0.2))
        const bestDeviations = sorted.slice(0, bestCount)
        const avgBest =
          bestDeviations.reduce((a, b) => a + b, 0) / bestDeviations.length
        // Tighten the cents->score slope when harder: K * (1/factor) is K at
        // d5 (factor 1.0), larger when factor<1 (harder = penalised faster).
        const slopeK = SCORE_SLOPE_K * (1 / difficultyFactor(difficulty))
        roundScore = Math.round(Math.max(0, 100 - avgBest * slopeK))
      }
    }

    roundScores.push(roundScore)

    // The glide itself, over this window's voiced frames only: how much of
    // the way from the first note toward the second the line glided. The
    // window is read from when it opened rather than back from the last
    // voiced frame, so a silent round glides nothing instead of borrowing
    // the frames of the round before.
    const glideFrames = history
      .filter((p) => p.freq > 0 && p.time * 1000 > glideFromMs)
      .map((p) => ({ midi: freqToExactMidi(p.freq), time: p.time }))
    if (glideFrames.length >= 2) voicedGlides++
    glideScores.push(
      Math.round(
        computeGlideCoverage(
          glideFrames,
          round.startMidi,
          round.endMidi,
          sirenGlideMaxRate(round.startMidi, round.endMidi),
        ) * 100,
      ),
    )

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
      playRound()
    }, 600)
  }

  function finish(): void {
    const result = computeResult()
    base._completeWithResult(result)
  }

  function computeResult(): ExerciseResult {
    if (roundScores.length === 0) {
      return {
        type: EXERCISE_SIREN,
        score: 0,
        metrics: {
          roundsCompleted: 0,
          avgAccuracy: 0,
          bestRound: 0,
          glideQuality: 0,
          voicedGlides: 0,
        },
        completedAt: Date.now(),
      }
    }
    const avgAccuracy = Math.round(
      roundScores.reduce((a, b) => a + b, 0) / roundScores.length,
    )
    const bestRound = Math.max(...roundScores)

    // The 30% part used to be detectSlides' score over the whole run, which
    // splits the line only at a jump of more than half a semitone between
    // two frames and scores the jumps: a glide sung smoothly at the dot's
    // pace was one stretch with no slide in it and earned nothing, while a
    // flip, the change of note across the silence between rounds, or a
    // tracking error earned it. It is now each round's own glide, averaged
    // over the rounds, and a round with no voiced glide scores 0 in it.
    const glideQuality = Math.round(
      glideScores.reduce((a, b) => a + b, 0) / glideScores.length,
    )

    return {
      type: EXERCISE_SIREN,
      score: Math.round(
        avgAccuracy * 0.45 + bestRound * 0.25 + glideQuality * 0.3,
      ),
      metrics: {
        roundsCompleted: roundScores.length,
        avgAccuracy,
        bestRound,
        glideQuality,
        voicedGlides,
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
