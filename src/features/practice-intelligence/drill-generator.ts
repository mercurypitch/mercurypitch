// ============================================================
// Drill Generator — Build targeted micro-drills from weaknesses
// ============================================================
//
// Takes a WeaknessReport and generates actionable micro-drills:
//  - Range drill: Focus on problematic pitch ranges
//  - Interval drill: Practice missed intervals
//  - Precision drill: Repeat weakest exercise at easier difficulty
//  - Stamina drill: Long-note on weak pitches

import type { ExerciseConfig, ExerciseType } from '@/features/exercises/types'
import { EXERCISE_INTERVAL_TRAINER, EXERCISE_LONG_NOTE, EXERCISE_SCALE_RUNNER, } from '@/features/exercises/types'
import { getDifficulty } from './difficulty-store'
import type { WeakExercise, WeakInterval, WeakPitch } from './weakness-analyzer'

// ── Types ──────────────────────────────────────────────────────

export interface MicroDrill {
  id: string
  title: string
  description: string
  exerciseType: ExerciseType
  config: ExerciseConfig
  reason: string
  icon: 'target' | 'arrow' | 'scale' | 'lock'
}

// ── Generators ─────────────────────────────────────────────────

export function generatePrecisionDrill(
  exercise: WeakExercise,
): MicroDrill | null {
  const difficulty = getDifficulty(exercise.type)
  const reducedDifficulty = Math.max(1, difficulty - 2)

  return {
    id: `precision-${exercise.type}`,
    title: `${capitalize(exercise.type.replace(/-/g, ' '))} Focus`,
    description: `Practice this exercise at a reduced difficulty to build accuracy.`,
    exerciseType: exercise.type,
    config: {
      type: exercise.type,
      difficulty: reducedDifficulty,
    },
    reason: `You're averaging ${exercise.recentAvg}% on this exercise.`,
    icon: 'target',
  }
}

export function generateRangeDrill(
  weakPitches: WeakPitch[],
): MicroDrill | null {
  if (weakPitches.length === 0) return null

  const top = weakPitches.slice(0, 3)
  const targetNotes = top.map((p) => p.noteName)

  return {
    id: 'range-weak-pitches',
    title: 'Pitch Range Spot Check',
    description: `Focus on ${targetNotes.join(', ')} — your weakest notes.`,
    exerciseType: EXERCISE_SCALE_RUNNER,
    config: {
      type: EXERCISE_SCALE_RUNNER,
      targetNote: targetNotes[0],
      difficulty: Math.max(1, getDifficulty(EXERCISE_SCALE_RUNNER) - 1),
    },
    reason: `You're ${Math.round(top[0].avgDeviation)}¢ off on ${top[0].noteName}.${targetNotes.length > 1 ? ` Range: ${targetNotes[targetNotes.length - 1]}–${targetNotes[0]}` : ''}`,
    icon: 'scale',
  }
}

export function generateIntervalDrill(
  weakIntervals: WeakInterval[],
): MicroDrill | null {
  if (weakIntervals.length === 0) return null

  const worst = weakIntervals[0]

  return {
    id: `interval-${worst.category}`,
    title: `${worst.label} Focus`,
    description: `Practice ${worst.range} — your weakest interval category.`,
    exerciseType: EXERCISE_INTERVAL_TRAINER,
    config: {
      type: EXERCISE_INTERVAL_TRAINER,
      difficulty: Math.max(1, getDifficulty(EXERCISE_INTERVAL_TRAINER) - 2),
    },
    reason: `Only ${worst.accuracy}% accuracy on ${worst.label.toLowerCase()} (${worst.occurrences} sessions).`,
    icon: 'arrow',
  }
}

export function generateStaminaDrill(
  weakPitches: WeakPitch[],
): MicroDrill | null {
  if (weakPitches.length === 0) return null

  const target = weakPitches[0]

  return {
    id: 'stamina-weak-pitch',
    title: `Hold ${target.noteName}`,
    description: `Practice sustaining ${target.noteName} with steady pitch to build control.`,
    exerciseType: EXERCISE_LONG_NOTE,
    config: {
      type: EXERCISE_LONG_NOTE,
      targetNote: target.noteName,
      difficulty: Math.max(1, getDifficulty(EXERCISE_LONG_NOTE) - 1),
    },
    reason: `You average ${target.avgDeviation}¢ off on ${target.noteName} across ${target.occurrences} attempts.`,
    icon: 'target',
  }
}

// ── Full Generation ────────────────────────────────────────────

export function generateDrills(
  exercises: WeakExercise[],
  pitches: WeakPitch[],
  intervals: WeakInterval[],
): MicroDrill[] {
  const drills: MicroDrill[] = []

  // Always generate a precision drill for the weakest exercise
  if (exercises.length > 0) {
    const drill = generatePrecisionDrill(exercises[0])
    if (drill) drills.push(drill)
  }

  // Range drill if there are weak pitches
  const rangeDrill = generateRangeDrill(pitches)
  if (rangeDrill) drills.push(rangeDrill)

  // Interval drill if interval weaknesses exist
  const intervalDrill = generateIntervalDrill(intervals)
  if (intervalDrill) drills.push(intervalDrill)

  // Stamina drill for most deviated pitch
  const staminaDrill = generateStaminaDrill(pitches)
  if (staminaDrill) drills.push(staminaDrill)

  return drills.slice(0, 4)
}

// ── Helpers ────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}
