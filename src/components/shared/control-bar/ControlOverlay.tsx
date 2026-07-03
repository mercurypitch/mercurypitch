// ============================================================
// ControlOverlay — Guitar-3D-style floating chrome for a tab's control bar.
// Wraps a bespoke control bar (as children) and turns it into a canvas overlay
// that docks top or bottom-centre and can be hidden. Dock + hidden state
// persist per device, per tab (keyed by `idPrefix`).
//
// Generic across tabs: pass `containerSelector` (the positioning container used
// for drag-snap) and `idPrefix` (persist-key + data-testid namespace). Defaults
// match the Singing tab so it's a drop-in for the original SingingControlOverlay.
// ============================================================

import type { Component, JSX } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'
import { isMobile } from '@/lib/use-viewport'
import styles from './ControlOverlay.module.css'

type Dock = 'top' | 'bottom'
const isDock = (v: unknown): v is Dock => v === 'top' || v === 'bottom'

const GripIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <g fill="currentColor">
      <circle cx="5" cy="4" r="1.3" />
      <circle cx="11" cy="4" r="1.3" />
      <circle cx="5" cy="8" r="1.3" />
      <circle cx="11" cy="8" r="1.3" />
      <circle cx="5" cy="12" r="1.3" />
      <circle cx="11" cy="12" r="1.3" />
    </g>
  </svg>
)

const Chevron = (props: { dir: 'up' | 'down' }) => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      d={props.dir === 'up' ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'}
    />
  </svg>
)

interface ControlOverlayProps {
  children: JSX.Element
  /** CSS selector of the positioning container used for drag-snap docking. */
  containerSelector?: string
  /** Persist-key + data-testid namespace, one per tab (e.g. 'singing', 'piano'). */
  idPrefix?: string
  /**
   * Render the glass card in normal flow (centred), without docking/drag/hide
   * chrome — for tabs whose bar lives in the panel layout rather than over a
   * canvas (Guitar fretboard, Compose). The host owns show/hide.
   */
  static?: boolean
  /**
   * Static-only: drop the centring/flow wrapper and render the bare glass card,
   * so the host can place it inline in a row (e.g. Compose: tabs + bar in one
   * row). No effect unless `static`.
   */
  inline?: boolean
  /**
   * Initial dock side before the user has chosen one (the choice persists per
   * device). Defaults to bottom on desktop / top on small/touch. Piano and
   * Singing set this to 'top' — Piano so the bar doesn't sit over the keyboard
   * at the canvas foot, Singing so it doesn't fight the bottom-centre
   * notification toasts.
   */
  defaultDock?: Dock
}

