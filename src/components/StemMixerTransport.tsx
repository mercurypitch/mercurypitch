// StemMixerTransport fits the stem mixer's state to the playback rail.
// ============================================================
//
// The rail (stem-mixer/rail/) takes values and callbacks; this file reads
// the mixer's accessors into it, and adds what only the karaoke focus pill
// has: the dock handle, the drop-zone preview while it is dragged, and the
// exit button.
//
// Focus mode hides the mixer header and the panels' own toggles, so the
// rail's More carries them there: the stage panels (waveform, pitch,
// lyrics), the edge the controls dock to, the workspace layout and, in the
// one layout that has it, the mixer sidebar. The layout rows and the sidebar
// row are the header's own (MixerViewControls), driven by the same object.
//
// Docking is a choice in More. The handle stays a drag handle: dragged past
// a few pixels it shows the edge it will land on (natural on touch), and a
// plain press does nothing, so it cannot open something by accident.

import type { Accessor, Component, Setter } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import type { KeyShiftBinding } from '@/components/key-shift/KeyShiftControl'
import type { OverflowMenuItem } from '@/components/OverflowMenu'
import type { MixerViewControlsProps } from '@/components/stem-mixer/MixerViewControls'
import { MIXER_LAYOUTS } from '@/components/stem-mixer/MixerViewControls'
import { MixerCapsule } from '@/components/stem-mixer/rail/MixerCapsule'
import { MixerRail } from '@/components/stem-mixer/rail/MixerRail'
import { MixerTimeline } from '@/components/stem-mixer/rail/MixerTimeline'
import { CheckSmall, GripVertical, Minimize2 } from './icons'
import styles from './StemMixerTransport.module.css'

type DockPos = 'top' | 'bottom' | 'left' | 'right'

/** The edges the focus pill docks to, as More names them. */
const DOCKS: readonly (readonly [DockPos, string])[] = [
  ['top', 'Controls at the top'],
  ['bottom', 'Controls at the bottom'],
  ['left', 'Controls on the left'],
  ['right', 'Controls on the right'],
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

  /**
   * The workspace layout and the sidebar, as the mixer header shows them.
   * More offers the same while focus mode hides the header.
   */
  view: MixerViewControlsProps

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
  // A drag past a few pixels shows the edge the pill will land on, and
  // letting go docks it there. Short of that it is a press, and does nothing.
  const [dragHoverZone, setDragHoverZone] = createSignal<DockPos | null>(null)
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
    if (!didDrag) return
    const zone = dragHoverZone()
    if (zone !== null) props.setToolbarPosition?.(zone)
    setDragHoverZone(null)
  }

  // ── More, in focus mode ──────────────────────────────────────────
  const stageRows = (): OverflowMenuItem[] => {
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
    if (props.view.layout === 'performance') return rows
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

  const dockRows = (): OverflowMenuItem[] =>
    DOCKS.map(([side, label], index) => ({
      key: `dock-${side}`,
      label,
      checked: dock() === side,
      checkType: 'radio',
      separatorBefore: index === 0,
      icon: () => tick(dock() === side),
      onSelect: () => props.setToolbarPosition?.(side),
    }))

  const viewRows = (): OverflowMenuItem[] => {
    const rows: OverflowMenuItem[] = MIXER_LAYOUTS.map((option, index) => ({
      key: `layout-${option.layout}`,
      label: option.label,
      checked: props.view.layout === option.layout,
      checkType: 'radio',
      separatorBefore: index === 0,
      icon: () => tick(props.view.layout === option.layout),
      onSelect: () => props.view.onLayoutChange(option.layout),
    }))
    // Only the fixed two-column layout has a sidebar to hide, as in the header.
    if (props.view.layout === 'fixed-2col') {
      rows.push({
        key: 'sidebar',
        label: 'Mixer sidebar',
        checked: !props.view.sidebarHidden,
        checkType: 'checkbox',
        separatorBefore: true,
        icon: () => tick(!props.view.sidebarHidden),
        onSelect: () => props.view.onToggleSidebar(),
      })
    }
    return rows
  }

  const focusRows = (): OverflowMenuItem[] =>
    props.karaokeFocus() ? [...stageRows(), ...dockRows(), ...viewRows()] : []

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
              moreItems={focusRows()}
              vertical={isVertical()}
              bare={props.karaokeFocus()}
              leading={
                props.karaokeFocus() ? (
                  <div
                    class={styles.handle}
                    data-testid="dock-handle"
                    onPointerDown={handleDragStart}
                    onPointerMove={handleDragMove}
                    onPointerUp={handleDragEnd}
                    onPointerCancel={handleDragEnd}
                    title="Drag to move the controls to another edge"
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
    </>
  )
}
