// ============================================================
// SharedControlToolbar — Unified control toolbar for Practice and Editor tabs
// Provides all shared controls with tab-specific options
// ============================================================

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { MicButton } from '@/components'
import { PrecCountButton } from '@/components/PrecCountButton'
import { Tooltip } from '@/components/Tooltip'
import { NOTE_NAMES } from '@/lib/scale-data'
import { appStore } from '@/stores'
import { bpm, keyName, micActive, micWaveVisible, playbackSpeed, scaleType, setBpm, setKeyName, setPlaybackSpeed, setScaleType, setSensitivity, settings, toggleMicWaveVisible, } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import { ControlGroup } from './ControlGroup'
import { MetronomeGroup } from './MetronomeGroup'

// ========================================
// Utility functions
// ========================================

// TODO: Only for tests, need to update all!
/** Determine the current practice mode based on global state */
export function activePracticeMode(
  playMode: () => 'once' | 'repeat' | 'practice',
  sessionActive: () => boolean,
): string {
  // Session mode takes priority
  if (sessionActive()) return 'Session'

  // Practice run-once vs repeat
  if (playMode() === 'practice') {
    return 'Run-once'
  }
  if (playMode() === 'repeat') {
    return 'Repeat'
  }
  return 'Run-once'
}

// Scale types matching the types file
export const SCALE_TYPES = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'harmonic-minor', label: 'Harmonic Minor' },
  { value: 'pentatonic', label: 'Pentatonic' },
  { value: 'blues', label: 'Blues' },
  { value: 'chromatic', label: 'Chromatic' },
  { value: 'dorian', label: 'Dorian' },
  { value: 'mixolydian', label: 'Mixolydian' },
] as const

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
  countInBeats: () => number

  // Core playback callbacks. Always synchronous from the toolbar's PoV;
  // if a caller has an async handler (e.g. handleStop awaits audio
  // teardown), they should wrap with `void` at the call site.
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

  // Save button (editor tab only)
  onSaveMelody?: () => void
  onSaveMelodyLabel?: string
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
                active={micActive()}
                onClick={props.onMicToggle}
                disabled={false}
              />
            </div>
          </div>
        )}

        {/* Wave toggle - practice tab only */}
        <Show when={isPracticeTab()}>
          <Tooltip text={micWaveVisible() ? 'Hide mic wave' : 'Show mic wave'}>
            <button
              class={`ctrl-btn wave-btn ${micWaveVisible() ? 'active' : ''}`}
              onClick={toggleMicWaveVisible}
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
              disabled={isActive() && !(props.isRecording?.() ?? false)}
              title={
                (props.isRecording?.() ?? false)
                  ? 'Stop recording'
                  : 'Record to piano roll'
              }
              onClick={() =>
                void (async () => {
                  await props.onRecordToggle?.()
                })()
              }
            >
              <Show
                when={props.isRecording?.() ?? false}
                fallback={
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <circle cx="12" cy="12" r="6" fill="currentColor" />
                  </svg>
                }
              >
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <rect
                    x="6"
                    y="6"
                    width="12"
                    height="12"
                    fill="currentColor"
                    rx="1"
                  />
                </svg>
              </Show>
              <span
                class={`record-text ${(props.isRecording?.() ?? false) ? 'recording' : ''}`}
              >
                {(props.isRecording?.() ?? false) ? 'STOP' : 'RECORD'}
              </span>
            </button>
          </div>
        </Show>

        <div class="app-header-sep" />

        {/* Playback controls - based on state */}
        {isStopped() && (
          <button
            class="ctrl-btn play-btn"
            onClick={() => void props.onPlay()}
            title="Play"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M8 5v14l11-7z" />
            </svg>
            Play
          </button>
        )}

        <Show when={props.isPlaying()}>
          <button
            class="ctrl-btn stop-btn"
            onClick={() => void props.onPause()}
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
            onClick={() => void props.onResume()}
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
          // Stop should only be actionable while there is something to
          // stop (playing OR paused). When stopped, it's disabled to give
          // a clear visual cue and prevent re-triggering reset side effects.
          disabled={!isActive()}
          onClick={() => void props.onStop()}
          title="Stop"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M6 6h12v12H6z" />
          </svg>
          Stop
        </button>

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

        {/* Precount toggle */}
        <div class="app-header-sep" />
        <div class="app-header-sep" />
        <div class="control-group">
          <PrecCountButton />
        </div>

        {/* Count-in badge */}
        <Show when={props.isCountingIn()}>
          <div id="countin-display" class="countin-badge">
            {props.countInBeat()}
          </div>
        </Show>

        <Show when={props.playMode() === 'practice'}>
          <div id="run-indicator">
            <span id="cycle-counter">⌛</span>
          </div>
        </Show>
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
              id="btn-session"
              class={`mode-btn ${props.playMode() === 'practice' ? 'active' : ''}`}
              onClick={() => {
                props.playModeChange('practice')
              }}
            >
              Practice
            </button>
          </div>
        </Show>

        {/* Cycles input — applies to Repeat mode (repeat the current melody
            N times). Practice mode plays the session through once and is
            controlled by the active session's items, not a cycle count. */}
        <Show when={isPracticeTab() && props.playMode() === 'repeat'}>
          <div class="secondary-control-group cycles-control-group">
            <label class="opt-label cycles-label">Cycles</label>
            <input
              type="number"
              id="cycles"
              min="2"
              max="100"
              value={props.practiceCycles()}
              onInput={(e) => {
                props.onCyclesChange(
                  Math.max(
                    2,
                    Math.min(100, parseInt(e.currentTarget.value) || 5),
                  ),
                )
              }}
              class="cycles-input"
            />
            <span class="cycle-progress-pill" title="Current repeat cycle">
              <span class="cycle-progress-label">Run</span>
              <span class="cycle-progress-value">
                {props.currentCycle()}/{props.practiceCycles()}
              </span>
            </span>
          </div>
        </Show>

        {/* Practice sub-mode selector — only in practice mode */}
        <Show when={isPracticeTab() && props.playMode() === 'practice'}>
          <div class="secondary-control-group practice-mode-control-group">
            <label class="opt-label practice-mode-label">Mode</label>
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
            type="number"
            id="bpm-input"
            min="40"
            max="280"
            value={bpm()}
            class="bpm-number-input"
            onInput={(e) => {
              const value = parseInt(e.currentTarget.value)
              if (value !== undefined && !isNaN(value)) {
                setBpm(value)
              }
            }}
          />
          <input
            type="range"
            id="tempo"
            min="40"
            max="280"
            value={bpm()}
            class="tempo-slider"
            onInput={(e) => setBpm(parseInt(e.currentTarget.value) || 80)}
          />
          <span id="tempo-value">{bpm()}</span>
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
              value={playbackSpeed().toString()}
              class="speed-select"
              onChange={(e) => {
                const speed = parseFloat(e.currentTarget.value)
                setPlaybackSpeed(speed)
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

        {/* Key — editor tab only */}
        <Show when={isEditorTab()}>
          <ControlGroup>
            <div class="key-group">
              <label class="opt-label">Key:</label>
              <select
                id="key-select"
                value={keyName()}
                class="key-select"
                onChange={(e) => {
                  const key = e.currentTarget.value
                  setKeyName(key)
                  // Refresh scale with new key
                  melodyStore.refreshScale(
                    key,
                    melodyStore.getCurrentOctave(),
                    scaleType(),
                  )
                }}
              >
                {NOTE_NAMES.map((k) => (
                  <option value={k}>{k}</option>
                ))}
              </select>
            </div>
          </ControlGroup>
          <ControlGroup>
            <div class="scale-group">
              <label class="opt-label">Scale:</label>
              <select
                id="scale-select"
                value={scaleType()}
                class="scale-select"
                onChange={(e) => {
                  const scaleType = e.currentTarget.value
                  setScaleType(scaleType)
                  // Refresh scale with new scale type
                  melodyStore.refreshScale(
                    keyName(),
                    melodyStore.getCurrentOctave(),
                    scaleType,
                  )
                }}
              >
                {SCALE_TYPES.map((s) => (
                  <option value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </ControlGroup>
        </Show>

        {/* Save Melody — editor tab only */}
        <Show when={isEditorTab() && props.onSaveMelody}>
          <ControlGroup>
            <div class="save-melody-group">
              <button
                id="save-melody-btn"
                class={`save-melody-btn ${props.onSaveMelodyLabel !== null && props.onSaveMelodyLabel !== undefined && props.onSaveMelodyLabel.length > 0 ? 'with-label' : ''}`}
                onClick={props.onSaveMelody}
                title="Save melody to library"
              >
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path
                    fill="currentColor"
                    d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"
                  />
                </svg>
                {props.onSaveMelodyLabel !== null &&
                  props.onSaveMelodyLabel !== undefined &&
                  props.onSaveMelodyLabel.length > 0 && (
                    <span>{props.onSaveMelodyLabel}</span>
                  )}
              </button>
            </div>
          </ControlGroup>
        </Show>

        {/* Sensitivity */}
        <ControlGroup>
          <div class="sensitivity-group">
            <label class="opt-label">Sens:</label>
            <input
              type="range"
              id="sensitivity"
              min="1"
              max="10"
              value={settings().sensitivity}
              class="sensitivity-slider"
              onInput={(e) => {
                const val = parseInt(e.currentTarget.value) || 5
                setSensitivity(val)
              }}
            />
            <span id="sensitivity-value">{settings().sensitivity}</span>
          </div>
        </ControlGroup>
      </div>
    </div>
  )
}
