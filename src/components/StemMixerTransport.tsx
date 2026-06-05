// ============================================================
// StemMixerTransport — playback transport bar
// ============================================================

import type { Component } from 'solid-js'
import type { Accessor, Setter } from 'solid-js'
import { Show } from 'solid-js'
import type { WorkspaceLayout } from '@/features/stem-mixer/useStemMixerLayoutController'
import { Mic, Minimize2, Pause, Play, SkipBack, SlidersHorizontal, } from './icons'

export interface StemMixerTransportProps {
  // Audio / transport
  playing: Accessor<boolean>
  elapsed: Accessor<number>
  duration: Accessor<number>
  windowDuration: Accessor<number>
  setWindowDuration: Setter<number>
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

  // Formatting
  formatTime: (t: number) => string

  // Playback speed
  speed: Accessor<number>
  onSpeedChange: (speed: number) => void

  // Karaoke focus mode
  karaokeFocus: Accessor<boolean>
  setKaraokeFocus: Setter<boolean>
  showWaveform: Accessor<boolean>
  setShowWaveform: Setter<boolean>
  showPitch: Accessor<boolean>
  setShowPitch: Setter<boolean>
  showLyrics: Accessor<boolean>
  setShowLyrics: Setter<boolean>
}

export const StemMixerTransport: Component<StemMixerTransportProps> = (
  props,
) => {
  return (
    <div class="sm-transport">
      <div class="sm-transport-controls">
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
        <button
          class="sm-transport-btn sm-transport-play"
          onClick={() => (props.playing() ? props.onPause() : props.onPlay())}
        >
          {props.playing() ? <Pause /> : <Play />}
        </button>

        <Show when={!props.karaokeFocus()}>
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
          </div>
        </Show>

        {/* ── Focus mode: panel visibility toggles ───────── */}
        <Show when={props.karaokeFocus()}>
          <div class="sm-focus-divider" />
          <button
            class="sm-focus-toggle-btn"
            classList={{ 'sm-focus-toggle-btn--active': props.showWaveform() }}
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
            classList={{ 'sm-focus-toggle-btn--active': props.showLyrics() }}
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

        <Show when={!props.karaokeFocus()}>
          <div class="sm-zoom-control">
            <button
              class="sm-zoom-btn"
              onClick={() => {
                props.setWindowDuration((prev) => Math.max(10, prev - 5))
                props.onQueueRedraw()
              }}
              title="Zoom in (shorter window)"
            >
              −
            </button>
            <span class="sm-zoom-value">{props.windowDuration()}s</span>
            <button
              class="sm-zoom-btn"
              onClick={() => {
                props.setWindowDuration((prev) => Math.min(150, prev + 5))
                props.onQueueRedraw()
              }}
              title="Zoom out (longer window)"
            >
              +
            </button>
          </div>
        </Show>

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

      <div class="sm-progress-area">
        <span class="sm-time">{props.formatTime(props.elapsed())}</span>
        <div class="sm-progress-bar" onClick={(e) => props.onSeek(e)}>
          <div
            class="sm-progress-fill"
            style={{
              width: `${props.duration() > 0 ? (props.elapsed() / props.duration()) * 100 : 0}%`,
            }}
          />
        </div>
        <span class="sm-time">{props.formatTime(props.duration())}</span>
      </div>
    </div>
  )
}
