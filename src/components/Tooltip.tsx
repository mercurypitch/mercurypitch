// ============================================================
// Tooltip — Minimal custom tooltip (GH #150)
// ============================================================

import type { Component, ParentProps } from 'solid-js'
import { createSignal, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import styles from './Tooltip.module.css'

type Placement = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps extends ParentProps {
  text: string
  placement?: Placement
  /** Also toggle on click/tap — hover doesn't exist on touch devices. */
  clickToggle?: boolean
}

const GAP = 6

/** How the tooltip box hangs off its anchor point, per placement. */
const TRANSFORMS: Record<Placement, string> = {
  top: 'translate(-50%, -100%)',
  bottom: 'translate(-50%, 0)',
  left: 'translate(-100%, -50%)',
  right: 'translate(0, -50%)',
}

/**
 * Wraps children and shows a styled tooltip on hover (400ms delay).
 * Usage: <Tooltip text="Do something">Button</Tooltip>
 * With `clickToggle`, a click/tap toggles it too (for touch devices).
 *
 * The tooltip renders through a document-level portal with fixed
 * positioning, so ancestors with overflow clipping (control bars,
 * scrollable panels) can't cut it off.
 */
export const Tooltip: Component<TooltipProps> = (props) => {
  const [visible, setVisible] = createSignal(false)
  const [pos, setPos] = createSignal({ top: 0, left: 0 })
  let wrapperRef: HTMLSpanElement | undefined
  let showTimer: ReturnType<typeof setTimeout> | undefined

  const placement = () => props.placement ?? 'top'

  const show = () => {
    const rect = wrapperRef?.getBoundingClientRect()
    if (!rect) return
    switch (placement()) {
      case 'top':
        setPos({ top: rect.top - GAP, left: rect.left + rect.width / 2 })
        break
      case 'bottom':
        setPos({ top: rect.bottom + GAP, left: rect.left + rect.width / 2 })
        break
      case 'left':
        setPos({ top: rect.top + rect.height / 2, left: rect.left - GAP })
        break
      case 'right':
        setPos({ top: rect.top + rect.height / 2, left: rect.right + GAP })
        break
    }
    setVisible(true)
  }

  const clearTimer = () => {
    if (showTimer !== undefined) {
      clearTimeout(showTimer)
      showTimer = undefined
    }
  }

  const handleMouseEnter = () => {
    showTimer = setTimeout(show, 400)
  }

  const handleMouseLeave = () => {
    clearTimer()
    setVisible(false)
  }

  const handleClick = () => {
    if (props.clickToggle !== true) return
    clearTimer()
    if (visible()) setVisible(false)
    else show()
  }

  onCleanup(clearTimer)

  return (
    <span
      ref={wrapperRef}
      class={styles.tooltipWrapper}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {props.children}
      <Show when={visible() && props.text}>
        <Portal>
          <span
            class={styles.tooltip}
            role="tooltip"
            style={{
              top: `${pos().top}px`,
              left: `${pos().left}px`,
              transform: TRANSFORMS[placement()],
            }}
          >
            {props.text}
          </span>
        </Portal>
      </Show>
    </span>
  )
}
