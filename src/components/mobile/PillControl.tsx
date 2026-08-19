// ============================================================
// PillControl — tap-to-toggle + vertical-drag-to-set-level.
// ============================================================
//
// Extracted verbatim from KaraokeMobileStage's "sing" pill: a capsule
// button where a tap toggles and a vertical drag sets a 0..1 level on a
// slide-out track. All the touch hardening carries over: pointer capture,
// a 7px threshold separating tap from drag, pointercancel treated as
// "not a tap" (system edge-swipe, incoming-call sheet, palm rejection),
// and keyboard/AT activation via click.detail === 0 so touch taps don't
// double-fire. Collapses back to the capsule ~1.4s after the finger lifts.
//
// Placement and skin are the consumer's: pass a `class` that positions the
// pill and overrides --pill-* custom properties (convention #8).
//
// Two optional halves on top of that, added for the mixer's music level and
// unused by the vocals pill it was extracted from:
//
//  - `valueLabel` draws a readout over the track while the pill is open, so
//    a level with units (a percentage, a decibel) can say what it is.
//  - `keyStep` turns the capsule into a real slider for assistive tech and
//    the keyboard. A tap-to-toggle button is enough for "mute the vocals";
//    it is not enough for a control whose whole purpose is the value.

import type { Component, JSX } from 'solid-js'
import { createSignal, onCleanup, Show } from 'solid-js'
import type { DragGestureOptions } from '@/components/shared/drag-gesture'
import { dragGesture } from '@/components/shared/drag-gesture'
import styles from './PillControl.module.css'

interface PillControlProps {
  /** Current level, 0..1 — drives the fill height. */
  level: number
  /** Renders the off/muted skin state (fill reads 0 via `level`). */
  off: boolean
  /** A tap (not a drag) — toggle your state here. */
  onTap: () => void
  /** Continuous level updates while dragging. */
  onLevel: (v: number) => void
  /** Icon shown in the capsule base. */
  children: JSX.Element
  class?: string
  title?: string
  ariaLabel: string
  /** Finger travel (px) that maps to the full 0..1 range. Fixed so the
      maths stay stable while the expand animation runs. */
  dragRange?: number
  /** Readout drawn over the track while the pill is open, e.g. "160%". */
  valueLabel?: string
  /** The level in the consumer's own units, for assistive technology. */
  valueText?: string
  /**
   * How far one arrow key moves the level, as a fraction of the range.
   *
   * Passing it makes the capsule announce itself as a slider and answer the
   * keyboard. Without it the pill stays a toggle that happens to accept a
   * drag, which is all the vocals pill ever needed.
   */
  keyStep?: number
  testId?: string
}

const DRAG_THRESHOLD_PX = 7
const COLLAPSE_DELAY_MS = 1400

export const PillControl: Component<PillControlProps> = (props) => {
  const [expanded, setExpanded] = createSignal(false)

  let collapseTimer: ReturnType<typeof setTimeout> | undefined
  const scheduleCollapse = (): void => {
    if (collapseTimer) clearTimeout(collapseTimer)
    collapseTimer = setTimeout(() => setExpanded(false), COLLAPSE_DELAY_MS)
  }
  onCleanup(() => {
    if (collapseTimer) clearTimeout(collapseTimer)
  })

  let startY = 0
  let startLevel = 0
  let dragged = false

  const pillDrag: DragGestureOptions = {
    onStart: (event) => {
      startY = event.clientY
      startLevel = props.level
      dragged = false
      setExpanded(true)
      if (collapseTimer) clearTimeout(collapseTimer)
    },
    onMove: (event) => {
      const dy = startY - event.clientY
      if (!dragged && Math.abs(dy) < DRAG_THRESHOLD_PX) return
      dragged = true
      const range = props.dragRange ?? 70
      props.onLevel(Math.max(0, Math.min(1, startLevel + dy / range)))
    },
    onEnd: (_event, reason) => {
      if (reason === 'pointerup' && !dragged) props.onTap()
      scheduleCollapse()
    },
  }

  const onClick = (e: MouseEvent): void => {
    if (e.detail === 0) props.onTap()
  }

  const isSlider = (): boolean => props.keyStep !== undefined
  const clamp = (value: number): number => Math.max(0, Math.min(1, value))

  const onKeyDown = (event: KeyboardEvent): void => {
    const step = props.keyStep
    if (step === undefined) return
    const move: Record<string, number> = {
      ArrowUp: step,
      ArrowRight: step,
      ArrowDown: -step,
      ArrowLeft: -step,
      PageUp: step * 2,
      PageDown: -step * 2,
    }
    const delta = move[event.key]
    if (delta !== undefined) {
      event.preventDefault()
      setExpanded(true)
      scheduleCollapse()
      props.onLevel(clamp(props.level + delta))
      return
    }
    if (event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    setExpanded(true)
    scheduleCollapse()
    props.onLevel(event.key === 'Home' ? 0 : 1)
  }

  return (
    <button
      ref={(element) => dragGesture(element, () => pillDrag)}
      classList={{
        [styles.pill]: true,
        [styles.off]: props.off,
        [styles.expanded]: expanded(),
        [props.class ?? '']: props.class !== undefined,
      }}
      onClick={onClick}
      onKeyDown={onKeyDown}
      data-testid={props.testId}
      title={props.title}
      aria-label={props.ariaLabel}
      // A slider must not also claim to be a pressed toggle: the two roles
      // answer different keys and screen readers announce only one of them.
      role={isSlider() ? 'slider' : undefined}
      aria-pressed={isSlider() ? undefined : props.off}
      aria-valuemin={isSlider() ? 0 : undefined}
      aria-valuemax={isSlider() ? 100 : undefined}
      aria-valuenow={isSlider() ? Math.round(props.level * 100) : undefined}
      aria-valuetext={props.valueText}
    >
      <div class={styles.track}>
        <div
          class={styles.fill}
          style={{ height: `${Math.round(props.level * 100)}%` }}
        />
        <Show when={props.valueLabel !== undefined && expanded()}>
          <span class={styles.value} aria-hidden="true">
            {props.valueLabel}
          </span>
        </Show>
      </div>
      <div class={styles.base}>{props.children}</div>
    </button>
  )
}
