// ============================================================
// PracticeTabHeader — Practice tab specific controls
// Contains: Mic button, mode toggles (Once/Repeat/Practice), cycles, count-in display
// ============================================================

import { Component, Show } from 'solid-js';
import { appStore } from '@/stores/app-store';
import { MicButton } from '@/components/MicButton';

interface PracticeTabHeaderProps {
  isPlaying: () => boolean;
  isPaused: () => boolean;
  playMode: () => 'once' | 'repeat' | 'practice';
  practiceCycles: () => number;
  currentCycle: () => number;
  isCountingIn: () => boolean;
  countInBeat: () => number;
  onMicToggle: () => void;
  onPlayModeChange: (mode: 'once' | 'repeat' | 'practice') => void;
  onCyclesChange: (cycles: number) => void;
}

export const PracticeTabHeader: Component<PracticeTabHeaderProps> = (props) => {
  const isActive = () => props.isPlaying() || props.isPaused();

  return (
    <div class="tab-header-bar">
      {/* Mic */}
      <MicButton
        active={appStore.micActive()}
        onClick={props.onMicToggle}
        disabled={isActive()}
      />

      <div class="app-header-sep" />

      {/* Mode toggles */}
      <div id="mode-group">
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
    </div>
  );
};
