import type { Component, JSX } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { AppNavOverflowMenu } from '@/components/AppNavOverflowMenu'
import type { DragGestureOptions } from '@/components/shared/drag-gesture'
import { dragGesture } from '@/components/shared/drag-gesture'
import { isTabVisible, MAX_INLINE_GROUP_TABS, splitGroupTabs, TAB_ANALYSIS, TAB_CHALLENGES, TAB_COMMUNITY, TAB_COMPOSE, TAB_EAR_LAB, TAB_EXERCISES, TAB_GROUPS, TAB_GUITAR, TAB_HOME, TAB_JAM, TAB_KARAOKE, TAB_LEADERBOARD, TAB_PATH, TAB_PIANO, TAB_PROGRESS, TAB_SETTINGS, TAB_SINGING, } from '@/features/tabs/constants'
import { createPersistedSignal } from '@/lib/storage'
import { practiceScope, uiMode } from '@/stores/settings-store'
import type { ActiveTab } from '@/types'
import styles from './AppNavTabs.module.css'

export interface AppNavTabsProps {
  activeTab: () => ActiveTab
  handleTabChange: (tab: ActiveTab) => void
  tabLabel: (tab: ActiveTab) => string
}

// ── Per-tab presentation ────────────────────────────────────────────
// Order and grouping live in TAB_GROUPS (the single source of truth shared
// with the swipe navigation). This map only carries the bits that are unique
// to each button: its DOM id, accessible label, optional test id, and icon.
// Exported: BottomTabBar (mobile) and AppNavOverflowMenu render the same
// ids/labels/icons — only one of the two bars is mounted at a time (isNarrow
// swaps them) and a tab is either inline or in its group's overflow menu,
// never both, so the shared DOM ids never collide and tour selectors resolve
// on both viewports and on either side of the overflow split.
export interface TabMeta {
  id: string
  ariaLabel: string
  testId?: string
  icon: () => JSX.Element
}

