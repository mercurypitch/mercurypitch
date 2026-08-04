// ============================================================
// RoutineRibbon — where you are in today's session, from inside a drill
// ============================================================
//
// Launching a routine segment used to drop the singer into a bare exercise:
// the same screen they get from the exercise list, with nothing saying this
// was step two of four, what came next, or how to get back. The routine
// advanced correctly behind their back and they had to return to Home to
// find out.
//
// The ribbon is derived, not passed in. It reads the routine the auto-advance
// writes to, and decides whether to show itself with `segmentRunsExercise` —
// the same predicate auto-advance uses. That matters: a ribbon fed by launch
// context would claim "step 2 of 4" for a drill opened from the exercise
// list, or miss one that WILL count because the current segment happens to
// run it. What the ribbon says and what the routine does cannot disagree.
//
// It attaches once, on mount, and stays for the life of the exercise — so
// finishing the segment leaves it on screen with the next one offered,
// rather than vanishing at the moment it becomes most useful.

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, onMount, Show } from 'solid-js'
import type { ExerciseType } from '@/features/exercises/types'
import { TAB_HOME } from '@/features/tabs/constants'
import { setActiveTab } from '@/stores/ui-store'
import styles from './RoutineRibbon.module.css'
import { exerciseLabel, segmentVariantLabel } from './segment-labels'
import type { RoutineSegment } from './types'
import { launchRoutineSegment, segmentRunsExercise, useDailyRoutine, } from './use-daily-routine'

export interface RoutineRibbonProps {
  /** The exercise this shell is running. */
  type: ExerciseType
}

/** What a segment calls itself in the chip row. */
function segmentTitle(seg: RoutineSegment): string {
  if (seg.type === 'challenge-prep') return 'Challenge'
  const variant = segmentVariantLabel(seg)
  if (variant !== undefined) return variant
  const exercise = seg.config.exercise
  return exercise === undefined ? 'Practice' : exerciseLabel(exercise)
}

export const RoutineRibbon: Component<RoutineRibbonProps> = (props) => {
  const routine = useDailyRoutine()

  // Attach once. The alternative — recomputing "does the current segment run
  // this exercise" every render — hides the ribbon the instant auto-advance
  // moves on, which is exactly when the singer wants to see what is next.
  const [attached, setAttached] = createSignal(false)
  onMount(() => {
    const current = routine.currentSegment()
    if (current !== null && segmentRunsExercise(current, props.type)) {
      setAttached(true)
    }
  })

  const segments = createMemo(() => routine.template()?.segments ?? [])
  const doneCount = createMemo(() => routine.completedSegments().length)
  /** The segment this exercise is running, or -1 once it has been ticked. */
  const myIndex = createMemo(() => {
    const idx = routine.currentSegmentIndex()
    const seg = segments()[idx]
    return seg !== undefined && segmentRunsExercise(seg, props.type) ? idx : -1
  })
  const nextSegment = createMemo<RoutineSegment | null>(() =>
    myIndex() === -1
      ? (segments()[routine.currentSegmentIndex()] ?? null)
      : null,
  )

  return (
    <Show when={attached() && segments().length > 0}>
      <div class={styles.ribbon}>
        <div class={styles.head}>
          <span class={styles.kicker}>
            {routine.template()?.name ?? "Today's session"}
          </span>
          {/* Where the ROUTINE is, not where this drill is: finishing a
              segment moves the count on, which is what makes "3 of 4" and
              "Next: Scale Runner" tell the same story. */}
          <span class={styles.count}>
            {Math.min(doneCount() + 1, segments().length)} of{' '}
            {segments().length}
          </span>
          <button
            type="button"
            class={styles.link}
            onClick={() => setActiveTab(TAB_HOME)}
          >
            Back to routine
          </button>
        </div>

        <ol class={styles.steps}>
          <For each={segments()}>
            {(seg, index) => (
              <li
                class={styles.step}
                classList={{
                  [styles.done]: routine.completedSegments().includes(index()),
                  [styles.current]: index() === myIndex(),
                }}
                aria-current={index() === myIndex() ? 'step' : undefined}
              >
                <span class={styles.dot} aria-hidden="true" />
                <span class={styles.stepName}>{segmentTitle(seg)}</span>
              </li>
            )}
          </For>
        </ol>

        {/* Only once this segment is behind them: while the drill is still
            the current one, "Next" would mean abandoning it half-done. */}
        <Show when={nextSegment()}>
          {(next) => (
            <button
              type="button"
              class={styles.next}
              onClick={() => launchRoutineSegment(next())}
            >
              Next: {segmentTitle(next())}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </button>
          )}
        </Show>

        <Show when={myIndex() === -1 && nextSegment() === null}>
          <p class={styles.finished}>
            That was the last one — today&rsquo;s session is complete.
          </p>
        </Show>
      </div>
    </Show>
  )
}

export default RoutineRibbon
