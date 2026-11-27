// Studio clip menu — a clip's menu at the pointer, or by the button that opened it, its rows in OverflowMenu's plain shape so a shared Studio menu can take them in as they are.
//
// It follows the app's one rule for floating panels (use-popover-layer):
// portalled to the page, clamped inside the viewport, and closed by a press
// outside, a scroll that moves what opened it, a resize, or Escape, which
// gives the focus back to what opened it. The page's own theme tokens
// paint it: the Studio's are scoped to its page, which a portal leaves.
// The checked row takes the focus first, so Enter on a menu the keyboard
// opened changes nothing.
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { CheckSmall } from '@/components/icons'
import type { OverflowMenuItem } from '@/components/OverflowMenu'
import type { PopoverAnchorRect } from '@/lib/use-popover-layer'
import { placePopover, usePopoverLayer } from '@/lib/use-popover-layer'
import styles from './StudioClipMenu.module.css'

/** Where a clip menu opens, and what opened it. */
export interface StudioClipMenuAnchor {
  /** What the menu hangs from, in viewport pixels: the pointer, or a button. */
  readonly rect: PopoverAnchorRect
  /** What opened it: it gets the focus back, and a scroll that moves it closes the menu. */
  readonly element: HTMLElement
}

interface StudioClipMenuProps {
  anchor: StudioClipMenuAnchor | null
  label: string
  items: readonly OverflowMenuItem[]
  onClose(): void
}

const roleOf = (item: OverflowMenuItem) => {
  if (item.checked === undefined) return 'menuitem'
  return item.checkType === 'checkbox' ? 'menuitemcheckbox' : 'menuitemradio'
}

/** The anchor of a menu opened from `element`: at the pointer, or by the element for a key's menu. */
export function studioClipMenuAnchor(
  event: MouseEvent,
  element: HTMLElement,
): StudioClipMenuAnchor {
  const box = element.getBoundingClientRect()
  // The menu key and Shift+F10 come with no pointer over the element.
  const pointer =
    event.clientX >= box.left &&
    event.clientX <= box.right &&
    event.clientY >= box.top &&
    event.clientY <= box.bottom &&
    (event.clientX !== 0 || event.clientY !== 0)
  const rect = pointer
    ? {
        left: event.clientX,
        right: event.clientX,
        top: event.clientY,
        bottom: event.clientY,
      }
    : { left: box.left, right: box.left, top: box.bottom, bottom: box.bottom }
  return { rect, element }
}

export function StudioClipMenu(props: StudioClipMenuProps) {
  let panel: HTMLDivElement | undefined
  const [pos, setPos] = createSignal({ x: 0, y: 0 })
  const close = (focusBack: boolean) => {
    const opener = props.anchor?.element
    props.onClose()
    if (focusBack) opener?.focus({ preventScroll: true })
  }
  usePopoverLayer({
    open: () => props.anchor !== null,
    onClose: (reason) => close(reason === 'escape'),
    inside: () => [panel, props.anchor?.element],
    anchor: () => props.anchor?.element ?? null,
  })
  const rows = (): HTMLButtonElement[] =>
    Array.from(
      panel?.querySelectorAll<HTMLButtonElement>(
        '[role^="menuitem"]:not([disabled])',
      ) ?? [],
    )
  const focusRow = (index: number) => {
    const list = rows()
    if (list.length === 0) return
    list[((index % list.length) + list.length) % list.length]?.focus()
  }
  createEffect(() => {
    const anchor = props.anchor
    if (anchor === null || panel === undefined) return
    setPos(
      placePopover(
        anchor.rect,
        { width: panel.offsetWidth, height: panel.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
        { align: 'start', gap: 2 },
      ),
    )
    const checked = rows().findIndex(
      (row) => row.getAttribute('aria-checked') === 'true',
    )
    focusRow(Math.max(0, checked))
    const onKeyDown = (event: KeyboardEvent) => {
      if (panel?.contains(document.activeElement) !== true) return
      const at = rows().indexOf(document.activeElement as HTMLButtonElement)
      if (event.key === 'ArrowDown') focusRow(at + 1)
      else if (event.key === 'ArrowUp') focusRow(at - 1)
      else if (event.key === 'Home') focusRow(0)
      else if (event.key === 'End') focusRow(rows().length - 1)
      else return
      event.preventDefault()
      event.stopPropagation()
    }
    document.addEventListener('keydown', onKeyDown, true)
    onCleanup(() => document.removeEventListener('keydown', onKeyDown, true))
  })
  const pick = (item: OverflowMenuItem) => {
    if (item.disabled === true) return
    close(true)
    item.onSelect()
  }
  return (
    <Show when={props.anchor}>
      <Portal>
        <div
          ref={panel}
          class={styles.menu}
          role="menu"
          aria-label={props.label}
          data-studio-clip-menu=""
          style={{ left: `${pos().x}px`, top: `${pos().y}px` }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <For each={props.items}>
            {(item, index) => (
              <>
                <Show when={index() > 0 && item.separatorBefore === true}>
                  <div class={styles.divider} role="separator" />
                </Show>
                <button
                  type="button"
                  role={roleOf(item)}
                  aria-checked={item.checked}
                  class={styles.row}
                  disabled={item.disabled}
                  data-studio-menu-row={item.key}
                  onClick={() => pick(item)}
                >
                  <span class={styles.mark} aria-hidden="true">
                    <Show when={item.checked === true}>
                      <CheckSmall size={14} />
                    </Show>
                  </span>
                  <span class={styles.text}>{item.label}</span>
                </button>
              </>
            )}
          </For>
        </div>
      </Portal>
    </Show>
  )
}
