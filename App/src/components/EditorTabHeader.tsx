// ============================================================
// EditorTabHeader — Transport controls shown in Editor tab
// Mirrors the transport portion of PracticeTabHeader so the
// playback bar is always visible regardless of active tab.
// ============================================================

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { MetronomeButton } from '@/components/MetronomeButton'
import { MicButton } from '@/components/MicButton'
import { Tooltip } from '@/components/Tooltip'
import { appStore } from '@/stores/app-store'
import { playback } from '@/stores/playback-store'

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
  bpm: () => number
  onBpmChange: (bpm: number) => void
  onExportMIDI?: () => void
  onImportMIDI?: () => void
  onShare?: () => void
  onInstrumentChange?: (instrument: string) => void
  currentInstrument?: string
  shareUrl?: string
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
      {/* Essential controls (always visible on mobile) */}
      <div class="essential-controls">
        {/* Mic — enabled even during playback (UX requirement) */}
        <MicButton
          active={appStore.micActive()}
          onClick={props.onMicToggle}
          disabled={false}
        />

        <Tooltip text={appStore.micWaveVisible() ? 'Hide mic wave' : 'Show mic wave'}>
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

        <div class="app-header-sep" />

        {/* Playback controls */}
        <div class="essential-control-group">
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
        </div>

        <div class="app-header-sep" />

        {/* Actions */}
        <div class="essential-control-group">
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
        </div>
      </div>

      {/* Secondary controls (hidden on mobile < 480px) */}
      <div class="secondary-controls">
        <div class="app-header-sep" />

        {/* Volume */}
        <div class="secondary-control-group">
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
        </div>

        <div class="app-header-sep" />

        {/* Speed */}
        <div class="secondary-control-group">
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
        </div>

        <div class="app-header-sep" />

        {/* Metronome */}
        <MetronomeButton
          active={props.metronomeEnabled()}
          onClick={props.onMetronomeToggle}
        />
      </div>

      {/* Secondary controls (hidden on mobile < 480px) */}
      <div class="secondary-controls">
        <div class="app-header-sep" />

        {/* BPM */}
        <div class="secondary-control-group">
          <div class="tempo-group">
            <label class="opt-label">BPM:</label>
            <input
              type="range"
              id="tempo"
              min="40"
              max="280"
              value={props.bpm()}
              class="tempo-slider"
              onInput={(e) => {
                const bpm = parseInt(e.currentTarget.value) || 80
                props.onBpmChange(bpm)
              }}
            />
            <span id="tempo-value">{props.bpm()}</span>
          </div>
        </div>

        <div class="app-header-sep" />

        {/* Tools */}
        <div class="secondary-control-group">
          <button
            class="tool-btn"
            onClick={props.onShare}
            title="Copy share link"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path
                fill="currentColor"
                d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"
              />
            </svg>
            Share
          </button>

          <button
            class="tool-btn"
            onClick={props.onExportMIDI}
            title="Export MIDI file"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path
                fill="currentColor"
                d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"
              />
            </svg>
            MIDI
          </button>

          <button
            class="tool-btn"
            onClick={props.onImportMIDI}
            title="Import MIDI file"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path
                fill="currentColor"
                d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"
              />
            </svg>
            Import
          </button>
        </div>

        <div class="app-header-sep" />

        {/* Instrument selector */}
        <div class="secondary-control-group">
          <label class="opt-label">Inst:</label>
          <select
            value={(props.currentInstrument ?? '') !== '' ? props.currentInstrument : 'piano'}
            class="instrument-select"
            onChange={(e) => {
              const instrument = e.currentTarget.value
              props.onInstrumentChange?.(instrument)
            }}
          >
            <option value="piano">Piano</option>
            <option value="guitar">Guitar</option>
            <option value="violin">Violin</option>
            <option value="drums">Drums</option>
          </select>
        </div>
      </div>
    </div>
  )
}
