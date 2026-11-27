// ============================================================
// Studio context menu — a menu at the pointer, for a right-click or a long press on the Studio's lanes
// ============================================================
//
// One menu at a time, in a portal under <body> so no lane clips it. It
// opens where it was asked for and inside the window (context-menu.ts),
// takes the focus on its first item, and answers the keys a menu does: the
// arrows, Home and End, Enter or Space to choose, Escape or Tab to leave.
// It closes by the app's rule for floating panels (use-popover-layer.ts): a
// press outside, a scroll, a resize. Leaving gives the focus back to where
// it was asked from. An item says the key that does the same, where there
// is one, and an item that is on or off says which.
import { createEffect, For, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { CheckSmall } from '@/components/icons'
import { usePopoverLayer } from '@/lib/use-popover-layer'
import { isStudioMenuKey, placeStudioMenu, stepStudioMenu, } from './context-menu'
import styles from './StudioContextMenu.module.css'

export interface StudioMenuItem {
  /** Stable identity for the row. */
  readonly key: string
  readonly label: string
  /** A second line, where the label alone would mislead. */
  readonly note?: string
  /** The key that does the same, as `aria-keyshortcuts` names it. */
  readonly shortcut?: string
  /** On or off: a checkbox item. Absent for a plain action. */
  readonly checked?: boolean
  readonly disabled?: boolean
  /** Undoable, but it takes something away: drawn apart, in the danger colour. */
  readonly danger?: boolean
  readonly separatorBefore?: boolean
  select(): void
}

export interface StudioMenuRequest {
  /** Where it was asked for, in viewport pixels. */
  readonly x: number
  readonly y: number
  /** Names the menu for a screen reader. */
  readonly label: string
  readonly items: readonly StudioMenuItem[]
  /** Where the focus goes back to when the menu closes. */
  readonly returnFocus?: HTMLElement | null
}

export function StudioContextMenu(props: {
  request: StudioMenuRequest | null
  onClose(): void
}) {
  let panel: HTMLDivElement | undefined
  const rows: HTMLButtonElement[] = []

  function close(focus: boolean): void {
    const back = props.request?.returnFocus
    props.onClose()
    if (focus && back?.isConnected === true) back.focus({ preventScroll: true })
  }

  usePopoverLayer({
    open: () => props.request !== null,
    inside: () => [panel],
    onClose: (reason) => close(reason === 'escape'),
  })

  // Placed once it has a size, then the first item it can choose takes the focus.
  createEffect(() => {
    const request = props.request
    if (request === null || panel === undefined) return
    rows.length = request.items.length
    const at = placeStudioMenu(
      request,
      { width: panel.offsetWidth, height: panel.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    )
    panel.style.left = `${at.x}px`
    panel.style.top = `${at.y}px`
    const first = stepStudioMenu(enabled(), -1, 'Home')
    rows[first]?.focus({ preventScroll: true })
  })

  const enabled = () =>
    (props.request?.items ?? []).map((item) => item.disabled !== true)

  function keyDown(event: KeyboardEvent): void {
    if (isStudioMenuKey(event.key)) {
      event.preventDefault()
      const at = rows.indexOf(document.activeElement as HTMLButtonElement)
      rows[stepStudioMenu(enabled(), at, event.key)]?.focus()
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      close(true)
    }
  }

  function choose(item: StudioMenuItem): void {
    if (item.disabled === true) return
    close(true)
    item.select()
  }

  onCleanup(() => {
    rows.length = 0
  })

  return (
    <Show when={props.request}>
      {(request) => (
        <Portal>
          <div
            ref={panel}
            class={styles.menu}
            role="menu"
            aria-label={request().label}
            data-studio-menu=""
            onKeyDown={keyDown}
            onContextMenu={(event) => event.preventDefault()}
          >
            <For each={request().items}>
              {(item, index) => (
                <>
                  <Show when={item.separatorBefore === true && index() > 0}>
                    <div class={styles.separator} role="separator" />
                  </Show>
                  <button
                    ref={(row) => (rows[index()] = row)}
                    type="button"
                    class={styles.item}
                    classList={{ [styles.danger]: item.danger === true }}
                    role={
                      item.checked === undefined
                        ? 'menuitem'
                        : 'menuitemcheckbox'
                    }
                    aria-checked={
                      item.checked === undefined ? undefined : item.checked
                    }
                    aria-keyshortcuts={item.shortcut}
                    disabled={item.disabled === true}
                    tabIndex={-1}
                    data-studio-menu-item={item.key}
                    onClick={() => choose(item)}
                  >
                    <span class={styles.check} aria-hidden="true">
                      <Show when={item.checked === true}>
                        <CheckSmall size={14} />
                      </Show>
                    </span>
                    <span class={styles.words}>
                      <span class={styles.label}>{item.label}</span>
                      <Show when={item.note}>
                        <span class={styles.note}>{item.note}</span>
                      </Show>
                    </span>
                    <Show when={item.shortcut}>
                      <kbd class={styles.shortcut} aria-hidden="true">
                        {item.shortcut}
                      </kbd>
                    </Show>
                  </button>
                </>
              )}
            </For>
          </div>
        </Portal>
      )}
    </Show>
  )
}
