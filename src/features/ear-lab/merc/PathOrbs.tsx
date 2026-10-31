// ============================================================
// The Ear Path as a row of orbs, on the bench and on the day's close:
// lit ones teal, the next one ringed in the kit's violet, the one lit
// today haloed. The count beside it says the same in words.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { PathMilestone } from '@/lib/ear/path'
import styles from './bench.module.css'

export function PathOrbs(props: {
  milestones: readonly PathMilestone[]
  /** The milestone the day lit, if it lit one. */
  litToday: string | null
}): JSX.Element {
  const step = () => 336 / Math.max(1, props.milestones.length - 1)
  const next = () =>
    props.milestones.find((milestone) => !milestone.lit)?.id ?? null
  return (
    <svg
      class={styles.orbs}
      width="100%"
      height="34"
      viewBox="0 0 358 34"
      aria-hidden="true"
      data-testid="merc-path-orbs"
    >
      <path d="M11 17h336" class={styles.orbTrack} stroke-width="2" />
      <For each={props.milestones}>
        {(milestone, i) => (
          <>
            <Show
              when={milestone.id === props.litToday}
              fallback={
                <Show when={milestone.lit}>
                  <circle
                    cx={11 + i() * step()}
                    cy="17"
                    r="10"
                    class={styles.orbHalo}
                  />
                </Show>
              }
            >
              <circle
                cx={11 + i() * step()}
                cy="17"
                r="12"
                class={styles.orbToday}
                stroke-width="1.4"
              />
            </Show>
            <circle
              cx={11 + i() * step()}
              cy="17"
              r="7"
              classList={{
                [styles.orb]: !milestone.lit,
                [styles.orbLit]: milestone.lit,
                [styles.orbNext]: milestone.id === next(),
              }}
              stroke-width="1.5"
            />
          </>
        )}
      </For>
    </svg>
  )
}
