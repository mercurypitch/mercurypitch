import type { Component } from 'solid-js'
import { createMemo } from 'solid-js'
import type { NoteResult } from '@/types'

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
      <div class="stat-row" data-band="100">
        <span class="stat-label">Perfect</span>
        <div class="stat-bar-bg">
          <div
            class="stat-bar"
            style={{ width: `${statsPercentages().perfect}%` }}
          />
        </div>
        <span class="stat-count">{statsCounts().perfect}</span>
      </div>
      <div class="stat-row" data-band="90">
        <span class="stat-label">Excellent</span>
        <div class="stat-bar-bg">
          <div
            class="stat-bar"
            style={{ width: `${statsPercentages().excellent}%` }}
          />
        </div>
        <span class="stat-count">{statsCounts().excellent}</span>
      </div>
      <div class="stat-row" data-band="75">
        <span class="stat-label">Good</span>
        <div class="stat-bar-bg">
          <div
            class="stat-bar"
            style={{ width: `${statsPercentages().good}%` }}
          />
        </div>
        <span class="stat-count">{statsCounts().good}</span>
      </div>
      <div class="stat-row" data-band="50">
        <span class="stat-label">Okay</span>
        <div class="stat-bar-bg">
          <div
            class="stat-bar"
            style={{ width: `${statsPercentages().okay}%` }}
          />
        </div>
        <span class="stat-count">{statsCounts().okay}</span>
      </div>
      <div class="stat-row" data-band="0">
        <span class="stat-label">Off</span>
        <div class="stat-bar-bg">
          <div
            class="stat-bar"
            style={{ width: `${statsPercentages().off}%` }}
          />
        </div>
        <span class="stat-count">{statsCounts().off}</span>
      </div>
    </div>
  )
}
