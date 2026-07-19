// ============================================================
// PathPage — The Ascent: the guided learning path
// ============================================================
// A winding trail of celestial week-orbs on a cosmic ground. One orb = one
// week; its 7-segment ring lights once per day the daily practice goal is
// met (the same signal that keeps the streak). Tapping a node opens its
// week card — the "guidebook": focus, goals, bound drills, and the
// Practise-today launcher. The path is a spine, never a cage: completed
// weeks stay replayable and freeform practice always counts.

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import type { PathWeek } from '@/features/path/path-content'
import { DAYS_PER_WEEK } from '@/features/path/path-content'
import { ASCENT_WEEKS } from '@/features/path/path-content'
import type { WeekState } from '@/features/path/path-progress'
import { pathComplete, pathProgress, ringFill, startAscent, weekState, } from '@/features/path/path-progress'
import { PathOrb } from '@/features/path/PathOrb'
import { launchRoutineSegment, useDailyRoutine, } from '@/features/routines/use-daily-routine'
import { startExercise } from '@/stores/ui-store'
import styles from './PathPage.module.css'

const THEME_LABEL: Record<PathWeek['theme'], string> = {
  foundations: 'Foundations',
  breath: 'Breath',
  range: 'Range',
  ear: 'Ear',
  agility: 'Agility',
  tone: 'Tone',
  recovery: 'Recovery',
}