export const ControlOverlay: Component<ControlOverlayProps> = (props) => {
  // Static per mount — safe to read once for the persist keys / test-ids.
  const prefix = props.idPrefix ?? 'singing' // eslint-disable-line solid/reactivity
  const isStatic = props.static === true // eslint-disable-line solid/reactivity
  const isInline = props.inline === true // eslint-disable-line solid/reactivity

  // Static mode: a plain glass card in flow. No dock/hide chrome. `inline`
  // drops the centring wrapper so the host can place the card in a row.
  if (isStatic) {
    const card = (
      <div
        class={styles.overlay}
        classList={{ [styles.inlineOverlay]: isInline }}
        data-testid={`${prefix}-control-overlay`}
      >
        <div class={styles.toolbarSlot}>{props.children}</div>
      </div>
    )
    return isInline ? (
      card
    ) : (
      <div class={`${styles.overlayWrap} ${styles.staticWrap}`}>{card}</div>
    )
  }

  const containerSelector = props.containerSelector ?? '#canvas-container' // eslint-disable-line solid/reactivity

  const [dock, setDock] = createPersistedSignal<Dock>(
    `mp-${prefix}-control-dock`,
    props.defaultDock ?? (isMobile() ? 'top' : 'bottom'),
    { validator: isDock },
  )
  const [hidden, setHidden] = createPersistedSignal<boolean>(
    `mp-${prefix}-control-hidden`,
    false,
  )
  // Committed horizontal nudge, px from centre (0 = centred). Applied as the
  // relatively-positioned bar's `left` — NOT a transform, so the inner
  // <select>s don't sit under a transformed ancestor (the iOS Safari bug the
  // flex-centre wrapper avoids). Persists per device/tab.
  const [offsetX, setOffsetX] = createPersistedSignal<number>(
    `mp-${prefix}-control-x`,
    0,
    { validator: (v): v is number => typeof v === 'number' && isFinite(v) },
  )
  // Live position while dragging (null when not) — kept out of the persisted
  // signal so a drag doesn't spam localStorage / cloud sync on every move.
  const [dragX, setDragX] = createSignal<number | null>(null)
  const barLeft = () => dragX() ?? offsetX()

  let overlayEl: HTMLDivElement | undefined
  let containerEl: HTMLElement | null = null

  // Keep the bar fully on-canvas: cap the nudge to half the slack between the
  // container and the bar (minus a small breathing gap).
  const clampOffset = (x: number): number => {
    const bar = overlayEl?.offsetWidth ?? 0
    const cont = containerEl?.clientWidth ?? 0
    if (bar === 0 || cont === 0) return x
    const max = Math.max(0, (cont - bar) / 2 - 8)
    return Math.max(-max, Math.min(max, x))
  }
  const reclamp = () => {
    const c = clampOffset(offsetX())
    if (c !== offsetX()) setOffsetX(c)
  }

  // Grip: click flips dock; drag repositions freely (horizontal nudge + snap to
  // the top/bottom half it's released in).
  let downX = 0
  let downY = 0
  let startOffset = 0
  let moved = false
  const onGripDown = (e: PointerEvent) => {
    downX = e.clientX
    downY = e.clientY
    moved = false
    containerEl =
      overlayEl?.closest<HTMLElement>(containerSelector) ?? containerEl
    startOffset = offsetX()
    setDragX(startOffset)
    try {
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    } catch {
      /* synthetic events / no active pointer */
    }
    e.preventDefault()
  }
  const onGripMove = (e: PointerEvent) => {
    const dx = e.clientX - downX
    const dy = e.clientY - downY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true
    if (dragX() !== null) setDragX(clampOffset(startOffset + dx))
  }
  const onGripUp = (e: PointerEvent) => {
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
    const live = dragX()
    setDragX(null)
    if (!moved) {
      setDock((d) => (d === 'top' ? 'bottom' : 'top'))
      return
    }
    if (live !== null) setOffsetX(clampOffset(live))
    const rect = containerEl?.getBoundingClientRect()
    if (rect) setDock(e.clientY - rect.top < rect.height / 2 ? 'top' : 'bottom')
  }

  // Resolve the container once mounted and re-clamp the persisted offset to the
  // current width (a value saved on a wider viewport must not push the bar
  // off-canvas here); keep it clamped as the container resizes.
  onMount(() => {
    containerEl = overlayEl?.closest<HTMLElement>(containerSelector) ?? null
    if (!containerEl || typeof ResizeObserver === 'undefined') {
      reclamp()
      return
    }
    const ro = new ResizeObserver(() => reclamp())
    ro.observe(containerEl)
    onCleanup(() => ro.disconnect())
  })

  return (
    <>
      <Show when={!hidden()}>
        <div
          class={styles.overlayWrap}
          classList={{
            [styles.top]: dock() === 'top',
            [styles.bottom]: dock() === 'bottom',
          }}
        >
          <div
            ref={overlayEl}
            class={styles.overlay}
            style={{ left: `${barLeft()}px` }}
            data-testid={`${prefix}-control-overlay`}
          >
            <div class={styles.chrome}>
              <button
                type="button"
                class={styles.grip}
                title="Drag to move · click to flip top / bottom"
                aria-label="Move control bar"
                onPointerDown={onGripDown}
                onPointerMove={onGripMove}
                onPointerUp={onGripUp}
                onPointerCancel={onGripUp}
              >
                <GripIcon />
              </button>
              <button
                type="button"
                class={styles.iconBtn}
                title="Hide controls"
                aria-label="Hide controls"
                data-testid={`${prefix}-control-hide`}
                onClick={() => setHidden(true)}
              >
                <Chevron dir={dock() === 'top' ? 'up' : 'down'} />
              </button>
            </div>
            <div class={styles.toolbarSlot}>{props.children}</div>
          </div>
        </div>
      </Show>

      <Show when={hidden()}>
        <button
          type="button"
          class={styles.showBtn}
          classList={{
            [styles.top]: dock() === 'top',
            [styles.bottom]: dock() === 'bottom',
          }}
          title="Show controls"
          aria-label="Show controls"
          data-testid={`${prefix}-control-show`}
          onClick={() => setHidden(false)}
        >
          <Chevron dir={dock() === 'top' ? 'down' : 'up'} />
        </button>
      </Show>
    </>
  )
}
