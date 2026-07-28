// ============================================================
// Dashboard sections — one card per capability tier
//
// Each section renders only when its take can support it. Nothing here
// invents a number: a practice record yields accuracy and range, a note
// analysis yields range/key/coverage, and timbre requires real audio.
// ============================================================

import type { Component, JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { StreakState } from '@/db/services/streak-service'
import type { MobileAnalysisSummary } from '@/lib/mobile-analysis-summary'
import type { AccuracyRating, SessionResult } from '@/types'
import styles from './AnalysisDashboard.module.css'
import type { PracticeMetrics, TrendPoint } from './metrics'
import { buildTrend, centsBiasLabel } from './metrics'

// ── Shared tile ─────────────────────────────────────────────

export const StatTile: Component<{
  label: string
  value: JSX.Element
  detail?: string
  tone?: 'good' | 'warn'
}> = (props) => (
  <div
    class={styles.stat}
    classList={{
      [styles.statGood]: props.tone === 'good',
      [styles.statWarn]: props.tone === 'warn',
    }}
  >
    <span class={styles.statValue}>{props.value}</span>
    <span class={styles.statLabel}>{props.label}</span>
    <Show when={props.detail !== undefined}>
      <span class={styles.statDetail}>{props.detail}</span>
    </Show>
  </div>
)

// ── Practice session (summary tier) ─────────────────────────

const RATING_ORDER: AccuracyRating[] = [
  'perfect',
  'excellent',
  'good',
  'okay',
  'off',
]

export const PracticeOverview: Component<{ metrics: PracticeMetrics }> = (
  props,
) => (
  <section class={styles.card} data-tour="analysis.overview">
    <h3 class={styles.cardTitle}>
      Overview
      <span class={styles.cardNote}>from saved note scores</span>
    </h3>
    <div class={styles.statGrid}>
      <StatTile
        label="Score"
        value={`${props.metrics.score}%`}
        tone={props.metrics.score >= 80 ? 'good' : undefined}
      />
      <StatTile
        label="In tune"
        value={`${props.metrics.inTunePercent}%`}
        detail="within ±25¢"
        tone={props.metrics.inTunePercent >= 75 ? 'good' : undefined}
      />
      <StatTile
        label="Range"
        value={`${props.metrics.lowNote}–${props.metrics.highNote}`}
        detail={`${props.metrics.rangeSemitones} semitones`}
      />
      <StatTile label="Notes" value={props.metrics.noteCount} />
    </div>
  </section>
)

export const TuningCard: Component<{ metrics: PracticeMetrics }> = (props) => {
  const maxCount = createMemo(() =>
    Math.max(1, ...Object.values(props.metrics.ratings)),
  )

  return (
    <section class={styles.card} data-tour="analysis.tuning">
      <h3 class={styles.cardTitle}>Tuning</h3>
      <div class={styles.statGrid} style={{ 'margin-bottom': '1rem' }}>
        <StatTile
          label="Average error"
          value={`${props.metrics.avgAbsCents}¢`}
          detail="mean distance from target"
        />
        <StatTile
          label="Bias"
          value={centsBiasLabel(props.metrics.centsBias)}
          detail={
            Math.abs(props.metrics.centsBias) < 5
              ? 'no consistent drift'
              : 'consistent drift in one direction'
          }
          tone={Math.abs(props.metrics.centsBias) >= 15 ? 'warn' : undefined}
        />
      </div>

      <For each={RATING_ORDER}>
        {(rating) => (
          <div class={styles.ratingRow}>
            <span class={styles.ratingName}>{rating}</span>
            <span class={styles.ratingTrack}>
              <span
                class={styles.ratingFill}
                style={{
                  width: `${(props.metrics.ratings[rating] / maxCount()) * 100}%`,
                }}
              />
            </span>
            <span class={styles.ratingCount}>
              {props.metrics.ratings[rating]}
            </span>
          </div>
        )}
      </For>
    </section>
  )
}

// ── Detected notes (notes tier) ─────────────────────────────

export const NotesOverview: Component<{ summary: MobileAnalysisSummary }> = (
  props,
) => (
  <section class={styles.card} data-tour="analysis.overview">
    <h3 class={styles.cardTitle}>
      Overview
      <span class={styles.cardNote}>from detected notes</span>
    </h3>
    <div class={styles.statGrid}>
      <StatTile
        label="Range"
        value={`${props.summary.lowNote}–${props.summary.highNote}`}
        detail={`${props.summary.rangeSemitones} semitones`}
      />
      <StatTile label="Key" value={props.summary.keyLabel} />
      <StatTile
        label="Voiced"
        value={`${props.summary.coveragePercent}%`}
        detail={`${Math.round(props.summary.voicedSeconds)}s of ${Math.round(
          props.summary.spanSeconds,
        )}s`}
      />
      <StatTile
        label="Notes"
        value={props.summary.cleanedNoteCount}
        detail={`${props.summary.rawNoteCount} before cleanup`}
      />
    </div>
  </section>
)

// ── Trends (across practice sessions) ───────────────────────

/** Build an SVG polyline path for a trend series scaled into a 100×40 box. */
function trendPath(points: TrendPoint[], pick: (p: TrendPoint) => number) {
  if (points.length === 0) return { line: '', area: '' }

  const values = points.map(pick)
  // Scale to the data's own range, not a forced 0 baseline — scores cluster in
  // the 60-95 band and anchoring at zero flattens every trend into a line.
  // A 10% pad keeps the extremes off the edges.
  const high = Math.max(...values)
  const low = Math.min(...values)
  const pad = Math.max(1, (high - low) * 0.1)
  const min = low - pad
  const span = Math.max(1, high + pad - min)

  const coords = points.map((_, i) => ({
    x: points.length === 1 ? 50 : (i / (points.length - 1)) * 100,
    y: 38 - ((values[i] - min) / span) * 34,
  }))

  const line = coords
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x} ${d.y}`)
    .join(' ')
  return { line, area: `${line} L100 40 L0 40 Z` }
}

export const TrendsCard: Component<{
  sessions: SessionResult[]
  streak: StreakState | null
}> = (props) => {
  const points = createMemo(() => buildTrend(props.sessions))
  const path = createMemo(() => trendPath(points(), (p) => p.score))

  const best = createMemo(() => {
    const all = points()
    return all.length === 0 ? 0 : Math.max(...all.map((p) => p.score))
  })

  return (
    <section class={styles.card} data-tour="analysis.trends">
      <h3 class={styles.cardTitle}>Progress</h3>

      <div class={styles.statGrid} style={{ 'margin-bottom': '1rem' }}>
        <StatTile
          label="Current streak"
          value={`${props.streak?.currentStreak ?? 0}d`}
          detail={
            props.streak?.practicedToday === true
              ? 'safe today'
              : 'practise today to keep it'
          }
          tone={props.streak?.practicedToday === true ? 'good' : undefined}
        />
        <StatTile
          label="Best streak"
          value={`${props.streak?.longestStreak ?? 0}d`}
        />
        <StatTile label="Sessions" value={points().length} />
        <StatTile label="Best score" value={`${best()}%`} />
      </div>

      <Show
        when={points().length >= 2}
        fallback={
          <p class={styles.unavailable}>
            One more session and your score trend appears here.
          </p>
        }
      >
        <svg
          class={styles.trendChart}
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          role="img"
          aria-label="Score across recent practice sessions"
        >
          <path class={styles.trendArea} d={path().area} />
          <path class={styles.trendLine} d={path().line} />
        </svg>
        <div class={styles.trendFoot}>
          <span>{new Date(points()[0].completedAt).toLocaleDateString()}</span>
          <span>Score per session</span>
          <span>
            {new Date(
              points()[points().length - 1].completedAt,
            ).toLocaleDateString()}
          </span>
        </div>
      </Show>
    </section>
  )
}
