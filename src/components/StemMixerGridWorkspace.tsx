// ============================================================
// StemMixerGridWorkspace — grid layout (auto-1col, auto-2col)
// ============================================================

import type { Component } from 'solid-js'
import type { Accessor, Setter } from 'solid-js'
import { Show } from 'solid-js'
import type { WorkspaceLayout, WorkspacePanel, } from '@/features/stem-mixer/useStemMixerLayoutController'
import type { AlignmentResult } from '@/lib/pitch-word-alignment'
import { karaokeFocus } from '@/stores/ui-store'
import { PitchCanvasToolbar } from './PitchCanvasToolbar'
import type { StemMixerLyricsPanelBodyProps } from './StemMixerLyricsPanelBody'
import { StemMixerLyricsPanelBody } from './StemMixerLyricsPanelBody'
import type { StemMixerMicMonitorProps } from './StemMixerMicMonitor'
import { StemMixerMicMonitor } from './StemMixerMicMonitor'
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
  handleCanvasWheel: (e: WheelEvent) => void
  handleCanvasPointerDown: (e: PointerEvent) => void
  handleCanvasPointerMove: (e: PointerEvent) => void
  handleCanvasPointerUp: (e: PointerEvent) => void

  // Audio
  setWindowDuration: Setter<number>

  // Stem controls
  stemControls: Omit<StemMixerStemControlsProps, 'direction'>
  micMonitor: StemMixerMicMonitorProps

  // Lyrics panel body props
  lyricsPanel: Omit<
    StemMixerLyricsPanelBodyProps,
    'idSuffix' | 'showLyricNoteLabels' | 'alignmentResult'
  >

  // Lyrics header actions (not in lyricsPanel)
  handleForceSearch: () => void
  toggleEditMode: () => void
  startLrcGen: () => void
  autoSyncWords: () => void
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
  showScoreDiffBars: Accessor<boolean>
  setShowScoreDiffBars: Setter<boolean>
  melodyAudio?: Accessor<boolean>
  onToggleMelodyAudio?: () => void

  // Whisper alignment
  whisperStatus: Accessor<string>
  whisperProgress: Accessor<number>
  transcribeElapsed: Accessor<number>
  alignmentResult: Accessor<AlignmentResult>
  startWhisperTranscription: () => void
  whisperLanguage: Accessor<string>
  setWhisperLanguage: Setter<string>

  // Workspace ref + wheel handler
  workspaceRef: (el: HTMLDivElement) => void
  onWorkspaceWheel: (e: WheelEvent) => void

  // Focus mode panel visibility
  showWaveform: Accessor<boolean>
  showPitch: Accessor<boolean>
  showLyrics: Accessor<boolean>
}

