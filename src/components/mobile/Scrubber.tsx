// ============================================================
// Scrubber — pointer-captured seek bar with scrub preview.
// ============================================================
//
// Extracted verbatim from KaraokeMobileStage's progress row. While the
// finger is down the fill follows the touch (preview) without seeking;
// release commits one seek; pointercancel aborts without seeking. The
// parent can mirror the preview (e.g. in a time readout) via onScrub.
//
// Skin via --scrubber-* props; the tap zone is padded well past the 4px
// track so it meets the touch-target rule.

import type { Component } from 'solid-js'
import { createSignal } from 'solid-js'
import styles from './Scrubber.module.css'

interface ScrubberProps {
  /** Elapsed seconds (drives the fill when not scrubbing). */
  value: number
  /** Total seconds; a non-positive duration disables interaction. */
  duration: number
  /** Commit a seek (fires once, on release). */
  onSeek: (t: number) => void
  /** Preview while dragging: seconds, or null when the drag ends. */
  onScrub?: (t: number | null) => void
  class?: string
}

export const Scrubber: Component<ScrubberProps> = (props) => {
  const [scrub, setScrub] = createSignal<number | null>(null)

  let trackRef: HTMLDivElement | undefined
  let pointerId: number | null = null

  const pct = (): number => {
    if (props.duration <= 0) return 0
    const t = scrub() ?? props.value
    return Math.max(0, Math.min(100, (t / props.duration) * 100))
  }

  const setPreview = (t: number | null): void => {
    setScrub(t)
    props.onScrub?.(t)
  }

  const timeFromPointer = (e: PointerEvent): number => {
    const rect = trackRef!.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    return (x / rect.width) * props.duration
  }

  const onDown = (e: PointerEvent): void => {
    if (props.duration <= 0) return
    pointerId = e.pointerId
    setPreview(timeFromPointer(e))
    try {
      trackRef?.setPointerCapture(e.pointerId)
    } catch {
      /* pointer already gone — the move/up guards still match by id */
    }
  }

  const onMove = (e: PointerEvent): void => {
    if (pointerId !== e.pointerId) return
    setPreview(timeFromPointer(e))
  }

  const onUp = (e: PointerEvent): void => {
    if (pointerId !== e.pointerId) return
    pointerId = null
    try {
      trackRef?.releasePointerCapture(e.pointerId)
    } catch {
      /* capture never took */
    }
    const t = scrub()
    setPreview(null)
    if (t !== null) props.onSeek(t)
  }

  const onCancel = (e: PointerEvent): void => {
    if (pointerId !== e.pointerId) return
    pointerId = null
    try {
      trackRef?.releasePointerCapture(e.pointerId)
    } catch {
      /* capture never took */
    }
    setPreview(null)
  }

  return (
    <div
      ref={trackRef}
      class={`${styles.scrubber} ${props.class ?? ''}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
    >
      <div class={styles.track}>
        <div class={styles.fill} style={{ width: `${pct()}%` }} />
      </div>
    </div>
  )
}
