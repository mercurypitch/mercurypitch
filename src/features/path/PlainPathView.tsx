import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Show, untrack, } from 'solid-js'
import { ASCENT_WEEKS, DAYS_PER_WEEK, PATH_THEME_LABEL, } from '@/features/path/path-content'
import type { WeekState } from '@/features/path/path-progress'
import { pathComplete, pathProgress, ringFill, weekState, } from '@/features/path/path-progress'
import type { PathDayState } from '@/features/path/path-view'
import { buildPathDayNodes } from '@/features/path/path-view'
import { PathViewToggle } from '@/features/path/PathViewToggle'
import { PathWeekGuide } from '@/features/path/PathWeekGuide'
import styles from './PlainPathView.module.css'

function weekStatus(state: WeekState, order: number): string {
  if (state === 'complete') return 'Complete'
  if (state === 'active') return `${ringFill(order)} of ${DAYS_PER_WEEK} days`
  if (state === 'available') return 'Ready to begin'
  return 'Locked'
}

function nodeStateClass(state: PathDayState): string {
  if (state === 'complete') return styles.nodeComplete
  if (state === 'current') return styles.nodeCurrent
  if (state === 'available') return styles.nodeAvailable
  return styles.nodeLocked
}

function nodeLabel(
  weekOrder: number,
  day: number,
  state: PathDayState,
): string {
  if (state === 'complete') {
    return `Week ${weekOrder}, day ${day}, completed. Open week details`
  }
  if (state === 'current') {
    return `Week ${weekOrder}, day ${day}, current. Open week details`
  }
  if (state === 'available') {
    return `Week ${weekOrder}, day ${day}, ready. Open week details`
  }
  return `Week ${weekOrder}, day ${day}, locked`
}

