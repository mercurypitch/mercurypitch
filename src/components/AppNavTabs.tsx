import type { Component, JSX } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { isTabVisible, TAB_ANALYSIS, TAB_CHALLENGES, TAB_COMMUNITY, TAB_COMPOSE, TAB_EXERCISES, TAB_GROUPS, TAB_GUITAR, TAB_JAM, TAB_KARAOKE, TAB_LEADERBOARD, TAB_PIANO, TAB_SETTINGS, TAB_SINGING, } from '@/features/tabs/constants'
import { createPersistedSignal } from '@/lib/storage'
import { practiceScope, uiMode } from '@/stores/settings-store'
import type { ActiveTab } from '@/types'
import styles from './AppNavTabs.module.css'

export interface AppNavTabsProps {
  activeTab: () => ActiveTab
  handleTabChange: (tab: ActiveTab) => void
  tabLabel: (tab: ActiveTab) => string
  advancedFeaturesEnabled: () => boolean
}

// ── Per-tab presentation ────────────────────────────────────────────
// Order and grouping live in TAB_GROUPS (the single source of truth shared
// with the swipe navigation). This map only carries the bits that are unique
// to each button: its DOM id, accessible label, optional test id, and icon.
interface TabMeta {
  id: string
  ariaLabel: string
  testId?: string
  icon: () => JSX.Element
}

const TAB_META: Partial<Record<ActiveTab, TabMeta>> = {
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
    icon: () => (
      <svg viewBox="0 0 24 24" width="16" height="16" class={styles.tabIcon}>
        <path
          fill="currentColor"
          d="M12 14c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2s2 .9 2 2v8c0 1.1-.9 2-2 2zm-1 4h2v2h-2zm-4.5-7.5c.8-.8 2-.8 2.8 0l1.4 1.4c.8.8.8 2 0 2.8-.8.8-2 .8-2.8 0L7.5 10.5zM3 13c0 5 4 9 9 9s9-4 9-9h-2c0 3.9-3.1 7-7 7s-7-3.1-7-7H3z"
        />
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
      >
        {meta.icon()}
        {props.tabLabel(tab)}
      </button>
    )
  }

  // ── Horizontal navigation: the mouse wheel pans the bar left/right, and
  // click-drag pans it too (mouse only — touch keeps native momentum scroll).
  // `tabs-scrollable` drives the grab cursor only when there is overflow.
  const [scrollable, setScrollable] = createSignal(false)
  const updateScrollable = (): void => {
    setScrollable(navRef.scrollWidth > navRef.clientWidth + 1)
  }
  createEffect(() => {
    collapsed() // re-measure overflow when a group collapses/expands
    practiceScope() // ...and when scope/UI mode change the visible tabs
    uiMode() // (content shrinks without a resize, so the RO won't fire)
    requestAnimationFrame(updateScrollable)
  })

  onMount(() => {
    const el = navRef
    updateScrollable()

    const onWheel = (e: WheelEvent): void => {
      if (e.deltaY === 0) return
      if (el.scrollWidth <= el.clientWidth) return
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }

    let down = false
    let dragged = false
    let startX = 0
    let startScroll = 0
    const DRAG_THRESHOLD = 6
    const onPointerDown = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      down = true
      dragged = false
      startX = e.clientX
      startScroll = el.scrollLeft
    }
    const onPointerMove = (e: PointerEvent): void => {
      if (!down) return
      const dx = e.clientX - startX
      if (!dragged && Math.abs(dx) > DRAG_THRESHOLD) {
        dragged = true
        el.classList.add('dragging')
        try {
          el.setPointerCapture(e.pointerId)
        } catch {
          /* setPointerCapture can throw if the pointer was already released */
        }
      }
      if (dragged) {
        el.scrollLeft = startScroll - dx
        e.preventDefault()
      }
    }
    const endDrag = (): void => {
      down = false
      el.classList.remove('dragging')
    }
    // Swallow the click that fires after a drag so panning never activates a tab.
    const onClickCapture = (e: MouseEvent): void => {
      if (dragged) {
        e.stopPropagation()
        e.preventDefault()
        dragged = false
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('pointercancel', endDrag)
    el.addEventListener('click', onClickCapture, true)

    const ro = new ResizeObserver(updateScrollable)
    ro.observe(el)
    window.addEventListener('resize', updateScrollable)

    onCleanup(() => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endDrag)
      el.removeEventListener('pointercancel', endDrag)
      el.removeEventListener('click', onClickCapture, true)
      ro.disconnect()
      window.removeEventListener('resize', updateScrollable)
    })
  })

  // Scope + UI mode filter the visible tabs; groups with nothing left vanish.
  const groupTabs = (group: (typeof TAB_GROUPS)[number]) =>
    group.tabs.filter((t) => isTabVisible(t, practiceScope(), uiMode()))

  return (
    <nav
      id="app-tabs"
      ref={navRef}
      classList={{
        'tabs-scrollable': scrollable(),
        'tabs-simple': uiMode() === 'simple',
      }}
    >
      <For each={TAB_GROUPS}>
        {(group) => (
          <Show when={groupTabs(group).length > 0}>
            <div
              class="tab-group collapsible"
              classList={{
                // Simple mode is a flat, focused bar: no group chrome.
                collapsed: uiMode() === 'advanced' && isCollapsed(group.id),
              }}
            >
              <Show when={uiMode() === 'advanced'}>
                {groupLabel(group.id, group.label)}
              </Show>
              <For each={groupTabs(group)}>{(tab) => renderTab(tab)}</For>
            </div>
          </Show>
        )}
      </For>
    </nav>
  )
}
