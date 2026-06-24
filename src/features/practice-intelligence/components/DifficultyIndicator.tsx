// ============================================================
// DifficultyIndicator — Visual badge for exercise difficulty
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import type { ExerciseType } from '@/features/exercises/types'
import { difficultyLabel } from '../adaptive-difficulty'
import { getDifficulty } from '../difficulty-store'

interface DifficultyIndicatorProps {
  exerciseType: ExerciseType
}

export const DifficultyIndicator: Component<DifficultyIndicatorProps> = (
  props,
) => {
  const level = createMemo(() => getDifficulty(props.exerciseType))
  const label = createMemo(() => difficultyLabel(level()))

  const colorClass = createMemo(() => {
    const l = level()
    if (l <= 2) return 'diff-beginner'
    if (l <= 4) return 'diff-easy'
    if (l <= 6) return 'diff-medium'
    if (l <= 8) return 'diff-hard'
    return 'diff-expert'
  })

  return (
    <span
      class={`difficulty-indicator ${colorClass()}`}
      title={`Difficulty: ${label()} (${level()}/10)`}
    >
      <Show when={level() !== 5} fallback={null}>
        <span class="difficulty-dot" />
        {label()}
      </Show>
    </span>
  )
}
