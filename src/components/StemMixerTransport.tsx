// StemMixerTransport fits the stem mixer's state to the playback rail.
// ============================================================
//
// The rail (stem-mixer/rail/) takes values and callbacks; this file reads
// the mixer's accessors into it, and adds what only the karaoke focus pill
// has: the dock handle and its compass, the drop-zone preview while the
// handle is dragged, the exit button, and the stage toggles (waveform,
// pitch, lyrics), which sit in More as ticked rows.
//
// The compass is portalled to <body>. The pill's transform and backdrop
// filter make it the containing block for anything fixed inside it, so a
// fixed backdrop drawn inside covered the pill and nothing else, and the
// compass could not close on a press outside it. It closes by the app's
// one rule for floating panels now (use-popover-layer).

import type { Accessor, Component, Setter } from 'solid-js'
import { createEffect, createSignal, For, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import type { KeyShiftBinding } from '@/components/key-shift/KeyShiftControl'
import type { OverflowMenuItem } from '@/components/OverflowMenu'
import { MixerCapsule } from '@/components/stem-mixer/rail/MixerCapsule'
import { MixerRail } from '@/components/stem-mixer/rail/MixerRail'
import { MixerTimeline } from '@/components/stem-mixer/rail/MixerTimeline'
import { placePopover, usePopoverLayer } from '@/lib/use-popover-layer'
import { CheckSmall, GripVertical, Minimize2 } from './icons'
import styles from './StemMixerTransport.module.css'

type DockPos = 'top' | 'bottom' | 'left' | 'right'
/** [side, arrow-path, label] for the click-to-dock compass. */
const DOCK_OPTIONS: readonly (readonly [DockPos, string, string])[] = [
  ['top', 'M12 4l-6 6h4v8h4v-8h4z', 'Dock top'],
  ['bottom', 'M12 20l6-6h-4V6h-4v8H6z', 'Dock bottom'],
  ['left', 'M4 12l6-6v4h8v4h-8v4z', 'Dock left'],
  ['right', 'M20 12l-6 6v-4H6v-4h8V6z', 'Dock right'],
]

/** Pointer travel that turns a press on the handle into a drag. */
const DRAG_THRESHOLD_PX = 6

export interface StemMixerTransportProps {
  // Playback
  playing: Accessor<boolean>
  elapsed: Accessor<number>
  duration: Accessor<number>
  onStop: () => void
  onRestart: () => void
  onPlay: () => void
  onPause: () => void
  /** Moves the playhead to a time in the song, in seconds. */
  onSeek: (seconds: number) => void

  // Workspace layout (switched from the mixer header)
  performanceLayout: Accessor<boolean>

  // Mic
  micActive: Accessor<boolean>
  micError: Accessor<string>
  onToggleMic: () => void
  micMonitorEnabled: Accessor<boolean>
  onToggleMicMonitor: () => void

  // Formatting
  formatTime: (t: number) => string

  // Speed
  speed: Accessor<number>
  onSpeedChange: (speed: number) => void

  // Key
  keyControl?: KeyShiftBinding

  // Focus mode
  karaokeFocus: Accessor<boolean>
  setKaraokeFocus: Setter<boolean>
  toolbarPosition?: Accessor<DockPos>
  setToolbarPosition?: Setter<DockPos>
  showWaveform: Accessor<boolean>
  setShowWaveform: Setter<boolean>
  showPitch: Accessor<boolean>
  setShowPitch: Setter<boolean>
  showLyrics: Accessor<boolean>
  setShowLyrics: Setter<boolean>

  // Loop
  loopEnabled: Accessor<boolean>
  loopStart: Accessor<number | null>
  loopEnd: Accessor<number | null>
  /** The least time between A and B the loop rule accepts. */
  minimumLoopGap: number
  onSetLoopA: () => void
  onSetLoopB: () => void
  /** A mark dragged or stepped on the timeline. */
  onMoveLoopPoint: (which: 'A' | 'B', seconds: number) => void
  onClearLoop: () => void
  onToggleLoop: () => void
}

const tick = (on: boolean) => (on ? <CheckSmall size={16} /> : null)

export const StemMixerTransport: Component<StemMixerTransportProps> = (
  props,
) => {
  const dock = (): DockPos => props.toolbarPosition?.() ?? 'bottom'
  const isVertical = () =>
    props.karaokeFocus() && (dock() === 'left' || dock() === 'right')

  // ── Dock handle ──────────────────────────────────────────────────
  // Dual-purpose: a plain click opens the compass (fast, precise docking
  // on a desk, the Chrome DevTools "Dock side" pattern), and a drag past
  // a few pixels shows the edge it will land on (natural on touch).
  const [dragHoverZone, setDragHoverZone] = createSignal<DockPos | null>(null)
  const [compassOpen, setCompassOpen] = createSignal(false)
  const [compassPos, setCompassPos] = createSignal({ x: 0, y: 0 })
  let handle: HTMLDivElement | undefined
  let compass: HTMLDivElement | undefined
  let dragStartX = 0
  let dragStartY = 0
  let didDrag = false

  const handleDragStart = (e: PointerEvent) => {
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    dragStartX = e.clientX
    dragStartY = e.clientY
    didDrag = false
  }

  const handleDragMove = (e: PointerEvent) => {
    const target = e.currentTarget as HTMLElement | null
    if (target?.hasPointerCapture(e.pointerId) !== true) return
    if (
      !didDrag &&
      Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) <
        DRAG_THRESHOLD_PX
    ) {
      return // still within click tolerance: not a drag yet
    }
    didDrag = true
    setCompassOpen(false)

    // The edge the pointer is nearest.
    const distances: Record<DockPos, number> = {
      top: e.clientY,
      bottom: window.innerHeight - e.clientY,
      left: e.clientX,
      right: window.innerWidth - e.clientX,
    }
    let closest: DockPos = 'bottom'
    for (const zone of Object.keys(distances) as DockPos[]) {
      if (distances[zone] < distances[closest]) closest = zone
    }
    setDragHoverZone(closest)
  }

  const handleDragEnd = (e: PointerEvent) => {
    const target = e.currentTarget as HTMLElement
    if (!target.hasPointerCapture(e.pointerId)) return
    target.releasePointerCapture(e.pointerId)
    if (didDrag) {
      const zone = dragHoverZone()
      if (zone !== null) props.setToolbarPosition?.(zone)
      setDragHoverZone(null)
    } else {
      setCompassOpen((open) => !open)
    }
  }

  const dockTo = (side: DockPos) => {
    props.setToolbarPosition?.(side)
    setCompassOpen(false)
  }

  usePopoverLayer({
    open: compassOpen,
    onClose: () => setCompassOpen(false),
    inside: () => [handle, compass],
    anchor: () => handle,
  })

  createEffect(() => {
    if (!compassOpen() || handle === undefined || compass === undefined) return
    // Toward the stage, away from the edge the pill is docked on.
    const { x, y } = placePopover(
      handle.getBoundingClientRect(),
      { width: compass.offsetWidth, height: compass.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
      { axis: isVertical() ? 'inline' : 'block', align: 'start' },
    )
    setCompassPos({ x, y })
  })

  // Leaving focus mode with the compass open must not strand it.
  createEffect(() => {
    if (!props.karaokeFocus()) setCompassOpen(false)
  })

  // ── Stage toggles, in More while focus mode hides the panels' own ──
  const stageRows = (): OverflowMenuItem[] => {
    if (!props.karaokeFocus()) return []
    const rows: OverflowMenuItem[] = [
      {
        key: 'show-waveform',
        label: 'Waveform',
        checked: props.showWaveform(),
        checkType: 'checkbox',
        separatorBefore: true,
        icon: () => tick(props.showWaveform()),
        onSelect: () => props.setShowWaveform((on) => !on),
      },
    ]
    // The performance layout always shows the lyrics and never the pitch.
    if (props.performanceLayout()) return rows
    rows.push(
      {
        key: 'show-pitch',
        label: 'Pitch',
        checked: props.showPitch(),
        checkType: 'checkbox',
        icon: () => tick(props.showPitch()),
        onSelect: () => props.setShowPitch((on) => !on),
      },
      {
        key: 'show-lyrics',
        label: 'Lyrics',
        checked: props.showLyrics(),
        checkType: 'checkbox',
        icon: () => tick(props.showLyrics()),
        onSelect: () => props.setShowLyrics((on) => !on),
      },
    )
    return rows
  }

  return (
    <>
      <Show when={dragHoverZone()}>
        {(zone) => <div class={styles.dropZone} data-zone={zone()} />}
      </Show>
      <div
        class={`sm-transport ${styles.transport}`}
        data-tour="mixer.transport"
        data-dock={props.karaokeFocus() ? dock() : undefined}
        data-vertical={isVertical() ? 'true' : 'false'}
      >
        <MixerRail
          vertical={isVertical()}
          // The bottom dock's pill is as wide as what is in it; the top
          // dock's spans the stage, and the rail fills it.
          fit={props.karaokeFocus() && dock() === 'bottom'}
          capsule={
            <MixerCapsule
              playing={props.playing()}
              onPlay={() => props.onPlay()}
              onPause={() => props.onPause()}
              onStop={() => props.onStop()}
              onRestart={() => props.onRestart()}
              loopStart={props.loopStart()}
              loopEnd={props.loopEnd()}
              loopEnabled={props.loopEnabled()}
              onSetLoopA={() => props.onSetLoopA()}
              onSetLoopB={() => props.onSetLoopB()}
              onToggleLoop={() => props.onToggleLoop()}
              onClearLoop={() => props.onClearLoop()}
              speed={props.speed()}
              onSpeedChange={(speed) => props.onSpeedChange(speed)}
              keyControl={props.keyControl}
              micActive={props.micActive()}
              micError={props.micError()}
              onToggleMic={() => props.onToggleMic()}
              micMonitorEnabled={props.micMonitorEnabled()}
              onToggleMicMonitor={() => props.onToggleMicMonitor()}
              moreItems={stageRows()}
              vertical={isVertical()}
              bare={props.karaokeFocus()}
              leading={
                props.karaokeFocus() ? (
                  <div
                    ref={handle}
                    class={styles.handle}
                    classList={{ [styles.handleOpen!]: compassOpen() }}
                    data-testid="dock-handle"
                    onPointerDown={handleDragStart}
                    onPointerMove={handleDragMove}
                    onPointerUp={handleDragEnd}
                    onPointerCancel={handleDragEnd}
                    title="Click to dock (or drag)"
                  >
                    <GripVertical />
                  </div>
                ) : undefined
              }
              trailing={
                props.karaokeFocus() ? (
                  <button
                    type="button"
                    class={styles.exit}
                    onClick={() => props.setKaraokeFocus(false)}
                    title="Exit karaoke mode (Esc)"
                    aria-label="Exit karaoke mode (Esc)"
                  >
                    <Minimize2 size={14} />
                  </button>
                ) : undefined
              }
            />
          }
          timeline={
            <MixerTimeline
              elapsed={props.elapsed()}
              duration={props.duration()}
              formatTime={props.formatTime}
              onSeek={(seconds) => props.onSeek(seconds)}
              loopStart={props.loopStart()}
              loopEnd={props.loopEnd()}
              loopEnabled={props.loopEnabled()}
              minimumLoopGap={props.minimumLoopGap}
              onMoveLoopPoint={(which, seconds) =>
                props.onMoveLoopPoint(which, seconds)
              }
            />
          }
        />
      </div>

      <Show when={compassOpen()}>
        <Portal>
          <div
            ref={compass}
            class={`${styles.compass} mp-dark-stage`}
            role="group"
            aria-label="Dock the controls"
            data-testid="dock-compass"
            style={{
              left: `${compassPos().x}px`,
              top: `${compassPos().y}px`,
            }}
          >
            <For each={DOCK_OPTIONS}>
              {([side, path, label]) => (
                <button
                  type="button"
                  class={styles.compassBtn}
                  data-side={side}
                  aria-pressed={dock() === side}
                  onClick={() => dockTo(side)}
                  title={label}
                  aria-label={label}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path fill="currentColor" d={path} />
                  </svg>
                </button>
              )}
            </For>
            <span class={styles.hub} aria-hidden="true" />
          </div>
        </Portal>
      </Show>
    </>
  )
}
