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
//
// THE DRAG REGION IS THE PANEL'S WHOLE TOP BAND, at least 44pt tall, with a
// 44x44 target around the grabber inside it, and a tap on that target closes
// (device round 2, R7: "the sheet's top handle is hard to grab on iOS"). The
// physics below are untouched — the same distance, the same flick velocity —
// so every existing sheet behaves as it did, with a bigger thing to hold.
//
// The band does NOT swallow the caller's own title row. Sheets put real
// controls up there (OptionsSheet's rows, the Jam picker's close), and a
// drag region over them would take their taps; `touch-action: none` on the
// band would also stop a scroll that started on one.

import type { Component, JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { createPortalSkinBridge } from '@/components/portal-skin'
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
/**
 * Travel (px) under which a press on the grabber is a TAP, not a drag.
 *
 * A tap closes, which is the second half of R7: the grabber is the one thing
 * on a sheet that looks like a control and did nothing at all when pressed.
 * The slop is deliberately small — a finger that moved further than this was
 * dragging, and a drag that stopped short must not close a sheet somebody was
 * only nudging.
 */
const TAP_SLOP = 8

export const Sheet: Component<SheetProps> = (props) => {
  const [dragY, setDragY] = createSignal(0)
  const [dragging, setDragging] = createSignal(false)
  const portalSkin = createPortalSkinBridge(() => props.isOpen)

  let panelRef: HTMLDivElement | undefined
  let pointerId: number | null = null
  let startY = 0
  let lastY = 0
  let lastT = 0
  let velocity = 0
  /** Did this press start on the grabber, and has it stayed still since? */
  let tapping = false

  useFocusTrap(() => panelRef, {
    isOpen: () => props.isOpen,
    onClose: () => props.close(),
    // Focus the panel itself, not the first row's control: an options sheet
    // leads with a native <select> (Key), which mobile browsers pop open when
    // it's focused right after the tap that opened the sheet — so tapping "⋯"
    // appeared to open both the sheet and the Key dropdown at once.
    initialFocus: () => panelRef,
  })

  /**
   * Only a press that landed on the grabber can become a tap.
   *
   * The drag band is the panel's whole top strip, which is wide enough to
   * catch a thumb resting on the sheet — a tap-to-close anywhere in it would
   * dismiss sheets nobody meant to dismiss. The grabber is the part that
   * looks like a control, so it is the part that behaves like one.
   */
  const onGrabber = (target: EventTarget | null): boolean =>
    target instanceof Element && target.closest(`.${styles.handleHit}`) !== null

  const onHandleDown = (e: PointerEvent): void => {
    pointerId = e.pointerId
    startY = e.clientY
    lastY = e.clientY
    lastT = e.timeStamp
    velocity = 0
    tapping = onGrabber(e.target)
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
    // Travel in EITHER direction ends the tap: a sheet cannot be dragged up,
    // so an upward nudge shows no movement at all and would otherwise still
    // release as a tap.
    if (Math.abs(e.clientY - startY) > TAP_SLOP) tapping = false
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
    const tapped = tapping && dragY() <= TAP_SLOP
    tapping = false
    const shouldClose =
      !cancelled &&
      (tapped || dragY() > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY)
    setDragging(false)
    setDragY(0)
    if (shouldClose) props.close()
  }

  return (
    <>
      {/* Stays in the caller's tree purely so the stage's custom properties
          resolve somewhere they still cascade. Renders nothing. */}
      <span
        ref={portalSkin.anchorRef}
        class={styles.anchor}
        aria-hidden="true"
      />
      <Show when={props.isOpen}>
        <Portal mount={document.body}>
          <div
            class={styles.backdrop}
            style={portalSkin.style()}
            onClick={() => props.close()}
          >
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={props.ariaLabel}
              tabindex="-1"
              data-testid="sheet-panel"
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
              {/* The drag band, and the grabber's own target inside it. The
                  grabber stays out of the accessibility tree on purpose: a
                  focusable close control here would change the focus order of
                  every sheet in the app, and Escape already closes one
                  (useFocusTrap, above). The tap is a touch affordance. */}
              <div
                class={styles.handleZone}
                data-testid="sheet-handle-zone"
                onPointerDown={onHandleDown}
                onPointerMove={onHandleMove}
                onPointerUp={(e) => endDrag(e, false)}
                onPointerCancel={(e) => endDrag(e, true)}
              >
                <div
                  class={styles.handleHit}
                  data-testid="sheet-handle"
                  aria-hidden="true"
                >
                  <div class={styles.handle} />
                </div>
              </div>
              {props.children}
            </div>
          </div>
        </Portal>
      </Show>
    </>
  )
}
