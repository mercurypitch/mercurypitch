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
import { createEffect, createMemo, createSignal, For, onCleanup, Show, untrack, } from 'solid-js'
import { ASCENT_WEEKS, DAYS_PER_WEEK, PATH_THEME_LABEL, } from '@/features/path/path-content'
import type { WeekState } from '@/features/path/path-progress'
import { devMarkPracticeDay, pathComplete, pathFreeRoam, pathProgress, resetAscent, ringFill, setPathFreeRoam, startAscent, weekState, } from '@/features/path/path-progress'
import { pathView } from '@/features/path/path-view'
import { PathOrb } from '@/features/path/PathOrb'
import { PathViewToggle } from '@/features/path/PathViewToggle'
import { PathWeekGuide } from '@/features/path/PathWeekGuide'
import { PlainPathView } from '@/features/path/PlainPathView'
import { IS_DEV } from '@/lib/defaults'
import styles from './PathPage.module.css'

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
  const [trailPath, setTrailPath] = createSignal('')

  let trailEl: HTMLDivElement | undefined
  let pageEl: HTMLDivElement | undefined

  const currentOrder = createMemo(() => pathProgress()?.currentWeek ?? 1)
  // Arrive with this week's guidebook already open, the way the Plain Path
  // view does. The trail used to load with nothing expanded so it read as an
  // uninterrupted climb — but the whole reason to open the Ascent is to find
  // out what today asks of you, and that cost a tap every single visit.
  //
  // untrack, and a plain signal rather than a memo, so tapping the open orb
  // still closes it: progress comes from a localStorage-backed signal, so the
  // week is already known here and nothing needs to re-open it later. The
  // page remounts on every tab entry (App.tsx renders it under `Show`), so
  // the next visit opens the current week again.
  const [expanded, setExpanded] = createSignal<number | null>(
    untrack(currentOrder),
  )
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
  }

  // The Ascent branch can mount after a persisted Plain Path preference.
  // Key setup to the selected view so its observers initialize every time the
  // cosmic branch is entered, not only on the first PathPage mount.
  createEffect(() => {
    if (pathView() !== 'ascent') return

    drawTrail()
    // Redraw as layout settles. rAF alone can be throttled/paused in some
    // embeds, so also retry on plain timers — the first attempt often runs
    // before the trail has a measurable height.
    const timers = [50, 150, 400].map((ms) => window.setTimeout(drawTrail, ms))
    const ro = new ResizeObserver(drawTrail)
    if (trailEl) ro.observe(trailEl)
    // Zoom / viewport changes move the orbs (their offset is vw-based) without
    // necessarily resizing the trail box, so the ResizeObserver alone can miss
    // them — redraw on window resize too.
    window.addEventListener('resize', drawTrail)
    onCleanup(() => {
      ro.disconnect()
      window.removeEventListener('resize', drawTrail)
      timers.forEach((t) => window.clearTimeout(t))
    })

    // Land the climber at their current orb (week 1 sits at the very foot).
    //
    // Deferred, then checked again. This effect runs in the same tick the
    // orbs and the open week guide are inserted, and drawTrail's retries
    // just above exist precisely because the trail has no measurable height
    // yet at this moment — so scrolling here aimed at a page that was still
    // growing, which is why arriving from Home did not land on your week.
    const reduce =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    const currentOrb = (): Element | null =>
      pageEl?.querySelector('.path-orb-current') ?? null
    const land = (behavior: ScrollBehavior): void => {
      currentOrb()?.scrollIntoView({ block: 'center', behavior })
    }

    const frame = requestAnimationFrame(() => land(reduce ? 'auto' : 'smooth'))
    // One corrective jump after the trail settles, and only when the orb has
    // actually drifted off centre — re-issuing a smooth scroll that already
    // arrived only fights the one in flight. 700ms clears that animation.
    const settle = window.setTimeout(() => {
      const orb = currentOrb()
      if (orb === null) return
      const box = orb.getBoundingClientRect()
      const drift = Math.abs(box.top + box.height / 2 - window.innerHeight / 2)
      if (drift > window.innerHeight / 4) land('auto')
    }, 700)
    onCleanup(() => {
      cancelAnimationFrame(frame)
      window.clearTimeout(settle)
    })
  })

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
    <Show when={pathView() === 'ascent'} fallback={<PlainPathView />}>
      <div class={`${styles.page} path-trail`} ref={pageEl}>
        <div class={styles.backdrop} aria-hidden="true" />
        <div class={styles.viewSwitch}>
          <PathViewToggle />
        </div>

        {/* Plain <div>, not <header>/<footer>: the app applies global flex
          layout to those elements (the top nav) which squashes the hero. */}
        <div class={styles.hero}>
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
        </div>

        <Show when={IS_DEV}>
          <div class={styles.devbar}>
            <span class={styles.devTag}>dev</span>
            <label class={styles.devToggle}>
              <input
                type="checkbox"
                checked={pathFreeRoam()}
                onChange={(e) => setPathFreeRoam(e.currentTarget.checked)}
              />
              Free-roam
            </label>
            <button onClick={() => devMarkPracticeDay()}>+ day</button>
            <button onClick={() => startAscent()}>begin</button>
            <button onClick={() => resetAscent()}>reset</button>
          </div>
        </Show>

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
            {/* No viewBox: user units == CSS pixels (1:1), so the path never
              stretches when the box resizes — it just redraws through the
              orbs' new centres. */}
            <svg class={styles.trailSvg} aria-hidden="true">
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
              {/* Double ribbon: a fainter parallel line nudged aside. */}
              <path
                d={trailPath()}
                fill="none"
                stroke="url(#ascent-trail)"
                stroke-width="1.4"
                stroke-linecap="round"
                opacity="0.4"
                transform="translate(3.5, 0)"
              />
              <path
                d={trailPath()}
                fill="none"
                stroke="url(#ascent-trail)"
                stroke-width="2.2"
                stroke-linecap="round"
                opacity="0.85"
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
                        theme={week.theme}
                        size={98}
                      />
                    </button>
                    <div
                      class={`${styles.label} ${labelLeft ? styles.labelLeft : styles.labelRight}`}
                    >
                      <div class={styles.week}>Week {week.order}</div>
                      <div class={`${styles.name} ${stateClass(state())}`}>
                        {PATH_THEME_LABEL[week.theme]}
                      </div>
                      <div class={styles.status}>
                        {stateLabel(state(), week.order)}
                      </div>
                    </div>
                  </div>

                  <Show when={isOpen()}>
                    <PathWeekGuide
                      week={week}
                      state={state()}
                      currentOrder={currentOrder()}
                      started={started()}
                      themeLabel={PATH_THEME_LABEL[week.theme]}
                    />
                  </Show>
                </>
              )
            }}
          </For>
        </div>

        <div class={styles.foot}>
          Any practice that meets your daily goal lights a segment — freeform
          singing counts too. Missing a day never empties a ring.
        </div>
      </div>
    </Show>
  )
}

export default PathPage
