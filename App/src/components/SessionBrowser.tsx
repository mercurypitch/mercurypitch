// ============================================================
// SessionBrowser — Modal for browsing and starting practice sessions
// ============================================================

import { Component, createSignal, For, Show } from 'solid-js';
import { appStore } from '@/stores/app-store';
import { PRACTICE_SESSIONS } from '@/data/sessions';
import type { PracticeSession, SessionCategory, SessionDifficulty } from '@/types';

interface SessionBrowserProps {
  isOpen: boolean;
  onClose: () => void;
}

type CategoryFilter = 'all' | SessionCategory | 'general';

const CATEGORIES: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'vocal', label: 'Vocal' },
  { value: 'instrumental', label: 'Instrumental' },
  { value: 'ear-training', label: 'Ear Training' },
  { value: 'general', label: 'General' },
];

const DIFFICULTY_COLORS: Record<SessionDifficulty, string> = {
  beginner: '#4ade80',
  intermediate: '#facc15',
  advanced: '#f87171',
};

const DIFFICULTY_LABELS: Record<SessionDifficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const SessionBrowser: Component<SessionBrowserProps> = (props) => {
  const [category, setCategory] = createSignal<CategoryFilter>('all');

  const filteredSessions = () => {
    const cat = category();
    if (cat === 'all') return PRACTICE_SESSIONS;
    return PRACTICE_SESSIONS.filter((s) => s.category === cat);
  };

  const handleStart = (session: PracticeSession) => {
    appStore.startPracticeSession(session);
    props.onClose();
    appStore.showNotification(`Session "${session.name}" started`, 'info');
  };

  const sessionDuration = (session: PracticeSession): string => {
    // Rough estimate: each scale item is about 4-8 beats at default BPM (80)
    // Each rest item is explicit ms
    const restMs = session.items
      .filter((i) => i.type === 'rest')
      .reduce((sum, i) => sum + (i.restMs ?? 0), 0);
    const scaleBeats = session.items
      .filter((i) => i.type === 'scale')
      .reduce((sum, i) => sum + (i.beats ?? 8), 0);
    const beatMs = (60000 / 80) * scaleBeats;
    const totalSec = Math.round((restMs + beatMs) / 1000);
    if (totalSec < 60) return `~${totalSec}s`;
    return `~${Math.round(totalSec / 60)}min`;
  };

  return (
    <Show when={props.isOpen}>
      <div class="modal-overlay" onClick={() => props.onClose()}>
        <div class="modal-content session-browser" onClick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h2>Practice Sessions</h2>
            <button class="modal-close" onClick={() => props.onClose()}>&times;</button>
          </div>

          {/* Category tabs */}
          <div class="session-categories">
            <For each={CATEGORIES}>
              {(cat) => (
                <button
                  class={`session-cat-btn ${category() === cat.value ? 'active' : ''}`}
                  onClick={() => setCategory(cat.value)}
                >
                  {cat.label}
                </button>
              )}
            </For>
          </div>

          {/* Session list */}
          <div class="session-list">
            <For each={filteredSessions()}>
              {(session) => (
                <div class="session-card">
                  <div class="session-card-header">
                    <span class="session-name">{session.name}</span>
                    <span
                      class="session-difficulty"
                      style={{ color: DIFFICULTY_COLORS[session.difficulty] }}
                    >
                      {DIFFICULTY_LABELS[session.difficulty]}
                    </span>
                  </div>
                  <p class="session-description">{session.description}</p>
                  <div class="session-meta">
                    <span class="session-items">
                      {session.items.length} item{session.items.length !== 1 ? 's' : ''}
                    </span>
                    <span class="session-duration">{sessionDuration(session)}</span>
                    <span class="session-category-badge">{session.category}</span>
                  </div>
                  <button
                    class="ctrl-btn session-start-btn"
                    onClick={() => handleStart(session)}
                  >
                    Start Session
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
  );
};
