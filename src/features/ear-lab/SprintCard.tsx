// ============================================================
// SprintCard — today's five minutes, and why.
//
// The card shows the scheduler's reasoning rather than hiding it:
// each drill carries the reason it was picked, so a user can see
// that Stack is here because it is currently their weakest and
// that the choice will move on once it is not. A recommendation
// you can audit is the same promise the Mercury Index makes.
//
// Segments are booked by *finishing the drill*, wherever it was
// started from — the three run engines call markSprintSegmentDone
// themselves. This card therefore never needs to own a runner; it
// points at the drills and reflects what has landed.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createMemo, For, Show } from 'solid-js'
import { findIdentificationDrill, findThresholdDrill } from '@/lib/ear/drills'
import type { SprintSegment } from '@/lib/ear/sprint'
import { SPRINT_REASON_LABEL } from '@/lib/ear/sprint'
import { completeSprint, isSprintComplete, sprintProgress, sprintStreak, todaysSprint, } from '@/stores/ear-lab-store'
import type { EarLabView } from './EarLabDashboard'
import styles from './SprintCard.module.css'

interface SprintCardProps {
  onNavigate: (view: EarLabView) => void
}

/** Drill ids do not all match their view names ('the-grid' → 'grid'). */
const VIEW_FOR_DRILL: Record<string, EarLabView> = {
  hairline: 'hairline',
  home: 'home',
  'the-grid': 'grid',
  leap: 'leap',
  stack: 'stack',
  contour: 'contour',
}

function drillName(drillId: string): string {
  return (
    findThresholdDrill(drillId)?.name ??
    findIdentificationDrill(drillId)?.name ??
    drillId
  )
}

function segmentLength(segment: SprintSegment): string {
  return segment.kind === 'identification'
    ? `${segment.rounds} rounds`
    : `${segment.reversals} turns`
}

export function SprintCard(props: SprintCardProps): JSX.Element {
  const plan = createMemo(() => todaysSprint())
  const done = createMemo(() => new Set(sprintProgress().done))
  const remaining = createMemo(
    () => plan().filter((segment) => !done().has(segment.drillId)).length,
  )
  const streak = createMemo(() => sprintStreak())

  // Closing the day is a consequence of the last segment landing, not
  // a button the user presses — they already did the work.
  createEffect(() => {
    if (plan().length > 0 && remaining() === 0 && !isSprintComplete()) {
      completeSprint()
    }
  })

  return (
    <section class={styles.card} data-tour="ear.sprint">
      <header class={styles.head}>
        <div>
          <h3 class={styles.title}>Today's sprint</h3>
          <p class={styles.sub}>
            <Show
              when={remaining() > 0}
              fallback="Done for today — the column keeps what you earned."
            >
              Three drills, about five minutes. Picked from your own readings.
            </Show>
          </p>
        </div>
        <Show when={streak() > 0}>
          <span class={styles.streak} title="Consecutive days with a sprint">
            {streak()} day{streak() === 1 ? '' : 's'}
          </span>
        </Show>
      </header>

      <ol class={styles.list}>
        <For each={plan()}>
          {(segment) => (
            <li
              class={styles.row}
              classList={{ [styles.rowDone]: done().has(segment.drillId) }}
            >
              <div class={styles.rowMain}>
                <span class={styles.drill}>{drillName(segment.drillId)}</span>
                <span class={styles.reason}>
                  {SPRINT_REASON_LABEL[segment.reason]} ·{' '}
                  {segmentLength(segment)}
                </span>
              </div>
              <Show
                when={!done().has(segment.drillId)}
                fallback={
                  <span class={styles.doneMark} aria-label="Finished">
                    <svg
                      viewBox="0 0 16 16"
                      width="16"
                      height="16"
                      aria-hidden="true"
                    >
                      <path
                        d="M3 8.5l3.2 3.2L13 5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </span>
                }
              >
                <button
                  type="button"
                  class={styles.go}
                  onClick={() => {
                    const view = VIEW_FOR_DRILL[segment.drillId]
                    if (view) props.onNavigate(view)
                  }}
                >
                  Start
                </button>
              </Show>
            </li>
          )}
        </For>
      </ol>
    </section>
  )
}
