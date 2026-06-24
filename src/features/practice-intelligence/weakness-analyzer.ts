// ============================================================
// Weakness Analyzer — Detect problem areas from practice history
// ============================================================
//
// Scans exercise history and session results to identify:
//  - Low-scoring exercise types
//  - Problematic pitch ranges (notes with high deviation)
//  - Missed intervals from interval-trainer metrics

import type { ExerciseType } from '@/features/exercises/types'
import { midiToNoteName } from '@/lib/frequency-to-note'
import { exerciseHistory } from '@/stores/exercise-history-store'
import { getSessionHistory } from '@/stores/practice-session-store'

// ── Types ──────────────────────────────────────────────────────

export interface WeakExercise {
  type: ExerciseType
  recentAvg: number
  totalPlays: number
  trend: 'improving' | 'declining' | 'stable'
}

export interface WeakPitch {
  midi: number
  noteName: string
  avgDeviation: number // average cents off
  occurrences: number
}

export interface WeaknessReport {
  weakExercises: WeakExercise[]
  weakPitches: WeakPitch[]
  weakIntervals: WeakInterval[]
  generatedAt: number
}

// ── Thresholds ─────────────────────────────────────────────────

const WEAK_EXERCISE_THRESHOLD = 65 // avg score below this = weak
const WEAK_PITCH_CENTS_THRESHOLD = 20 // avg deviation above this = weak
const WEAK_PITCH_MIN_OCCURRENCES = 3
const WEAK_INTERVAL_THRESHOLD = 60 // accuracy below this = weak
const RECENT_WINDOW = 10 // consider last N entries

// ── Exercise Weaknesses ────────────────────────────────────────

export function findWeakExercises(): WeakExercise[] {
  const entries = exerciseHistory()
  if (entries.length === 0) return []

  const byType = new Map<ExerciseType, { recent: number[]; all: number[] }>()
  for (const e of entries) {
    const data = byType.get(e.type) ?? { recent: [], all: [] }
    data.all.push(e.score)
    if (data.recent.length < RECENT_WINDOW) {
      data.recent.push(e.score)
    }
    byType.set(e.type, data)
  }

  const results: WeakExercise[] = []
  for (const [type, data] of byType) {
    const recentAvg =
      data.recent.length > 0
        ? Math.round(
            data.recent.reduce((a, b) => a + b, 0) / data.recent.length,
          )
        : 0

    if (recentAvg < WEAK_EXERCISE_THRESHOLD) {
      const allAvg =
        data.all.length > 0
          ? Math.round(data.all.reduce((a, b) => a + b, 0) / data.all.length)
          : 0

      const trend: WeakExercise['trend'] =
        recentAvg > allAvg + 5
          ? 'improving'
          : recentAvg < allAvg - 5
            ? 'declining'
            : 'stable'

      results.push({
        type,
        recentAvg,
        totalPlays: data.all.length,
        trend,
      })
    }
  }

  return results.sort((a, b) => a.recentAvg - b.recentAvg)
}

// ── Pitch Weaknesses ───────────────────────────────────────────

export function findWeakPitches(): WeakPitch[] {
  const sessions = getSessionHistory()
  if (sessions.length === 0) return []

  // Collect cents deviations per MIDI note from noteResults
  const pitchData = new Map<number, { totalCents: number; count: number }>()

  for (const session of sessions) {
    for (const pr of session.practiceItemResult) {
      for (const nr of pr.noteResult) {
        const midi = nr.item.note.midi
        const existing = pitchData.get(midi) ?? { totalCents: 0, count: 0 }
        existing.totalCents += Math.abs(nr.avgCents)
        existing.count++
        pitchData.set(midi, existing)
      }
    }
  }

  const results: WeakPitch[] = []
  for (const [midi, data] of pitchData) {
    if (data.count < WEAK_PITCH_MIN_OCCURRENCES) continue
    const avgDeviation = Math.round((data.totalCents / data.count) * 10) / 10
    if (avgDeviation >= WEAK_PITCH_CENTS_THRESHOLD) {
      results.push({
        midi,
        noteName: midiToNoteName(midi),
        avgDeviation,
        occurrences: data.count,
      })
    }
  }

  return results.sort((a, b) => b.avgDeviation - a.avgDeviation).slice(0, 8)
}

// ── Interval Weaknesses ────────────────────────────────────────

export interface WeakInterval {
  category: 'small' | 'medium' | 'large'
  label: string
  range: string
  accuracy: number // 0-100
  occurrences: number
}

export function findWeakIntervals(): WeakInterval[] {
  const entries = exerciseHistory().filter((e) => e.type === 'interval-trainer')
  if (entries.length === 0) return []

  // The interval-trainer groups intervals into size categories.
  // Available: smallIntervalAvg (≤4 semitones), mediumIntervalAvg (5-8), largeIntervalAvg (>8)
  let smallTotal = 0
  let smallCount = 0
  let mediumTotal = 0
  let mediumCount = 0
  let largeTotal = 0
  let largeCount = 0

  for (const entry of entries) {
    const smallAvg = entry.metrics.smallIntervalAvg
    const mediumAvg = entry.metrics.mediumIntervalAvg
    const largeAvg = entry.metrics.largeIntervalAvg

    if (smallAvg != null && smallAvg > 0) {
      smallTotal += smallAvg
      smallCount++
    }
    if (mediumAvg != null && mediumAvg > 0) {
      mediumTotal += mediumAvg
      mediumCount++
    }
    if (largeAvg != null && largeAvg > 0) {
      largeTotal += largeAvg
      largeCount++
    }
  }

  const intervals: {
    category: WeakInterval['category']
    label: string
    range: string
    accuracy: number
    occurrences: number
  }[] = [
    {
      category: 'small',
      label: 'Small Intervals',
      range: '≤4 semitones (m3, M3, P4)',
      accuracy: smallCount > 0 ? Math.round(smallTotal / smallCount) : 0,
      occurrences: smallCount,
    },
    {
      category: 'medium',
      label: 'Medium Intervals',
      range: '5-8 semitones (P5, m6, M6)',
      accuracy: mediumCount > 0 ? Math.round(mediumTotal / mediumCount) : 0,
      occurrences: mediumCount,
    },
    {
      category: 'large',
      label: 'Large Intervals',
      range: '>8 semitones (m7, M7, octave)',
      accuracy: largeCount > 0 ? Math.round(largeTotal / largeCount) : 0,
      occurrences: largeCount,
    },
  ]

  return intervals
    .filter((i) => i.occurrences > 0 && i.accuracy < WEAK_INTERVAL_THRESHOLD)
    .sort((a, b) => a.accuracy - b.accuracy)
}

// ── Full Report ────────────────────────────────────────────────

export function generateWeaknessReport(): WeaknessReport {
  return {
    weakExercises: findWeakExercises(),
    weakPitches: findWeakPitches(),
    weakIntervals: findWeakIntervals(),
    generatedAt: Date.now(),
  }
}

/**
 * Check if there are any weaknesses worth reporting.
 * Returns false if no data or everything looks good.
 */
export function hasWeaknesses(): boolean {
  const report = generateWeaknessReport()
  return (
    report.weakExercises.length > 0 ||
    report.weakPitches.length > 0 ||
    report.weakIntervals.length > 0
  )
}
