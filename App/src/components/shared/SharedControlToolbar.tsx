// ============================================================
// SharedControlToolbar — Unified control toolbar for Practice and Editor tabs
// Provides all shared controls with tab-specific options
// ============================================================

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { MicButton } from '@/components'
import { Tooltip } from '@/components/Tooltip'
import { appStore } from '@/stores/app-store'
import { ControlGroup } from './ControlGroup'
import { MetronomeGroup } from './MetronomeGroup'

export type PracticeSubMode = 'all' | 'random' | 'focus' | 'reverse'
export type ActiveTab = 'practice' | 'editor' | 'settings'

interface SharedControlToolbarProps {
  // Tab identification
  activeTab: () => ActiveTab
  practiceTab?: () => boolean
  editorTab?: () => boolean

  // Playback state
  isPlaying: () => boolean
  isPaused: () => boolean
  playMode: () => 'once' | 'repeat' | 'practice'
  practiceCycles: () => number
  currentCycle: () => number
  isCountingIn: () => boolean
  countInBeat: () => number

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
  playModeChange: (mode: 'once' | 'repeat' | 'practice') => void
  onCyclesChange: (cycles: number) => void
  practiceSubMode: () => PracticeSubMode
  onPracticeSubModeChange: (mode: PracticeSubMode) => void

  // Editor-specific
  isRecording?: () => boolean
  onRecordToggle?: () => Promise<void>

  // Common
  onMicToggle?: () => void
  onWaveToggle?: () => void

  // Practice sessions
  onSessionsClick?: () => void
}

