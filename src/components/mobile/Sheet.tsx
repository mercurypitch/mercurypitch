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
// Portalled to document.body, with the stage's skin carried across by hand.
//
// This used to render in place, on the reasoning that a `position: fixed`
// box escapes to the viewport anyway — "StageShell has no transform/filter"
// — and that staying in the tree let a stage's --sheet-* custom properties
// cascade in (convention #8). The first half of that was verified against
// exactly one caller and is false for the others. `position: fixed` is only
// viewport-relative while NO ancestor creates a containing block or a clip
// for it, and `transform`, `filter`, `backdrop-filter`, `will-change` and
// `contain` all do. JamPanel is built from blurred glass layers over a
// photographic room, inside `.mainArea { overflow: hidden }` — so the Jam
// song picker opened as a squashed, uninteractable band pinned to the
// transport row instead of a sheet, on a phone, where it is the only way in.
//
// Portalling makes the sheet immune to every one of those triggers rather
// than to the one that was found, which matters because a stage can grow a
// `filter` at any time and nothing would fail until somebody opened a sheet
// on a phone.
//
// The cascade the old approach bought is preserved deliberately: an
// in-place anchor stays behind, and every custom property that resolves on it
// is copied onto the portalled backdrop when the sheet opens. Forwarding only
// `--sheet-*` is not enough: sheet children also consume caller-local tokens
// such as Zen's `--zen-*` / `--pitch-*` and Jam's surface palette. Copying the
// complete custom-property cascade keeps existing callers themed without
// coupling this shared primitive to each feature's token names.
//
// Drag applies a transient transform to the panel only while the finger is
// down; at rest there is no transform, so iOS <select> pickers inside
// sheets are safe from the WebKit transformed-ancestor bug (see
// AppSidebar.module.css).

import type { Component, JSX } from 'solid-js'
import { createEffect, createSignal, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
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

/** Resolve the caller's custom-property cascade before moving content to the
 * body portal. Browsers expose inherited custom properties on the anchor's
 * computed style; walking outward as well makes the bridge resilient in DOM
 * implementations that enumerate only properties declared on each element.
 * The nearest declaration wins, matching normal CSS inheritance. */
function resolvedCustomProperties(anchor: Element): Record<string, string> {
  const resolved: Record<string, string> = {}
  let node: Element | null = anchor
  while (node !== null) {
    const computed = window.getComputedStyle(node)
    for (let index = 0; index < computed.length; index += 1) {
      const name = computed.item(index)
      if (!name.startsWith('--') || name in resolved) continue
      const value = computed.getPropertyValue(name).trim()
      if (value !== '') resolved[name] = value
    }
    node = node.parentElement
  }
  return resolved
}

export const Sheet: Component<SheetProps> = (props) => {
  const [dragY, setDragY] = createSignal(0)
  const [dragging, setDragging] = createSignal(false)
  const [skin, setSkin] = createSignal<Record<string, string>>({})

  let panelRef: HTMLDivElement | undefined
  let anchorRef: HTMLSpanElement | undefined
  let pointerId: number | null = null
  let startY = 0
  let lastY = 0
  let lastT = 0
  let velocity = 0

  // Sample the complete custom-property cascade from where the caller
  // actually sits, on open. A fixed allowlist silently de-themes sheet
  // children that consume feature-local tokens after they move through the
  // portal (the Zen guide uses --zen-* and --pitch-*, for example).
  createEffect(() => {
    if (!props.isOpen) return
    const anchor = anchorRef
    if (anchor === undefined) return
    if (
      typeof window === 'undefined' ||
      typeof window.getComputedStyle !== 'function'
    )
      return
    setSkin(resolvedCustomProperties(anchor))
  })

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
    <>
      {/* Stays in the caller's tree purely so the stage's custom properties
          resolve somewhere they still cascade. Renders nothing. */}
      <span ref={anchorRef} class={styles.anchor} aria-hidden="true" />
      <Show when={props.isOpen}>
        <Portal mount={document.body}>
          <div
            class={styles.backdrop}
            style={skin()}
            onClick={() => props.close()}
          >
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
                dragY() > 0
                  ? { transform: `translateY(${dragY()}px)` }
                  : undefined
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
        </Portal>
      </Show>
    </>
  )
}
