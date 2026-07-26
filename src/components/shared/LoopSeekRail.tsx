// ============================================================
// LoopSeekRail — the glass seek rail with a progress fill, an A-B loop
// region overlay, and draggable A/B markers. Shared by the Singing and
// Piano/Guitar status bars (SingingStatusBar, MidiSongStatusBar), which used
// to carry a near-verbatim copy of this block each. The parent still owns the
// surrounding time labels; this owns the rail, the seek click, and the marker
// drag lifecycle. Styling comes from the shared SongStatusBar.module.css.
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { loopRegionPct } from '@/lib/ab-loop'
import type { DragGestureOptions } from './drag-gesture'
import { dragGesture } from './drag-gesture'
import styles from './status-bar/SongStatusBar.module.css'

interface LoopSeekRailProps {
  /** Playback position + length, in beats. */
  playheadBeat: () => number
  totalBeats: () => number
  /** Seek to a beat (from a rail click). */
  onSeek: (beat: number) => void
  // A-B loop (beats; 0 = unset). Optional — a bar with no loop leaves these
  // undefined and only the fill renders.
  loopA?: () => number
  loopB?: () => number
  loopEnabled?: () => boolean
  /** Drag the A / B markers (beats). Absent → markers are not draggable. */
  onMoveLoopA?: (beat: number) => void
  onMoveLoopB?: (beat: number) => void
  /** Namespaces the rail's data-testid (`${prefix}-seek-rail`). */
  testIdPrefix: string
}

export const LoopSeekRail: Component<LoopSeekRailProps> = (props) => {
  let railEl: HTMLDivElement | undefined
  const [dragTarget, setDragTarget] = createSignal<'A' | 'B' | null>(null)

  // Set for one tick after a marker drag so the drag's synthesized pointer-up
  // click doesn't also seek the rail.
  let suppressSeek = false

  const beatFromClientX = (clientX: number): number => {
    if (!railEl) return 0
    const rect = railEl.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * props.totalBeats()
  }

  const handleSeek = (e: MouseEvent) => {
    if (suppressSeek) {
      suppressSeek = false
      return
    }
    props.onSeek(beatFromClientX(e.clientX))
  }

  const progressPct = () =>
    props.totalBeats() > 0
      ? (Math.max(0, props.playheadBeat()) / props.totalBeats()) * 100
      : 0

  const region = () =>
    loopRegionPct(
      props.loopA?.() ?? 0,
      props.loopB?.() ?? 0,
      props.totalBeats(),
    )
  const pctOf = (beat: number): number =>
    props.totalBeats() > 0 ? (beat / props.totalBeats()) * 100 : 0

  const startMarkerDrag = (which: 'A' | 'B', e: PointerEvent): void => {
    e.stopPropagation() // don't let the rail read this as a seek-click
    setDragTarget(which)
  }
  const endMarkerDrag = (): void => {
    if (dragTarget() === null) return
    setDragTarget(null)
    suppressSeek = true
    setTimeout(() => {
      suppressSeek = false
    }, 0)
  }

  const markerDragOptions = (which: 'A' | 'B'): DragGestureOptions => ({
    canStart: () =>
      which === 'A'
        ? props.onMoveLoopA !== undefined
        : props.onMoveLoopB !== undefined,
    onStart: (event) => startMarkerDrag(which, event),
    onEnd: endMarkerDrag,
    stopPropagation: true,
    slider: {
      getAriaLabel: () =>
        which === 'A' ? 'Loop start marker' : 'Loop end marker',
      getValue: () =>
        which === 'A' ? (props.loopA?.() ?? 0) : (props.loopB?.() ?? 0),
      getMin: () =>
        which === 'A' ? 0 : Math.min(props.loopA?.() ?? 0, props.totalBeats()),
      getMax: () =>
        which === 'A'
          ? Math.max(0, props.loopB?.() ?? props.totalBeats())
          : props.totalBeats(),
      getStep: () => 0.25,
      getValueFromPointer: (event) => beatFromClientX(event.clientX),
      getValueText: () => {
        const beat =
          which === 'A' ? (props.loopA?.() ?? 0) : (props.loopB?.() ?? 0)
        return `${beat.toFixed(2)} beats`
      },
      isDisabled: () =>
        which === 'A'
          ? props.onMoveLoopA === undefined
          : props.onMoveLoopB === undefined,
      onChange: (beat) => {
        if (which === 'A') props.onMoveLoopA?.(beat)
        else props.onMoveLoopB?.(beat)
      },
    },
  })
  const markerADrag = markerDragOptions('A')
  const markerBDrag = markerDragOptions('B')

  return (
    <div
      ref={railEl}
      class={styles.rail}
      onClick={handleSeek}
      title="Seek"
      data-testid={`${props.testIdPrefix}-seek-rail`}
    >
      <div class={styles.fill} style={{ width: `${progressPct()}%` }} />
      <Show when={region()}>
        {(r) => (
          <div
            class={styles.loopRegion}
            classList={{
              [styles.loopRegionActive]: props.loopEnabled?.() ?? false,
            }}
            style={{ left: `${r().left}%`, width: `${r().width}%` }}
            data-testid="loop-region"
          />
        )}
      </Show>
      <Show when={(props.loopA?.() ?? 0) > 0}>
        <div
          class={`${styles.loopMarker} ${styles.loopMarkerA}`}
          classList={{ [styles.loopMarkerDragging]: dragTarget() === 'A' }}
          style={{ left: `${pctOf(props.loopA?.() ?? 0)}%` }}
          title="Drag to move loop start (A)"
          data-testid="loop-marker-a"
          ref={(element) => dragGesture(element, () => markerADrag)}
          onClick={(e) => e.stopPropagation()}
        >
          <span class={styles.loopMarkerFlag}>A</span>
        </div>
      </Show>
      <Show when={(props.loopB?.() ?? 0) > 0}>
        <div
          class={`${styles.loopMarker} ${styles.loopMarkerB}`}
          classList={{ [styles.loopMarkerDragging]: dragTarget() === 'B' }}
          style={{ left: `${pctOf(props.loopB?.() ?? 0)}%` }}
          title="Drag to move loop end (B)"
          data-testid="loop-marker-b"
          ref={(element) => dragGesture(element, () => markerBDrag)}
          onClick={(e) => e.stopPropagation()}
        >
          <span class={styles.loopMarkerFlag}>B</span>
        </div>
      </Show>
    </div>
  )
}
