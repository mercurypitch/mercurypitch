// ============================================================
// PracticeSummaryCard — Enhanced post-run score overlay
// ============================================================
//
// Replaces the inline #score-card with a richer summary that
// includes sparkline trends, weekly comparisons, and practice
// improvement insights.

import type { Component } from 'solid-js'
import piStyles from '@/features/practice-intelligence/components/PracticeIntelligence.module.css'
import { createMemo, For, Show } from 'solid-js'
import type { ExerciseType } from '@/features/exercises/types'
import { EXERCISE_LONG_NOTE } from '@/features/exercises/types'
import type { NoteResult } from '@/types'
import { computeImprovementRate, computePracticeStats, getRecentScores, } from '../trends-computer'
import { generateWeaknessReport } from '../weakness-analyzer'
import { SparklineChart } from './SparklineChart'

interface PracticeSummaryCardProps {
  score: number
  noteCount: number
  avgCents: number
  noteResults: NoteResult[]
  onTryAgain?: () => void
  onClose?: () => void
  onStartDrill?: (exerciseType: ExerciseType) => void
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Pitch Perfect!'
  if (score >= 80) return 'Excellent!'
  if (score >= 65) return 'Good!'
  if (score >= 50) return 'Okay!'
  return 'Needs Work'
}

function scoreGradeClass(score: number): string {
  if (score >= 90) return 'grade-perfect'
  if (score >= 80) return 'grade-excellent'
  if (score >= 65) return 'grade-good'
  if (score >= 50) return 'grade-okay'
  return 'grade-needs-work'
}

function ratingCounts(noteResults: NoteResult[]) {
  const counts = { perfect: 0, excellent: 0, good: 0, okay: 0, off: 0 }
  for (const r of noteResults) {
    if (counts[r.rating] !== undefined) counts[r.rating]++
  }
  return counts
}

export const PracticeSummaryCard: Component<PracticeSummaryCardProps> = (
  props,
) => {
  const recentScores = createMemo(() => getRecentScores(20))
  const stats = createMemo(() => computePracticeStats())
  const improvement = createMemo(() => computeImprovementRate())
  const counts = createMemo(() => ratingCounts(props.noteResults))

  const weaknesses = createMemo(() => {
    const report = generateWeaknessReport()
    return report.weakPitches.slice(0, 3)
  })

  return (
    <div id="score-card" class="practice-summary-card">
      {/* Sparkline */}
      <Show when={recentScores().length >= 2}>
        <div class={piStyles.summarySparkline}>
          <SparklineChart data={recentScores()} width={200} height={40} />
        </div>
      </Show>

      {/* Grade */}
      <h2 id="score-title">Run Complete!</h2>
      <div id="score-grade" class={scoreGradeClass(props.score)}>
        {scoreLabel(props.score)}
      </div>
      <div id="score-pct">{props.score}%</div>
      <div id="score-detail">
        {props.noteCount} notes · {props.avgCents.toFixed(1)}¢ avg
      </div>

      {/* Rating breakdown */}
      <div id="score-stats">
        <div class="score-stat-perfect">
          <div class="score-stat-value">{counts().perfect}</div>
          <div class="score-stat-label">Perfect</div>
        </div>
        <div class="score-stat-excellent">
          <div class="score-stat-value">{counts().excellent}</div>
          <div class="score-stat-label">Excellent</div>
        </div>
        <div class="score-stat-good">
          <div class="score-stat-value">{counts().good}</div>
          <div class="score-stat-label">Good</div>
        </div>
        <div class="score-stat-okay">
          <div class="score-stat-value">{counts().okay}</div>
          <div class="score-stat-label">Okay</div>
        </div>
        <div class="score-stat-off">
          <div class="score-stat-value">{counts().off}</div>
          <div class="score-stat-label">Off</div>
        </div>
      </div>

      {/* Trends summary */}
      <Show when={stats().totalSessions > 1}>
        <div class={piStyles.summaryTrends}>
          <div class={piStyles.summaryTrendRow}>
            <span class={piStyles.summaryTrendLabel}>This Week</span>
            <span class={piStyles.summaryTrendValue}>
              {stats().sessionsThisWeek} session
              {stats().sessionsThisWeek !== 1 ? 's' : ''}· {stats().overallAvg}%
              avg
            </span>
          </div>
          <Show when={improvement() !== null}>
            <div class={piStyles.summaryTrendRow}>
              <span class={piStyles.summaryTrendLabel}>Trend</span>
              <span
                class={piStyles.summaryTrendValue}
                classList={{
                  [piStyles.trendUp]: improvement()! > 0,
                  [piStyles.trendDown]: improvement()! < 0,
                }}
              >
                {improvement()! > 0 ? '↑' : improvement()! < 0 ? '↓' : '→'}{' '}
                {Math.abs(improvement()!).toFixed(1)} pts/week
              </span>
            </div>
          </Show>
          <Show when={recentScores().length >= 5}>
            <div class={piStyles.summaryTrendRow}>
              <span class={piStyles.summaryTrendLabel}>Last 5 avg</span>
              <span class={piStyles.summaryTrendValue}>
                {stats().rolling.last5}%
              </span>
            </div>
          </Show>
        </div>
      </Show>

      {/* Weak spots */}
      <Show when={weaknesses().length > 0}>
        <div class={piStyles.summaryWeakness}>
          <h4>Watch These Notes</h4>
          <div class={piStyles.summaryWeaknessNotes}>
            <For each={weaknesses()}>
              {(p) => (
                <span
                  class={piStyles.summaryWeaknessBadge}
                  title={`${p.avgDeviation}¢ deviation`}
                >
                  {p.noteName} {p.avgDeviation}¢
                </span>
              )}
            </For>
          </div>
          <button
            class="overlay-btn"
            onClick={() => props.onStartDrill?.(EXERCISE_LONG_NOTE)}
          >
            Practice Weak Notes
          </button>
        </div>
      </Show>

      {/* Actions */}
      <div id="score-actions">
        <button
          class="overlay-btn primary"
          onClick={() => props.onTryAgain?.()}
          aria-label="Try again"
        >
          Try Again
        </button>
        <button
          class="overlay-btn"
          onClick={() => props.onClose?.()}
          aria-label="Close"
        >
          Close
        </button>
      </div>
    </div>
  )
}
