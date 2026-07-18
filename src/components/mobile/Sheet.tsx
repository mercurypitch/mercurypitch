// ============================================================
// Sheet — the mobile bottom sheet.
// ============================================================
//
// Extracted from KaraokeMobileStage's song sheet and upgraded per
// mobile-kit.md: backdrop tap closes, the grab handle actually drags
// (pointer-captured, dismiss on distance or flick velocity), focus is
// trapped like every modal (Modal convention: isOpen + close +
// useFocusTrap), and inner scrolling is contained so the page never
// rubber-bands behind it.
//
// Renders in place (no portal): a `position: fixed` box escapes to the
// viewport anyway — StageShell has no transform/filter — and staying in
// the tree lets a stage's --sheet-* custom properties cascade in
// (convention #8). Drag applies a transient transform to the panel only
// while the finger is down; at rest there is no transform, so iOS
// <select> pickers inside sheets are safe from the WebKit
// transformed-ancestor bug (see AppSidebar.module.css).

import type { Component, JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { useFocusTrap } from '@/lib/use-focus-trap'
import styles from './Sheet.module.css'

interface SheetProps {
  isOpen: boolean
  close: () => void
  ariaLabel: string
  /** 'content' (default) sizes to content up to the max height;
      'tall' pins the sheet at its max height. */
  snap?: 'content' | 'tall'
  class?: string
  children: JSX.Element
}

/** Finger travel (px) beyond which release dismisses the sheet. */
const DISMISS_DISTANCE = 90
/** Flick speed (px/ms) that dismisses regardless of distance. */
const DISMISS_VELOCITY = 0.55

export const Sheet: Component<SheetProps> = (props) => {
  const [dragY, setDragY] = createSignal(0)
  const [dragging, setDragging] = createSignal(false)

  let panelRef: HTMLDivElement | undefined
  let pointerId: number | null = null
  let startY = 0
  let lastY = 0
  let lastT = 0
  let velocity = 0

  useFocusTrap(() => panelRef, {
    isOpen: () => props.isOpen,
    onClose: () => props.close(),
    // Focus the panel itself, not the first row's control: an options sheet
    // leads with a native <select> (Key), which mobile browsers pop open when
    // it's focused right after the tap that opened the sheet — so tapping "⋯"
    // appeared to open both the sheet and the Key dropdown at once.
    initialFocus: () => panelRef,
  })

  const onHandleDown = (e: PointerEvent): void => {
    pointerId = e.pointerId
    startY = e.clientY
    lastY = e.clientY
    lastT = e.timeStamp
    velocity = 0
    setDragging(true)
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* pointer already gone — the move/up guards still match by id */
    }
  }

  const onHandleMove = (e: PointerEvent): void => {
    if (pointerId !== e.pointerId) return
    const dt = e.timeStamp - lastT
    if (dt > 0) velocity = (e.clientY - lastY) / dt
    lastY = e.clientY
    lastT = e.timeStamp
    setDragY(Math.max(0, e.clientY - startY))
  }

  const endDrag = (e: PointerEvent, cancelled: boolean): void => {
    if (pointerId !== e.pointerId) return
    pointerId = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* capture never took */
    }
    const shouldClose =
      !cancelled && (dragY() > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY)
    setDragging(false)
    setDragY(0)
    if (shouldClose) props.close()
  }

  return (
    <Show when={props.isOpen}>
      <div class={styles.backdrop} onClick={() => props.close()}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={props.ariaLabel}
          tabindex="-1"
          classList={{
            [styles.panel]: true,
            [styles.tall]: props.snap === 'tall',
            [styles.dragging]: dragging(),
            [props.class ?? '']: props.class !== undefined,
          }}
          style={
            dragY() > 0 ? { transform: `translateY(${dragY()}px)` } : undefined
          }
          onClick={(e) => e.stopPropagation()}
        >
          <div
            class={styles.handleZone}
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={(e) => endDrag(e, false)}
            onPointerCancel={(e) => endDrag(e, true)}
          >
            <div class={styles.handle} aria-hidden="true" />
          </div>
          {props.children}
        </div>
      </div>
    </Show>
  )
}
