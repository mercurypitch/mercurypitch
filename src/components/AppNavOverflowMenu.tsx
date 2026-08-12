// ============================================================
// AppNavOverflowMenu — the "..." at the end of a desktop tab group
// ============================================================
//
// The bar shows three tabs per group (MAX_INLINE_GROUP_TABS) and folds
// the rest in here, which is the same bargain the phone's bottom bar
// already makes with its More button. It exists so that shipping a new
// surface costs a menu row instead of bar width.
//
// It portals to <body> for the three reasons InfoPopover documents: the
// tab strip is an `overflow-x: auto` scroller, so a panel inside it is
// clipped by its own parent AND drags with the strip; and the sidebar
// (z-index 200) draws over anything that cannot leave the header's
// stacking context.
//
// Menu rows carry the SAME `#tab-*` ids as bar buttons. A tab is either
// inline or in the menu, never both, so the ids stay unique — and every
// existing tour selector, e2e locator and audit script resolves whichever
// side of the split its tab landed on.

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import type { TabMeta } from '@/components/AppNavTabs'
import type { ActiveTab } from '@/types'
import styles from './AppNavOverflowMenu.module.css'

export interface AppNavOverflowMenuProps {
  /** The group this menu belongs to — labels the trigger for screen readers. */
  groupLabel: string
  /** Tabs folded into the menu, in canonical order. */
  tabs: readonly ActiveTab[]
  /** Presentation for each tab (id, aria-label, icon). */
  meta: (tab: ActiveTab) => TabMeta | undefined
  tabLabel: (tab: ActiveTab) => string
  activeTab: () => ActiveTab
  onPick: (tab: ActiveTab) => void
}

/** Clear of the viewport edge, so the panel never sits flush against it. */
const MARGIN = 8
/** Gap between the trigger and the panel. */
const GAP = 6

export const AppNavOverflowMenu: Component<AppNavOverflowMenuProps> = (
  props,
) => {
  const [open, setOpen] = createSignal(false)
  const [pos, setPos] = createSignal({ x: 0, y: 0 })
  let trigger: HTMLButtonElement | undefined
  let panel: HTMLDivElement | undefined

  const place = (): void => {
    if (trigger === undefined || panel === undefined) return
    const t = trigger.getBoundingClientRect()
    const w = panel.offsetWidth
    const h = panel.offsetHeight

    // Right-aligned to the trigger, then pulled back inside the viewport —
    // the last group's menu would otherwise open past the window edge.
    let x = t.right - w
    x = Math.min(
      Math.max(MARGIN, x),
      Math.max(MARGIN, window.innerWidth - w - MARGIN),
    )

    let y = t.bottom + GAP
    if (y + h > window.innerHeight - MARGIN && t.top - GAP - h > MARGIN) {
      y = t.top - GAP - h
    }

    setPos({ x, y })
  }

  /** Roving focus across the rows, so the menu is usable without a mouse. */
  const focusRow = (index: number): void => {
    const rows = panel?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    if (rows === undefined || rows.length === 0) return
    const wrapped = ((index % rows.length) + rows.length) % rows.length
    rows[wrapped].focus()
  }

  const currentRow = (): number => {
    const rows = panel?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    if (rows === undefined) return -1
    return Array.from(rows).indexOf(document.activeElement as HTMLButtonElement)
  }

  createEffect(() => {
    if (!open()) return
    place()
    // Focus the first row once the portal has painted, so keyboard users
    // land inside the menu they just opened rather than behind it.
    requestAnimationFrame(() => focusRow(0))

    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Node | null
      if (target === null) return
      if (trigger?.contains(target) === true) return
      if (panel?.contains(target) === true) return
      setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false)
        trigger?.focus()
        return
      }
      if (panel?.contains(document.activeElement) !== true) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        focusRow(currentRow() + 1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        focusRow(currentRow() - 1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        focusRow(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        focusRow(props.tabs.length - 1)
      }
    }
    // The tab strip is a horizontal scroller and the header can scroll with
    // the page; both would strand the panel where the trigger used to be.
    const onScroll = (): void => {
      setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', place)

    onCleanup(() => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', place)
    })
  })

  // Scope or UI mode can empty this group while the menu is open; the portal
  // would otherwise outlive its trigger and hang over the next screen.
  onCleanup(() => {
    setOpen(false)
  })

  const pick = (tab: ActiveTab): void => {
    setOpen(false)
    trigger?.focus()
    props.onPick(tab)
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        class="app-tab tab-overflow-trigger"
        data-testid={`tab-overflow-${props.groupLabel.toLowerCase()}`}
        aria-label={`More ${props.groupLabel} tabs`}
        aria-haspopup="menu"
        aria-expanded={open()}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
      >
        <svg
          class="tab-overflow-dots"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          aria-hidden="true"
          fill="currentColor"
        >
          <circle cx="5" cy="12" r="1.9" />
          <circle cx="12" cy="12" r="1.9" />
          <circle cx="19" cy="12" r="1.9" />
        </svg>
      </button>

      <Show when={open()}>
        <Portal>
          <div
            ref={panel}
            class={styles.panel}
            role="menu"
            aria-label={`More ${props.groupLabel} tabs`}
            style={{ left: `${pos().x}px`, top: `${pos().y}px` }}
          >
            {/* Visual only. A `role="menu"` should contain menu items, not
                prose, and the panel's own aria-label already names the group
                for assistive tech — so this is hidden from it rather than
                announced as a stray line inside the list. */}
            <p class={styles.groupHeading} aria-hidden="true">
              {props.groupLabel}
            </p>
            <For each={props.tabs}>
              {(tab) => {
                const meta = props.meta(tab)
                return (
                  <button
                    id={meta?.id}
                    type="button"
                    role="menuitem"
                    class={styles.row}
                    classList={{
                      [styles.rowActive]: props.activeTab() === tab,
                      // Bar buttons carry `.active`; menu rows carry it too so
                      // the specs that assert on it work from either side.
                      active: props.activeTab() === tab,
                    }}
                    aria-current={
                      props.activeTab() === tab ? 'page' : undefined
                    }
                    aria-label={meta?.ariaLabel}
                    onClick={() => pick(tab)}
                  >
                    <span class={styles.rowIcon}>{meta?.icon()}</span>
                    {props.tabLabel(tab)}
                  </button>
                )
              }}
            </For>
          </div>
        </Portal>
      </Show>
    </>
  )
}