export const StemMixerGridWorkspace: Component<StemMixerGridWorkspaceProps> = (
  props,
) => {
  const lp = () => props.lyricsPanel
  return (
    <Show
      when={
        props.workspaceLayout() !== 'fixed-2col' &&
        props.workspaceLayout() !== 'performance'
      }
    >
      <div
        ref={props.workspaceRef}
        class="sm-workspace"
        style={{
          'grid-template-columns':
            props.workspaceLayout() === 'auto-1col' ? '1fr' : '1fr 1fr',
        }}
        onWheel={(e) => props.onWorkspaceWheel(e)}
      >
        {/* Panel: Waveform Overview */}
        <Show when={!karaokeFocus() || props.showWaveform()}>
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
              onPointerMove={(e) => props.handlePanelDragMove(e)}
              onPointerUp={(e) => props.handlePanelDragEnd(e)}
              onPointerCancel={(e) => props.handlePanelDragEnd(e)}
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
              data-canvas-id="overview"
              onPointerDown={(e) => props.handleCanvasPointerDown(e)}
              onPointerMove={(e) => props.handleCanvasPointerMove(e)}
              onPointerUp={(e) => props.handleCanvasPointerUp(e)}
            />
            <div
              class="sm-resize-handle"
              onPointerDown={(e) => props.handleResizeStart('overview', e)}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        </Show>

        {/* Panel: Live Waveform */}
        <Show when={!karaokeFocus() || props.showWaveform()}>
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
              onPointerMove={(e) => props.handlePanelDragMove(e)}
              onPointerUp={(e) => props.handlePanelDragEnd(e)}
              onPointerCancel={(e) => props.handlePanelDragEnd(e)}
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
              data-canvas-id="live"
            />
            <div
              class="sm-resize-handle"
              onPointerDown={(e) => props.handleResizeStart('live', e)}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        </Show>

        {/* Panel: Vocal Pitch */}
        <Show when={!karaokeFocus() || props.showPitch()}>
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
              onPointerMove={(e) => props.handlePanelDragMove(e)}
              onPointerUp={(e) => props.handlePanelDragEnd(e)}
              onPointerCancel={(e) => props.handlePanelDragEnd(e)}
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
                <select
                  class="sm-whisper-lang-select"
                  value={props.whisperLanguage()}
                  onChange={(e) =>
                    props.setWhisperLanguage(e.currentTarget.value)
                  }
                  title="Whisper transcription language"
                >
                  <option value="en">EN</option>
                  <option value="hr">HR</option>
                </select>
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
                melodyAudio={props.melodyAudio}
                onToggleMelodyAudio={props.onToggleMelodyAudio}
                showScoreDiffBars={props.showScoreDiffBars}
                setShowScoreDiffBars={props.setShowScoreDiffBars}
              />
            </div>
            <canvas
              ref={props.setCanvasRef('pitch')}
              class="sm-canvas sm-canvas-pitch"
              data-canvas-id="pitch"
              onPointerDown={(e) => props.handleCanvasPointerDown(e)}
              onPointerMove={(e) => props.handleCanvasPointerMove(e)}
              onPointerUp={(e) => props.handleCanvasPointerUp(e)}
            />
            <div
              class="sm-resize-handle"
              onPointerDown={(e) => props.handleResizeStart('pitch', e)}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        </Show>

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
              onPointerMove={(e) => props.handlePanelDragMove(e)}
              onPointerUp={(e) => props.handlePanelDragEnd(e)}
              onPointerCancel={(e) => props.handlePanelDragEnd(e)}
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
              data-canvas-id="midi"
              onPointerDown={(e) => props.handleCanvasPointerDown(e)}
              onPointerMove={(e) => props.handleCanvasPointerMove(e)}
              onPointerUp={(e) => props.handleCanvasPointerUp(e)}
              onWheel={(e) => props.handleCanvasWheel(e)}
            />
            <div
              class="sm-resize-handle"
              onPointerDown={(e) => props.handleResizeStart('midi', e)}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        </Show>

        {/* Panel: Stem Controls -- hidden in focus mode */}
        <Show when={!karaokeFocus()}>
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
              onPointerMove={(e) => props.handlePanelDragMove(e)}
              onPointerUp={(e) => props.handlePanelDragEnd(e)}
              onPointerCancel={(e) => props.handlePanelDragEnd(e)}
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
            <StemMixerMicMonitor {...props.micMonitor} />
            <div
              class="sm-resize-handle"
              onPointerDown={(e) => props.handleResizeStart('controls', e)}
            />
          </div>
        </Show>

        {/* Panel: Lyrics */}
        <Show when={!karaokeFocus() || props.showLyrics()}>
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
              onPointerMove={(e) => props.handlePanelDragMove(e)}
              onPointerUp={(e) => props.handlePanelDragEnd(e)}
              onPointerCancel={(e) => props.handlePanelDragEnd(e)}
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
                    props.autoSyncWords()
                  }}
                  title="Auto word-sync — time every word from the vocal stem"
                >
                  <svg viewBox="0 0 24 24" width="11" height="11">
                    <path
                      fill="currentColor"
                      d="M7.5 5.6 9 2l1.5 3.6L14 7l-3.5 1.4L9 12 7.5 8.4 4 7l3.5-1.4zm9 4.8L18 8l1.5 2.4L22 12l-2.5 1.6L18 16l-1.5-2.4L14 12l2.5-1.6zM9 16l1 2.5L12.5 20 10 21.5 9 24l-1-2.5L5.5 20 8 18.5 9 16z"
                    />
                  </svg>
                </button>
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
              <Show when={lp().lyricsSource() === 'upload' && !lp().editMode()}>
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
                        Math.min(4, +(prev + 0.1).toFixed(2)),
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
                      <ellipse
                        cx="7"
                        cy="19"
                        rx="4"
                        ry="3"
                        fill="currentColor"
                      />
                      <rect
                        x="10"
                        y="4"
                        width="2.5"
                        height="15"
                        rx="1"
                        fill="currentColor"
                      />
                      <path
                        fill="currentColor"
                        d="M12.5 4 C14 4, 19 3, 20 8 C21 12, 17 11, 12.5 10 Z"
                      />
                    </svg>
                  </button>
                </Show>
              </div>
            </div>
            <StemMixerLyricsPanelBody
              {...lp()}
              showLyricNoteLabels={props.showLyricNoteLabels}
              alignmentResult={props.alignmentResult}
            />
            <div
              class="sm-resize-handle"
              onPointerDown={(e) => props.handleResizeStart('lyrics', e)}
            />
          </div>
        </Show>
      </div>
    </Show>
  )
}
