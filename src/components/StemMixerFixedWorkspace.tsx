// ============================================================
// StemMixerFixedWorkspace — fixed 2-column layout
// ============================================================

import type { Component } from 'solid-js'
import type { Accessor, Setter } from 'solid-js'
import { Show } from 'solid-js'
import type { WorkspaceLayout } from '@/features/stem-mixer/useStemMixerLayoutController'
import type { AlignmentResult } from '@/lib/pitch-word-alignment'
import { PitchCanvasToolbar } from './PitchCanvasToolbar'
import type { StemMixerLyricsPanelBodyProps } from './StemMixerLyricsPanelBody'
import { StemMixerLyricsPanelBody } from './StemMixerLyricsPanelBody'
import type { StemMixerStemControlsProps } from './StemMixerStemControls'
import { StemMixerStemControls } from './StemMixerStemControls'

interface StemMixerFixedWorkspaceProps {
  // Layout
  workspaceLayout: Accessor<WorkspaceLayout>
  fixedPanelHeights: Accessor<Record<string, number>>
  handleFixedResizeStart: (id: string, e: PointerEvent) => void
  sidebarHidden: Accessor<boolean>

  // Canvas
  setCanvasRef: (id: string) => (el: HTMLCanvasElement) => void
  handleWaveformClick: (e: MouseEvent) => void
  handleCanvasWheel: (e: WheelEvent) => void

  // Stem controls
  stemControls: Omit<StemMixerStemControlsProps, 'direction'>

  // Lyrics panel body props
  lyricsPanel: Omit<
    StemMixerLyricsPanelBodyProps,
    'idSuffix' | 'showLyricNoteLabels' | 'alignmentResult'
  >

  // Lyrics header actions (not in lyricsPanel)
  handleForceSearch: () => void
  toggleEditMode: () => void
  startLrcGen: () => void
  handleDownloadLrc: () => void
  lyricsFileInputRef: (el: HTMLInputElement) => void
  handleLyricsChange: (e: Event) => void
  triggerChangeFile: () => void
  handlePasteLyricsHeader: () => void

  // Conditional MIDI
  showMidi: Accessor<boolean>

  // Note labels toggle
  showNoteLabels: Accessor<boolean>
  setShowNoteLabels: Setter<boolean>
  showLyricLabels: Accessor<boolean>
  setShowLyricLabels: Setter<boolean>
  showLyricNoteLabels: Accessor<boolean>
  setShowLyricNoteLabels: Setter<boolean>

  // Whisper alignment
  whisperStatus: Accessor<string>
  whisperProgress: Accessor<number>
  transcribeElapsed: Accessor<number>
  alignmentResult: Accessor<AlignmentResult>
  startWhisperTranscription: () => void
}

export const StemMixerFixedWorkspace: Component<
  StemMixerFixedWorkspaceProps
