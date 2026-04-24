// ============================================================
// SessionBrowser — Modal for browsing and selecting practice sessions
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For } from 'solid-js'
import { PRACTICE_SESSIONS } from '@/data/sessions'
import type { SessionCategory, SessionDifficulty, SessionTemplate } from '@/types'

type FilterCategory = 'all' | SessionCategory

interface SessionBrowserProps {
  onClose: () => void
  onStartSession: (session: SessionTemplate) => void
}

const DIFFICULTY_COLORS: Record<SessionDifficulty, string> = {
  beginner: 'var(--accent-success)',
  intermediate: 'var(--accent-warning)',
  advanced: 'var(--accent-danger)',
  expert: 'var(--accent-info)',
}

const CATEGORY_LABELS: Partial<Record<SessionCategory, string>> = {
  warmup: 'Warmup',
  scales: 'Scales',
  melodic: 'Melodic',
  rhythmic: 'Rhythmic',
  ear_training: 'Ear Training',
  custom: 'Custom',
  vocal: 'Vocal',
}

function estimateDuration(items: SessionTemplate['items']): string {
  let beats = 0
  let restMs = 0
  for (const item of items) {
    if (item.type === 'scale') beats += item.beats ?? 8
    if (item.type === 'rest') restMs += item.restMs ?? 0
  }
  const sec = Math.round(beats * (60 / 120) + restMs / 1000)
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export const SessionBrowser: Component<SessionBrowserProps> = (props) => {
  const [activeCategory, setActiveCategory] =
    createSignal<FilterCategory>('all')

  const filteredSessions = () => {
    const cat = activeCategory()
    if (cat === 'all') return PRACTICE_SESSIONS
    return PRACTICE_SESSIONS.filter((s) => s.category === cat)
  }

  const categories: FilterCategory[] = [
    'all',
    'vocal',
    'warmup',
    'scales',
    'melodic',
    'rhythmic',
  ]

  return (
    <div
      class="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose()
      }}
    >
      <div class="modal-content session-browser">
        <div class="modal-header">
          <h2>Practice Sessions</h2>
          <button class="modal-close-btn" onClick={props.onClose} title="Close">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="currentColor"
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              />
            </svg>
          </button>
        </div>

        <div class="session-categories">
          <For each={categories}>
            {(cat) => (
              <button
                class={`session-cat-btn ${activeCategory() === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat === 'all' ? 'All' : CATEGORY_LABELS[cat] ?? cat}
              </button>
            )}
          </For>
        </div>

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
                    {session.difficulty}
                  </span>
                </div>
                <p class="session-description">{session.description}</p>
                <div class="session-meta">
                  <span class="session-category-badge">
                    {CATEGORY_LABELS[session.category] ?? session.category}
                  </span>
                  <span class="session-item-count">
                    {session.items.length} items
                  </span>
                  <span class="session-duration">
                    ~{estimateDuration(session.items)}
                  </span>
                </div>
                <button
                  class="session-start-btn"
                  onClick={() => {
                    props.onStartSession(session)
                  }}
                >
                  Start
                </button>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
