// ============================================================
// PathOrb — one celestial node of The Ascent
// ============================================================
// A luminous orb wrapped in a 7-segment progress ring. The ring is pure
// CSS: a conic-gradient fill masked to a stroke, with a repeating-conic
// overlay carving the seven day-notches. States restyle the orb:
// locked (dormant) / available (soft violet) / active (cyan, breathing) /
// complete (radiant gold + crown).

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { DAYS_PER_WEEK } from '@/features/path/path-content'
import type { WeekState } from '@/features/path/path-progress'
import styles from './PathOrb.module.css'

export interface PathOrbProps {
  /** Lit ring segments, 0..7. */
  fill: number
  state: WeekState
  /** Outer diameter in px (ring included). */
  size?: number
  /** Show the n/7 fraction inside the orb. */
  showFraction?: boolean
}

export const PathOrb: Component<PathOrbProps> = (props) => {
  const size = () => props.size ?? 96
  const stateClass = () =>
    props.state === 'complete'
      ? styles.done
      : props.state === 'active'
        ? styles.active
        : props.state === 'available'
          ? styles.avail
          : styles.locked

  return (
    <div
      class={`${styles.wrap} ${stateClass()}`}
      style={{
        width: `${size()}px`,
        height: `${size()}px`,
        '--fill': `${Math.min(DAYS_PER_WEEK, Math.max(0, props.fill)) / DAYS_PER_WEEK}`,
      }}
      role="img"
      aria-label={`Week ${props.state === 'complete' ? 'complete' : `${props.fill} of ${DAYS_PER_WEEK} days`}`}
    >
      <div class={styles.ring} />
      <div class={styles.gaps} />
      <div class={styles.orb} />
      <Show when={props.showFraction !== false}>
        <div class={styles.frac}>
          {props.state === 'complete' ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M4.5 12.5l5 5 10-11" />
            </svg>
          ) : (
            `${props.fill}/${DAYS_PER_WEEK}`
          )}
        </div>
      </Show>
      <Show when={props.state === 'complete'}>
        <svg
          class={styles.crown}
          width="20"
          height="14"
          viewBox="0 0 20 14"
          aria-hidden="true"
        >
          <path fill="currentColor" d="M2 12h16l1-8-5 4-4-7-4 7-5-4z" />
        </svg>
      </Show>
    </div>
  )
}