export const SharedControlToolbar: Component<SharedControlToolbarProps> = (
  props,
) => {
  const isPracticeTab = () =>
    props.practiceTab?.() ?? props.activeTab() === 'practice'
  const isEditorTab = () =>
    props.editorTab?.() ?? props.activeTab() === 'editor'

  const isActive = () => props.isPlaying() || props.isPaused()
  const isStopped = () => !props.isPlaying() && !props.isPaused()

  return (
    <div class="practice-header-bar">
      {/* Essential controls (always visible on mobile) */}
      <div class="essential-controls">
        {/* Mic — enabled even during playback (UX requirement) */}
        {props.onMicToggle && (
          <div class="essential-control-group">
            <div class="mic-group">
              <MicButton
                active={appStore.micActive()}
                onClick={props.onMicToggle}
                disabled={false}
              />
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
              onClick={appStore.toggleMicWaveVisible}
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

        {/* Record to piano roll */}
        <Show when={isEditorTab() && props.onRecordToggle}>
          <div class="app-header-sep" />
          <div class="essential-control-group">
            <button
              id="record-btn"
              class={`ctrl-btn record-btn ${(props.isRecording?.() ?? false) ? 'recording' : ''}`}
              disabled={isActive()}
              title="Record to piano roll"
              onClick={() => void (async () => {
                await props.onRecordToggle?.()
              })()}
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <circle cx="12" cy="12" r="6" fill="currentColor" />
              </svg>
              {(props.isRecording?.() ?? false) ? 'Stop' : 'Record'}
            </button>
          </div>
        </Show>

        <div class="app-header-sep" />

        {/* Playback controls - based on state */}
        {isStopped() && (
          <button class="ctrl-btn play-btn" onClick={() => void props.onPlay()} title="Play">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M8 5v14l11-7z" />
            </svg>
            Play
          </button>
        )}

        <Show when={props.isPlaying()}>
          <button
            class="ctrl-btn stop-btn"
            onClick={props.onPause}
            title="Pause"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
            Pause
          </button>
        </Show>

        <Show when={props.isPaused()}>
          <button
            class="ctrl-btn play-btn"
            onClick={props.onResume}
            title="Continue"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M8 5v14l11-7z" />
            </svg>
            Continue
          </button>
        </Show>

        <button
          class={`ctrl-btn stop-btn stop ${isActive() ? '' : 'inactive'}`}
          onClick={props.onStop}
          title="Stop"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M6 6h12v12H6z" />
          </svg>
          Stop
        </button>

        {/* Practice sessions */}
        <Show when={!appStore.sessionActive()}>
          <div class="app-header-sep" />
          <button
            class="ctrl-btn mode-btn"
            onClick={() => {
              props.onSessionsClick?.()
            }}
            title="Browse practice sessions"
          >
            Sessions
          </button>
        </Show>

        {/* Focus Mode button */}
        <Show when={isPracticeTab()}>
          <div class="app-header-sep" />
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

        {/* Count-in badge */}
        <Show when={props.isCountingIn()}>
          <div id="countin-display" class="countin-badge">
            {props.countInBeat()}
          </div>
        </Show>

        <div id="run-indicator">
          <span id="cycle-counter">
            {props.playMode() === 'practice'
              ? `C${props.currentCycle()}/${props.practiceCycles()}`
              : props.playMode() === 'repeat'
                ? '↻'
                : ''}
          </span>
        </div>
      </div>

      {/* Secondary controls (hidden on mobile < 480px) */}
      <div class="secondary-controls">
        <div class="app-header-sep" />

        {/* Mode toggles - only in practice mode */}
        <Show when={isPracticeTab()}>
          <div class="mode-group">
            <button
              id="btn-once"
              class={`mode-btn ${props.playMode() === 'once' ? 'active' : ''}`}
              onClick={() => {
                props.playModeChange('once')
              }}
            >
              Once
            </button>
            <button
              id="btn-repeat"
              class={`mode-btn ${props.playMode() === 'repeat' ? 'active' : ''}`}
              onClick={() => {
                props.playModeChange('repeat')
              }}
            >
              Repeat
            </button>
            <button
              id="btn-practice"
              class={`mode-btn ${props.playMode() === 'practice' ? 'active' : ''}`}
              onClick={() => {
                props.playModeChange('practice')
              }}
            >
              Practice
            </button>
          </div>
        </Show>

        {/* Practice cycles and sub-mode - only in practice mode */}
        <Show when={isPracticeTab() && props.playMode() === 'practice'}>
          <div class="secondary-control-group">
            <label class="opt-label">Cycles:</label>
            <input
              type="number"
              id="cycles"
              min="2"
              max="20"
              value={props.practiceCycles()}
              onInput={(e) => {
                props.onCyclesChange(
                  Math.max(
                    2,
                    Math.min(20, parseInt(e.currentTarget.value) || 5),
                  ),
                )
              }}
              class="cycles-input"
            />
          </div>
          <div class="secondary-control-group">
            <label class="opt-label">Mode:</label>
            <select
              id="practice-sub-mode"
              value={props.practiceSubMode()}
              onChange={(e) => {
                props.onPracticeSubModeChange(
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

        {/* BPM */}
        <div class="tempo-group">
          <label class="opt-label">BPM:</label>
          <input
            type="range"
            id="tempo"
            min="40"
            max="280"
            value={appStore.bpm()}
            class="tempo-slider"
            onInput={(e) =>
              appStore.setBpm(parseInt(e.currentTarget.value) || 80)
            }
          />
          <span id="tempo-value">{appStore.bpm()}</span>
        </div>

        {/* Volume */}
        <ControlGroup>
          <div class="volume-group">
            <label class="opt-label">Vol:</label>
            <input
              type="range"
              id="volume"
              min="0"
              max="100"
              value={props.volume()}
              class="volume-slider"
              onInput={(e) => {
                const vol = parseInt(e.currentTarget.value) || 80
                props.onVolumeChange(vol)
              }}
            />
            <span id="volume-value">{props.volume()}</span>
          </div>
        </ControlGroup>

        {/* Speed */}
        <ControlGroup>
          <div class="speed-group">
            <label class="opt-label">Speed:</label>
            <select
              id="speed-select"
              value={appStore.playbackSpeed().toString()}
              class="speed-select"
              onChange={(e) => {
                const speed = parseFloat(e.currentTarget.value)
                appStore.setPlaybackSpeed(speed)
                props.onSpeedChange(speed)
              }}
            >
              <option value="0.25">0.25x</option>
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
          </div>
        </ControlGroup>

        {/* Metronome */}
        <ControlGroup>
          <MetronomeGroup
            active={props.metronomeEnabled}
            onClick={props.onMetronomeToggle}
          />
        </ControlGroup>

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
              class="sensitivity-slider"
              onInput={(e) => {
                const val = parseInt(e.currentTarget.value) || 5
                appStore.setSensitivity(val)
              }}
            />
            <span id="sensitivity-value">
              {appStore.settings().sensitivity}
            </span>
          </div>
        </ControlGroup>
      </div>
    </div>
  )
}
