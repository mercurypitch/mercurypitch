import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import type { MascotState } from '@/components/Mascot'
import { Mascot } from '@/components/Mascot'
import { Button } from '@/components/shared/Button'
import styles from './SessionCelebration.module.css'

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
  if (score >= 80) return styles.scoreHigh
  if (score >= 50) return styles.scoreMid
  return styles.scoreLow
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Outstanding!'
  if (score >= 80) return 'Great job!'
  if (score >= 65) return 'Nice work!'
  if (score >= 50) return 'Keep practicing!'
  return 'Keep at it!'
}

// Merc mirrors the result — celebrate when it went well, cheer you on when it didn't.
function celebrationMascotState(score: number): MascotState {
  if (score >= 80) return 'celebrate'
  if (score >= 50) return 'idle'
  return 'encouraging'
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
      <div class={styles.backdrop} onClick={() => props.onClose?.()}>
        <div
          class={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="celebration-label-text"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            class={styles.close}
            aria-label="Close results"
            onClick={() => props.onClose?.()}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="currentColor"
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              />
            </svg>
          </button>

          <div class={styles.content}>
            <div style={{ display: 'flex', 'justify-content': 'center' }}>
              <Mascot
                state={celebrationMascotState(props.data!.score)}
                size={92}
                title="Merc"
              />
            </div>

            <div class={`${styles.score} ${scoreClass(props.data!.score)}`}>
              <span class={styles.scoreValue}>{props.data!.score}</span>
              <span class={styles.scoreUnit}>%</span>
            </div>

            <div class={styles.label} id="celebration-label-text">
              {scoreLabel(props.data!.score)}
            </div>

            <Show when={props.data!.bestWindow}>
              <div class={styles.bestMoment}>
                Best moment: {props.data!.bestWindow!.score}% (
                {(props.data!.bestWindow!.endMs -
                  props.data!.bestWindow!.startMs) /
                  1000}
                s window)
              </div>
            </Show>

            <div class={styles.metrics}>
              <For each={Object.entries(props.data!.metrics)}>
                {([key, val]) => (
                  <div class={styles.metric}>
                    <span class={styles.metricLabel}>{metricLabel(key)}</span>
                    <span class={styles.metricValue}>
                      {typeof val === 'number' ? Math.round(val) : val}
                    </span>
                  </div>
                )}
              </For>
            </div>

            <Button variant="primary" onClick={() => props.onClose?.()}>
              Continue
            </Button>
          </div>
        </div>
      </div>
    </Show>
  )
}
