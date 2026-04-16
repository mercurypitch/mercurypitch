// ============================================================
// AppHeader — Shared header component
// Contains: Play/Pause/Continue/Stop, BPM, Count-in, Volume, Speed, Sensitivity
// Play/Pause/Continue/Stop visible in all tabs
// Sensitivity, metronome visible in Practice tab only
// ============================================================

import { Component, Show } from 'solid-js';
import { appStore } from '@/stores/app-store';
import { MetronomeButton } from '@/components/MetronomeButton';

interface AppHeaderProps {
  isPlaying: () => boolean;
  isPaused: () => boolean;
  metronomeEnabled: () => boolean;
  volume: () => number;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onMetronomeToggle: () => void;
  onSpeedChange?: (speed: number) => void;
  onVolumeChange: (vol: number) => void;
}

export const AppHeader: Component<AppHeaderProps> = (props) => {
  const isStopped = () => !props.isPlaying() && !props.isPaused();

  return (
    <div class="app-header-bar">
      {/* Play — shown when stopped */}
      <Show when={isStopped()}>
        <button
          id="app-play-btn"
          class="ctrl-btn app-play-btn play"
          onClick={props.onPlay}
          title="Play melody"
        >
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
          Play
        </button>
      </Show>

      {/* Pause — shown when playing */}
      <Show when={props.isPlaying()}>
        <button
          id="app-pause-btn"
          class="ctrl-btn app-play-btn pause"
          onClick={props.onPause}
          title="Pause playback"
        >
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          Pause
        </button>
      </Show>

      {/* Continue — shown when paused */}
      <Show when={props.isPaused()}>
        <button
          id="app-play-btn"
          class="ctrl-btn app-play-btn play"
          onClick={props.onResume}
          title="Continue playback"
        >
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
          Continue
        </button>
      </Show>

      {/* Stop — shown when playing or paused */}
      <Show when={props.isPlaying() || props.isPaused()}>
        <button
          id="app-stop-btn"
          class="ctrl-btn app-play-btn stop"
          onClick={props.onStop}
          title="Stop playback"
        >
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 6h12v12H6z"/></svg>
          Stop
        </button>
      </Show>

      <div class="app-header-sep" />

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
          onInput={(e) => appStore.setBpm(parseInt(e.currentTarget.value) || 80)}
        />
        <span id="tempo-value">{appStore.bpm()}</span>
      </div>

      {/* Count-in */}
      <div class="countin-group">
        <label class="opt-label">Count:</label>
        <select
          id="countin-select"
          value={appStore.countIn()}
          onChange={(e) => appStore.setCountIn(parseInt(e.currentTarget.value) as any)}
          class="countin-select"
        >
          <option value="0">Off</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="4">4</option>
        </select>
      </div>

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
            const vol = parseInt(e.currentTarget.value) || 80;
            props.onVolumeChange(vol);
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
            const speed = parseFloat(e.currentTarget.value);
            props.onSpeedChange?.(speed);
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

      {/* Metronome — Practice tab only */}
      <Show when={appStore.activeTab() === 'practice'}>
        <MetronomeButton
          active={props.metronomeEnabled()}
          onClick={props.onMetronomeToggle}
        />

        {/* Sensitivity */}
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
              const val = parseInt(e.currentTarget.value) || 5;
              appStore.setSensitivity(val);
            }}
          />
          <span id="sensitivity-value">{appStore.settings().sensitivity}</span>
        </div>
      </Show>
    </div>
  );
};
