// ============================================================
// SingingControlOverlay — Guitar-3D-style floating chrome for the
// practice control bar. Wraps the existing SharedControlToolbar
// (passed as children, so every control + test-id is preserved) and
// turns it into a canvas overlay that docks top or bottom-centre and
// can be hidden. Dock + hidden state persist per device.
//
// Phase 1 of the singing redesign: the toolbar logic stays in
// SharedControlToolbar (still used by Compose/Piano/Guitar); this only
// adds the positioned glass shell around it on the Singing tab.
// ============================================================

import type { Component, JSX } from 'solid-js'
import { Show } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'
import styles from './SingingControlOverlay.module.css'

type Dock = 'top' | 'bottom'
const isDock = (v: unknown): v is Dock => v === 'top' || v === 'bottom'

const DOCK_KEY = 'mp-singing-control-dock'
const HIDDEN_KEY = 'mp-singing-control-hidden'

// Touch / small screens default to the top dock (the bottom rail sits under
// the thumbs); desktop defaults to the centred bottom bar. Explicit choice wins.
const prefersTopDock = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return false
  return window.matchMedia('(max-width: 768px), (pointer: coarse)').matches
}

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

export const SingingControlOverlay: Component<{ children: JSX.Element }> = (
  props,
) => {
  const [dock, setDock] = createPersistedSignal<Dock>(
    DOCK_KEY,
    prefersTopDock() ? 'top' : 'bottom',
    { validator: isDock },
  )
  const [hidden, setHidden] = createPersistedSignal<boolean>(HIDDEN_KEY, false)

  // Grip: click flips dock; drag snaps to the half it's released in.
  let downY = 0
  let moved = false
  let containerEl: HTMLElement | null = null
  const onGripDown = (e: PointerEvent) => {
    downY = e.clientY
    moved = false
    containerEl = (e.currentTarget as HTMLElement).closest('#canvas-container')
    try {
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    } catch {
      /* synthetic events / no active pointer */
    }
    e.preventDefault()
  }
  const onGripMove = (e: PointerEvent) => {
    if (Math.abs(e.clientY - downY) > 4) moved = true
  }
  const onGripUp = (e: PointerEvent) => {
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
    if (!moved) {
      setDock((d) => (d === 'top' ? 'bottom' : 'top'))
      return
    }
    const rect = containerEl?.getBoundingClientRect()
    if (rect) setDock(e.clientY - rect.top < rect.height / 2 ? 'top' : 'bottom')
  }

  return (
    <>
      <Show when={!hidden()}>
        <div
          class={styles.overlay}
          classList={{
            [styles.top]: dock() === 'top',
            [styles.bottom]: dock() === 'bottom',
          }}
          data-testid="singing-control-overlay"
        >
          <div class={styles.chrome}>
            <button
              type="button"
              class={styles.grip}
              title="Drag to move (top / bottom) · click to flip"
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
              data-testid="singing-control-hide"
              onClick={() => setHidden(true)}
            >
              <Chevron dir={dock() === 'top' ? 'up' : 'down'} />
            </button>
          </div>
          <div class={styles.toolbarSlot}>{props.children}</div>
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
          data-testid="singing-control-show"
          onClick={() => setHidden(false)}
        >
          <Chevron dir={dock() === 'top' ? 'down' : 'up'} />
        </button>
      </Show>
    </>
  )
}
