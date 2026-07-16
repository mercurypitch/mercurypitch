// ============================================================
// StemMixerTransport — playback transport bar
// ============================================================

import type { Component } from 'solid-js'
import type { Accessor, Setter } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import type { WorkspaceLayout } from '@/features/stem-mixer/useStemMixerLayoutController'
import { GripVertical, Headphones, Loop, Mic, Minimize2, Pause, Play, SkipBack, SlidersHorizontal, } from './icons'

export interface StemMixerTransportProps {
  // Audio / transport
  playing: Accessor<boolean>
  elapsed: Accessor<number>
  duration: Accessor<number>
  onStop: () => void
  onRestart: () => void
  onPlay: () => void
  onPause: () => void
  onSeek: (e: MouseEvent) => void

  // Layout
  workspaceLayout: Accessor<WorkspaceLayout>
  setWorkspaceLayout: Setter<WorkspaceLayout>
  sidebarHidden: Accessor<boolean>
  setSidebarHidden: Setter<boolean>
  onQueueRedraw: () => void

  // Mic
  micActive: Accessor<boolean>
  micError: Accessor<string>
  onToggleMic: () => void
  micMonitorEnabled: Accessor<boolean>
  onToggleMicMonitor: () => void

  // Formatting
  formatTime: (t: number) => string

  // Playback speed
  speed: Accessor<number>
  onSpeedChange: (speed: number) => void

  // Karaoke focus mode
  karaokeFocus: Accessor<boolean>
  setKaraokeFocus: Setter<boolean>
  toolbarPosition?: Accessor<'top' | 'bottom' | 'left' | 'right'>
  setToolbarPosition?: Setter<'top' | 'bottom' | 'left' | 'right'>
  showWaveform: Accessor<boolean>
  setShowWaveform: Setter<boolean>
  showPitch: Accessor<boolean>
  setShowPitch: Setter<boolean>
  showLyrics: Accessor<boolean>
  setShowLyrics: Setter<boolean>

  // Loop
  loopEnabled: Accessor<boolean>
  loopStart: Accessor<number>
  loopEnd: Accessor<number>
  onSetLoopA: () => void
  onSetLoopB: () => void
  onClearLoop: () => void
  onToggleLoop: () => void
}

