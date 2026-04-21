// ============================================================
// SharedControlToolbar — Unified control toolbar for Practice and Editor tabs
// Provides all shared controls with tab-specific options
// ============================================================

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { Tooltip } from '@/components/Tooltip'
import { appStore } from '@/stores/app-store'
import { ControlGroup } from './ControlGroup'
import { CoreControls } from './CoreControls'
import { MetronomeGroup } from './MetronomeGroup'
import { SpeedGroup } from './SpeedGroup'
import { VolumeGroup } from './VolumeGroup'

export type PracticeSubMode = 'all' | 'random' | 'focus' | 'reverse'

interface SharedControlToolbarProps {
  // Tab identification
  activeTab: () => 'practice' | 'editor'
  practiceTab?: () => boolean
  editorTab?: () => boolean

  // Playback state
  isPlaying: () => boolean
  isPaused: () => boolean
  playButtonLabel: () => 'Start' | 'Pause' | 'Continue'

  // Core playback callbacks
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void

  // Volume
  volume: () => number
  onVolumeChange: (vol: number) => void

  // Speed
  speed: number
  onSpeedChange: (speed: number) => void

  // Metronome
  metronomeEnabled: () => boolean
  onMetronomeToggle: () => void

  // Practice-specific
  playMode?: () => 'once' | 'repeat' | 'practice'
  onPlayModeChange?: (mode: 'once' | 'repeat' | 'practice') => void
  practiceCycles?: () => number
  onCyclesChange?: (cycles: number) => void
  currentCycle?: () => number
  practiceSubMode?: () => PracticeSubMode
  onPracticeSubModeChange?: (mode: PracticeSubMode) => void
  isCountingIn?: () => boolean
  countInBeat?: () => number

  // Editor-specific
  isRecording?: () => boolean
  onRecordToggle?: () => void

  // Common
  onMicToggle?: () => void
  onWaveToggle?: () => void
}

