// ── JamActivityHeatmap ─────────────────────────────────────────────────
// GitHub-contributions-style activity grid rendered over the exercise
// canvas.  Each cell = one completed exercise; colour intensity reflects
// the average accuracy of all participants in that round.
// Empty (grey) cells are padding so the grid always shows a full
// rectangular shape (TOTAL_CELLS slots).

import type { Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { JamExerciseResult } from '@/stores/jam-store'
import { jamExerciseHistory } from '@/stores/jam-store'
import styles from './JamActivityHeatmap.module.css'

// Fixed grid size — keeps the visual stable as sessions accumulate
const TOTAL_CELLS = 7 * 12 // 7 rows x 12 columns

function accuracyLevel(result: JamExerciseResult): number {
  if (result.scores.length === 0) return 0
  const avg =
    result.scores.reduce((sum, s) => sum + s.accuracy, 0) / result.scores.length
  if (avg >= 0.8) return 4
  if (avg >= 0.6) return 3
  if (avg >= 0.4) return 2
  if (avg > 0) return 1
  return 0
}

export const JamActivityHeatmap: Component = () => {
  const history = () => jamExerciseHistory()

  // Build cell data: pad with empties so the grid is always rectangular
  const cells = createMemo(() => {
    const items = history()
    const filled = items.map((r) => ({
      level: accuracyLevel(r),
      title: `${r.melodyName} - ${Math.round(
        (r.scores.reduce((s, sc) => s + sc.accuracy, 0) /
          Math.max(r.scores.length, 1)) *
          100,
      )}%`,
    }))
    // Oldest first so newest appear at the end (bottom-right)
    const reversed = [...filled].reverse()
    const padCount = Math.max(0, TOTAL_CELLS - reversed.length)
    const empty = Array.from({ length: padCount }, () => ({
      level: 0,
      title: '',
    }))
    return [...empty, ...reversed]
  })

  return (
    <Show when={history().length > 0}>
      <div class={styles.container}>
        <div class={styles.header}>Activity</div>
        <div class={styles.grid}>
          <For each={cells()}>
            {(cell) => (
              <div
                class={`${styles.cell} ${styles[`level${cell.level}`]}`}
                title={cell.title}
              />
            )}
          </For>
        </div>

        {/* Legend */}
        <div class={styles.legend}>
          <span class={styles.legendLabel}>Less</span>
          <div class={`${styles.legendCell} ${styles.level0}`} />
          <div class={`${styles.legendCell} ${styles.level1}`} />
          <div class={`${styles.legendCell} ${styles.level2}`} />
          <div class={`${styles.legendCell} ${styles.level3}`} />
          <div class={`${styles.legendCell} ${styles.level4}`} />
          <span class={styles.legendLabel}>More</span>
        </div>
      </div>
    </Show>
  )
}
