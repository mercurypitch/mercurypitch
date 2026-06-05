import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'

export interface CelebrationData {
  score: number
  exerciseType: string
  metrics: Record<string, number>
  bestWindow?: { startMs: number; endMs: number; score: number }
}

interface SessionCelebrationProps {
  data: CelebrationData | null
  onClose: () => void
}

function scoreClass(score: number): string {
  if (score >= 80) return 'celebration-score-high'
  if (score >= 50) return 'celebration-score-mid'
  return 'celebration-score-low'
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Outstanding!'
  if (score >= 80) return 'Great job!'
  if (score >= 65) return 'Nice work!'
  if (score >= 50) return 'Keep practicing!'
  return 'Keep at it!'
}

function metricLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^[a-z]/, (s) => s.toUpperCase())
    .trim()
}

export const SessionCelebration: Component<SessionCelebrationProps> = (
  props,
) => {
  return (
    <Show when={props.data}>
      <div class="celebration-backdrop" onClick={props.onClose}>
        <div class="celebration-modal" onClick={(e) => e.stopPropagation()}>
          <button class="celebration-close" onClick={props.onClose}>
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="currentColor"
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              />
            </svg>
          </button>

          <div class="celebration-content">
            <div class={`celebration-score ${scoreClass(props.data!.score)}`}>
              <span class="celebration-score-value">{props.data!.score}</span>
              <span class="celebration-score-unit">%</span>
            </div>

            <div class="celebration-label">{scoreLabel(props.data!.score)}</div>

            <Show when={props.data!.bestWindow}>
              <div class="celebration-best-moment">
                Best moment: {props.data!.bestWindow!.score}% (
                {(
                  (props.data!.bestWindow!.endMs -
                    props.data!.bestWindow!.startMs) /
                  1000
                ).toFixed(1)}
                s window)
              </div>
            </Show>

            <div class="celebration-metrics">
              <For each={Object.entries(props.data!.metrics)}>{([key, val]) => (
                <div class="celebration-metric">
                  <span class="celebration-metric-label">
                    {metricLabel(key)}
                  </span>
                  <span class="celebration-metric-value">
                    {typeof val === 'number' ? Math.round(val) : val}
                  </span>
                </div>
              )}</For>
            </div>

            <button class="celebration-btn" onClick={props.onClose}>
              Continue
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}