> = (props) => {
  const lp = () => props.lyricsPanel
  return (
    <Show when={props.workspaceLayout() === 'fixed-2col'}>
      <div class="sm-fixed-layout">
        <div class="sm-fixed-main">
          {/* Left Column: Waveform Overview + Lyrics */}
          <div class="sm-fixed-col sm-fixed-col-left">
            <div
              class="sm-workspace-panel"
              style={{ height: `${props.fixedPanelHeights().overview}px` }}
              data-fixed-panel="overview"
            >
              <div class="sm-panel-header">Waveform Overview</div>
              <canvas
                ref={props.setCanvasRef('overview')}
                class="sm-canvas sm-canvas-overview"
                onClick={(e) => props.handleWaveformClick(e)}
              />
              <div
                class="sm-resize-handle"
                onPointerDown={(e) =>
                  props.handleFixedResizeStart('overview', e)
                }
              />
            </div>
            <div
              class="sm-workspace-panel"
              style={{ flex: '1', 'min-height': '0' }}
            >
              <div class="sm-panel-header">
                Lyrics
                <Show when={lp().lyricsSource() === 'api'}>
                  <span class="sm-lyrics-source">found</span>
                </Show>
                <Show when={lp().lyricsSource() === 'upload'}>
                  <span class="sm-lyrics-source sm-lyrics-source-upload">
                    uploaded
                  </span>
                </Show>
                <Show
                  when={
                    (lp().lyricsSource() === 'upload' && !lp().editMode()) ||
                    (lp().lyricsSource() === 'api' && !lp().editMode())
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
                    lp().lyricsSource() !== 'none' &&
                    !lp().editMode() &&
                    !lp().lrcGenMode()
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
                <Show when={lp().lrcGenMode()}>
                  <span class="sm-lyrics-gen-label">LRC Gen</span>
                </Show>
                <Show
                  when={
                    lp().lyricsSource() !== 'none' &&
                    !lp().editMode() &&
                    !lp().lrcGenMode()
                  }
                >
                  <button
                    class={`sm-lyrics-markmode-btn${lp().blockMarkMode() ? ' sm-lyrics-markmode-btn--active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      lp().setBlockMarkMode((prev) => !prev)
                      lp().setMarkStartLine(null)
                      lp().setMarkEndLine(null)
                    }}
                    title={
                      lp().blockMarkMode()
                        ? 'Exit mark mode'
                        : 'Mark repeat blocks'
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
                <Show when={lp().lyricsSource() !== 'none' && !lp().editMode()}>
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
                <Show
                  when={lp().lyricsSource() === 'upload' && !lp().editMode()}
                >
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
                  <button
                    class="sm-lyrics-paste-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      props.handlePasteLyricsHeader()
                    }}
                    title="Paste lyrics from clipboard"
                    style={{ 'margin-left': '4px' }}
                  >
                    <svg viewBox="0 0 24 24" width="11" height="11">
                      <path
                        fill="currentColor"
                        d="M19 2h-4.18C14.4.84 13.3 0 12 0S9.6.84 9.18 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"
                      />
                    </svg>
                  </button>
                </Show>
                <Show when={lp().lyricsSource() === 'none'}>
                  <button
                    class="sm-lyrics-upload-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      props.triggerChangeFile()
                    }}
                    title="Load LRC / TXT file"
                  >
                    <svg viewBox="0 0 24 24" width="11" height="11">
                      <path
                        fill="currentColor"
                        d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"
                      />
                    </svg>
                  </button>
                </Show>
                <input
                  type="file"
                  accept=".txt,.lrc"
                  ref={props.lyricsFileInputRef}
                  hidden
                  onChange={(e) => props.handleLyricsChange(e)}
                />
                <div class="sm-lyrics-toolbar">
                  <div class="sm-lyrics-zoom">
                    <button
                      class="sm-lyrics-zoom-btn"
                      onClick={() =>
                        lp().setLyricsFontSize((prev) =>
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
                        lp().setLyricsFontSize((prev) =>
                          Math.min(1.5, +(prev + 0.1).toFixed(2)),
                        )
                      }
                      title="Larger text"
                    >
                      A+
                    </button>
                  </div>
                  <Show when={lp().hasMultipleSections()}>
                    <div class="sm-lyrics-col-toggle">
                      <button
                        class={`sm-lyrics-col-btn${lp().lyricsColumns() === 1 ? ' sm-lyrics-col-active' : ''}`}
                        onClick={() => lp().setLyricsColumns(1)}
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
                        class={`sm-lyrics-col-btn${lp().lyricsColumns() === 2 ? ' sm-lyrics-col-active' : ''}`}
                        onClick={() => lp().setLyricsColumns(2)}
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
                  <Show when={props.alignmentResult().totalWords > 0}>
                    <button
                      class={`sm-lyrics-note-toggle${props.showLyricNoteLabels() ? ' active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        props.setShowLyricNoteLabels((prev) => !prev)
                      }}
                      title={
                        props.showLyricNoteLabels()
                          ? 'Hide note labels on words'
                          : 'Show note labels on words'
                      }
                    >
                      <svg viewBox="0 0 24 24" width="10" height="10">
                        <path
                          fill="currentColor"
                          d="M12 3l6 4H6zm0 18l-6-4h12zm-6-4V7l6 4-6 4zm12 0l-6-4-6 4h12z"
                        />
                      </svg>
                    </button>
                  </Show>
                </div>
              </div>
              <StemMixerLyricsPanelBody
                {...lp()}
                idSuffix="-fixed"
                showLyricNoteLabels={props.showLyricNoteLabels}
                alignmentResult={props.alignmentResult}
              />
            </div>
          </div>

          {/* Right Column: Live Waveform + Vocal Pitch */}
          <div class="sm-fixed-col sm-fixed-col-right">
            <div
              class="sm-workspace-panel"
              style={{ height: `${props.fixedPanelHeights().live}px` }}
              data-fixed-panel="live"
            >
              <div class="sm-panel-header">Live Waveform</div>
              <canvas
                ref={props.setCanvasRef('live')}
                class="sm-canvas sm-canvas-live"
              />
              <div
                class="sm-resize-handle"
                onPointerDown={(e) => props.handleFixedResizeStart('live', e)}
              />
            </div>
            <div
              class="sm-workspace-panel"
              style={{ height: `${props.fixedPanelHeights().pitch}px` }}
              data-fixed-panel="pitch"
            >
              <div class="sm-panel-header">
                Vocal Pitch
                <Show when={props.whisperStatus() === 'loading'}>
                  <span class="pitch-alignment-stats whisper-processing">
                    Loading whisper
                    {props.whisperProgress() > 0
                      ? ` (${Math.round(props.whisperProgress())}%)`
                      : '...'}
                  </span>
                </Show>
                <Show when={props.whisperStatus() === 'processing'}>
                  <span class="pitch-alignment-stats whisper-processing">
                    Transcribing
                    {props.transcribeElapsed() >= 0
                      ? ` (${props.transcribeElapsed()}s)`
                      : '...'}
                  </span>
                </Show>
                <Show
                  when={
                    props.whisperStatus() === 'done' &&
                    props.alignmentResult().totalWords > 0
                  }
                >
                  <span
                    class="pitch-alignment-stats"
                    title={`${props.alignmentResult().mappedWords} of ${props.alignmentResult().totalWords} words mapped to pitch`}
                  >
                    {Math.round(props.alignmentResult().accuracy * 100)}% mapped
                  </span>
                </Show>
                <Show when={props.whisperStatus() === 'ready'}>
                  <button
                    class="sm-transcribe-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      props.startWhisperTranscription()
                    }}
                    title="Transcribe words from vocal stem"
                  >
                    Transcribe
                  </button>
                </Show>
                <PitchCanvasToolbar
                  showNoteLabels={props.showNoteLabels}
                  setShowNoteLabels={props.setShowNoteLabels}
                  showLyricLabels={props.showLyricLabels}
                  setShowLyricLabels={props.setShowLyricLabels}
                />
              </div>
              <canvas
                ref={props.setCanvasRef('pitch')}
                class="sm-canvas sm-canvas-pitch"
              />
              <div
                class="sm-resize-handle"
                onPointerDown={(e) => props.handleFixedResizeStart('pitch', e)}
              />
            </div>
            <Show when={props.showMidi()}>
              <div
                class="sm-workspace-panel"
                style={{ height: `${props.fixedPanelHeights().midi}px` }}
                data-fixed-panel="midi"
              >
                <div class="sm-panel-header">MIDI Melody</div>
                <canvas
                  ref={props.setCanvasRef('midi')}
                  class="sm-canvas sm-canvas-midi"
                  onWheel={(e) => props.handleCanvasWheel(e)}
                />
                <div
                  class="sm-resize-handle"
                  onPointerDown={(e) => props.handleFixedResizeStart('midi', e)}
                />
              </div>
            </Show>
          </div>
        </div>

        {/* Right Sidebar: Stem Controls */}
        <aside
          class="sm-sidebar"
          classList={{ 'sm-sidebar-hidden': props.sidebarHidden() }}
        >
          <div
            class="sm-workspace-panel"
            style={{
              flex: '1',
              display: 'flex',
              'flex-direction': 'column',
            }}
          >
            <div class="sm-panel-header">Stem Controls</div>
            <StemMixerStemControls {...props.stemControls} direction="column" />
          </div>
        </aside>
      </div>
    </Show>
  )
}