export const TAB_META: Partial<Record<ActiveTab, TabMeta>> = {
  [TAB_HOME]: {
    id: 'tab-home',
    ariaLabel: 'Home',
    icon: () => (
      <svg
        class={styles.tabIcon}
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
        <path d="M9.5 21v-6h5v6" />
      </svg>
    ),
  },
  [TAB_PATH]: {
    id: 'tab-path',
    ariaLabel: 'The Ascent guided path',
    icon: () => (
      <svg
        class={styles.tabIcon}
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        {/* Orb with a segmented progress ring — the path's own mark */}
        <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
        <path d="M12 2.8a9.2 9.2 0 0 1 8.6 6" />
        <path d="M21.2 12a9.2 9.2 0 0 1-3.4 7.2" />
        <path d="M14.6 20.8a9.2 9.2 0 0 1-9.8-2.4" />
        <path d="M2.8 12a9.2 9.2 0 0 1 3.4-7.2" />
      </svg>
    ),
  },
  [TAB_PROGRESS]: {
    id: 'tab-progress',
    ariaLabel: 'Practice progress',
    icon: () => (
      <svg
        class={styles.tabIcon}
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      >
        <path d="M4 17.5c2.3 0 2.7-11 5-11s2.7 11 5 11 2.7-7 6-7" />
        <path d="M4 21h16" opacity=".45" />
      </svg>
    ),
  },
  [TAB_SINGING]: {
    id: 'tab-singing',
    ariaLabel: 'Singing practice',
    icon: () => (
      <svg
        class={styles.tabIcon}
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="currentColor"
      >
        <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path
          d="M19 10v1a7 7 0 0 1-14 0v-1"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
        <line
          x1="12"
          y1="19"
          x2="12"
          y2="22"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
        <line
          x1="8"
          y1="22"
          x2="16"
          y2="22"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    ),
  },
  [TAB_PIANO]: {
    // Historic id — kept stable for existing selectors/tours/tests.
    id: 'tab-falling-notes',
    ariaLabel: 'Falling notes piano',
    icon: () => (
      <svg
        class={styles.tabIcon}
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="currentColor"
      >
        <rect x="2" y="5" width="4" height="15" rx="0.5" />
        <rect x="7" y="5" width="4" height="15" rx="0.5" />
        <rect x="12" y="5" width="4" height="15" rx="0.5" />
        <rect x="17" y="5" width="4" height="15" rx="0.5" />
        <rect
          x="4"
          y="5"
          width="2.5"
          height="10"
          rx="0.5"
          fill="var(--bg-primary)"
        />
        <rect
          x="9.5"
          y="5"
          width="2.5"
          height="10"
          rx="0.5"
          fill="var(--bg-primary)"
        />
        <rect
          x="14.5"
          y="5"
          width="2.5"
          height="10"
          rx="0.5"
          fill="var(--bg-primary)"
        />
      </svg>
    ),
  },
  [TAB_GUITAR]: {
    id: 'tab-guitar',
    ariaLabel: 'Guitar practice',
    icon: () => (
      <svg class={styles.tabIcon} viewBox="0 0 24 24" width="16" height="16">
        {/* Diagonal acoustic guitar: headstock up-right, body down-left */}
        <g transform="rotate(45 12 12)" fill="currentColor">
          <path d="M10.7 1.6h2.6l.55 3.1h-3.7z" />
          <path d="M11.05 5.4h1.9l.25 5.2h-2.4z" />
          <path
            fill-rule="evenodd"
            d="M12 10.3c2.7 0 3.9 1.3 3.5 2.8-.2.9-.2 1.4.4 2.4 1 1.7.1 6.2-3.9 6.2s-4.9-4.5-3.9-6.2c.6-1 .6-1.5.4-2.4-.4-1.5.8-2.8 3.5-2.8zm0 2.7a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5z"
          />
        </g>
      </svg>
    ),
  },
  [TAB_EXERCISES]: {
    id: 'tab-exercises',
    ariaLabel: 'Singing Exercises',
    // Dumbbell — the universal "training/drills" glyph (the old mic-in-arc
    // mark read as nothing in particular at 16px).
    icon: () => (
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        class={styles.tabIcon}
        fill="none"
        stroke="currentColor"
        stroke-width="1.9"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M6.2 7.8v8.4M3.4 9.6v4.8M17.8 7.8v8.4M20.6 9.6v4.8M6.2 12h11.6" />
      </svg>
    ),
  },
  [TAB_EAR_LAB]: {
    id: 'tab-ear-lab',
    ariaLabel: 'Ear Lab',
    // Thermometer with a scale tick — the Mercury Column in
    // miniature: a calibrated instrument, not a game.
    icon: () => (
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        class={styles.tabIcon}
        fill="none"
        stroke="currentColor"
        stroke-width="1.9"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M10 4a2 2 0 0 1 4 0v9.3a4.5 4.5 0 1 1-4 0Z" />
        <circle cx="12" cy="17" r="1.6" fill="currentColor" stroke="none" />
        <line x1="12" y1="15.4" x2="12" y2="9" />
        <line x1="16.5" y1="7.5" x2="19" y2="7.5" />
      </svg>
    ),
  },
  [TAB_KARAOKE]: {
    id: 'tab-karaoke',
    ariaLabel: 'Karaoke',
    icon: () => (
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        class={styles.tabIcon}
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        {/* Waveform (Stem Mixer) */}
        <line x1="8" y1="9" x2="8" y2="15"></line>
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="16" y1="10" x2="16" y2="14"></line>
      </svg>
    ),
  },
  [TAB_COMMUNITY]: {
    id: 'tab-community',
    ariaLabel: 'Community',
    icon: () => (
      <svg viewBox="0 0 24 24" width="16" height="16" class={styles.tabIcon}>
        <path
          fill="currentColor"
          d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
        />
      </svg>
    ),
  },
  [TAB_LEADERBOARD]: {
    id: 'tab-leaderboard',
    ariaLabel: 'Leaderboard',
    icon: () => (
      <svg viewBox="0 0 24 24" width="16" height="16" class={styles.tabIcon}>
        <path
          fill="currentColor"
          d="M5 3H3v18h2V3zm4 0H7v18h2V3zm4 0h-2v18h2V3zm4 0h-2v18h2V3zm4 0h-2v18h2V3z"
        />
      </svg>
    ),
  },
  [TAB_CHALLENGES]: {
    id: 'tab-challenges',
    ariaLabel: 'Challenges',
    icon: () => (
      <svg viewBox="0 0 24 24" width="16" height="16" class={styles.tabIcon}>
        <path
          fill="currentColor"
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        />
      </svg>
    ),
  },
  [TAB_JAM]: {
    id: 'tab-jam',
    ariaLabel: 'Jam session',
    icon: () => (
      <svg
        class={styles.tabIcon}
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  [TAB_COMPOSE]: {
    id: 'tab-compose',
    ariaLabel: 'Compose melodies',
    icon: () => (
      <svg
        class={styles.tabIcon}
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
    ),
  },
  [TAB_ANALYSIS]: {
    id: 'tab-analysis',
    ariaLabel: 'Vocal analysis',
    testId: 'tab-analysis',
    icon: () => (
      <svg viewBox="0 0 24 24" width="16" height="16" class={styles.tabIcon}>
        <path
          fill="currentColor"
          d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
        />
      </svg>
    ),
  },
  [TAB_SETTINGS]: {
    id: 'tab-settings',
    ariaLabel: 'Settings',
    testId: 'tab-settings',
    icon: () => (
      <svg
        class={styles.tabIcon}
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    ),
  },
}

export const AppNavTabs: Component<AppNavTabsProps> = (props) => {
  let navRef!: HTMLElement

  // Expose the active tab to assistive tech — the `.active` class only conveys
  // selection visually. `aria-current="page"` inside the <nav> is appropriate.
  const ariaCurrent = (tab: ActiveTab): 'page' | undefined =>
    props.activeTab() === tab ? 'page' : undefined

  createEffect(() => {
    props.activeTab() // track dependency
    requestAnimationFrame(() => {
      if (navRef === undefined || navRef === null) return
      const activeEl = navRef.querySelector('.app-tab.active')
      if (activeEl !== null) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        })
      }
    })
  })

  const renderTab = (tab: ActiveTab) => {
    const meta = TAB_META[tab]
    if (meta === undefined) return null
    return (
      <button
        id={meta.id}
        data-testid={meta.testId}
        class={`app-tab ${props.activeTab() === tab ? 'active' : ''}`}
        onClick={() => void props.handleTabChange(tab)}
        aria-current={ariaCurrent(tab)}
        aria-label={meta.ariaLabel}
        // Only while the name is hidden. A native tooltip repeating a label
        // that is already on screen is noise on every hover.
        title={iconOnly() ? props.tabLabel(tab) : undefined}
      >
        {meta.icon()}
        {/* Wrapped so icon-only mode can hide the name without touching the
            icon. A bare text node has nothing for CSS to select. */}
        <span class="tab-text">{props.tabLabel(tab)}</span>
      </button>
    )
  }

  // ── Fitting the bar ────────────────────────────────────────────────
  // MAX_INLINE_GROUP_TABS is the ceiling, not a promise. Measured on a
  // 1440px window: eleven labelled tabs want 1439px and the strip only gets
  // 923 of them, because .header-left and .header-support are served first.
  // A fixed cap of three therefore still left Settings 400px off the right
  // edge, reachable only by panning — and Settings is the way back out of
  // simple mode.
  //
  // So the bar degrades until it fits, and the cap is the last thing to go
  // (see fitToWidth for the order). Measured across the viewports the app
  // ships to: all eleven tabs inline from 1280px up, four plus four menus at
  // 1024px and below. Every step folds into a group's own overflow button, so
  // nothing becomes unreachable — it moves one click away.
  const [inlineCap, setInlineCap] = createSignal(MAX_INLINE_GROUP_TABS)

  /**
   * The uppercase group names. First thing dropped when the bar is squeezed:
   * they teach the taxonomy but cost ~193px measured, and a destination the
   * user can reach beats a caption over one they cannot. The pill borders
   * still separate the groups without them.
   */
  const [showLabels, setShowLabels] = createSignal(true)

  /**
   * Tabs as their icons alone, names in the tooltip.
   *
   * Dropped after the group names and BEFORE any tab count, because a tab you
   * can see and click beats a tab behind a menu: a text tab measures ~89px and
   * an icon one ~41px, which is what keeps all eleven destinations on a 1280px
   * laptop instead of four tabs and four menus. The ≤768px bar has always done
   * this — same idea, measured rather than hard-coded to a breakpoint.
   */
  const [iconOnly, setIconOnly] = createSignal(false)

  const [scrollable, setScrollable] = createSignal(false)

  /**
   * The width the groups actually want, which is NOT `scrollWidth`.
   *
   * `scrollWidth` is defined as at least `clientWidth`, so on a strip with
   * room to spare it reports the box, not the content — it can say "too
   * wide" but never "there is slack", and a fit pass built on it can only
   * ever shrink. Summing the group pills gives the real number in both
   * directions, so the bar grows back when the window does.
   */
  const contentWidth = (): number => {
    const groups = Array.from(navRef.children) as HTMLElement[]
    if (groups.length === 0) return 0
    const gap =
      Number.parseFloat(window.getComputedStyle(navRef).columnGap) || 0
    const total = groups.reduce(
      (sum, el) => sum + el.getBoundingClientRect().width,
      0,
    )
    return total + gap * (groups.length - 1)
  }

  /**
   * Re-render at the ceiling, then degrade until the strip fits: group names,
   * then the tab names, then a tab per group. Chrome before content.
   *
   * Runs inside one animation frame: Solid applies each setter synchronously,
   * so the browser never paints an intermediate width and the pass cannot
   * flicker. Starting from the ceiling every time is what lets the bar grow
   * BACK when the window widens — state that only ever decreased would stay
   * narrow forever.
   */
  const fitToWidth = (): void => {
    if (navRef === undefined || navRef === null) return
    const overflows = (): boolean => contentWidth() > navRef.clientWidth + 1

    setShowLabels(true)
    setIconOnly(false)
    setInlineCap(MAX_INLINE_GROUP_TABS)

    // Cheapest thing first, destinations last: group names, then the tab
    // names, and only then a tab per group.
    if (overflows()) setShowLabels(false)
    if (overflows()) setIconOnly(true)
    for (let cap = MAX_INLINE_GROUP_TABS; cap > 1 && overflows(); cap--) {
      setInlineCap(cap - 1)
    }

    // At one tab per group there is nothing left to fold, so the narrowest
    // desktops keep the pan-to-scroll strip; the grab cursor says so.
    setScrollable(overflows())
  }

  /**
   * Run the fit pass on the next frame, at most once per frame.
   *
   * It MUST NOT run synchronously from `onMount` or from inside a
   * `createEffect` body. Solid batches signal writes that happen during an
   * update cycle, so the DOM still holds the previous cap when `fitToWidth`
   * measures it — every candidate reads as overflowing and the bar
   * collapses to one tab per group. Measured: at 1440px it settled on 1
   * when 2 fits with 11px to spare. A frame later the writes have flushed
   * and layout is real, so the same code converges correctly.
   *
   * `fitting` keeps the ResizeObserver from re-entering: the pass resizes
   * the strip by design, which would otherwise call it straight back.
   */
  let fitFrame = 0
  let fitTimer: ReturnType<typeof setTimeout> | undefined
  let fitting = false

  const cancelFit = (): void => {
    if (fitFrame !== 0) {
      cancelAnimationFrame(fitFrame)
      fitFrame = 0
    }
    if (fitTimer !== undefined) {
      clearTimeout(fitTimer)
      fitTimer = undefined
    }
  }

  const runFit = (): void => {
    cancelFit()
    fitting = true
    fitToWidth()
    fitting = false
  }

  const scheduleFit = (): void => {
    if (fitFrame !== 0 || fitTimer !== undefined) return
    fitFrame = requestAnimationFrame(runFit)
    // A frame is the right moment, but rAF is SUSPENDED whenever the page is
    // not compositing — a background tab, or an offscreen preview — and the
    // bar would then sit at its widest state indefinitely, overflowing.
    // Timers still fire there, so whichever arrives first runs the pass and
    // cancels the other.
    fitTimer = setTimeout(runFit, 50)
  }

  let dragged = false
  let dragResetTimer: ReturnType<typeof setTimeout> | undefined
  let startX = 0
  let startScroll = 0
  const navDrag: DragGestureOptions = {
    // Touch deliberately keeps the bar's native horizontal momentum scroll.
    touchAction: 'pan-x',
    preventDefault: false,
    activationDistance: 6,
    canStart: (event) => event.pointerType === 'mouse' && event.button === 0,
    onStart: (event) => {
      if (dragResetTimer !== undefined) {
        clearTimeout(dragResetTimer)
        dragResetTimer = undefined
      }
      dragged = true
      startX = event.clientX
      startScroll = navRef.scrollLeft
      navRef.classList.add('dragging')
    },
    onMove: (event) => {
      const dx = event.clientX - startX
      navRef.scrollLeft = startScroll - dx
      event.preventDefault()
    },
    onEnd: () => {
      navRef.classList.remove('dragging')
      // Keep suppression armed for the click synthesized by pointerup, then
      // recover even when cancellation/out-of-window release emits no click.
      dragResetTimer = setTimeout(() => {
        dragged = false
        dragResetTimer = undefined
      }, 0)
    },
  }
  createEffect(() => {
    practiceScope() // re-measure when scope/UI mode change the visible tabs
    uiMode() // (content shrinks without a resize, so the RO won't fire)
    props.activeTab() // ...and when a promoted tab changes a group's width
    scheduleFit()
  })

  onMount(() => {
    const el = navRef
    scheduleFit()

    const onWheel = (e: WheelEvent): void => {
      if (e.deltaY === 0) return
      if (el.scrollWidth <= el.clientWidth) return
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }

    // Swallow the click that fires after a drag so panning never activates a tab.
    const onClickCapture = (e: MouseEvent): void => {
      if (dragged) {
        e.stopPropagation()
        e.preventDefault()
        dragged = false
        if (dragResetTimer !== undefined) {
          clearTimeout(dragResetTimer)
          dragResetTimer = undefined
        }
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('click', onClickCapture, true)

    // Observing the strip covers the header's other children too: it is a
    // flex-grow item, so anything that changes .header-left or
    // .header-support changes its box and lands here — including the
    // account and install widgets, which arrive after first paint.
    const ro = new ResizeObserver(() => {
      if (fitting) return
      scheduleFit()
    })
    ro.observe(el)
    window.addEventListener('resize', scheduleFit)

    onCleanup(() => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('click', onClickCapture, true)
      ro.disconnect()
      window.removeEventListener('resize', scheduleFit)
      cancelFit()
      if (dragResetTimer !== undefined) clearTimeout(dragResetTimer)
    })
  })

  // Scope + UI mode filter the visible tabs; groups with nothing left vanish.
  const groupTabs = (group: (typeof TAB_GROUPS)[number]) =>
    group.tabs.filter((t) => isTabVisible(t, practiceScope(), uiMode()))

  // Up to three inline tabs per group, the rest behind the group's "..." —
  // the same bargain the phone's bottom bar makes, so a new surface costs a
  // menu row rather than bar width. Filtering happens BEFORE the split, so a
  // single-instrument scope spends its slots on tabs that actually exist, and
  // the measured cap can never exceed a group's own declared ceiling.
  const split = (group: (typeof TAB_GROUPS)[number]) =>
    splitGroupTabs(
      groupTabs(group),
      props.activeTab(),
      Math.min(group.maxInline ?? MAX_INLINE_GROUP_TABS, inlineCap()),
    )

  // ── Group collapse (desktop): click a group label to collapse it down to
  // just its active tab; hovering the collapsed group expands it inline.
  // Persisted so the layout the user prefers survives reloads.
  const [collapsed, setCollapsed] = createPersistedSignal<
    Record<string, boolean>
  >('mp.navCollapsedGroups', {})
  const isCollapsed = (id: string): boolean => collapsed()[id] === true
  const toggleGroup = (id: string): void => {
    setCollapsed((c) => ({ ...c, [id]: c[id] !== true }))
  }

  /**
   * Collapse is only offered while the group labels are showing, because the
   * label IS the toggle. When the strip is squeezed enough to drop the labels
   * (see fitToWidth) the collapse state is ignored rather than applied — a
   * group left collapsed would otherwise have no affordance left to reopen it.
   */
  const collapsible = (): boolean => uiMode() === 'advanced' && showLabels()

  const groupLabel = (id: string, label: string) => (
    <button
      type="button"
      class="tab-group-label"
      classList={{ collapsed: isCollapsed(id) }}
      onClick={() => toggleGroup(id)}
      aria-expanded={!isCollapsed(id)}
      title={isCollapsed(id) ? `Expand ${label}` : `Collapse ${label}`}
    >
      {label}
      <svg
        class="tab-group-caret"
        viewBox="0 0 24 24"
        width="10"
        height="10"
        aria-hidden="true"
      >
        <path
          d="M6 9l6 6 6-6"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  )

  return (
    <nav
      id="app-tabs"
      ref={(element) => {
        navRef = element
        dragGesture(element, () => navDrag)
      }}
      classList={{
        'tabs-scrollable': scrollable(),
        'tabs-simple': uiMode() === 'simple',
        'tabs-icon-only': iconOnly(),
      }}
    >
      <For each={TAB_GROUPS}>
        {(group) => (
          <Show when={groupTabs(group).length > 0}>
            <div
              class="tab-group"
              data-tab-group={group.id}
              classList={{
                collapsible: collapsible(),
                collapsed: collapsible() && isCollapsed(group.id),
              }}
            >
              {/* Simple mode is a flat, focused bar: no group chrome. Wide
                  windows get the group names; squeezed ones spend the pixels
                  on tabs instead (see fitToWidth). The name doubles as the
                  collapse toggle. */}
              <Show when={collapsible()}>
                {groupLabel(group.id, group.label)}
              </Show>
              <For each={split(group).inline}>{(tab) => renderTab(tab)}</For>
              <Show when={split(group).overflow.length > 0}>
                <AppNavOverflowMenu
                  groupLabel={group.label}
                  tabs={split(group).overflow}
                  meta={(tab) => TAB_META[tab]}
                  tabLabel={props.tabLabel}
                  activeTab={props.activeTab}
                  onPick={(tab) => void props.handleTabChange(tab)}
                />
              </Show>
            </div>
          </Show>
        )}
      </For>
    </nav>
  )
}
