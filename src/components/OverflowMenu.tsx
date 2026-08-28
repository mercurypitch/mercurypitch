// ── OverflowMenu ─────────────────────────────────────────────────────
// The "..." that keeps a surface from becoming a wall of buttons.
//
// Written because there were already two of these — the tab bar's
// AppNavOverflowMenu and a hand-rolled one inside UvrSessionActions —
// and a third would have been the point at which the Escape key works
// on some menus and not others. This is the one the session card uses,
// and the one anything new should use.
//
// It portals to <body> for the reason InfoPopover documents: a panel
// rendered inside a scrolling or clipped ancestor is cut off by it, and
// on a card in a grid that is every panel.
//
// On a narrow screen it is a bottom sheet instead of a popover. A
// popover anchored to a card in a two-column phone layout has nowhere to
// go: it either runs off the edge or covers the thing it belongs to.

import type { Component, JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, Index, onCleanup, Show, } from 'solid-js'
import { Portal } from 'solid-js/web'
import { isNarrow } from '@/lib/use-viewport'
import styles from './OverflowMenu.module.css'

export interface OverflowMenuItem {
  /** Stable identity for the row — also the test hook. */
  key: string
  label: string
  icon?: () => JSX.Element
  /** A second line, for a row whose consequence is not obvious. */
  note?: string
  disabled?: boolean
  /**
   * Sorted to the bottom, under a divider.
   *
   * Not decoration: Delete and "Upgrade this session" both replace
   * something, and a menu that puts them next to Play along is a menu
   * that gets one of them clicked by accident.
   */
  destructive?: boolean
  onSelect: () => void
}

export interface OverflowMenuProps {
  /** Names the trigger and the panel for screen readers. */
  label: string
  items: OverflowMenuItem[]
  disabled?: boolean
  /** Starts any work the rows need before the singer chooses one. */
  onOpen?: () => void
  /** Extra class on the trigger, so a host can size it to its own row. */
  triggerClass?: string
  testId?: string
}

/** Clear of the viewport edge, so the panel never sits flush against it. */
const MARGIN = 8
/** Gap between the trigger and the panel. */
const GAP = 6

export const OverflowMenu: Component<OverflowMenuProps> = (props) => {
  const [open, setOpen] = createSignal(false)
  const [pos, setPos] = createSignal({ x: 0, y: 0 })
  let trigger: HTMLButtonElement | undefined
  let panel: HTMLDivElement | undefined

  // Ordinary rows keep their given order; destructive ones go last
  // whatever order the caller listed them in, so a host cannot
  // accidentally put Delete in the middle.
  const rows = createMemo(() => [
    ...props.items.filter((item) => item.destructive !== true),
    ...props.items.filter((item) => item.destructive === true),
  ])
  const firstDestructive = createMemo(() =>
    rows().findIndex((item) => item.destructive === true),
  )

  const sheet = (): boolean => isNarrow()

  const place = (): void => {
    if (trigger === undefined || panel === undefined || sheet()) return
    const t = trigger.getBoundingClientRect()
    const w = panel.offsetWidth
    const h = panel.offsetHeight

    // Right-aligned to the trigger, then pulled back inside the viewport —
    // a card at the right edge of the grid would otherwise open past it.
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

  /** The rows a keyboard can actually land on. */
  const focusable = (): HTMLButtonElement[] =>
    Array.from(
      panel?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not([disabled])',
      ) ?? [],
    )

  const focusRow = (index: number): void => {
    const items = focusable()
    if (items.length === 0) return
    const wrapped = ((index % items.length) + items.length) % items.length
    items[wrapped]?.focus()
  }

  const currentRow = (): number =>
    focusable().indexOf(document.activeElement as HTMLButtonElement)

  const close = (restoreFocus = true): void => {
    setOpen(false)
    if (restoreFocus) trigger?.focus()
  }

  const openMenu = (): void => {
    if (open()) return
    props.onOpen?.()
    setOpen(true)
  }

  createEffect(() => {
    if (!open()) return
    place()
    // Focus the first row once the portal has painted, so a keyboard user
    // lands inside the menu they just opened rather than behind it.
    requestAnimationFrame(() => focusRow(0))

    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Node | null
      if (target === null) return
      if (trigger?.contains(target) === true) return
      if (panel?.contains(target) === true) return
      close(false)
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
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
        focusRow(focusable().length - 1)
      }
    }
    // A card list scrolls. A popover that stays where the trigger used to
    // be is worse than no popover.
    const onScroll = (): void => {
      if (!sheet()) close(false)
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

  // A card can be deleted while its own menu is open; without this the
  // portal outlives the trigger and hangs over whatever comes next.
  onCleanup(() => setOpen(false))

  const pick = (item: OverflowMenuItem): void => {
    if (item.disabled === true) return
    close()
    item.onSelect()
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        class={`${styles.trigger} ${props.triggerClass ?? ''}`}
        data-testid={props.testId}
        aria-label={props.label}
        aria-haspopup="menu"
        aria-expanded={open()}
        disabled={props.disabled}
        onClick={(e) => {
          e.stopPropagation()
          if (open()) close(false)
          else openMenu()
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            openMenu()
          }
        }}
      >
        <svg
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
          {/* The sheet gets a backdrop; a popover does not, because a
              backdrop over a card list swallows the scroll it needs. */}
          <Show when={sheet()}>
            <div
              class={styles.backdrop}
              aria-hidden="true"
              onClick={() => close(false)}
            />
          </Show>
          <div
            ref={panel}
            class={styles.panel}
            classList={{ [styles.panelSheet!]: sheet() }}
            role="menu"
            aria-label={props.label}
            style={
              sheet()
                ? undefined
                : { left: `${pos().x}px`, top: `${pos().y}px` }
            }
          >
            <Index each={rows()}>
              {(item, index) => (
                <>
                  <Show
                    when={
                      firstDestructive() > 0 && index === firstDestructive()
                    }
                  >
                    <div class={styles.divider} role="separator" />
                  </Show>
                  <button
                    type="button"
                    role="menuitem"
                    data-testid={`overflow-${item().key}`}
                    class={styles.row}
                    classList={{
                      [styles.rowDestructive!]: item().destructive,
                    }}
                    disabled={item().disabled}
                    onClick={() => pick(item())}
                  >
                    <Show when={item().icon}>
                      {(icon) => <span class={styles.rowIcon}>{icon()()}</span>}
                    </Show>
                    <span class={styles.rowText}>
                      {item().label}
                      <Show when={item().note}>
                        {(note) => <span class={styles.rowNote}>{note()}</span>}
                      </Show>
                    </span>
                  </button>
                </>
              )}
            </Index>
          </div>
        </Portal>
      </Show>
    </>
  )
}
