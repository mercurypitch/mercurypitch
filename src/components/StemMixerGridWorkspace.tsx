// ============================================================
// StemMixerGridWorkspace — grid layout (auto-1col, auto-2col)
// ============================================================

import type { Component } from 'solid-js'
import type { Accessor, Setter } from 'solid-js'
import { Show } from 'solid-js'
import type { WorkspaceLayout, WorkspacePanel, } from '@/features/stem-mixer/useStemMixerLayoutController'
import type { StemMixerLyricsPanelBodyProps } from './StemMixerLyricsPanelBody'
import { StemMixerLyricsPanelBody } from './StemMixerLyricsPanelBody'
import type { StemMixerStemControlsProps } from './StemMixerStemControls'
import { StemMixerStemControls } from './StemMixerStemControls'

interface StemMixerGridWorkspaceProps {
  // Layout
  workspaceLayout: Accessor<WorkspaceLayout>
  panelStyle: (id: string) => { order: number; height?: string }
  getPanel: (id: string) => WorkspacePanel
  handlePanelDragStart: (id: string, order: number, e: PointerEvent) => void
  handlePanelDragMove: (e: PointerEvent) => void
  handlePanelDragEnd: (e: PointerEvent) => void
  handleResizeStart: (id: string, e: PointerEvent) => void

  // Canvas
  setCanvasRef: (id: string) => (el: HTMLCanvasElement) => void
  handleWaveformClick: (e: MouseEvent) => void
  handleCanvasWheel: (e: WheelEvent) => void

  // Audio
  setWindowDuration: Setter<number>

  // Stem controls
  stemControls: Omit<StemMixerStemControlsProps, 'direction'>

  // Lyrics panel body props
  lyricsPanel: Omit<StemMixerLyricsPanelBodyProps, 'idSuffix'>

  // Lyrics header actions (not in lyricsPanel)
  handleForceSearch: () => void
  toggleEditMode: () => void
  startLrcGen: () => void
  handleDownloadLrc: () => void
  lyricsFileInputRef: (el: HTMLInputElement) => void
  handleLyricsChange: (e: Event) => void
  triggerChangeFile: () => void

  // Conditional MIDI
  showMidi: Accessor<boolean>

  // Workspace ref + wheel handler
  workspaceRef: (el: HTMLDivElement) => void
  onWorkspaceWheel: (e: WheelEvent) => void
}

