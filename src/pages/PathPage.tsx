// ============================================================
// PathPage — The Ascent: the guided learning path
// ============================================================
// A serpentine trail of celestial week-orbs climbing a night sky — week 1
// at the foot, week 7 at the summit, joined by an organic light-trail
// drawn through the orbs' real positions. One orb = one week; its ring
// lights once per day the daily practice goal is met (the streak signal).
// Tapping a node opens its guidebook card. The path is a spine, never a
// cage: completed weeks stay replayable and freeform practice counts.

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import type { PathWeek } from '@/features/path/path-content'
import { ASCENT_WEEKS, DAYS_PER_WEEK } from '@/features/path/path-content'
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

/** Serpentine horizontal offset per week order (multiplies --amp). */
const OFFSETS: Record<number, number> = {
  1: 0.5,
  2: -0.85,
  3: 0.65,
  4: -0.55,
  5: 0.9,
  6: -0.4,
  7: 0.15,
}

/** Weeks rendered summit-first: week 7 at the top, week 1 at the foot. */
const DESCENDING = [...ASCENT_WEEKS].sort((a, b) => b.order - a.order)

const PathPage: Component = () => {
  const routine = useDailyRoutine()
  const [expanded, setExpanded] = createSignal<number | null>(null)
  const [trailPath, setTrailPath] = createSignal('')
  const [trailSize, setTrailSize] = createSignal({ w: 0, h: 0 })

  let trailEl: HTMLDivElement | undefined
  let pageEl: HTMLDivElement | undefined

  const currentOrder = createMemo(() => pathProgress()?.currentWeek ?? 1)
  // Nothing is expanded on load — the trail reads as an uninterrupted climb;
  // tapping an orb opens its guidebook card.
  const openOrder = createMemo(() => expanded())
  const started = createMemo(() => pathProgress() !== null)
  const finished = createMemo(() => pathComplete())

  const totalDays = createMemo(() => {
    const p = pathProgress()
    if (p === null) return 0
    return Object.values(p.weekDays).reduce((sum, d) => sum + d.length, 0)
  })

  /** Redraw the light-trail through the orbs' actual centres. */
  function drawTrail(): void {
    if (!trailEl) return
    const box = trailEl.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) return
    const pts = [...trailEl.querySelectorAll<HTMLElement>('[data-orb-center]')]
      .map((el) => {
        const r = el.getBoundingClientRect()
        return {
          x: r.left + r.width / 2 - box.left,
          y: r.top + r.height / 2 - box.top,
        }
      })
      .sort((a, b) => a.y - b.y)
    if (pts.length < 2) return
    let d = `M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!
      const b = pts[i]!
      const k = (b.y - a.y) * 0.45
      d += ` C ${a.x.toFixed(1)} ${(a.y + k).toFixed(1)}, ${b.x.toFixed(1)} ${(b.y - k).toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
    }
    setTrailPath(d)
    setTrailSize({ w: box.width, h: box.height })
  }

  onMount(() => {
    drawTrail()
    const ro = new ResizeObserver(drawTrail)
    if (trailEl) ro.observe(trailEl)
    onCleanup(() => ro.disconnect())

    // Land the climber at their current orb (week 1 sits at the very foot).
    const target = pageEl?.querySelector('.path-orb-current')
    if (target) {
      const reduce = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
      target.scrollIntoView({
        block: 'center',
        behavior: reduce ? 'auto' : 'smooth',
      })
    }
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

  const stateClass = (state: WeekState): string =>
    state === 'complete'
      ? styles.nameDone
      : state === 'active'
        ? styles.nameActive
        : state === 'available'
          ? styles.nameAvail
          : styles.nameLocked

  return (
    <div class={`${styles.page} path-trail`} ref={pageEl}>
      <div class={styles.cosmos} aria-hidden="true" />
      <div class={styles.summitGlow} aria-hidden="true" />

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

      <div class={styles.trail} ref={trailEl}>
        {/* The light-trail, drawn through the orbs' real centres. */}
        <Show when={trailPath() !== ''}>
          <svg
            class={styles.trailSvg}
            viewBox={`0 0 ${trailSize().w} ${trailSize().h}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="ascent-trail" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stop-color="#f0c674" stop-opacity="0.7" />
                <stop offset="45%" stop-color="#6d5efc" stop-opacity="0.55" />
                <stop offset="100%" stop-color="#45d3e8" stop-opacity="0.3" />
              </linearGradient>
              <filter
                id="ascent-trail-blur"
                x="-20%"
                y="-5%"
                width="140%"
                height="110%"
              >
                <feGaussianBlur stdDeviation="4" />
              </filter>
            </defs>
            <path
              d={trailPath()}
              fill="none"
              stroke="url(#ascent-trail)"
              stroke-width="7"
              stroke-linecap="round"
              opacity="0.35"
              filter="url(#ascent-trail-blur)"
            />
            <path
              d={trailPath()}
              fill="none"
              stroke="url(#ascent-trail)"
              stroke-width="2.2"
              stroke-linecap="round"
              opacity="0.8"
            />
          </svg>
        </Show>

        <For each={DESCENDING}>
          {(week) => {
            const state = () => weekState(week.order)
            const isOpen = () => openOrder() === week.order
            const off = OFFSETS[week.order] ?? 0
            const labelLeft = off > 0 // orb sits right of centre → label left
            return (
              <>
                <div
                  class={`${styles.node} ${
                    state() === 'active' || (!started() && week.order === 1)
                      ? 'path-orb-current'
                      : ''
                  }`}
                  style={{ '--off': `${off}` }}
                >
                  <button
                    class={styles.orbBtn}
                    data-orb-center
                    onClick={() => setExpanded(isOpen() ? null : week.order)}
                    aria-expanded={isOpen()}
                    aria-label={`Week ${week.order}: ${week.title} — ${stateLabel(state(), week.order)}`}
                  >
                    <PathOrb
                      fill={ringFill(week.order)}
                      state={state()}
                      size={98}
                    />
                  </button>
                  <div
                    class={`${styles.label} ${labelLeft ? styles.labelLeft : styles.labelRight}`}
                  >
                    <div class={styles.week}>Week {week.order}</div>
                    <div class={`${styles.name} ${stateClass(state())}`}>
                      {THEME_LABEL[week.theme]}
                    </div>
                    <div class={styles.status}>
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
