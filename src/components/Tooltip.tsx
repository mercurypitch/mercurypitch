// ============================================================
// Tooltip — Minimal custom tooltip (GH #150)
// ============================================================

import type { Component, ParentProps } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import styles from './Tooltip.module.css'

type Placement = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps extends ParentProps {
  text: string
  placement?: Placement
}

/**
 * Wraps children and shows a styled tooltip on hover.
 * Usage: <Tooltip text="Do something">Button</Tooltip>
 */
export const Tooltip: Component<TooltipProps> = (props) => {
  const [visible, setVisible] = createSignal(false)
  let showTimer: ReturnType<typeof setTimeout> | undefined

  const placement = () => props.placement ?? 'top'

  const handleMouseEnter = () => {
    showTimer = setTimeout(() => setVisible(true), 400)
  }

  const handleMouseLeave = () => {
    if (showTimer !== undefined) {
      clearTimeout(showTimer)
      showTimer = undefined
    }
    setVisible(false)
  }

  const placementClass: Record<Placement, string> = {
    top: styles.tooltipTop,
    bottom: styles.tooltipBottom,
    left: styles.tooltipLeft,
    right: styles.tooltipRight,
  }

  return (
    <span
      class={styles.tooltipWrapper}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {props.children}
      <Show when={visible() && props.text}>
        <span
          class={`${styles.tooltip} ${placementClass[placement()]}`}
          role="tooltip"
        >
          {props.text}
        </span>
      </Show>
    </span>
  )
}
