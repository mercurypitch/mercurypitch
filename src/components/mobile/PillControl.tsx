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

import type { Component, JSX } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
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

  let rootRef: HTMLButtonElement | undefined
  let pointerId: number | null = null
  let startY = 0
  let startLevel = 0
  let dragged = false

  const onPointerDown = (e: PointerEvent): void => {
    pointerId = e.pointerId
    startY = e.clientY
    startLevel = props.level
    dragged = false
    setExpanded(true)
    if (collapseTimer) clearTimeout(collapseTimer)
    try {
      rootRef?.setPointerCapture(e.pointerId)
    } catch {
      /* pointer already gone — the move/up guards still match by id */
    }
  }

  const onPointerMove = (e: PointerEvent): void => {
    if (pointerId !== e.pointerId) return
    const dy = startY - e.clientY
    if (!dragged && Math.abs(dy) < DRAG_THRESHOLD_PX) return
    dragged = true
    const range = props.dragRange ?? 70
    props.onLevel(Math.max(0, Math.min(1, startLevel + dy / range)))
  }

  const onPointerUp = (e: PointerEvent): void => {
    if (pointerId !== e.pointerId) return
    pointerId = null
    try {
      rootRef?.releasePointerCapture(e.pointerId)
    } catch {
      /* capture never took */
    }
    if (!dragged) props.onTap()
    scheduleCollapse()
  }

  const onPointerCancel = (e: PointerEvent): void => {
    if (pointerId !== e.pointerId) return
    pointerId = null
    try {
      rootRef?.releasePointerCapture(e.pointerId)
    } catch {
      /* capture never took */
    }
    scheduleCollapse()
  }

  const onClick = (e: MouseEvent): void => {
    if (e.detail === 0) props.onTap()
  }

  return (
    <button
      ref={rootRef}
      classList={{
        [styles.pill]: true,
        [styles.off]: props.off,
        [styles.expanded]: expanded(),
        [props.class ?? '']: props.class !== undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={onClick}
      title={props.title}
      aria-label={props.ariaLabel}
      aria-pressed={props.off}
    >
      <div class={styles.track}>
        <div
          class={styles.fill}
          style={{ height: `${Math.round(props.level * 100)}%` }}
        />
      </div>
      <div class={styles.base}>{props.children}</div>
    </button>
  )
}
