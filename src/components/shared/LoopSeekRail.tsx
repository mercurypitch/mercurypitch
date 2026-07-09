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

  const startMarkerDrag = (which: 'A' | 'B') => (e: PointerEvent) => {
    e.preventDefault()
    e.stopPropagation() // don't let the rail read this as a seek-click
    setDragTarget(which)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMarkerDrag = (e: PointerEvent) => {
    const which = dragTarget()
    if (which === null) return
    e.preventDefault()
    const beat = beatFromClientX(e.clientX)
    if (which === 'A') props.onMoveLoopA?.(beat)
    else props.onMoveLoopB?.(beat)
  }
  const endMarkerDrag = (e: PointerEvent) => {
    if (dragTarget() === null) return
    const el = e.currentTarget as HTMLElement
    if (el.hasPointerCapture?.(e.pointerId))
      el.releasePointerCapture(e.pointerId)
    setDragTarget(null)
    suppressSeek = true
    setTimeout(() => {
      suppressSeek = false
    }, 0)
  }

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
          onPointerDown={startMarkerDrag('A')}
          onPointerMove={onMarkerDrag}
          onPointerUp={endMarkerDrag}
          onPointerCancel={endMarkerDrag}
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
          onPointerDown={startMarkerDrag('B')}
          onPointerMove={onMarkerDrag}
          onPointerUp={endMarkerDrag}
          onPointerCancel={endMarkerDrag}
          onClick={(e) => e.stopPropagation()}
        >
          <span class={styles.loopMarkerFlag}>B</span>
        </div>
      </Show>
    </div>
  )
}