export const StemMixerTransport: Component<StemMixerTransportProps> = (
  props,
) => {
  const hasLoop = () => props.loopEnd() > 0
  const isVertical = () =>
    props.karaokeFocus() &&
    (props.toolbarPosition?.() === 'left' ||
      props.toolbarPosition?.() === 'right')

  // Drag logic
  const [dragHoverZone, setDragHoverZone] = createSignal<
    'top' | 'bottom' | 'left' | 'right' | null
  >(null)

  const handleDragStart = (e: PointerEvent) => {
    e.preventDefault()
    const handle = e.currentTarget as HTMLElement
    handle.setPointerCapture(e.pointerId)
  }

  const handleDragMove = (e: PointerEvent) => {
    if (
      !e.currentTarget ||
      !(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)
    )
      return

    // Determine which edge we are closest to
    const x = e.clientX
    const y = e.clientY
    const w = window.innerWidth
    const h = window.innerHeight

    // Distances to edges
    const dists = {
      top: y,
      bottom: h - y,
      left: x,
      right: w - x,
    }

    // Find min distance
    let closestZone: 'top' | 'bottom' | 'left' | 'right' = 'bottom'
    let minDist = dists.bottom
    for (const [zone, dist] of Object.entries(dists)) {
      if (dist < minDist) {
        closestZone = zone as 'top' | 'bottom' | 'left' | 'right'
        minDist = dist
      }
    }

    setDragHoverZone(closestZone)
  }

  const handleDragEnd = (e: PointerEvent) => {
    const handle = e.currentTarget as HTMLElement
    if (handle.hasPointerCapture(e.pointerId)) {
      handle.releasePointerCapture(e.pointerId)
      const zone = dragHoverZone()
      if (zone && props.setToolbarPosition) {
        props.setToolbarPosition(zone)
      }
      setDragHoverZone(null)
    }
  }

  return (
    <>
      <Show when={dragHoverZone() !== null}>
        <div class={`sm-drag-overlay sm-drag-overlay--${dragHoverZone()}`} />
      </Show>
      <div
        class="sm-transport"
        data-tour="mixer.transport"
        classList={{
          'sm-transport--vertical': isVertical(),
          [`sm-transport--docked-${props.toolbarPosition?.()}`]:
            props.karaokeFocus(),
        }}
      >
        <Show when={props.karaokeFocus()}>
          <div
            class="sm-transport-drag-handle"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
            title="Drag to dock toolbar"
          >
            <GripVertical />
          </div>
        </Show>
        <div class="sm-transport-controls">
          <button
            class="sm-transport-btn sm-transport-play"
            onClick={() => (props.playing() ? props.onPause() : props.onPlay())}
          >
            {props.playing() ? <Pause /> : <Play />}
          </button>
          <button
            class="sm-transport-btn"
            onClick={() => props.onStop()}
            title="Stop"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          </button>
          <button
            class="sm-transport-btn"
            onClick={() => props.onRestart()}
            title="Restart (play from beginning)"
          >
            <SkipBack />
          </button>

          <div class="sm-focus-divider" />

          {/* Loop A / B / Toggle */}
          <button
            class="sm-icon-btn sm-loop-icon-a"
            classList={{ 'sm-loop-btn--a-set': props.loopStart() > 0 }}
            onClick={() => props.onSetLoopA()}
            title="Set loop start (A)"
          >
            <svg class="sm-loop-icon" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="11" />
              <text
                x="12"
                y="16.5"
                font-size="12"
                font-family="sans-serif"
                text-anchor="middle"
                font-weight="bold"
              >
                A
              </text>
            </svg>
          </button>
          <button
            class="sm-icon-btn sm-loop-icon-b"
            classList={{ 'sm-loop-btn--b-set': props.loopEnd() > 0 }}
            onClick={() => props.onSetLoopB()}
            title="Set loop end (B)"
          >
            <svg class="sm-loop-icon" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="11" />
              <text
                x="12"
                y="16.5"
                font-size="12"
                font-family="sans-serif"
                text-anchor="middle"
                font-weight="bold"
              >
                B
              </text>
            </svg>
          </button>
          <Show when={hasLoop()}>
            <button
              class="sm-icon-btn"
              classList={{ 'sm-loop-toggle--active': props.loopEnabled() }}
              onClick={() => props.onToggleLoop()}
              title={props.loopEnabled() ? 'Disable loop' : 'Enable loop'}
              style={{ 'margin-left': '0.5rem' }}
            >
              <Loop />
            </button>
            <button
              class="sm-icon-btn"
              onClick={() => props.onClearLoop()}
              title="Clear loop points"
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <line
                  x1="18"
                  y1="6"
                  x2="6"
                  y2="18"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <line
                  x1="6"
                  y1="6"
                  x2="18"
                  y2="18"
                  stroke="currentColor"
                  stroke-width="2"
                />
              </svg>
            </button>
          </Show>

          <div class="sm-col-toggle">
            <button
              class={`sm-col-btn${props.workspaceLayout() === 'auto-1col' ? ' sm-col-active' : ''}`}
              onClick={() => {
                props.setWorkspaceLayout('auto-1col')
                props.onQueueRedraw()
              }}
              title="Single column"
            >
              <svg viewBox="0 0 24 24" width="12" height="12">
                <rect
                  x="4"
                  y="4"
                  width="16"
                  height="16"
                  rx="1"
                  fill="currentColor"
                />
              </svg>
            </button>
            <button
              class={`sm-col-btn${props.workspaceLayout() === 'auto-2col' ? ' sm-col-active' : ''}`}
              onClick={() => {
                props.setWorkspaceLayout('auto-2col')
                props.onQueueRedraw()
              }}
              title="Two columns auto"
            >
              <svg viewBox="0 0 24 24" width="12" height="12">
                <rect
                  x="3"
                  y="4"
                  width="8"
                  height="16"
                  rx="1"
                  fill="currentColor"
                />
                <rect
                  x="13"
                  y="4"
                  width="8"
                  height="16"
                  rx="1"
                  fill="currentColor"
                />
              </svg>
            </button>
            <button
              class={`sm-col-btn${props.workspaceLayout() === 'fixed-2col' ? ' sm-col-active' : ''}`}
              data-tour="mixer.layout-fixed"
              onClick={() => {
                props.setWorkspaceLayout('fixed-2col')
                props.onQueueRedraw()
              }}
              title="Two columns fixed"
            >
              <svg viewBox="0 0 24 24" width="12" height="12">
                <rect
                  x="2"
                  y="3"
                  width="8"
                  height="18"
                  rx="1"
                  fill="currentColor"
                />
                <rect
                  x="12"
                  y="3"
                  width="10"
                  height="18"
                  rx="1"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
              </svg>
            </button>
            <button
              class={`sm-col-btn${props.workspaceLayout() === 'performance' ? ' sm-col-active' : ''}`}
              onClick={() => {
                props.setWorkspaceLayout('performance')
                props.onQueueRedraw()
              }}
              title="Performance (karaoke stage — big centered lyrics)"
            >
              <svg viewBox="0 0 24 24" width="12" height="12">
                <rect
                  x="2"
                  y="3"
                  width="14"
                  height="18"
                  rx="1"
                  fill="currentColor"
                />
                <rect
                  x="18"
                  y="3"
                  width="4"
                  height="18"
                  rx="1"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
              </svg>
            </button>
          </div>

          {/* ── Focus mode: panel visibility toggles ───────── */}
          <Show when={props.karaokeFocus()}>
            <div class="sm-focus-divider" />
            <button
              class="sm-focus-toggle-btn"
              classList={{
                'sm-focus-toggle-btn--active': props.showWaveform(),
              }}
              onClick={() => props.setShowWaveform((p) => !p)}
              title={props.showWaveform() ? 'Hide waveform' : 'Show waveform'}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              >
                <line x1="4" y1="8" x2="4" y2="16" />
                <line x1="8" y1="4" x2="8" y2="20" />
                <line x1="12" y1="10" x2="12" y2="14" />
                <line x1="16" y1="6" x2="16" y2="18" />
                <line x1="20" y1="9" x2="20" y2="15" />
              </svg>
            </button>
            {/* Pitch + lyrics toggles do nothing in the performance layout
                (lyrics always shown, pitch never) — only the waveform toggles. */}
            <Show when={props.workspaceLayout() !== 'performance'}>
              <button
                class="sm-focus-toggle-btn"
                classList={{ 'sm-focus-toggle-btn--active': props.showPitch() }}
                onClick={() => props.setShowPitch((p) => !p)}
                title={props.showPitch() ? 'Hide pitch' : 'Show pitch'}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </button>
              <button
                class="sm-focus-toggle-btn"
                classList={{
                  'sm-focus-toggle-btn--active': props.showLyrics(),
                }}
                onClick={() => props.setShowLyrics((p) => !p)}
                title={props.showLyrics() ? 'Hide lyrics' : 'Show lyrics'}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </button>
            </Show>
          </Show>

          <div class="sm-focus-divider" />

          {/* ── Mic toggle (always visible) ────────────────── */}
          <button
            class={`sm-mic-toggle-btn${props.micActive() ? ' sm-mic-toggle-btn--active' : ''}${props.micError() ? ' sm-mic-toggle-btn--error' : ''}`}
            onClick={() => {
              void props.onToggleMic()
            }}
            title={
              props.micError()
                ? props.micError()
                : props.micActive()
                  ? 'Disable microphone'
                  : 'Enable microphone pitch comparison'
            }
            disabled={!!props.micError()}
          >
            <Mic />
          </button>

          {/* ── Mic monitor (hear yourself) ──────────────── */}
          <Show when={props.micActive()}>
            <button
              class={`sm-mic-toggle-btn${props.micMonitorEnabled() ? ' sm-mic-toggle-btn--active' : ''}`}
              onClick={() => props.onToggleMicMonitor()}
              title={
                props.micMonitorEnabled()
                  ? 'Mute self-monitoring'
                  : 'Hear my voice over the track (use headphones)'
              }
            >
              <Headphones />
            </button>
          </Show>

          {/* ── Speed selector (always visible) ──────────── */}
          <select
            class="sm-speed-select"
            value={props.speed().toString()}
            onChange={(e) => {
              props.onSpeedChange(parseFloat(e.currentTarget.value))
            }}
            title="Playback speed"
          >
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.2">1.2x</option>
            <option value="1.5">1.5x</option>
            <option value="1.75">1.75x</option>
            <option value="2">2x</option>
          </select>

          {/* ── Sidebar toggle (visible in fixed-2col, both modes) ── */}
          <Show when={props.workspaceLayout() === 'fixed-2col'}>
            <button
              class="sm-sidebar-toggle"
              classList={{
                'sm-sidebar-toggle--active': !props.sidebarHidden(),
              }}
              onClick={() => props.setSidebarHidden((prev) => !prev)}
              title={
                props.sidebarHidden()
                  ? 'Show mixer sidebar'
                  : 'Hide mixer sidebar'
              }
            >
              <SlidersHorizontal />
            </button>
          </Show>

          {/* ── Focus mode: exit button ───────────────────── */}
          <Show when={props.karaokeFocus()}>
            <div class="sm-focus-divider" />
            <button
              class="sm-focus-exit-btn"
              onClick={() => props.setKaraokeFocus(false)}
              title="Exit karaoke mode (Esc)"
            >
              <Minimize2 size={14} />
            </button>
          </Show>
        </div>

        <Show when={!isVertical()}>
          <div class="sm-progress-area">
            <span class="sm-time">{props.formatTime(props.elapsed())}</span>
            <div class="sm-progress-bar" onClick={(e) => props.onSeek(e)}>
              <div
                class="sm-progress-fill"
                style={{
                  width: `${props.duration() > 0 ? (props.elapsed() / props.duration()) * 100 : 0}%`,
                }}
              />
              <Show when={props.loopEnd() > 0}>
                <div
                  class="sm-progress-loop"
                  style={{
                    left: `${(props.loopStart() / props.duration()) * 100}%`,
                    width: `${((props.loopEnd() - props.loopStart()) / props.duration()) * 100}%`,
                  }}
                />
              </Show>
            </div>
            <span class="sm-time">{props.formatTime(props.duration())}</span>
          </div>
        </Show>
      </div>
    </>
  )
}
