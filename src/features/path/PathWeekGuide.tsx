import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import type { PathWeek } from '@/features/path/path-content'
import { DAYS_PER_WEEK } from '@/features/path/path-content'
import type { WeekState } from '@/features/path/path-progress'
import { ringFill, startAscent } from '@/features/path/path-progress'
import { launchRoutineSegment, useDailyRoutine, } from '@/features/routines/use-daily-routine'
import { getZenExercise } from '@/features/zen/exercise-catalog'
import { openSingingZen, startExercise } from '@/stores/ui-store'
import styles from './PathWeekGuide.module.css'

export interface PathWeekGuideProps {
  week: PathWeek
  state: WeekState
  currentOrder: number
  started: boolean
  themeLabel: string
}

export const PathWeekGuide: Component<PathWeekGuideProps> = (props) => {
  const routine = useDailyRoutine()

  function practiseToday(): void {
    routine.startOrResume()
    const current = routine.currentSegment()
    if (current !== null) launchRoutineSegment(current)
  }

  return (
    <div class={`${styles.card} path-week-card`}>
      <div class={styles.kicker}>
        Week {props.week.order} · {props.themeLabel}
        <Show when={props.state === 'active'}>
          {' '}
          · Day {ringFill(props.week.order)} of {DAYS_PER_WEEK}
        </Show>
      </div>
      <h3 class={styles.cardTitle}>{props.week.title}</h3>

      <Show
        when={props.state !== 'locked'}
        fallback={
          <p class={styles.focus}>
            Unlocks after Week {props.week.order - 1}. Each day opens from left
            to right as your practice goal is met.
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
          <For each={props.week.zenExercises ?? []}>
            {(exerciseId) => (
              <button
                type="button"
                class={`${styles.chip} ${styles.zenChip}`}
                onClick={() =>
                  openSingingZen({
                    mode: 'exercise',
                    exerciseId,
                    source: 'path',
                  })
                }
                title={`Open ${getZenExercise(exerciseId)?.title ?? 'guided pattern'} in Zen practice`}
              >
                Zen · {getZenExercise(exerciseId)?.title ?? exerciseId}
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
            Practise today · ~
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
