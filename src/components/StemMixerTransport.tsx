// ============================================================
// StemMixerTransport — playback transport bar
// ============================================================

import type { Component } from 'solid-js'
import type { Accessor, Setter } from 'solid-js'
import { Show } from 'solid-js'
import type { WorkspaceLayout } from '@/features/stem-mixer/useStemMixerLayoutController'
import { Mic, Pause, Play, SkipBack, SlidersHorizontal } from './icons'

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
}

export const StemMixerTransport: Component<StemMixerTransportProps> = (
  props,
) => {
  return (
    <div class="sm-transport">
      <div class="sm-transport-controls">
        <button class="sm-transport-btn" onClick={props.onStop} title="Stop">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
        </button>
        <button
          class="sm-transport-btn"
          onClick={props.onRestart}
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

        <div class="sm-zoom-control">
          <button
            class="sm-zoom-btn"
            onClick={() =>
              props.setWindowDuration((prev) => Math.max(10, prev - 5))
            }
            title="Zoom in (shorter window)"
          >
            −
          </button>
          <span class="sm-zoom-value">{props.windowDuration()}s</span>
          <button
            class="sm-zoom-btn"
            onClick={() =>
              props.setWindowDuration((prev) => Math.min(150, prev + 5))
            }
            title="Zoom out (longer window)"
          >
            +
          </button>
        </div>

        <Show when={props.workspaceLayout() === 'fixed-2col'}>
          <button
            class="sm-sidebar-toggle"
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
      </div>

      <div class="sm-progress-area">
        <span class="sm-time">{props.formatTime(props.elapsed())}</span>
        <div class="sm-progress-bar" onClick={props.onSeek}>
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
