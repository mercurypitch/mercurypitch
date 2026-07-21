// ============================================================
// StemMixerPerformanceWorkspace — karaoke "stage" layout
// A big, front-and-centre lyrics panel for singing, with the stem mixer
// on the right and a slim waveform on top.
// ============================================================

import type { Accessor, Component, Setter } from 'solid-js'
import { For, Show } from 'solid-js'
import type { WorkspaceLayout } from '@/features/stem-mixer/useStemMixerLayoutController'
import type { LyricsAlign } from '@/features/stem-mixer/useStemMixerLyricsController'
import type { AlignmentResult } from '@/lib/pitch-word-alignment'
import { karaokeFocus } from '@/stores/ui-store'
import type { StemMixerLyricsPanelBodyProps } from './StemMixerLyricsPanelBody'
import { StemMixerLyricsPanelBody } from './StemMixerLyricsPanelBody'
import type { StemMixerMicMonitorProps } from './StemMixerMicMonitor'
import { StemMixerMicMonitor } from './StemMixerMicMonitor'
import type { StemMixerStemControlsProps } from './StemMixerStemControls'
import { StemMixerStemControls } from './StemMixerStemControls'

interface StemMixerPerformanceWorkspaceProps {
  workspaceLayout: Accessor<WorkspaceLayout>
  sidebarHidden: Accessor<boolean>

  // Canvas (waveform overview)
  setCanvasRef: (id: string) => (el: HTMLCanvasElement) => void
  handleCanvasPointerDown: (e: PointerEvent) => void
  handleCanvasPointerMove: (e: PointerEvent) => void
  handleCanvasPointerUp: (e: PointerEvent) => void

  // Stem controls + mic
  stemControls: Omit<StemMixerStemControlsProps, 'direction'>
  micMonitor: StemMixerMicMonitorProps

  // Lyrics body
  lyricsPanel: Omit<
    StemMixerLyricsPanelBodyProps,
    'idSuffix' | 'showLyricNoteLabels' | 'alignmentResult'
  >
  showLyricNoteLabels: Accessor<boolean>
  alignmentResult: Accessor<AlignmentResult>

  // Alignment + lyrics header essentials
  lyricsAlign: Accessor<LyricsAlign>
  setLyricsAlign: Setter<LyricsAlign>
  handleForceSearch: () => void
  handleRemoveLyrics: () => void
  triggerChangeFile: () => void

  // Focus-mode panel visibility
  showWaveform: Accessor<boolean>
}

const ALIGNS: LyricsAlign[] = ['left', 'center', 'right']

function alignIcon(a: LyricsAlign) {
  // Three lines anchored to the chosen edge.
  const widths = a === 'center' ? [14, 18, 12] : [18, 12, 16]
  const xFor = (w: number) =>
    a === 'left' ? 3 : a === 'right' ? 21 - w : 12 - w / 2
  return (
    <svg viewBox="0 0 24 24" width="11" height="11">
      <rect
        x={xFor(widths[0])}
        y="3.5"
        width={widths[0]}
        height="2.5"
        rx="1"
        fill="currentColor"
      />
      <rect
        x={xFor(widths[1])}
        y="10.5"
        width={widths[1]}
        height="2.5"
        rx="1"
        fill="currentColor"
      />
      <rect
        x={xFor(widths[2])}
        y="17.5"
        width={widths[2]}
        height="2.5"
        rx="1"
        fill="currentColor"
      />
    </svg>
  )
}

export const StemMixerPerformanceWorkspace: Component<
  StemMixerPerformanceWorkspaceProps
> = (props) => {
  const lp = () => props.lyricsPanel
  return (
    <Show when={props.workspaceLayout() === 'performance'}>
      <div class="sm-perf-layout">
        <Show when={!karaokeFocus() || props.showWaveform()}>
          <div class="sm-perf-waveform">
            <canvas
              ref={props.setCanvasRef('overview')}
              class="sm-canvas sm-canvas-overview"
              data-canvas-id="overview"
              onPointerDown={(e) => props.handleCanvasPointerDown(e)}
              onPointerMove={(e) => props.handleCanvasPointerMove(e)}
              onPointerUp={(e) => props.handleCanvasPointerUp(e)}
            />
          </div>
        </Show>

        <div class="sm-perf-main">
          {/* Centre stage: big lyrics */}
          <div class="sm-perf-lyrics sm-workspace-panel">
            <div class="sm-panel-header sm-perf-header">
              <span class="sm-perf-title">Lyrics</span>
              <div class="sm-lyrics-zoom">
                <button
                  class="sm-lyrics-zoom-btn"
                  onClick={() =>
                    lp().setLyricsFontSize((p) =>
                      Math.max(0.45, +(p - 0.1).toFixed(2)),
                    )
                  }
                  title="Smaller text"
                >
                  A−
                </button>
                <button
                  class="sm-lyrics-zoom-btn"
                  onClick={() =>
                    lp().setLyricsFontSize((p) =>
                      Math.min(4, +(p + 0.1).toFixed(2)),
                    )
                  }
                  title="Larger text"
                >
                  A+
                </button>
              </div>
              <div class="sm-lyrics-align-toggle">
                <For each={ALIGNS}>
                  {(a) => (
                    <button
                      class={`sm-lyrics-align-btn${props.lyricsAlign() === a ? ' sm-lyrics-align-active' : ''}`}
                      onClick={() => props.setLyricsAlign(a)}
                      title={`Align ${a}`}
                    >
                      {alignIcon(a)}
                    </button>
                  )}
                </For>
              </div>
              <Show when={lp().lyricsSource() === 'none'}>
                <button
                  class="sm-lyrics-edit-btn"
                  onClick={() => props.handleForceSearch()}
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
                  class="sm-lyrics-upload-btn"
                  onClick={() => props.triggerChangeFile()}
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
              <Show when={lp().lyricsSource() !== 'none'}>
                <button
                  class="sm-lyrics-edit-btn"
                  onClick={() => props.handleForceSearch()}
                  title="Search Lyrics Online"
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
                  onClick={() => props.handleRemoveLyrics()}
                  title="Remove lyrics"
                  aria-label="Remove lyrics"
                >
                  <svg viewBox="0 0 24 24" width="11" height="11">
                    <path
                      fill="currentColor"
                      d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                    />
                  </svg>
                </button>
              </Show>
            </div>
            <StemMixerLyricsPanelBody
              {...lp()}
              idSuffix="-perf"
              showLyricNoteLabels={props.showLyricNoteLabels}
              alignmentResult={props.alignmentResult}
            />
          </div>

          {/* Right: stem mixer */}
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
              <StemMixerStemControls
                {...props.stemControls}
                direction="column"
              />
              <StemMixerMicMonitor {...props.micMonitor} />
            </div>
          </aside>
        </div>
      </div>
    </Show>
  )
}
