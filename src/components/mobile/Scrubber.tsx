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
import type { DragGestureOptions } from '@/components/shared/drag-gesture'
import { dragGesture } from '@/components/shared/drag-gesture'
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

  const scrubberDrag: DragGestureOptions = {
    onStart: (event) => setPreview(timeFromPointer(event)),
    onEnd: (_event, reason) => {
      const t = scrub()
      setPreview(null)
      if (reason === 'pointerup' && t !== null) props.onSeek(t)
    },
    slider: {
      getAriaLabel: () => 'Playback position',
      getValue: () => scrub() ?? props.value,
      getMin: () => 0,
      getMax: () => Math.max(0, props.duration),
      getStep: () => 1,
      getValueFromPointer: timeFromPointer,
      isDisabled: () => props.duration <= 0,
      onChange: (value) => props.onSeek(value),
      onPointerValue: setPreview,
    },
  }

  return (
    <div
      ref={(element) => {
        trackRef = element
        dragGesture(element, () => scrubberDrag)
      }}
      class={`${styles.scrubber} ${props.class ?? ''}`}
    >
      <div class={styles.track}>
        <div class={styles.fill} style={{ width: `${pct()}%` }} />
      </div>
    </div>
  )
}