export const SharedControlToolbar: Component<SharedControlToolbarProps> = (
  props,
) => {
  const isPracticeTab = () =>
    props.practiceTab?.() ?? props.activeTab() === 'practice'
  const isEditorTab = () =>
    props.editorTab?.() ?? props.activeTab() === 'editor'

  const showPlayPauseContinue = () =>
    !isPracticeTab() ||
    props.playMode?.() === 'practice' ||
    props.playMode?.() === 'repeat'

  return (
    <div class="practice-header-bar">
      {/* Essential controls (always visible on mobile) */}
      <div class="essential-controls">
        {/* Mic — enabled even during playback (UX requirement) */}
        {props.onMicToggle && (
          <div class="essential-control-group">
            <div class="mic-group">
              <button
                class="mic-btn"
                onClick={props.onMicToggle}
                title="Toggle microphone"
              >
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path
                    fill="currentColor"
                    d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
                  />
                  <path
                    fill="currentColor"
                    d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Wave toggle - practice tab only */}
        <Show when={isPracticeTab()}>
          <Tooltip
            text={appStore.micWaveVisible() ? 'Hide mic wave' : 'Show mic wave'}
          >
            <button
              class={`ctrl-btn wave-btn ${appStore.micWaveVisible() ? 'active' : ''}`}
              onClick={props.onWaveToggle}
              title="Toggle mic waveform view"
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path
                  fill="currentColor"
                  d="M3 9h2v6H3zm4-3h2v12H7zm4 6h2v3h-2zm4-3h2v6h-2zm4-2h2v10h-2z"
                />
              </svg>
            </button>
          </Tooltip>
        </Show>

        <div class="app-header-sep" />

        {/* Core playback controls */}
        {showPlayPauseContinue() && (
          <CoreControls
            isPlaying={props.isPlaying}
            isPaused={props.isPaused}
            onPlay={props.onPlay}
            onPause={props.onPause}
            onResume={props.onResume}
            onStop={props.onStop}
            playButtonLabel={props.playButtonLabel}
          />
        )}

        <Show when={isEditorTab() && props.onRecordToggle}>
          <div class="app-header-sep" />
          <div class="essential-control-group">
            <button
              id="record-btn"
              class={`ctrl-btn record-btn ${isRecording?.() === true ? 'recording' : ''}`}
              onClick={props.onRecordToggle}
              disabled={
                (props.isPlaying?.() ?? false) || (props.isPaused?.() ?? false)
              }
              title="Record to piano roll"
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <circle cx="12" cy="12" r="6" fill="currentColor" />
              </svg>
              {(props.isRecording?.() ?? false) ? 'Stop' : 'Record'}
            </button>
          </div>
        </Show>

        <div class="app-header-sep" />

        {/* Secondary controls (hidden on mobile < 480px) */}
        <div class="secondary-controls">
          <div class="app-header-sep" />

          {/* Volume */}
          <ControlGroup>
            <VolumeGroup
              volume={props.volume}
              onVolumeChange={props.onVolumeChange}
            />
          </ControlGroup>

          <div class="app-header-sep" />

          {/* Speed */}
          <ControlGroup>
            <SpeedGroup
              speed={props.speed}
              onSpeedChange={props.onSpeedChange}
            />
          </ControlGroup>

          <div class="app-header-sep" />

          {/* Metronome */}
          <MetronomeGroup
            active={props.metronomeEnabled}
            onClick={props.onMetronomeToggle}
          />

          {/* Practice-only controls */}
          <Show when={isPracticeTab()}>
            <div class="app-header-sep" />

            {/* Practice mode selector */}
            <Show when={props.playMode !== undefined}>
              <div class="mode-group">
                <button
                  id="btn-once"
                  class={`mode-btn ${props.playMode?.() === 'once' ? 'active' : ''}`}
                  onClick={() => props.onPlayModeChange?.('once')}
                >
                  Once
                </button>
                <button
                  id="btn-repeat"
                  class={`mode-btn ${props.playMode?.() === 'repeat' ? 'active' : ''}`}
                  onClick={() => props.onPlayModeChange?.('repeat')}
                >
                  Repeat
                </button>
                <button
                  id="btn-practice"
                  class={`mode-btn ${props.playMode?.() === 'practice' ? 'active' : ''}`}
                  onClick={() => props.onPlayModeChange?.('practice')}
                >
                  Practice
                </button>
              </div>
            </Show>

            {/* Practice cycles */}
            <Show when={props.playMode?.() === 'practice'}>
              <div class="secondary-control-group">
                <label class="opt-label">Cycles:</label>
                <input
                  type="number"
                  id="cycles"
                  min="2"
                  max="20"
                  value={props.practiceCycles?.() ?? 5}
                  onInput={(e) => {
                    props.onCyclesChange?.(
                      Math.max(
                        2,
                        Math.min(20, parseInt(e.currentTarget.value) || 5),
                      ),
                    )
                  }}
                  class="cycles-input"
                />
              </div>
            </Show>

            {/* Practice sub-mode */}
            <Show when={props.playMode?.() === 'practice'}>
              <div class="secondary-control-group">
                <label class="opt-label">Mode:</label>
                <select
                  id="practice-sub-mode"
                  value={props.practiceSubMode?.() ?? 'all'}
                  onChange={(e) => {
                    props.onPracticeSubModeChange?.(
                      e.currentTarget.value as PracticeSubMode,
                    )
                  }}
                  class="practice-sub-mode-select"
                >
                  <option value="all">All Notes</option>
                  <option value="random">Random (50%)</option>
                  <option value="focus">Focus Errors</option>
                  <option value="reverse">Reverse</option>
                </select>
              </div>
            </Show>

            {/* Practice sessions button */}
            <Show when={!appStore.sessionActive()}>
              <button
                class="ctrl-btn mode-btn"
                onClick={() => {
                  appStore.setActiveTab('settings')
                  setShowSessionBrowser(true)
                }}
                title="Browse practice sessions"
              >
                Sessions
              </button>
            </Show>

            <div class="app-header-sep" />

            {/* Count-in */}
            <ControlGroup>
              <div class="prec-count-btn-group">
                <button
                  id="prec-count-minus"
                  class="prec-count-btn"
                  onClick={() => {
                    const current = appStore.countIn()
                    appStore.setCountIn(Math.max(0, current - 1))
                  }}
                  disabled={appStore.countIn() === 0}
                >
                  −
                </button>
                <span id="prec-count-value">{appStore.countIn()}</span>
                <button
                  id="prec-count-plus"
                  class="prec-count-btn"
                  onClick={() => {
                    const current = appStore.countIn()
                    appStore.setCountIn(Math.min(4, current + 1))
                  }}
                  disabled={appStore.countIn() === 4}
                >
                  +
                </button>
              </div>
            </ControlGroup>

            <div id="run-indicator">
              <span id="cycle-counter">
                {props.playMode?.() === 'practice'
                  ? `C${props.currentCycle ?? 1}/${props.practiceCycles?.() ?? 5}`
                  : props.playMode?.() === 'repeat'
                    ? '↻'
                    : ''}
              </span>
            </div>

            {/* Count-in badge */}
            <Show when={props.isCountingIn}>
              <div id="countin-display" class="countin-badge">
                {props.countInBeat}
              </div>
            </Show>

            <div class="app-header-sep" />

            {/* Sensitivity */}
            <ControlGroup>
              <div class="sensitivity-group">
                <label class="opt-label">Sens:</label>
                <input
                  type="range"
                  id="sensitivity"
                  min="1"
                  max="10"
                  value={appStore.settings().sensitivity}
                  onInput={(e) => {
                    const val = parseInt(e.currentTarget.value) || 5
                    appStore.setSensitivity(val)
                  }}
                  class="sensitivity-slider"
                />
                <span id="sensitivity-value">
                  {appStore.settings().sensitivity}
                </span>
              </div>
            </ControlGroup>
          </Show>

          <div class="app-header-sep" />

          {/* Focus Mode button (practice only) */}
          <Show when={isPracticeTab()}>
            <button
              class="ctrl-btn focus-btn"
              onClick={() => {
                appStore.enterFocusMode()
              }}
              title="Enter Focus Mode (minimal UI)"
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path
                  fill="currentColor"
                  d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"
                />
              </svg>
              Focus
            </button>
          </Show>
        </div>
      </div>
    </div>
  )
}
