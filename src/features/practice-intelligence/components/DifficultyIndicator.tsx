// ============================================================
// DifficultyIndicator — Visual badge for exercise difficulty
// ============================================================

import type { Component } from 'solid-js'
import piStyles from '@/features/practice-intelligence/components/PracticeIntelligence.module.css'
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
    if (l <= 2) return piStyles.diffBeginner
    if (l <= 4) return piStyles.diffEasy
    if (l <= 6) return piStyles.diffMedium
    if (l <= 8) return piStyles.diffHard
    return piStyles.diffExpert
  })

  return (
    <span
      class={`${piStyles.difficultyIndicator} ${colorClass()}`}
      title={`Difficulty: ${label()} (${level()}/10)`}
    >
      <Show when={level() !== 5} fallback={null}>
        <span class={piStyles.difficultyDot} />
        {label()}
      </Show>
    </span>
  )
}
