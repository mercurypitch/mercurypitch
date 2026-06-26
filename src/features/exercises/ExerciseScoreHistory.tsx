// ============================================================
// ExerciseScoreHistory — recent scores chip (canvas corner)
// ============================================================
//
// Replaces the celebration modal + result overlay: the last few scores for
// the current exercise sit unobtrusively in the corner of the panel, updating
// as soon as a run finishes. The most recent is highlighted.

import type { Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { exerciseHistory, getExerciseStats, } from '@/stores/exercise-history-store'
import type { ExerciseType } from './types'

const RECENT_COUNT = 3

const scoreTier = (s: number): string =>
  s >= 80 ? 'good' : s >= 50 ? 'ok' : 'poor'

export const ExerciseScoreHistory: Component<{ type: ExerciseType }> = (
  props,
) => {
  // history() is most-recent-first; take this exercise's latest few.
  const recent = createMemo(() =>
    exerciseHistory()
      .filter((e) => e.type === props.type)
      .slice(0, RECENT_COUNT),
  )
  const best = createMemo(() => getExerciseStats(props.type).bestScore)

  return (
    <Show when={recent().length > 0}>
      <div class="exercise-score-history" aria-label="Your recent scores">
        <span class="exercise-score-history-title">Recent</span>
        <div class="exercise-score-history-scores">
          <For each={recent()}>
            {(entry, i) => (
              <span
                class={`exercise-score-chip exercise-score-chip-${scoreTier(entry.score)}`}
                classList={{ latest: i() === 0 }}
              >
                {entry.score}%
              </span>
            )}
          </For>
        </div>
        <span class="exercise-score-history-best">Best {best()}%</span>
      </div>
    </Show>
  )
}
