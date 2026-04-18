// ============================================================
// EditorTabHeader — Transport controls shown in Editor tab
// Mirrors the transport portion of PracticeTabHeader so the
// playback bar is always visible regardless of active tab.
// ============================================================

import { Component, Show } from 'solid-js'
import { appStore } from '@/stores/app-store'
import { playback } from '@/stores/playback-store'
import { MicButton } from '@/components/MicButton'
import { MetronomeButton } from '@/components/MetronomeButton'

interface EditorTabHeaderProps {
  isPlaying: () => boolean
  isPaused: () => boolean
  onMicToggle: () => void
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onMetronomeToggle: () => void
  onSpeedChange: (speed: number) => void
  metronomeEnabled: () => boolean
  isRecording: () => boolean
  onRecordToggle: () => void
  volume: () => number
  onVolumeChange: (vol: number) => void
}

export const EditorTabHeader: Component<EditorTabHeaderProps> = (props) => {
  const isActive = () => props.isPlaying() || props.isPaused()
  const isStopped = () => !props.isPlaying() && !props.isPaused()

  const playLabel = () => playback.playButtonLabel()

  const handlePlayClick = () => {
    const state = playback.state()
    if (state === 'stopped') {
      playback.startPlayback()
      props.onPlay()
    } else if (state === 'playing') {
      playback.pausePlayback()
      props.onPause()
    } else {
      playback.continuePlayback()
      props.onResume()
    }
  }

  const handleStopClick = () => {
    playback.resetPlayback()
    props.onStop()
  }

  return (
    <div class="practice-header-bar">
      {/* Mic — enabled even during playback (UX requirement) */}
      <MicButton
        active={appStore.micActive()}
        onClick={props.onMicToggle}
        disabled={false}
      />

      {/* Record to piano roll */}
      <button
        id="record-btn"
        class={`ctrl-btn record-btn ${props.isRecording() ? 'recording' : ''}`}
        onClick={props.onRecordToggle}
        disabled={isActive()}
        title="Record to piano roll"
      >
        <svg viewBox="0 0 24 24" width="16" height="16">
          <circle cx="12" cy="12" r="6" fill="currentColor" />
        </svg>
        {props.isRecording() ? 'Stop' : 'Record'}
      </button>

      <div class="app-header-sep" />

      {/* Playback controls */}
      <Show when={isStopped()}>
        <button
          class="ctrl-btn play-btn"
          onClick={handlePlayClick}
          title="Play"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M8 5v14l11-7z" />
          </svg>
          {playLabel()}
        </button>
      </Show>

      <Show when={props.isPlaying()}>
        <button
          class="ctrl-btn stop-btn"
          onClick={handlePlayClick}
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
          onClick={handlePlayClick}
          title="Continue"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M8 5v14l11-7z" />
          </svg>
          Continue
        </button>
      </Show>

      <button
        class={`ctrl-btn stop-btn stop ${props.isPlaying() || props.isPaused() ? '' : 'inactive'}`}
        onClick={handleStopClick}
        title="Stop"
      >
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M6 6h12v12H6z" />
        </svg>
        Stop
      </button>

      <div class="app-header-sep" />

      {/* Volume */}
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

      {/* Speed */}
      <div class="speed-group">
        <label class="opt-label">Speed:</label>
        <select
          id="speed-select"
          value="1"
          class="speed-select"
          onChange={(e) => {
            const speed = parseFloat(e.currentTarget.value)
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

      {/* Metronome */}
      <MetronomeButton
        active={props.metronomeEnabled()}
        onClick={props.onMetronomeToggle}
      />
    </div>
  )
}
