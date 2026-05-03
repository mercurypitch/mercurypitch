import type { Component } from 'solid-js'
import { createMemo } from 'solid-js'
import type { NoteResult } from '@/types'
import styles from './StatsBars.module.css'

interface StatsBarsProps {
  noteResults: () => NoteResult[]
}

export const StatsBars: Component<StatsBarsProps> = (props) => {
  const statsCounts = createMemo(() => {
    const results = props.noteResults() ?? []
    return {
      perfect: results.filter((r) => r.rating === 'perfect').length,
      excellent: results.filter((r) => r.rating === 'excellent').length,
      good: results.filter((r) => r.rating === 'good').length,
      okay: results.filter((r) => r.rating === 'okay').length,
      off: results.filter((r) => r.rating === 'off').length,
    }
  })

  const statsPercentages = createMemo(() => {
    const counts = statsCounts()
    const total = Math.max(
      1,
      counts.perfect +
        counts.excellent +
        counts.good +
        counts.okay +
        counts.off,
    )
    return {
      perfect: (counts.perfect / total) * 100,
      excellent: (counts.excellent / total) * 100,
      good: (counts.good / total) * 100,
      okay: (counts.okay / total) * 100,
      off: (counts.off / total) * 100,
    }
  })

  return (
    <div id="stats-bars">
      <div class={styles.statRow} data-band="100">
        <span class={styles.statLabel}>Perfect</span>
        <div class={styles.statBarBg}>
          <div
            class={styles.statBar}
            style={{ width: `${statsPercentages().perfect}%` }}
          />
        </div>
        <span class={styles.statCount}>{statsCounts().perfect}</span>
      </div>
      <div class={styles.statRow} data-band="90">
        <span class={styles.statLabel}>Excellent</span>
        <div class={styles.statBarBg}>
          <div
            class={styles.statBar}
            style={{ width: `${statsPercentages().excellent}%` }}
          />
        </div>
        <span class={styles.statCount}>{statsCounts().excellent}</span>
      </div>
      <div class={styles.statRow} data-band="75">
        <span class={styles.statLabel}>Good</span>
        <div class={styles.statBarBg}>
          <div
            class={styles.statBar}
            style={{ width: `${statsPercentages().good}%` }}
          />
        </div>
        <span class={styles.statCount}>{statsCounts().good}</span>
      </div>
      <div class={styles.statRow} data-band="50">
        <span class={styles.statLabel}>Okay</span>
        <div class={styles.statBarBg}>
          <div
            class={styles.statBar}
            style={{ width: `${statsPercentages().okay}%` }}
          />
        </div>
        <span class={styles.statCount}>{statsCounts().okay}</span>
      </div>
      <div class={styles.statRow} data-band="0">
        <span class={styles.statLabel}>Off</span>
        <div class={styles.statBarBg}>
          <div
            class={styles.statBar}
            style={{ width: `${statsPercentages().off}%` }}
          />
        </div>
        <span class={styles.statCount}>{statsCounts().off}</span>
      </div>
    </div>
  )
}