const PathPage: Component = () => {
  const routine = useDailyRoutine()
  // The expanded node: defaults to the week that needs attention.
  const [expanded, setExpanded] = createSignal<number | null>(null)

  const currentOrder = createMemo(
    () => pathProgress()?.currentWeek ?? 1, // week 1 is the door before starting
  )
  const openOrder = createMemo(() => expanded() ?? currentOrder())
  const started = createMemo(() => pathProgress() !== null)
  const finished = createMemo(() => pathComplete())

  const totalDays = createMemo(() => {
    const p = pathProgress()
    if (p === null) return 0
    return Object.values(p.weekDays).reduce((sum, d) => sum + d.length, 0)
  })

  /** Start (or resume) today's themed session from the week card. */
  function practiseToday(): void {
    routine.startOrResume()
    const current = routine.currentSegment()
    if (current !== null) launchRoutineSegment(current)
  }

  const stateLabel = (state: WeekState, order: number): string => {
    if (state === 'complete') return 'Complete'
    if (state === 'active') return `Day ${ringFill(order)} of ${DAYS_PER_WEEK}`
    if (state === 'available') return 'Ready to begin'
    return 'Locked'
  }

  return (
    <div class={`${styles.page} path-trail`}>
      <div class={styles.cosmos} aria-hidden="true" />

      <header class={styles.hero}>
        <div class={styles.eyebrow}>MercuryPitch · Guided Path</div>
        <h1 class={styles.title}>
          The <em>Ascent</em>
        </h1>
        <p class={styles.tagline}>
          Seven weeks through the craft of singing — one luminous week at a
          time. Practise ~5 minutes a day and watch each orb fill.
        </p>
        <Show when={started() && !finished()}>
          <p class={styles.progressLine}>
            Week {currentOrder()} of {ASCENT_WEEKS.length} · {totalDays()}{' '}
            practice {totalDays() === 1 ? 'day' : 'days'} so far
          </p>
        </Show>
      </header>

      <Show when={finished()}>
        <div class={`${styles.graduation} path-graduation`}>
          <h2>The Ascent, complete.</h2>
          <p>
            Seven weeks, every orb radiant. Your voice has climbed — keep it
            aloft with the daily session, or replay any week below.
          </p>
        </div>
      </Show>

      <div class={styles.trail}>
        <div class={styles.spine} aria-hidden="true" />
        <For each={ASCENT_WEEKS}>
          {(week, i) => {
            const state = () => weekState(week.order)
            const isOpen = () => openOrder() === week.order
            const side = () => (i() % 2 === 0 ? styles.left : styles.right)
            return (
              <>
                <div
                  class={`${styles.node} ${side()} ${
                    state() === 'active' || (!started() && week.order === 1)
                      ? 'path-orb-current'
                      : ''
                  }`}
                >
                  <button
                    class={styles.orbBtn}
                    onClick={() => setExpanded(isOpen() ? null : week.order)}
                    aria-expanded={isOpen()}
                    aria-label={`Week ${week.order}: ${week.title} — ${stateLabel(state(), week.order)}`}
                  >
                    <PathOrb
                      fill={ringFill(week.order)}
                      state={state()}
                      size={92}
                    />
                  </button>
                  <div class={styles.label}>
                    <div class={styles.week}>Week {week.order}</div>
                    <div class={styles.name}>{week.title}</div>
                    <div
                      class={`${styles.status} ${
                        state() === 'complete'
                          ? styles.statusDone
                          : state() === 'active'
                            ? styles.statusActive
                            : ''
                      }`}
                    >
                      {THEME_LABEL[week.theme]} ·{' '}
                      {stateLabel(state(), week.order)}
                    </div>
                  </div>
                </div>

                <Show when={isOpen()}>
                  <div class={`${styles.card} path-week-card`}>
                    <div class={styles.kicker}>
                      Week {week.order} · {THEME_LABEL[week.theme]}
                      <Show when={state() === 'active'}>
                        {' '}
                        · Day {ringFill(week.order)} of {DAYS_PER_WEEK}
                      </Show>
                    </div>
                    <h3 class={styles.cardTitle}>{week.title}</h3>

                    <Show
                      when={state() !== 'locked'}
                      fallback={
                        <p class={styles.focus}>
                          Unlocks after Week {week.order - 1} — every orb opens
                          in turn as the one before it fills.
                        </p>
                      }
                    >
                      <p class={styles.focus}>{week.focus}</p>

                      <ul class={styles.goals}>
                        <For each={week.goals}>{(goal) => <li>{goal}</li>}</For>
                      </ul>

                      <Show when={state() === 'active'}>
                        <div class={styles.minibar}>
                          <div class={styles.miniTrack}>
                            <div
                              class={styles.miniFill}
                              style={{
                                width: `${(ringFill(week.order) / DAYS_PER_WEEK) * 100}%`,
                              }}
                            />
                          </div>
                          <span class={styles.miniText}>
                            {ringFill(week.order)} / {DAYS_PER_WEEK} days
                          </span>
                        </div>
                      </Show>

                      <div class={styles.chips}>
                        <For each={week.exercises}>
                          {(ex) => (
                            <button
                              class={styles.chip}
                              onClick={() => startExercise(ex)}
                              title={`Practise ${ex} now`}
                            >
                              {ex}
                            </button>
                          )}
                        </For>
                      </div>

                      <Show
                        when={started()}
                        fallback={
                          <button
                            class={`${styles.cta} path-cta`}
                            onClick={() => startAscent()}
                          >
                            Begin The Ascent
                          </button>
                        }
                      >
                        <Show when={state() !== 'complete'}>
                          <button
                            class={`${styles.cta} path-cta`}
                            onClick={practiseToday}
                          >
                            Practise today · ~
                            {Math.max(
                              1,
                              Math.round(routine.totalDurationSec() / 60) || 8,
                            )}{' '}
                            min
                          </button>
                        </Show>
                        <Show when={state() === 'complete'}>
                          <p class={styles.replayNote}>
                            Complete — the drills above stay open. Revisit any
                            time.
                          </p>
                        </Show>
                      </Show>

                      <Show when={week.resources.length > 0}>
                        <div class={styles.resources}>
                          <div class={styles.resHead}>Go deeper</div>
                          <For each={week.resources}>
                            {(r) => (
                              <a
                                class={styles.resLink}
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <b>{r.title}</b>
                                <span>
                                  {r.author}
                                  {r.minutes !== undefined
                                    ? ` · ${r.minutes} min`
                                    : ''}
                                </span>
                              </a>
                            )}
                          </For>
                        </div>
                      </Show>
                    </Show>
                  </div>
                </Show>
              </>
            )
          }}
        </For>
      </div>

      <footer class={styles.foot}>
        Any practice that meets your daily goal lights a segment — freeform
        singing counts too. Missing a day never empties a ring.
      </footer>
    </div>
  )
}

export default PathPage
