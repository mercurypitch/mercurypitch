// ============================================================
// Adventure guidance — derives and presents the next useful route instruction.
// ============================================================

import { createMemo, Show } from 'solid-js'
import type { GameSnapshot, LevelDefinition } from '../contracts'
import { getRequiredRouteBreakableIds } from '../core/progress'
import styles from './GlassAdventure.module.css'

export interface AdventureProgressGuidance {
  kind: 'exit' | 'locked' | 'next'
  heading: string
  detail: string
}

interface AdventureGuidanceProps {
  level: LevelDefinition
  snapshot: GameSnapshot
  visible: boolean
}

export function deriveAdventureProgressGuidance(
  level: LevelDefinition,
  snapshot: GameSnapshot,
  requiredRouteIds: readonly string[] = getRequiredRouteBreakableIds(level),
): AdventureProgressGuidance | undefined {
  const next = level.breakables.find(
    (item) => item.id === snapshot.nextRequiredBreakableId,
  )
  const locked = level.breakables.find(
    (item) => item.id === snapshot.nearbyLockedBreakableId,
  )
  if (locked !== undefined) {
    const directDependency = locked.requiresCompleted
      ?.filter((id) => !snapshot.completedBreakableIds.includes(id))
      .map((id) => level.breakables.find((item) => item.id === id))
      .find((item) => item !== undefined)
    const dependency = next ?? directDependency
    return {
      kind: 'locked',
      heading: `${locked.label} is still sealed.`,
      detail:
        dependency === undefined
          ? 'Open the earlier required exhibit first.'
          : `Sing to ${dependency.label.replace(/^The /, 'the ')} first.`,
    }
  }
  if (snapshot.nearLockedExit === true) {
    const remaining = requiredRouteIds.filter(
      (id) => !snapshot.completedBreakableIds.includes(id),
    ).length
    return {
      kind: 'exit',
      heading: 'Exit sealed.',
      detail:
        next === undefined
          ? `${remaining} required ${remaining === 1 ? 'exhibit remains' : 'exhibits remain'}.`
          : `${remaining} ${remaining === 1 ? 'exhibit remains' : 'exhibits remain'}. Next: ${next.label}.`,
    }
  }
  if (next === undefined || snapshot.nearbyBreakableId !== null)
    return undefined
  return {
    kind: 'next',
    heading: `Next: ${next.label}.`,
    detail: 'Follow its glowing circle, then tap Sing.',
  }
}

export function AdventureGuidance(props: AdventureGuidanceProps) {
  const requiredRouteIds = createMemo(() =>
    getRequiredRouteBreakableIds(props.level),
  )
  const guidance = createMemo(() =>
    deriveAdventureProgressGuidance(
      props.level,
      props.snapshot,
      requiredRouteIds(),
    ),
  )
  return (
    <Show when={props.visible && guidance()}>
      {(current) => (
        <p
          class={styles.progressGuidance}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid="glass-progress-guidance"
          data-guidance-kind={current().kind}
        >
          <strong>{current().heading}</strong> {current().detail}
        </p>
      )}
    </Show>
  )
}
