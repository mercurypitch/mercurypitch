// LoopPointMenu is the waveform's right-click menu: A or B at the time clicked.
// ============================================================
//
// Right-click a waveform or the pitch lane and the menu opens at the
// pointer with the time under it: set the loop's start or end there, or
// clear the loop. The native context menu had nothing useful to offer.
//
// It follows the app's one rule for floating panels (use-popover-layer):
// portalled to the page, so focus mode's glass pill cannot trap or cover it,
// clamped inside the viewport, and closed by a press outside, a scroll that
// moves the waveform, a resize, or Escape (the top layer only).

import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { placePopover, usePopoverLayer } from '@/lib/use-popover-layer'
import styles from './LoopPointMenu.module.css'

export interface LoopPoint {
  /** The press, in viewport pixels. */
  x: number
  y: number
  /** The song time under the press, in seconds. */
  time: number
  /** The canvas pressed: a scroll that moves it closes the menu. */
  anchor?: Element
}

export interface LoopPointMenuProps {
  point: LoopPoint | null
  formatTime: (seconds: number) => string
  /** Whether a loop exists to clear. */
  hasLoop: boolean
  onSetA: (time: number) => void
  onSetB: (time: number) => void
  onClear: () => void
  onClose: () => void
}

export const LoopPointMenu: Component<LoopPointMenuProps> = (props) => {
  let panel: HTMLDivElement | undefined
  const [pos, setPos] = createSignal({ x: 0, y: 0 })

  usePopoverLayer({
    open: () => props.point !== null,
    onClose: () => props.onClose(),
    inside: () => [panel],
    anchor: () => props.point?.anchor ?? null,
  })

  const items = (): HTMLButtonElement[] =>
    Array.from(panel?.querySelectorAll<HTMLButtonElement>('button') ?? [])

  const focusItem = (index: number): void => {
    const list = items()
    if (list.length === 0) return
    list[((index % list.length) + list.length) % list.length]?.focus()
  }

  createEffect(() => {
    const point = props.point
    if (point === null || panel === undefined) return
    const { x, y } = placePopover(
      { left: point.x, right: point.x, top: point.y, bottom: point.y },
      { width: panel.offsetWidth, height: panel.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
      { align: 'start', gap: 2 },
    )
    setPos({ x, y })
    focusItem(0)

    const onKeyDown = (event: KeyboardEvent): void => {
      if (panel?.contains(document.activeElement) !== true) return
      const current = items().indexOf(
        document.activeElement as HTMLButtonElement,
      )
      if (event.key === 'ArrowDown') focusItem(current + 1)
      else if (event.key === 'ArrowUp') focusItem(current - 1)
      else if (event.key === 'Home') focusItem(0)
      else if (event.key === 'End') focusItem(items().length - 1)
      else return
      event.preventDefault()
    }
    document.addEventListener('keydown', onKeyDown)
    onCleanup(() => document.removeEventListener('keydown', onKeyDown))
  })

  /** Run a row, then close: one menu, one choice. */
  const choose = (row: 'A' | 'B' | 'clear', time: number): void => {
    if (row === 'A') props.onSetA(time)
    else if (row === 'B') props.onSetB(time)
    else props.onClear()
    props.onClose()
  }

  return (
    <Show when={props.point}>
      {(point) => (
        <Portal>
          <div
            ref={panel}
            class={`${styles.menu} mp-dark-stage`}
            role="menu"
            aria-label={`Loop point at ${props.formatTime(point().time)}`}
            data-testid="loop-point-menu"
            style={{ left: `${pos().x}px`, top: `${pos().y}px` }}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div class={styles.time} aria-hidden="true">
              Loop point at {props.formatTime(point().time)}
            </div>
            <button
              type="button"
              role="menuitem"
              class={styles.item}
              onClick={() => choose('A', point().time)}
            >
              <span class={`${styles.dot} ${styles.dotA}`} aria-hidden="true">
                A
              </span>
              Set loop start here
            </button>
            <button
              type="button"
              role="menuitem"
              class={styles.item}
              onClick={() => choose('B', point().time)}
            >
              <span class={`${styles.dot} ${styles.dotB}`} aria-hidden="true">
                B
              </span>
              Set loop end here
            </button>
            <Show when={props.hasLoop}>
              <button
                type="button"
                role="menuitem"
                class={`${styles.item} ${styles.itemClear}`}
                onClick={() => choose('clear', point().time)}
              >
                Clear loop
              </button>
            </Show>
          </div>
        </Portal>
      )}
    </Show>
  )
}