export const StemMixerGridWorkspace: Component<StemMixerGridWorkspaceProps> = (
  props,
) => {
  const lp = props.lyricsPanel
  return (
    <Show when={props.workspaceLayout() !== 'fixed-2col'}>
      <div
        ref={props.workspaceRef}
        class="sm-workspace"
        style={{
          'grid-template-columns':
            props.workspaceLayout() === 'auto-1col' ? '1fr' : '1fr 1fr',
        }}
        onWheel={props.onWorkspaceWheel}
      >
        {/* Panel: Waveform Overview */}
        <div
          class="sm-workspace-panel"
          style={props.panelStyle('overview')}
          data-panel-id="overview"
        >
          <div
            class="sm-panel-header"
            onPointerDown={(e) =>
              props.handlePanelDragStart(
                'overview',
                props.getPanel('overview').order,
                e,
              )
            }
            onPointerMove={props.handlePanelDragMove}
            onPointerUp={props.handlePanelDragEnd}
            onPointerCancel={props.handlePanelDragEnd}
          >
            <svg
              viewBox="0 0 24 24"
              width="10"
              height="10"
              class="sm-drag-icon"
            >
              <path fill="currentColor" d="M20 9H4v2h16V9zM4 15h16v-2H4v2z" />
            </svg>
            Waveform Overview
          </div>
          <canvas
            ref={props.setCanvasRef('overview')}
            class="sm-canvas sm-canvas-overview"
            onClick={props.handleWaveformClick}
            onWheel={props.handleCanvasWheel}
          />
          <div
            class="sm-resize-handle"
            onPointerDown={(e) => props.handleResizeStart('overview', e)}
          />
        </div>

        {/* Panel: Live Waveform */}
        <div
          class="sm-workspace-panel"
          style={props.panelStyle('live')}
          data-panel-id="live"
        >
          <div
            class="sm-panel-header"
            onPointerDown={(e) =>
              props.handlePanelDragStart(
                'live',
                props.getPanel('live').order,
                e,
              )
            }
            onPointerMove={props.handlePanelDragMove}
            onPointerUp={props.handlePanelDragEnd}
            onPointerCancel={props.handlePanelDragEnd}
          >
            <svg
              viewBox="0 0 24 24"
              width="10"
              height="10"
              class="sm-drag-icon"
            >
              <path fill="currentColor" d="M20 9H4v2h16V9zM4 15h16v-2H4v2z" />
            </svg>
            Live Waveform
          </div>
          <canvas
            ref={props.setCanvasRef('live')}
            class="sm-canvas sm-canvas-live"
            onWheel={props.handleCanvasWheel}
          />
          <div
            class="sm-resize-handle"
            onPointerDown={(e) => props.handleResizeStart('live', e)}
          />
        </div>

        {/* Panel: Vocal Pitch */}
        <div
          class="sm-workspace-panel"
          style={props.panelStyle('pitch')}
          data-panel-id="pitch"
        >
          <div
            class="sm-panel-header"
            onPointerDown={(e) =>
              props.handlePanelDragStart(
                'pitch',
                props.getPanel('pitch').order,
                e,
              )
            }
            onPointerMove={props.handlePanelDragMove}
            onPointerUp={props.handlePanelDragEnd}
            onPointerCancel={props.handlePanelDragEnd}
          >
            <svg
              viewBox="0 0 24 24"
              width="10"
              height="10"
              class="sm-drag-icon"
            >
              <path fill="currentColor" d="M20 9H4v2h16V9zM4 15h16v-2H4v2z" />
            </svg>
            Vocal Pitch
          </div>
          <canvas
            ref={props.setCanvasRef('pitch')}
            class="sm-canvas sm-canvas-pitch"
            onWheel={props.handleCanvasWheel}
          />
          <div
            class="sm-resize-handle"
            onPointerDown={(e) => props.handleResizeStart('pitch', e)}
          />
        </div>

        {/* Panel: MIDI Pitch */}
        <Show when={props.showMidi()}>
          <div
            class="sm-workspace-panel"
            style={props.panelStyle('midi')}
            data-panel-id="midi"
          >
            <div
              class="sm-panel-header"
              onPointerDown={(e) =>
                props.handlePanelDragStart(
                  'midi',
                  props.getPanel('midi').order,
                  e,
                )
              }
              onPointerMove={props.handlePanelDragMove}
              onPointerUp={props.handlePanelDragEnd}
              onPointerCancel={props.handlePanelDragEnd}
            >
              <svg
                viewBox="0 0 24 24"
                width="10"
                height="10"
                class="sm-drag-icon"
              >
                <path fill="currentColor" d="M20 9H4v2h16V9zM4 15h16v-2H4v2z" />
              </svg>
              MIDI Melody
            </div>
            <canvas
              ref={props.setCanvasRef('midi')}
              class="sm-canvas sm-canvas-midi"
              onWheel={props.handleCanvasWheel}
            />
            <div
              class="sm-resize-handle"
              onPointerDown={(e) => props.handleResizeStart('midi', e)}
            />
          </div>
        </Show>

        {/* Panel: Stem Controls */}
        <div
          class="sm-workspace-panel"
          style={props.panelStyle('controls')}
          data-panel-id="controls"
        >
          <div
            class="sm-panel-header"
            onPointerDown={(e) =>
              props.handlePanelDragStart(
                'controls',
                props.getPanel('controls').order,
                e,
              )
            }
            onPointerMove={props.handlePanelDragMove}
            onPointerUp={props.handlePanelDragEnd}
            onPointerCancel={props.handlePanelDragEnd}
          >
            <svg
              viewBox="0 0 24 24"
              width="10"
              height="10"
              class="sm-drag-icon"
            >
              <path fill="currentColor" d="M20 9H4v2h16V9zM4 15h16v-2H4v2z" />
            </svg>
            Stem Controls
          </div>
          <StemMixerStemControls {...props.stemControls} />
          <div
            class="sm-resize-handle"
            onPointerDown={(e) => props.handleResizeStart('controls', e)}
          />
        </div>

        {/* Panel: Lyrics */}
        <div
          class="sm-workspace-panel"
          style={props.panelStyle('lyrics')}
          data-panel-id="lyrics"
        >
          <div
            class="sm-panel-header"
            onPointerDown={(e) =>
              props.handlePanelDragStart(
                'lyrics',
                props.getPanel('lyrics').order,
                e,
              )
            }
            onPointerMove={props.handlePanelDragMove}
            onPointerUp={props.handlePanelDragEnd}
            onPointerCancel={props.handlePanelDragEnd}
          >
            <svg
              viewBox="0 0 24 24"
              width="10"
              height="10"
              class="sm-drag-icon"
            >
              <path fill="currentColor" d="M20 9H4v2h16V9zM4 15h16v-2H4v2z" />
            </svg>
            Lyrics
            <Show when={lp.lyricsSource() === 'api'}>
              <span class="sm-lyrics-source">found</span>
            </Show>
            <Show when={lp.lyricsSource() === 'upload'}>
              <span class="sm-lyrics-source sm-lyrics-source-upload">
                uploaded
              </span>
            </Show>
            <Show
              when={
                (lp.lyricsSource() === 'upload' && !lp.editMode()) ||
                (lp.lyricsSource() === 'api' && !lp.editMode())
              }
            >
              <button
                class="sm-lyrics-edit-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  props.handleForceSearch()
                }}
                title="Search Lyrics Online"
                style={{ 'margin-right': '4px' }}
              >
                <svg viewBox="0 0 24 24" width="11" height="11">
                  <path
                    fill="currentColor"
                    d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
                  />
                </svg>
              </button>
              <button
                class="sm-lyrics-edit-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  props.toggleEditMode()
                }}
                title="Edit word timings"
              >
                <svg viewBox="0 0 24 24" width="11" height="11">
                  <path
                    fill="currentColor"
                    d="M16.474 5.408l2.118 2.117-10.8 10.8-2.544.426.426-2.544 10.8-10.8zM13.296 2.38l1.414 1.414-1.908 1.908-1.414-1.414L13.296 2.38zM3.5 20.5h3l9.9-9.9-3-3L3.5 17.5v3z"
                  />
                </svg>
              </button>
            </Show>
            <Show
              when={
                lp.lyricsSource() !== 'none' &&
                !lp.editMode() &&
                !lp.lrcGenMode()
              }
            >
              <button
                class="sm-lyrics-gen-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  props.startLrcGen()
                }}
                title="Generate LRC timings with playback"
              >
                <svg viewBox="0 0 24 24" width="11" height="11">
                  <path
                    fill="currentColor"
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                  />
                </svg>
              </button>
            </Show>
            <Show when={lp.lrcGenMode()}>
              <span class="sm-lyrics-gen-label">LRC Gen</span>
            </Show>
            <Show
              when={
                lp.lyricsSource() !== 'none' &&
                !lp.editMode() &&
                !lp.lrcGenMode()
              }
            >
              <button
                class={`sm-lyrics-markmode-btn${lp.blockMarkMode() ? ' sm-lyrics-markmode-btn--active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  lp.setBlockMarkMode((prev) => !prev)
                  lp.setMarkStartLine(null)
                  lp.setMarkEndLine(null)
                }}
                title={
                  lp.blockMarkMode() ? 'Exit mark mode' : 'Mark repeat blocks'
                }
              >
                <svg viewBox="0 0 24 24" width="11" height="11">
                  <path
                    fill="currentColor"
                    d="M3 3h18v4H3V3zm0 7h12v4H3v-4zm0 7h18v4H3v-4z"
                  />
                </svg>
              </button>
            </Show>
            <Show when={lp.lyricsSource() !== 'none' && !lp.editMode()}>
              <button
                class="sm-lyrics-download-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  props.handleDownloadLrc()
                }}
                title="Download LRC file"
              >
                <svg viewBox="0 0 24 24" width="11" height="11">
                  <path
                    fill="currentColor"
                    d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"
                  />
                </svg>
              </button>
            </Show>
            <Show when={lp.lyricsSource() === 'upload' && !lp.editMode()}>
              <button
                class="sm-lyrics-change-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  props.triggerChangeFile()
                }}
                title="Change lyrics file"
              >
                <svg viewBox="0 0 24 24" width="11" height="11">
                  <path
                    fill="currentColor"
                    d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                  />
                </svg>
              </button>
            </Show>
            <input
              type="file"
              accept=".txt,.lrc"
              ref={props.lyricsFileInputRef}
              hidden
              onChange={props.handleLyricsChange}
            />
            <div class="sm-lyrics-toolbar">
              <div class="sm-lyrics-zoom">
                <button
                  class="sm-lyrics-zoom-btn"
                  onClick={() =>
                    lp.setLyricsFontSize((prev) =>
                      Math.max(0.45, +(prev - 0.1).toFixed(2)),
                    )
                  }
                  title="Smaller text"
                >
                  A−
                </button>
                <button
                  class="sm-lyrics-zoom-btn"
                  onClick={() =>
                    lp.setLyricsFontSize((prev) =>
                      Math.min(1.5, +(prev + 0.1).toFixed(2)),
                    )
                  }
                  title="Larger text"
                >
                  A+
                </button>
              </div>
              <Show when={lp.hasMultipleSections()}>
                <div class="sm-lyrics-col-toggle">
                  <button
                    class={`sm-lyrics-col-btn${lp.lyricsColumns() === 1 ? ' sm-lyrics-col-active' : ''}`}
                    onClick={() => lp.setLyricsColumns(1)}
                    title="Single column"
                  >
                    <svg viewBox="0 0 24 24" width="10" height="10">
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
                    class={`sm-lyrics-col-btn${lp.lyricsColumns() === 2 ? ' sm-lyrics-col-active' : ''}`}
                    onClick={() => lp.setLyricsColumns(2)}
                    title="Two columns"
                  >
                    <svg viewBox="0 0 24 24" width="10" height="10">
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
                </div>
              </Show>
            </div>
          </div>
          <StemMixerLyricsPanelBody {...lp} />
          <div
            class="sm-resize-handle"
            onPointerDown={(e) => props.handleResizeStart('lyrics', e)}
          />
        </div>
      </div>
    </Show>
  )
}
