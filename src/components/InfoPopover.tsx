// ============================================================
// InfoPopover — the little "i" that explains a thing
// ============================================================
//
// Use this for every 'i' / '?' affordance. Hand-rolling one is a trap
// with three jaws, and the first version of the badge hints fell into
// all three (see docs/agent/MISTAKES.md):
//
//   1. It never closed. A <details> or a boolean signal opens fine and
//      then stays open — clicking elsewhere, scrolling, or navigating to
//      another tab leaves it hanging over the new screen.
//   2. It was clipped. Positioned inside its own card, the first card in
//      a row opens its panel past the container's edge and the text is
//      cut in half.
//   3. It went under the furniture. A panel inside a card cannot escape
//      that card's stacking context, so the sidebar (z-index 200) drew
//      straight over it.
//
// A portal to <body> fixes 2 and 3 outright: no ancestor overflow can
// clip it and no ancestor stacking context can bury it. 1 is the
// listeners below, and the cleanup that removes them.

import type { Component, JSX } from 'solid-js'
import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import styles from './InfoPopover.module.css'

interface InfoPopoverProps {
  /** What the panel says. */
  children: JSX.Element
  /** Describes the thing being explained, for screen readers. */
  label: string
  /** Glyph on the trigger. Default 'i'. */
  glyph?: string
  /** Extra class for the trigger, for per-surface placement. */
  class?: string
  /**
   * An element whose hover opens the panel, on pointer devices only.
   *
   * For cards where the whole tile is the affordance and the 'i' is just
   * the visible marker: hovering anywhere on it explains the thing,
   * leaving closes. Touch devices report `hover: none` and are left with
   * tap, which is the only thing that works there anyway.
   */
  hoverAnchor?: () => HTMLElement | undefined
}

/** Clear of the viewport edge, so the panel never sits flush against it. */
const MARGIN = 8
/** Above the sidebar (200) and the app chrome, below modals (10000+). */
const GAP = 8

export const InfoPopover: Component<InfoPopoverProps> = (props) => {
  const [open, setOpen] = createSignal(false)
  const [pos, setPos] = createSignal({ x: 0, y: 0 })
  let trigger: HTMLButtonElement | undefined
  let panel: HTMLDivElement | undefined

  const place = (): void => {
    if (trigger === undefined || panel === undefined) return
    const t = trigger.getBoundingClientRect()
    const w = panel.offsetWidth
    const h = panel.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Centred on the trigger, then pulled back inside the viewport. This
    // is what stops the leftmost card's panel hanging off the edge.
    let x = t.left + t.width / 2 - w / 2
    x = Math.min(Math.max(MARGIN, x), Math.max(MARGIN, vw - w - MARGIN))

    // Below by default; above when there is no room, so a badge near the
    // bottom of the page does not open off-screen.
    let y = t.bottom + GAP
    if (y + h > vh - MARGIN && t.top - GAP - h > MARGIN) y = t.top - GAP - h

    setPos({ x, y })
  }

  createEffect(() => {
    if (!open()) return
    place()

    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Node | null
      if (target === null) return
      // A click on the trigger is the toggle's own business.
      if (trigger?.contains(target) === true) return
      if (panel?.contains(target) === true) return
      setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    // Scrolling would leave the panel stranded where the trigger used to
    // be, so close rather than chase it. Capture, because the scroll may
    // happen in any ancestor.
    const onScroll = (): void => {
      setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', place)

    onCleanup(() => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', place)
    })
  })

  // Hover-to-open, for callers that pass a host element.
  createEffect(() => {
    const host = props.hoverAnchor?.()
    if (host === undefined) return
    if (!window.matchMedia?.('(hover: hover)').matches) return

    const enter = (): void => {
      setOpen(true)
    }
    const leave = (): void => {
      setOpen(false)
    }
    host.addEventListener('mouseenter', enter)
    host.addEventListener('mouseleave', leave)
    onCleanup(() => {
      host.removeEventListener('mouseenter', enter)
      host.removeEventListener('mouseleave', leave)
    })
  })

  // Navigating away unmounts the trigger; the portal would otherwise
  // outlive it and hang over the next screen.
  onCleanup(() => {
    setOpen(false)
  })

  return (
    <>
      <button
        ref={trigger}
        type="button"
        class={`${styles.trigger} ${props.class ?? ''}`}
        aria-label={props.label}
        aria-expanded={open()}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        {props.glyph ?? 'i'}
      </button>
      <Show when={open()}>
        <Portal>
          <div
            ref={panel}
            class={styles.panel}
            role="tooltip"
            style={{ left: `${pos().x}px`, top: `${pos().y}px` }}
          >
            {props.children}
          </div>
        </Portal>
      </Show>
    </>
  )
}
