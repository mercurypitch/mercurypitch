import type { Component } from 'solid-js'
import { createMemo, For, onMount, Show } from 'solid-js'
import type { PathWeek } from '@/features/path/path-content'
import { DAYS_PER_WEEK } from '@/features/path/path-content'
import type { WeekState } from '@/features/path/path-progress'
import { ringFill, startAscent } from '@/features/path/path-progress'
import { launchRoutineSegment, useDailyRoutine, } from '@/features/routines/use-daily-routine'
import { getZenExercise } from '@/features/zen/exercise-catalog'
import { ascentGuidedAssignmentsForWeek, refreshGuidedContent, } from '@/features/zen/guided-content-store'
import { showNotification } from '@/stores/notifications-store'
import { openSingingZen, startExercise } from '@/stores/ui-store'
import styles from './PathWeekGuide.module.css'

export interface PathWeekGuideProps {
  week: PathWeek
  state: WeekState
  currentOrder: number
  started: boolean
  themeLabel: string
  /** The day the singer tapped, or null for the day they are actually on. */
  selectedDay?: number | null
}

interface WeekZenExercise {
  exerciseId: string
  exerciseVersion?: number
}

export const PathWeekGuide: Component<PathWeekGuideProps> = (props) => {
  const routine = useDailyRoutine()
  const zenExercises = createMemo<readonly WeekZenExercise[]>(() => {
    const published = ascentGuidedAssignmentsForWeek(props.week.order)
    if (published.length > 0) {
      const practiceDay = Math.min(
        DAYS_PER_WEEK,
        ringFill(props.week.order) + 1,
      )
      return published
        .filter(
          (assignment) =>
            assignment.dayNumber === 0 || assignment.dayNumber === practiceDay,
        )
        .map((assignment) => ({
          exerciseId: assignment.exerciseId,
          exerciseVersion: assignment.exerciseVersion,
        }))
    }
    return (props.week.zenExercises ?? []).map((exerciseId) => ({
      exerciseId,
    }))
  })

  onMount(() => {
    void refreshGuidedContent()
  })

  function practiseToday(): void {
    const template = routine.startOrResume()
    const current = routine.currentSegment()
    if (current !== null) {
      launchRoutineSegment(current)
      return
    }

    // Today's routine is already finished, so currentSegment() is null and
    // this button silently did nothing — the singer pressed the day's main
    // CTA and got no response at all. Replay from the top instead.
    //
    // Deliberately NOT routine.reset(): that clears today's completion,
    // and with it the streak credit the singer already earned. An encore
    // should cost them nothing.
    const first = template?.segments?.[0]
    if (first === undefined) return
    showNotification("Today's routine is done — running it again.", 'info')
    launchRoutineSegment(first)
  }

  return (
    <div class={`${styles.card} path-week-card`}>
      <div class={styles.kicker}>
        Week {props.week.order} · {props.themeLabel}
        <Show when={props.state === 'active'}>
          {' '}
          {/* ringFill is the count of days COMPLETED, so this read
              "Day 2 of 7" while day 3 was selected — it was never the
              day being shown. Show the tapped day; fall back to the next
              one to do, which is completed + 1. */}
          · Day{' '}
          {props.selectedDay ??
            Math.min(DAYS_PER_WEEK, ringFill(props.week.order) + 1)}{' '}
          of {DAYS_PER_WEEK}
        </Show>
      </div>
      <h3 class={styles.cardTitle}>{props.week.title}</h3>

      {/* No direction in the locked line below: the card is shared by both
          path views, and they run opposite ways — the plain view's day rail
          reads left to right, the Ascent climbs bottom to top. "One at a
          time" is the rule; which way the row points is decoration, and it
          was wrong on whichever view you were not looking at. */}
      <Show
        when={props.state !== 'locked'}
        fallback={
          <p class={styles.focus}>
            Unlocks after Week {props.week.order - 1}. One day opens at a time,
            each as your practice goal is met.
          </p>
        }
      >
        <p class={styles.focus}>{props.week.focus}</p>

        <Show when={props.week.coachNote !== undefined}>
          <p class={styles.coachNote}>
            <svg
              class={styles.coachQuote}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M7 7h4v4c0 3-1.6 5-4.5 6l-.5-1.4C7.7 14.9 8.5 14 8.5 12H7V7Zm7 0h4v4c0 3-1.6 5-4.5 6l-.5-1.4c1.7-.7 2.5-1.6 2.5-3.6H14V7Z" />
            </svg>
            {props.week.coachNote}
          </p>
        </Show>

        <ul class={styles.goals}>
          <For each={props.week.goals}>{(goal) => <li>{goal}</li>}</For>
        </ul>

        <Show when={props.state === 'active'}>
          <div class={styles.minibar}>
            <div class={styles.miniTrack}>
              <div
                class={styles.miniFill}
                style={{
                  width: `${(ringFill(props.week.order) / DAYS_PER_WEEK) * 100}%`,
                }}
              />
            </div>
            <span class={styles.miniText}>
              {ringFill(props.week.order)} / {DAYS_PER_WEEK} days
            </span>
          </div>
        </Show>

        <div class={styles.chips}>
          <For each={props.week.exercises}>
            {(exercise) => (
              <button
                type="button"
                class={styles.chip}
                onClick={() => startExercise(exercise)}
                title={`Practise ${exercise} now`}
              >
                {exercise}
              </button>
            )}
          </For>
          <For each={zenExercises()}>
            {(exercise) => (
              <button
                type="button"
                class={`${styles.chip} ${styles.zenChip}`}
                onClick={() =>
                  openSingingZen({
                    mode: 'exercise',
                    exerciseId: exercise.exerciseId,
                    ...(exercise.exerciseVersion === undefined
                      ? {}
                      : { exerciseVersion: exercise.exerciseVersion }),
                    source: 'path',
                  })
                }
                title={`Open ${
                  getZenExercise(exercise.exerciseId, exercise.exerciseVersion)
                    ?.title ?? 'guided pattern'
                } in Zen practice`}
              >
                Zen ·{' '}
                {getZenExercise(exercise.exerciseId, exercise.exerciseVersion)
                  ?.title ?? exercise.exerciseId}
              </button>
            )}
          </For>
        </div>

        <Show when={!props.started}>
          <button
            type="button"
            class={`${styles.cta} path-cta`}
            onClick={() => startAscent()}
          >
            Begin The Ascent
          </button>
        </Show>
        <Show when={props.started && props.state === 'active'}>
          <button
            type="button"
            class={`${styles.cta} path-cta`}
            onClick={practiseToday}
          >
            {routine.isComplete() ? 'Practise again · ~' : 'Practise today · ~'}
            {Math.max(1, Math.round(routine.totalDurationSec() / 60) || 8)} min
          </button>
        </Show>
        <Show when={props.started && props.state === 'available'}>
          <p class={styles.replayNote}>
            Preview this week through any drill above. Your daily progress
            continues on Week {props.currentOrder}.
          </p>
        </Show>
        <Show when={props.started && props.state === 'complete'}>
          <p class={styles.replayNote}>
            Complete. These drills stay open whenever you want to revisit them.
          </p>
        </Show>

        <Show when={props.week.resources.length > 0}>
          <div class={styles.resources}>
            <div class={styles.resHead}>Go deeper</div>
            <For each={props.week.resources}>
              {(resource) => (
                <a
                  class={styles.resLink}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <b>{resource.title}</b>
                  <span>
                    {resource.author}
                    {resource.minutes !== undefined
                      ? ` · ${resource.minutes} min`
                      : ''}
                  </span>
                </a>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  )
}

export default PathWeekGuide
