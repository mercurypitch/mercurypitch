// ============================================================
// Trends Computer — Aggregation utilities for practice data
// ============================================================
//
// Computes weekly/monthly trends, rolling averages, and
// improvement metrics from exercise and session history.
// Shared by all three practice-intelligence features.

import type { ExerciseType } from '@/features/exercises/types'
import { exerciseHistory } from '@/stores/exercise-history-store'
import { getSessionHistory } from '@/stores/practice-session-store'

// ── Types ──────────────────────────────────────────────────────

export interface WeeklyTrend {
  weekStart: string // ISO date string (Monday)
  avgScore: number
  sessionCount: number
  totalNotes: number
}

export interface MonthlyTrend {
  month: string // "YYYY-MM"
  avgScore: number
  sessionCount: number
}

export interface RollingAverage {
  last5: number | null
  last10: number | null
}

export interface PracticeStats {
  totalSessions: number
  bestScore: number
  worstScore: number
  overallAvg: number
  sessionsThisWeek: number
  weeklyTrend: WeeklyTrend[]
  monthlyTrend: MonthlyTrend[]
  rolling: RollingAverage
  improvementRate: number | null // score change per week (from linear regression)
}

export interface PerExerciseStats {
  type: ExerciseType
  totalPlays: number
  bestScore: number
  lastScore: number
  avgScore: number
  trend: 'improving' | 'declining' | 'stable'
}

// ── Helpers ────────────────────────────────────────────────────

function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday start
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

function getMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7)
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

// ── Session Trends ─────────────────────────────────────────────

export function computeWeeklyTrends(weeks = 12): WeeklyTrend[] {
  const sessions = getSessionHistory()
  const byWeek = new Map<string, { scores: number[]; noteCounts: number[] }>()

  for (const s of sessions) {
    const week = getWeekStart(new Date(s.completedAt))
    const entry = byWeek.get(week) ?? { scores: [], noteCounts: [] }
    entry.scores.push(s.score)
    entry.noteCounts.push(s.itemsCompleted)
    byWeek.set(week, entry)
  }

  const trends: WeeklyTrend[] = []
  for (const [weekStart, data] of byWeek) {
    trends.push({
      weekStart,
      avgScore: Math.round(mean(data.scores)),
      sessionCount: data.scores.length,
      totalNotes: data.noteCounts.reduce((a, b) => a + b, 0),
    })
  }

  trends.sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  return trends.slice(-weeks)
}

export function computeMonthlyTrends(months = 12): MonthlyTrend[] {
  const sessions = getSessionHistory()
  const byMonth = new Map<string, number[]>()

  for (const s of sessions) {
    const month = getMonthKey(new Date(s.completedAt))
    const scores = byMonth.get(month) ?? []
    scores.push(s.score)
    byMonth.set(month, scores)
  }

  const trends: MonthlyTrend[] = []
  for (const [month, scores] of byMonth) {
    trends.push({
      month,
      avgScore: Math.round(mean(scores)),
      sessionCount: scores.length,
    })
  }

  trends.sort((a, b) => a.month.localeCompare(b.month))
  return trends.slice(-months)
}

// ── Rolling Averages ───────────────────────────────────────────

export function computeRollingAverage(sessionCount = 10): RollingAverage {
  const sessions = getSessionHistory()
  const scores = sessions.slice(0, sessionCount).map((s) => s.score)

  return {
    last5: scores.length >= 5 ? Math.round(mean(scores.slice(0, 5))) : null,
    last10: scores.length >= 10 ? Math.round(mean(scores.slice(0, 10))) : null,
  }
}

// ── Improvement Rate (linear regression slope) ─────────────────

export function computeImprovementRate(weeks = 8): number | null {
  const weekly = computeWeeklyTrends(weeks)
  if (weekly.length < 2) return null

  // Simple linear regression: score = slope * weekIndex + intercept
  const n = weekly.length
  const xMean = (n - 1) / 2
  const yMean = mean(weekly.map((w) => w.avgScore))

  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i++) {
    const dx = i - xMean
    const dy = weekly[i].avgScore - yMean
    numerator += dx * dy
    denominator += dx * dx
  }

  if (denominator === 0) return null
  return Math.round((numerator / denominator) * 100) / 100 // score change per week
}

// ── Overall Stats ──────────────────────────────────────────────

export function computePracticeStats(): PracticeStats {
  const sessions = getSessionHistory()
  const scores = sessions.map((s) => s.score)

  const now = new Date()
  const weekStart = getWeekStart(now)
  const sessionsThisWeek = sessions.filter(
    (s) => getWeekStart(new Date(s.completedAt)) === weekStart,
  ).length

  return {
    totalSessions: sessions.length,
    bestScore: scores.length > 0 ? Math.max(...scores) : 0,
    worstScore: scores.length > 0 ? Math.min(...scores) : 0,
    overallAvg: Math.round(mean(scores)),
    sessionsThisWeek,
    weeklyTrend: computeWeeklyTrends(),
    monthlyTrend: computeMonthlyTrends(),
    rolling: computeRollingAverage(),
    improvementRate: computeImprovementRate(),
  }
}

// ── Per-Exercise Stats ─────────────────────────────────────────

export function computePerExerciseStats(): PerExerciseStats[] {
  const allHistory = exerciseHistory()
  const byType = new Map<ExerciseType, number[]>()

  for (const entry of allHistory) {
    const scores = byType.get(entry.type) ?? []
    scores.push(entry.score)
    byType.set(entry.type, scores)
  }

  const results: PerExerciseStats[] = []
  for (const [type, scores] of byType) {
    const recent = scores.slice(0, 5)
    const older = scores.slice(5, 10)

    const recentAvg = mean(recent)
    const olderAvg = older.length > 0 ? mean(older) : recentAvg

    let trend: PerExerciseStats['trend'] = 'stable'
    if (older.length > 0) {
      if (recentAvg > olderAvg + 5) trend = 'improving'
      else if (recentAvg < olderAvg - 5) trend = 'declining'
    }

    results.push({
      type,
      totalPlays: scores.length,
      bestScore: Math.max(...scores),
      lastScore: scores[0],
      avgScore: Math.round(mean(scores)),
      trend,
    })
  }

  return results.sort((a, b) => a.avgScore - b.avgScore)
}

// ── Sparkline Data ─────────────────────────────────────────────

export function getRecentScores(count = 20): number[] {
  return getSessionHistory()
    .slice(0, count)
    .map((s) => s.score)
    .reverse()
}
