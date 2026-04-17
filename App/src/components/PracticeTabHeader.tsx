// ============================================================
// PracticeTabHeader — Practice tab controls (mic + modes + playback)
// This is the second header bar containing all practice controls
// ============================================================

import { Component, Show } from 'solid-js';
import { appStore } from '@/stores/app-store';
import { MicButton } from '@/components/MicButton';
import { MetronomeButton } from '@/components/MetronomeButton';

export type PracticeSubMode = 'all' | 'random' | 'focus' | 'reverse';

interface PracticeTabHeaderProps {
  isPlaying: () => boolean;
  isPaused: () => boolean;
  playMode: () => 'once' | 'repeat' | 'practice';
  practiceCycles: () => number;
  currentCycle: () => number;
  isCountingIn: () => boolean;
  countInBeat: () => number;
  metronomeEnabled: () => boolean;
  volume: () => number;
  practiceSubMode: () => PracticeSubMode;
  onMicToggle: () => void;
  onPlayModeChange: (mode: 'once' | 'repeat' | 'practice') => void;
  onCyclesChange: (cycles: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onMetronomeToggle: () => void;
  onSpeedChange: (speed: number) => void;
  onVolumeChange: (vol: number) => void;
  onPracticeSubModeChange: (mode: PracticeSubMode) => void;
  isRecording: () => boolean;
  onRecordToggle: () => void;
}

export const PracticeTabHeader: Component<PracticeTabHeaderProps> = (props) => {
  const isActive = () => props.isPlaying() || props.isPaused();
  const isStopped = () => !props.isPlaying() && !props.isPaused();

  return (
    <div class="practice-header-bar">
      {/* Mic */}
      <MicButton
        active={appStore.micActive()}
        onClick={props.onMicToggle}
        disabled={isActive()}
      />

      {/* Record to piano roll */}
      <button
        id="record-btn"
        class={`ctrl-btn record-btn ${props.isRecording() ? 'recording' : ''}`}
        onClick={props.onRecordToggle}
        disabled={isActive()}
        title="Record to piano roll"
      >
        <svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>
        {props.isRecording() ? 'Stop' : 'Record'}
      </button>

      <div class="app-header-sep" />

      {/* Playback controls */}
      <Show when={isStopped()}>
        <button class="ctrl-btn play-btn" onClick={props.onPlay} title="Play">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
          Play
        </button>
      </Show>

      <Show when={props.isPlaying()}>
        <button class="ctrl-btn stop-btn" onClick={props.onPause} title="Pause">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          Pause
        </button>
      </Show>

      <Show when={props.isPaused()}>
        <button class="ctrl-btn play-btn" onClick={props.onResume} title="Continue">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
          Continue
        </button>
      </Show>

      <button class={`ctrl-btn stop-btn stop ${props.isPlaying() || props.isPaused() ? '' : 'inactive'}`} onClick={props.onStop} title="Stop">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 6h12v12H6z"/></svg>
          Stop
        </button>

      <div class="app-header-sep" />

      {/* Mode toggles */}
      <div class="mode-group">
        <button
          id="btn-once"
          class={`mode-btn ${props.playMode() === 'once' ? 'active' : ''}`}
          onClick={() => props.onPlayModeChange('once')}
        >
          Once
        </button>
        <button
          id="btn-repeat"
          class={`mode-btn ${props.playMode() === 'repeat' ? 'active' : ''}`}
          onClick={() => props.onPlayModeChange('repeat')}
        >
          Repeat
        </button>
        <button
          id="btn-practice"
          class={`mode-btn ${props.playMode() === 'practice' ? 'active' : ''}`}
          onClick={() => props.onPlayModeChange('practice')}
        >
          Practice
        </button>
      </div>

      <Show when={props.playMode() === 'practice'}>
        <label class="opt-label">Cycles:</label>
        <input
          type="number"
          id="cycles"
          min="2"
          max="20"
          value={props.practiceCycles()}
          onInput={(e) => props.onCyclesChange(Math.max(2, Math.min(20, parseInt(e.currentTarget.value) || 5)))}
          class="cycles-input"
        />
        <label class="opt-label">Mode:</label>
        <select
          id="practice-sub-mode"
          value={props.practiceSubMode()}
          onChange={(e) => props.onPracticeSubModeChange(e.currentTarget.value as PracticeSubMode)}
          class="practice-sub-mode-select"
        >
          <option value="all">All Notes</option>
          <option value="random">Random (50%)</option>
          <option value="focus">Focus Errors</option>
          <option value="reverse">Reverse</option>
        </select>
      </Show>

      <div id="run-indicator">
        <span id="cycle-counter">
          {props.playMode() === 'practice'
            ? `Cycle ${props.currentCycle()}/${props.practiceCycles()}`
            : props.playMode() === 'repeat'
            ? 'Repeat'
            : ''}
        </span>
      </div>

      <Show when={props.isCountingIn()}>
        <div id="countin-display" class="countin-badge">
          {props.countInBeat()}
        </div>
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
            props.onSpeedChange(speed);
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
    </div>
  );
};
