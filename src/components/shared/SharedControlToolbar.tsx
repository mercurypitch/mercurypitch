// ============================================================
// SharedControlToolbar — Unified control toolbar for Practice and Editor tabs
// Provides all shared controls with tab-specific options
// ============================================================

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { MicButton } from '@/components'
import { PrecCountButton } from '@/components/PrecCountButton'
import { Tooltip } from '@/components/Tooltip'
import { PLAYBACK_MODE_ONCE, PLAYBACK_MODE_REPEAT, PLAYBACK_MODE_SESSION, TAB_COMPOSE, TAB_PIANO, TAB_SINGING, } from '@/features/tabs/constants'
import { bpm, enterFocusMode, micActive, micWaveVisible, playbackSpeed, setBpm, setPlaybackSpeed, setSensitivity, settings, toggleMicWaveVisible, } from '@/stores'
import type { PlaybackMode, SpacedRestMode } from '@/types'
import { ControlGroup } from './ControlGroup'

// ========================================
// Utility functions
// ========================================

// TODO: Only for tests, need to update all!
/** Determine the current practice mode based on global state */
export function activePracticeMode(
  playMode: () => PlaybackMode,
  sessionActive: () => boolean,
): string {
  // Session mode takes priority
  if (sessionActive()) return 'Session'

  // Practice run-once vs repeat
  if (playMode() === PLAYBACK_MODE_SESSION) {
    return 'Run-once'
  }
  if (playMode() === PLAYBACK_MODE_REPEAT) {
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
import type { ActiveTab } from '@/types'

interface SharedControlToolbarProps {
  // Tab identification
  activeTab: () => ActiveTab
  singingTab?: () => boolean
  editorTab?: () => boolean
  pianoTab?: () => boolean

  // Playback state
  isPlaying: () => boolean
  isPaused: () => boolean
  playMode: () => PlaybackMode
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
  playModeChange: (mode: PlaybackMode) => void
  onCyclesChange: (cycles: number) => void
  practiceSubMode: () => PracticeSubMode
  onPracticeSubModeChange: (mode: PracticeSubMode) => void
  spacedRestMode?: () => SpacedRestMode
  onSpacedRestModeChange?: (mode: SpacedRestMode) => void

  // Editor-specific
  isRecording?: () => boolean
  onRecordToggle?: () => Promise<void>

  // Zoom (falling-notes tab only)
  zoomLevel?: () => number
  onZoomIn?: () => void
  onZoomOut?: () => void

  // Labels toggle (falling-notes tab only)
  showNoteLabels?: () => boolean
  onToggleNoteLabels?: () => void

  // MIDI (falling-notes tab only)
  inputMode?: () => 'mic' | 'midi'
  midiConnected?: () => boolean
  onMidiToggle?: () => void

  // Common
  onMicToggle?: () => void
  onWaveToggle?: () => void

  // BPM override (piano tab uses currentSongBpm, others use global bpm)
  bpmValue?: () => number
  onBpmChange?: (bpm: number) => void

  // Save button (editor tab only)
  onSaveMelody?: () => void
  onSaveMelodyLabel?: string
}

export const SharedControlToolbar: Component<SharedControlToolbarProps> = (
  props,
) => {
  const isPracticeTab = () =>
    props.singingTab?.() ?? props.activeTab() === TAB_SINGING
  const isEditorTab = () =>
    props.editorTab?.() ?? props.activeTab() === TAB_COMPOSE
  const isPianoTab = () => props.pianoTab?.() ?? props.activeTab() === TAB_PIANO

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

        {/* MIDI — falling notes only, toggle between mic and MIDI input */}
        <Show when={isPianoTab() && props.onMidiToggle}>
          <div class="essential-control-group">
            <button
              class={`ctrl-btn midi-btn ${(props.midiConnected?.() ?? false) ? 'active' : ''}`}
              onClick={() => props.onMidiToggle?.()}
              title={
                (props.midiConnected?.() ?? false)
                  ? 'Disconnect MIDI'
                  : 'Connect MIDI Keyboard'
              }
              aria-label={
                (props.midiConnected?.() ?? false)
                  ? 'Disconnect MIDI'
                  : 'Connect MIDI Keyboard'
              }
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
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
                {/* 5-pin DIN connector dots */}
                <circle
                  cx="12"
                  cy="5"
                  r="1"
                  fill="currentColor"
                  stroke="none"
                />
                <circle
                  cx="18.7"
                  cy="7.7"
                  r="1"
                  fill="currentColor"
                  stroke="none"
                />
                <circle
                  cx="16.2"
                  cy="16.2"
                  r="1"
                  fill="currentColor"
                  stroke="none"
                />
                <circle
                  cx="7.8"
                  cy="16.2"
                  r="1"
                  fill="currentColor"
                  stroke="none"
                />
                <circle
                  cx="5.3"
                  cy="7.7"
                  r="1"
                  fill="currentColor"
                  stroke="none"
                />
              </svg>
              <span>MIDI</span>
            </button>
          </div>
        </Show>

        {/* Wave toggle - practice tab only */}
        <Show when={isPracticeTab()}>
          <Tooltip text={micWaveVisible() ? 'Hide mic wave' : 'Show mic wave'}>
            <button
              class={`ctrl-btn wave-btn ${micWaveVisible() ? 'active' : ''}`}
              onClick={toggleMicWaveVisible}
              title="Toggle mic waveform view"
              aria-label="Toggle mic waveform view"
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
              enterFocusMode()
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

        {/* Precount + Metronome */}
        <div class="app-header-sep" />
        <div class="control-group">
          <PrecCountButton />
        </div>
        <button
          class={`ctrl-btn metronome-btn ${props.metronomeEnabled() ? 'active' : ''}`}
          onClick={() => props.onMetronomeToggle()}
          title="Toggle metronome"
          aria-label="Toggle metronome"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M12 2L8 22h8L12 2zm0 5.5l2.5 10h-5L12 7.5z"
            />
            <line
              x1="12"
              y1="2"
              x2="12"
              y2="5"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <circle cx="12" cy="3.5" r="0.5" fill="currentColor" />
          </svg>
        </button>

        {/* Count-in badge */}
        <Show when={props.isCountingIn()}>
          <div id="countin-display" class="countin-badge">
            {props.countInBeat()}
          </div>
        </Show>
      </div>

      {/* Secondary controls (hidden on mobile < 480px) */}
      <div class="secondary-controls">
        <div class="app-header-sep" />

        {/* Mode toggles - practice and piano modes */}
        <Show when={isPracticeTab() || isPianoTab()}>
          <div class="mode-group">
            <button
              id="btn-once"
              class={`mode-btn ${props.playMode() === PLAYBACK_MODE_ONCE ? 'active' : ''}`}
              onClick={() => {
                props.playModeChange(PLAYBACK_MODE_ONCE)
              }}
            >
              Once
            </button>
            <button
              id="btn-repeat"
              class={`mode-btn ${props.playMode() === PLAYBACK_MODE_REPEAT ? 'active' : ''}`}
              onClick={() => {
                props.playModeChange(PLAYBACK_MODE_REPEAT)
              }}
            >
              Repeat
            </button>
            {/* Session button only on practice tab */}
            <Show when={isPracticeTab()}>
              <button
                id="btn-session"
                class={`mode-btn ${props.playMode() === PLAYBACK_MODE_SESSION ? 'active' : ''}`}
                onClick={() => {
                  props.playModeChange(PLAYBACK_MODE_SESSION)
                }}
              >
                Session
              </button>
            </Show>
          </div>
        </Show>

        {/* Cycles input — applies to Repeat mode on both practice and piano tabs */}
        <Show
          when={
            (isPracticeTab() || isPianoTab()) &&
            props.playMode() === PLAYBACK_MODE_REPEAT
          }
        >
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
        <Show
          when={isPracticeTab() && props.playMode() === PLAYBACK_MODE_SESSION}
        >
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

        {/* Spaced mode selector — once-through playback with optional rests inserted between notes. */}
        <Show when={isPracticeTab() && props.playMode() === PLAYBACK_MODE_ONCE}>
          <div class="secondary-control-group practice-mode-control-group spaced-mode-control-group">
            <label class="opt-label practice-mode-label">Rest</label>
            <select
              id="spaced-rest-mode"
              value={props.spacedRestMode?.() ?? 'none'}
              onChange={(e) => {
                props.onSpacedRestModeChange?.(
                  e.currentTarget.value as SpacedRestMode,
                )
              }}
              class="dropdown-select-style spaced-rest-select"
            >
              <option value="none">None</option>
              <option value="fourth">𝄽 Fourth rest</option>
              <option value="half">𝄼 Half rest</option>
              <option value="full">𝄻 Full bar rest</option>
            </select>
          </div>
        </Show>

        {/*
          ── Tempo / Volume / Speed cluster ─────────────────────────
          Wrapped in `inline-controls-row` so on narrow viewports
          (<600px) the cluster collapses to a second row underneath
          the playback controls. Labels were replaced with compact
          icons so the slider widget reads as one cohesive control
          instead of "label : value : slider : number" stacked text.
          See app.css `.inline-controls-row`.
        */}
        <div class="inline-controls-row">
          {/* BPM */}
          <Show when={!isPianoTab() || (props.bpmValue && props.onBpmChange)}>
            <div class="tempo-group inline-control" title="Tempo (BPM)">
              <span class="inline-control-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    fill="currentColor"
                    d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm.5-13H11v6l5.2 3.1.8-1.3-4.5-2.7z"
                  />
                </svg>
              </span>
              <input
                type="number"
                id="bpm-input"
                min="40"
                max="280"
                value={
                  isPianoTab() && props.bpmValue ? props.bpmValue() : bpm()
                }
                class="bpm-number-input"
                aria-label="BPM"
                onInput={(e) => {
                  const value = parseInt(e.currentTarget.value)
                  if (value !== undefined && !isNaN(value)) {
                    if (isPianoTab() && props.onBpmChange) {
                      props.onBpmChange(value)
                    } else {
                      setBpm(value)
                    }
                  }
                }}
              />
              <input
                type="range"
                id="tempo"
                min="40"
                max="280"
                value={
                  isPianoTab() && props.bpmValue ? props.bpmValue() : bpm()
                }
                class="tempo-slider"
                aria-label="BPM slider"
                onInput={(e) => {
                  const val = parseInt(e.currentTarget.value) || 80
                  if (isPianoTab() && props.onBpmChange) {
                    props.onBpmChange(val)
                  } else {
                    setBpm(val)
                  }
                }}
              />
            </div>
          </Show>

          {/* Volume */}
          <div class="volume-group inline-control" title="Volume">
            <span class="inline-control-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path
                  fill="currentColor"
                  d="M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06A9 9 0 0 0 14 3.23z"
                />
              </svg>
            </span>
            <input
              type="number"
              id="vol-input"
              min="0"
              max="80"
              value={props.volume()}
              class="vol-number-input"
              aria-label="Volume"
              onInput={(e) => {
                const vol = parseInt(e.currentTarget.value)
                if (vol >= 0) {
                  props.onVolumeChange(vol)
                }
              }}
            />
            <input
              type="range"
              id="volume"
              min="0"
              max="80"
              value={props.volume()}
              class="volume-slider"
              aria-label="Volume"
              onInput={(e) => {
                const vol = parseInt(e.currentTarget.value)
                if (vol >= 0) {
                  props.onVolumeChange(vol)
                }
              }}
            />
          </div>

          {/* Sensitivity — styled like BPM/Volume so the entire mic
              sensitivity widget reads as one cohesive control instead
              of a stray label-slider pair tucked at the right edge. */}
          <Show when={!isPianoTab()}>
            <div
              class="sensitivity-group inline-control"
              title="Mic sensitivity (1 = quiet rooms, 10 = noisy)"
            >
              <span class="inline-control-icon" aria-hidden="true">
                {/* Mic icon */}
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    fill="currentColor"
                    d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z"
                  />
                </svg>
              </span>
              <input
                type="number"
                id="sens-input"
                min="1"
                max="10"
                value={settings().sensitivity}
                class="sens-number-input"
                aria-label="Sensitivity"
                onInput={(e) => {
                  const val = parseInt(e.currentTarget.value)
                  if (!isNaN(val) && val >= 1 && val <= 10) {
                    setSensitivity(val)
                  }
                }}
              />
              <input
                type="range"
                id="sensitivity"
                min="1"
                max="10"
                value={settings().sensitivity}
                class="sensitivity-slider"
                aria-label="Sensitivity slider"
                onInput={(e) => {
                  const val = parseInt(e.currentTarget.value) || 5
                  setSensitivity(val)
                }}
              />
            </div>
          </Show>

          {/* Speed */}
          <div class="speed-group inline-control" title="Playback speed">
            <span class="inline-control-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M4 5v14l8-7zM14 5v14l8-7z" />
              </svg>
            </span>
            <select
              id="speed-select"
              value={playbackSpeed().toString()}
              class="speed-select"
              aria-label="Playback speed"
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

          {/* Zoom — falling notes tab only */}
          <Show
            when={
              isPianoTab() &&
              props.zoomLevel &&
              props.onZoomIn &&
              props.onZoomOut
            }
          >
            <div class="zoom-group inline-control" title="Zoom level">
              <span class="inline-control-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    fill="currentColor"
                    d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
                  />
                </svg>
              </span>
              <button
                class="roll-zoom-btn"
                title="Zoom out"
                aria-label="Zoom out"
                onClick={() => props.onZoomOut?.()}
              >
                -
              </button>
              <span class="zoom-label">{props.zoomLevel?.() ?? 100}%</span>
              <button
                class="roll-zoom-btn"
                title="Zoom in"
                aria-label="Zoom in"
                onClick={() => props.onZoomIn?.()}
              >
                +
              </button>
            </div>
          </Show>

          {/* Note label toggle — falling notes tab only */}
          <Show
            when={
              isPianoTab() && props.showNoteLabels && props.onToggleNoteLabels
            }
          >
            <div
              class="label-toggle-group inline-control"
              title="Toggle note labels"
            >
              <button
                class={`label-toggle-btn ${props.showNoteLabels?.() === true ? 'active' : ''}`}
                aria-label="Toggle note labels"
                onClick={() => props.onToggleNoteLabels?.()}
              >
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    fill="currentColor"
                    d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
                  />
                </svg>
                <span class="label-toggle-text">Labels</span>
              </button>
            </div>
          </Show>
        </div>

        {/* Save Melody — editor tab only */}
        <Show when={isEditorTab() && props.onSaveMelody}>
          <ControlGroup>
            <div class="save-melody-group">
              <button
                id="save-melody-btn"
                class={`save-melody-btn ${props.onSaveMelodyLabel != null && props.onSaveMelodyLabel.length > 0 ? 'with-label' : ''}`}
                onClick={() => props.onSaveMelody?.()}
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

        {/* Sensitivity is now part of the inline-controls-row above
            (BPM / Volume / Sensitivity / Speed) so it renders as a
            cohesive icon+number+slider widget matching the other
            tempo-style controls instead of a standalone label-slider
            pair. The old ControlGroup wrapper used to live here. */}
      </div>
    </div>
  )
}
