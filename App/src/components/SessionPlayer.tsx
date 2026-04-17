// ============================================================
// SessionPlayer — Inline UI for active practice sessions
// Shows progress, current item, timer, and session controls
// ============================================================

import { Component, createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { appStore } from '@/stores/app-store';

interface SessionPlayerProps {
  onSkip: () => void;
  onEnd: () => void;
}

export const SessionPlayer: Component<SessionPlayerProps> = (props) => {
  const [elapsed, setElapsed] = createSignal(0);
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  const session = () => appStore.practiceSession();
  const itemIndex = () => appStore.sessionItemIndex();
  const totalItems = () => session()?.items.length ?? 0;

  const currentItem = () => {
    const s = session();
    if (!s) return null;
    return s.items[itemIndex()] ?? null;
  };

  const formatTime = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min > 0 ? `${min}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
  };

  // Start elapsed timer
  createEffect(() => {
    if (appStore.sessionActive()) {
      setElapsed(0);
      timerInterval = setInterval(() => {
        setElapsed((e) => e + 1000);
      }, 1000);
    } else {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }
  });

  onCleanup(() => {
    if (timerInterval) {
      clearInterval(timerInterval);
    }
  });

  const itemLabel = () => {
    const item = currentItem();
    if (!item) return '';
    if (item.label) return item.label;
    if (item.type === 'scale') return `${item.scaleType ?? 'Scale'} Scale`;
    if (item.type === 'rest') return 'Rest';
    return item.type;
  };

  const itemTypeIcon = () => {
    const item = currentItem();
    if (!item) return '';
    switch (item.type) {
      case 'scale': return '♩';
      case 'rest': return '⏸';
      default: return '♪';
    }
  };

  return (
    <Show when={appStore.sessionActive() && session()}>
      <div class="session-player">
        <div class="session-player-header">
          <span class="session-player-title">{session()!.name}</span>
          <span class="session-player-progress">
            Item {itemIndex() + 1} of {totalItems()}
          </span>
        </div>

        <div class="session-player-item">
          <span class="session-item-icon">{itemTypeIcon()}</span>
          <span class="session-item-label">{itemLabel()}</span>
        </div>

        <div class="session-player-timer">
          <span class="session-elapsed">{formatTime(elapsed())}</span>
        </div>

        <div class="session-player-controls">
          <button class="ctrl-btn small" onClick={props.onSkip} title="Skip this item">
            Skip
          </button>
          <button class="ctrl-btn small danger" onClick={props.onEnd} title="End session early">
            End
          </button>
        </div>
      </div>
    </Show>
  );
};
