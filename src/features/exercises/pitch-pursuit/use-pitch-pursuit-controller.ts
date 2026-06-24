import { batch } from 'solid-js'
import { difficultyFactor } from '@/features/practice-intelligence/difficulty-scaling'
import { launchDifficulty } from '@/features/practice-intelligence/launch-override'
import { freqToExactMidi } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_PITCH_PURSUIT } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'

// Baselines reproduced exactly at difficulty 5 (difficultyFactor(5) === 1.0).
const HIT_TOLERANCE_CENTS = 50
const FALL_DURATION_MS = 5000
const SPAWN_INTERVAL_MS = 2200
const TOTAL_NOTES = 12
const TARGET_ZONE_FRAC = 0.88
const SCORE_HIT_RATE_WEIGHT = 0.5
const SCORE_ACCURACY_WEIGHT = 0.3
const MAX_COMBO_BONUS = 25
const COMBO_MULTIPLIER = 3

interface FallingNote {
  id: number
  midi: number
  spawnedAt: number
  active: boolean
  scored: boolean
  hit: boolean
  /** Timestamp (performance.now()) when the note should be deactivated. 0 = not scheduled. */
  deactivateAt: number
}

export function usePitchPursuitController(base: BaseExerciseController) {
  let notes: FallingNote[] = []
  let nextId = 0
  let lastSpawnTime = 0
  let hits = 0
  let misses = 0
  let combo = 0
  let maxCombo = 0
  let totalAccuracy = 0
  let gameLoopId = 0

  // Adaptive params, resolved at round setup. Default to baselines so the
  // controller behaves identically before startGame() runs.
  let hitToleranceCents = HIT_TOLERANCE_CENTS
  let fallDurationMs = FALL_DURATION_MS
  let totalNotes = TOTAL_NOTES

  const NOTE_POOL = [60, 62, 64, 65, 67, 69, 71, 72, 55, 57, 59]

  function spawnNote(): void {
    const midi = NOTE_POOL[Math.floor(Math.random() * NOTE_POOL.length)]
    notes.push({
      id: nextId++,
      midi,
      spawnedAt: performance.now(),
      active: true,
      scored: false,
      hit: false,
      deactivateAt: 0,
    })
  }

  function startGame(): void {
    notes = []
    nextId = 0
    hits = 0
    misses = 0
    combo = 0
    maxCombo = 0
    totalAccuracy = 0

    // Resolve adaptive difficulty for this round. Each scaled expression
    // reduces to its baseline at d5 because difficultyFactor(5) === 1.0.
    const difficulty = launchDifficulty(EXERCISE_PITCH_PURSUIT)
    const factor = difficultyFactor(difficulty)
    // Acceptance window: harder = tighter (|cents| <= W * factor).
    hitToleranceCents = HIT_TOLERANCE_CENTS * factor
    // Pursuit duration: harder = shorter fall, so the target moves faster.
    fallDurationMs = FALL_DURATION_MS * factor
    // Target count: harder = more notes (2 - factor grows as factor shrinks).
    totalNotes = Math.round(TOTAL_NOTES * (2 - factor))

    lastSpawnTime = performance.now()
    spawnNote()

    gameLoopId = requestAnimationFrame(loop)
  }

  function loop(): void {
    if (!base._isRunning()) return

    const now = performance.now()

    // Deactivate notes whose deactivation time has passed
    for (const note of notes) {
      if (note.deactivateAt > 0 && now >= note.deactivateAt) {
        note.active = false
        note.deactivateAt = 0
      }
    }

    // Spawn new notes
    if (
      now - lastSpawnTime > SPAWN_INTERVAL_MS &&
      notes.filter((n) => n.active).length < totalNotes
    ) {
      spawnNote()
      lastSpawnTime = now
    }

    const pitch = base.currentPitch()
    let currentMidi = 0
    if (pitch && pitch.freq > 0) {
      currentMidi = freqToExactMidi(pitch.freq)
    }

    // Check hits for active notes near the target zone
    for (const note of notes) {
      if (!note.active || note.scored) continue

      const elapsed = now - note.spawnedAt
      const progress = elapsed / fallDurationMs
      const yFrac = progress

      // Note reached target zone
      if (yFrac >= TARGET_ZONE_FRAC && !note.scored) {
        note.scored = true

        if (currentMidi > 0) {
          const cents = (currentMidi - note.midi) * 100
          if (Math.abs(cents) <= hitToleranceCents) {
            note.hit = true
            hits++
            combo++
            if (combo > maxCombo) maxCombo = combo
            totalAccuracy += Math.max(0, 100 - Math.abs(cents) * 1.5)
          } else {
            misses++
            combo = 0
          }
        } else {
          misses++
          combo = 0
        }

        // Schedule deactivation via timestamp (no untracked setTimeout)
        note.deactivateAt = now + 400
      }

      // Note fell off screen without being scored
      if (yFrac >= 1.0 && !note.scored) {
        note.scored = true
        misses++
        combo = 0
        note.deactivateAt = now + 200
      }
    }

    // Clean up old notes
    notes = notes.filter(
      (n) =>
        n.active ||
        (n.scored && performance.now() - n.spawnedAt < fallDurationMs + 1000),
    )

    // Update live metrics
    const total = hits + misses
    const score = total > 0 ? Math.round((hits / total) * 100) : 0
    batch(() => {
      base._updateScore(score)
      base._updateMetrics({
        hits,
        misses,
        combo,
        maxCombo,
        totalNotes: total,
      })
    })

    // End condition
    const newlySpawned = notes.filter((n) => n.active).length
    if (total >= totalNotes && newlySpawned === 0 && notes.length === 0) {
      finish()
      return
    }

    gameLoopId = requestAnimationFrame(loop)
  }

  function finish(): void {
    cancelAnimationFrame(gameLoopId)
    base._completeWithResult(computeResult())
  }

  function computeResult(): ExerciseResult {
    const total = hits + misses
    if (total === 0) {
      return {
        type: EXERCISE_PITCH_PURSUIT,
        score: 0,
        metrics: { hits: 0, misses: 0, accuracy: 0, maxCombo: 0 },
        completedAt: Date.now(),
      }
    }

    const hitRate = (hits / total) * 100
    const avgAccuracy = hits > 0 ? Math.round(totalAccuracy / hits) : 0
    const comboBonus = Math.min(MAX_COMBO_BONUS, maxCombo * COMBO_MULTIPLIER)
    const score = Math.min(
      100,
      Math.round(
        hitRate * SCORE_HIT_RATE_WEIGHT +
          avgAccuracy * SCORE_ACCURACY_WEIGHT +
          comboBonus,
      ),
    )

    return {
      type: EXERCISE_PITCH_PURSUIT,
      score,
      metrics: {
        hits,
        misses,
        accuracy: avgAccuracy,
        maxCombo,
        totalNotes: total,
      },
      completedAt: Date.now(),
    }
  }

  function stopGame(): void {
    cancelAnimationFrame(gameLoopId)
    base._setRunning(false)
    finish()
  }

  function getNotes(): FallingNote[] {
    return notes
  }

  return {
    startGame,
    stopGame,
    computeResult,
    getNotes,
  }
}
