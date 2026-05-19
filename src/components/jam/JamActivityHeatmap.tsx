// ── JamActivityHeatmap ─────────────────────────────────────────────────
// Session scoreboard overlay on the exercise canvas.
// Shows each completed exercise as a row with per-user accuracy badges.
// Persisted via sessionStorage in the jam-store.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { jamExerciseHistory } from '@/stores/jam-store'
import styles from './JamActivityHeatmap.module.css'

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

export const JamActivityHeatmap: Component = () => {
  const history = () => jamExerciseHistory()

  return (
    <Show when={history().length > 0}>
      <div class={styles.container}>
        <div class={styles.header}>Session Scores</div>
        <div class={styles.list}>
          <For each={history()}>
            {(entry) => (
              <div class={styles.row}>
                <div class={styles.rowMeta}>
                  <span class={styles.rowName}>{entry.melodyName}</span>
                  <span class={styles.rowTime}>{fmtTime(entry.timestamp)}</span>
                </div>
                <div class={styles.badges}>
                  <For each={entry.scores}>
                    {(score) => {
                      const pct = Math.round(score.accuracy * 100)
                      const letter = score.name.charAt(0).toUpperCase()
                      return (
                        <div
                          class={styles.badge}
                          style={{
                            'border-color': score.color,
                            'box-shadow': `0 0 6px ${score.color}44`,
                          }}
                          title={`${score.name}: ${pct}%`}
                        >
                          <span
                            class={styles.badgeLetter}
                            style={{ color: score.color }}
                          >
                            {letter}
                          </span>
                          <span class={styles.badgePct}>{pct}</span>
                        </div>
                      )
                    }}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  )
}
