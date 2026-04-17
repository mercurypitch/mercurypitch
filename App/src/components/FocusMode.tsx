// ============================================================
// FocusMode — full-screen minimal practice UI (GH #123)
// ============================================================

import { Component, Show, createMemo } from 'solid-js';
import { appStore } from '@/stores/app-store';
import { PitchCanvas } from '@/components/PitchCanvas';
import { HistoryCanvas } from '@/components/HistoryCanvas';
import type { PitchResult, NoteResult, PracticeResult } from '@/types';

interface FocusModeProps {
  isPlaying: () => boolean;
  isPaused: () => boolean;
  currentPitch: () => PitchResult | null;
  pitchHistory: () => Array<{ time: number; freq: number; amplitude: number }>;
  noteResults: () => NoteResult[];
  practiceResult: () => PracticeResult | null;
  liveScore: () => number | null;
  countInBeat: () => number;
  isCountingIn: () => boolean;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export const FocusMode: Component<FocusModeProps> = (props) => {
  const keyDisplay = createMemo(
    () => `${appStore.keyName()} ${appStore.scaleType()}`
  );

  return (
    <div class="focus-mode">
      {/* History canvas — thin strip at top */}
      <div id="history-container">
        <HistoryCanvas />
      </div>

      {/* Main pitch canvas fills remaining space */}
      <div class="focus-canvas">
        <PitchCanvas
          pitch={props.currentPitch}
          pitchHistory={props.pitchHistory}
          noteResults={props.noteResults}
          practiceResult={props.practiceResult}
          liveScore={props.liveScore}
          countInBeat={props.countInBeat}
          isCountingIn={props.isCountingIn}
          isPlaying={props.isPlaying}
          isPaused={props.isPaused}
        />
      </div>

      {/* Floating toolbar */}
      <div class="focus-toolbar">
        {/* Exit button */}
        <button
          class="focus-exit"
          onClick={() => appStore.exitFocusMode()}
          title="Exit Focus Mode"
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="currentColor"
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>

        {/* Play/Pause — shown when stopped or playing */}
        <Show when={!props.isPlaying() && !props.isPaused()}>
          <button class="focus-play" onClick={props.onPlay} title="Play">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M8 5v14l11-7z" />
            </svg>
          </button>
        </Show>

        <Show when={props.isPlaying()}>
          <button class="focus-play" onClick={props.onPause} title="Pause">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path
                fill="currentColor"
                d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"
              />
            </svg>
          </button>
        </Show>

        <Show when={props.isPaused()}>
          <button class="focus-play" onClick={props.onResume} title="Continue">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M8 5v14l11-7z" />
            </svg>
          </button>
        </Show>

        {/* Key info */}
        <div>
          <div class="focus-info">{keyDisplay()}</div>
          <div class="focus-key-hint">Space = play/pause</div>
        </div>
      </div>
    </div>
  );
};
