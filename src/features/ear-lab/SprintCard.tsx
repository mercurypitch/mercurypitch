// ============================================================
// SprintCard — today's regulation, and why.
//
// The plate shows the scheduler's reasoning rather than hiding it:
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
import { VIEW_FOR_DRILL } from './drill-views'
import { IconCheck, IconSeal } from './ear-icons'
import type { EarLabView } from './EarLabDashboard'
import styles from './SprintCard.module.css'

interface SprintCardProps {
  /** In the rack's Today panel: the bench's copy keeps the tour hook. */
  rack?: boolean
  onNavigate: (view: EarLabView) => void
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
    <section
      class={styles.card}
      data-tour={props.rack === true ? undefined : 'ear.sprint'}
      aria-label="Today's regulation"
    >
      <header class={styles.head}>
        <span class={styles.title}>Today's regulation</span>
        <Show when={streak() > 0}>
          <span class={styles.seal} title="Consecutive days with a sprint">
            <IconSeal size={12} />
            Day {streak()}
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
              <span class={styles.rowMain}>
                <span class={styles.drill}>{drillName(segment.drillId)}</span>
                <span class={styles.reason}>
                  {SPRINT_REASON_LABEL[segment.reason]} ·{' '}
                  {segmentLength(segment)}
                </span>
              </span>
              <Show
                when={!done().has(segment.drillId)}
                fallback={
                  <span class={styles.doneMark} aria-label="Finished">
                    <IconCheck size={14} />
                  </span>
                }
              >
                <button
                  type="button"
                  class={styles.go}
                  data-drill={segment.drillId}
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

      <p class={styles.note}>
        <Show
          when={remaining() > 0}
          fallback="Done for today — the glass keeps what you earned."
        >
          Two slots go to what is neediest, the third rotates. Finish a drill
          anywhere in the Lab and it ticks here.
        </Show>
      </p>
    </section>
  )
}
