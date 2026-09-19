// ── JamSplitHandle ────────────────────────────────────────────────────
// The seam between the words and the lanes, and you can move it.
//
// The stage shipped with a fixed 3fr / 2fr split, which is one person's
// guess applied to every screen. On a wide desktop it left the lyric
// column with a hand's width of empty paper and the pitch lanes too
// narrow to show a phrase; on a laptop the same ratio is about right.
// Rather than pick a better constant, let the singer decide and remember
// what they chose (jam-view-prefs) -- it is a view preference, so it
// never reaches the room.
//
// A real `separator`, not a div with a pointerdown handler: a focusable
// separator IS the window-splitter role, so a keyboard gets the arrows,
// Home and End for free semantics, and a screen reader announces a
// percentage rather than "clickable".

import type { Component } from 'solid-js'
import { onMount } from 'solid-js'
import { dragGesture } from '@/components/shared/drag-gesture'
import styles from './JamSplitHandle.module.css'

export interface JamSplitHandleProps {
  /** True while the stage is one column with the lanes underneath. */
  stacked: () => boolean
  /** Percent of the stage the lyric column takes. */
  share: () => number
  min: () => number
  max: () => number
  /** The element the share is measured against. */
  container: () => HTMLElement | undefined
  onShare: (next: number) => void
  onReset: () => void
}

/** Arrow-key nudge, in percentage points. */
const KEY_STEP = 2

export const JamSplitHandle: Component<JamSplitHandleProps> = (props) => {
  let handleRef: HTMLDivElement | undefined

  /** Where the pointer sits, as a share of the container it is over. */
  const shareAtPointer = (event: PointerEvent): number | null => {
    const box = props.container()
    if (box === undefined) return null
    const rect = box.getBoundingClientRect()
    if (props.stacked()) {
      if (rect.height <= 0) return null
      return ((event.clientY - rect.top) / rect.height) * 100
    }
    if (rect.width <= 0) return null
    return ((event.clientX - rect.left) / rect.width) * 100
  }

  onMount(() => {
    const element = handleRef
    if (element === undefined) return
    dragGesture(element, () => ({
      // Touch has no buttons; a right-click on a separator is a context
      // menu, not a drag.
      canStart: (event) => event.pointerType === 'touch' || event.button === 0,
      onStart: (event) => {
        element.dataset.dragging = 'true'
        const next = shareAtPointer(event)
        if (next !== null) props.onShare(next)
      },
      onMove: (event) => {
        const next = shareAtPointer(event)
        if (next !== null) props.onShare(next)
      },
      onEnd: () => {
        delete element.dataset.dragging
      },
    }))
  })

  const onKeyDown = (event: KeyboardEvent): void => {
    let next: number | undefined
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        next = props.share() - KEY_STEP
        break
      case 'ArrowRight':
      case 'ArrowDown':
        next = props.share() + KEY_STEP
        break
      case 'Home':
        next = props.min()
        break
      case 'End':
        next = props.max()
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        props.onReset()
        return
      default:
        return
    }
    event.preventDefault()
    props.onShare(next)
  }

  return (
    <div
      ref={handleRef}
      class={styles.handle}
      classList={{ [styles.handleStacked]: props.stacked() }}
      data-testid="jam-split-handle"
      role="separator"
      tabIndex={0}
      aria-label="Resize the lyrics against the pitch lanes"
      aria-orientation={props.stacked() ? 'horizontal' : 'vertical'}
      aria-valuemin={props.min()}
      aria-valuemax={props.max()}
      aria-valuenow={Math.round(props.share())}
      aria-valuetext={`Lyrics take ${Math.round(props.share())} percent`}
      title="Drag to trade space between the words and the lanes. Double-click to reset."
      onKeyDown={onKeyDown}
      onDblClick={() => props.onReset()}
    >
      <span class={styles.grip} aria-hidden="true" />
    </div>
  )
}