export const PlainPathView: Component = () => {
  const currentOrder = createMemo(() => pathProgress()?.currentWeek ?? 1)
  const started = createMemo(() => pathProgress() !== null)
  const finished = createMemo(() => pathComplete())
  // Which day's card is open. The day buttons all called
  // setSelectedWeek(week.order) and ignored node.day entirely, so every
  // one of the seven did the same thing and the panel never changed —
  // which is exactly what "clicking on days, they are all the same"
  // describes. null means "whatever day the singer is actually on".
  const [selectedDay, setSelectedDay] = createSignal<number | null>(null)
  const [selectedWeek, setSelectedWeek] = createSignal<number | null>(
    untrack(currentOrder),
  )

  /**
   * Bring the open week's guide into view.
   *
   * selectedWeek already defaults to the week the singer is on, so the
   * panel WAS open on arrival — it just sat below the fold with nothing
   * scrolling to it, which is what "the info goes outside of the screen
   * and it doesn't auto scroll in view" describes. Arriving from Home's
   * "Begin your guided path" now glides to week 1 rather than landing
   * above it.
   *
   * requestAnimationFrame because the panel renders in the same tick the
   * signal changes; measuring before paint scrolls to the wrong place.
   */
  createEffect(() => {
    const order = selectedWeek()
    if (order === null) return
    const reduced = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    requestAnimationFrame(() => {
      document.getElementById(`plain-path-week-${order}`)?.scrollIntoView({
        behavior: reduced === true ? 'auto' : 'smooth',
        block: 'center',
      })
    })
  })

  const totalDays = createMemo(() => {
    const progress = pathProgress()
    if (progress === null) return 0
    return Object.values(progress.weekDays).reduce(
      (sum, days) => sum + days.length,
      0,
    )
  })

  return (
    <div class={styles.page}>
      <div class={styles.viewSwitch}>
        <PathViewToggle />
      </div>

      <div class={styles.hero}>
        <div>
          <p class={styles.eyebrow}>MercuryPitch · Guided Path</p>
          <h1>Your Path</h1>
          <p class={styles.tagline}>
            Seven focused weeks. Each daily goal illuminates the next control
            from left to right.
          </p>
        </div>
        <div class={styles.heroControl}>
          <Show when={started()}>
            <p class={styles.progressSummary}>
              Week {currentOrder()} of {ASCENT_WEEKS.length}
              <span aria-hidden="true"> · </span>
              {totalDays()} practice {totalDays() === 1 ? 'day' : 'days'}
            </p>
          </Show>
        </div>
      </div>

      <Show when={finished()}>
        <div class={styles.graduation}>
          <span class={styles.graduationMark} aria-hidden="true">
            7/7
          </span>
          <div>
            <h2>The Ascent, complete</h2>
            <p>Every week remains open for replay and review.</p>
          </div>
        </div>
      </Show>

      <div class={styles.weekList}>
        <For each={ASCENT_WEEKS}>
          {(week) => {
            const state = () => weekState(week.order)
            const fill = () => ringFill(week.order)
            const nodes = () => buildPathDayNodes(state(), fill())
            const selected = () => selectedWeek() === week.order

            return (
              <section
                class={`${styles.weekBlock} ${selected() ? styles.weekSelected : ''}`}
                data-week={week.order}
              >
                <div
                  class={`${styles.weekRow} ${state() === 'locked' ? styles.weekLocked : ''}`}
                >
                  <button
                    type="button"
                    class={styles.weekSummary}
                    aria-expanded={selected()}
                    aria-controls={`plain-path-week-${week.order}`}
                    onClick={() => {
                      setSelectedWeek(selected() ? null : week.order)
                      // Reopening a week starts on the day the singer is
                      // actually on, not whichever they last poked.
                      setSelectedDay(null)
                    }}
                  >
                    <span class={styles.weekOrder}>
                      <span>Week</span>
                      {String(week.order).padStart(2, '0')}
                    </span>
                    <span class={styles.weekCopy}>
                      <span class={styles.weekTheme}>
                        {PATH_THEME_LABEL[week.theme]}
                      </span>
                      <span class={styles.weekTitle}>{week.title}</span>
                      <span class={styles.weekFocus}>{week.subtitle}</span>
                    </span>
                    <span
                      class={`${styles.weekState} ${styles[`state${state()[0]!.toUpperCase()}${state().slice(1)}`]}`}
                    >
                      {weekStatus(state(), week.order)}
                    </span>
                  </button>

                  <div class={styles.dayScroller}>
                    <div
                      class={styles.dayRail}
                      role="group"
                      aria-label={`Week ${week.order}: seven practice days`}
                    >
                      <For each={nodes()}>
                        {(node) => (
                          <button
                            type="button"
                            class={`${styles.dayNode} ${nodeStateClass(node.state)}`}
                            data-path-day={`${week.order}-${node.day}`}
                            disabled={!node.actionable}
                            aria-current={
                              node.state === 'current' ? 'step' : undefined
                            }
                            aria-label={nodeLabel(
                              week.order,
                              node.day,
                              node.state,
                            )}
                            onClick={() => {
                              setSelectedWeek(week.order)
                              setSelectedDay(node.day)
                            }}
                          >
                            <span class={styles.nodeOrb}>
                              <Show
                                when={node.state === 'complete'}
                                fallback={
                                  <span class={styles.nodeNumber}>
                                    {node.day}
                                  </span>
                                }
                              >
                                <svg
                                  width="17"
                                  height="17"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2.8"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  aria-hidden="true"
                                >
                                  <path d="m5 12 4 4 10-10" />
                                </svg>
                              </Show>
                            </span>
                            <span class={styles.dayCaption}>
                              Day {node.day}
                            </span>
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                </div>

                <Show when={selected()}>
                  <div
                    id={`plain-path-week-${week.order}`}
                    class={styles.weekGuide}
                  >
                    <PathWeekGuide
                      week={week}
                      state={state()}
                      currentOrder={currentOrder()}
                      started={started()}
                      themeLabel={PATH_THEME_LABEL[week.theme]}
                      selectedDay={
                        selectedWeek() === week.order ? selectedDay() : null
                      }
                    />
                  </div>
                </Show>
              </section>
            )
          }}
        </For>
      </div>

      <p class={styles.foot}>
        Completed days stay open. The next day unlocks when your daily practice
        goal is met; missing a day never erases progress.
      </p>
    </div>
  )
}

export default PlainPathView
