// ============================================================
// PresetsLibraryModal — Static practice session templates
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { PRACTICE_SESSIONS } from '@/data/sessions'
import { appStore } from '@/stores/app-store'
import type { SavedUserSession, SessionCategory, SessionDifficulty, SessionItem, } from '@/types'

const DIFFICULTY_COLORS: Record<SessionDifficulty, string> = {
  beginner: 'var(--accent-success)',
  intermediate: 'var(--accent-warning)',
  advanced: 'var(--accent-danger)',
}

const CATEGORY_LABELS: Record<SessionCategory, string> = {
  vocal: 'Vocal',
  instrumental: 'Instrumental',
  'ear-training': 'Ear Training',
  general: 'General',
}

function estimateDuration(items: SessionItem[]): string {
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

interface PresetsLibraryModalProps {
  isOpen: boolean
  close: () => void
}

export const PresetsLibraryModal: Component<PresetsLibraryModalProps> = (
  props,
) => {
  const [activeCategory, setActiveCategory] = createSignal<
    SessionCategory | 'all'
  >('all')

  const filteredSessions = createMemo(() => {
    const cat = activeCategory()
    if (cat === 'all') return PRACTICE_SESSIONS
    return PRACTICE_SESSIONS.filter((s) => s.category === cat)
  })

  const handlePlay = (session: (typeof PRACTICE_SESSIONS)[number]) => {
    const items = session.items.map((item) => ({
      type: item.type as 'scale' | 'rest' | 'preset' | 'melody',
      label: item.label,
      scaleType: item.scaleType,
      beats: item.beats,
      restMs: item.restMs,
      repeat: item.repeat ?? 1,
    }))

    const savedSession: SavedUserSession = {
      id: `preset-${session.id}`,
      name: session.name,
      author: 'System',
      items,
      created: Date.now(),
      lastPlayed: Date.now(),
      difficulty: session.difficulty,
      category: session.category,
    }

    appStore.loadSession(savedSession)
    props.close()
  }

  return (
    <Show when={props.isOpen}>
      <div
        class="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.close()
        }}
      >
        <div
          class="library-modal"
          style={{ width: '700px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div class="library-header">
            <h2>Practice Presets</h2>
            <button class="close-btn" onClick={props.close}>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="currentColor"
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                />
              </svg>
            </button>
          </div>

          <div class="session-categories">
            <button
              class={`session-cat-btn ${activeCategory() === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              All
            </button>
            <button
              class={`session-cat-btn ${activeCategory() === 'vocal' ? 'active' : ''}`}
              onClick={() => setActiveCategory('vocal')}
            >
              Vocal
            </button>
            <button
              class={`session-cat-btn ${activeCategory() === 'instrumental' ? 'active' : ''}`}
              onClick={() => setActiveCategory('instrumental')}
            >
              Instrumental
            </button>
            <button
              class={`session-cat-btn ${activeCategory() === 'ear-training' ? 'active' : ''}`}
              onClick={() => setActiveCategory('ear-training')}
            >
              Ear Training
            </button>
            <button
              class={`session-cat-btn ${activeCategory() === 'general' ? 'active' : ''}`}
              onClick={() => setActiveCategory('general')}
            >
              General
            </button>
          </div>

          <div class="preset-list">
            <For each={filteredSessions()}>
              {(session) => (
                <div class="preset-card">
                  <div class="preset-card-header">
                    <span class="preset-name">{session.name}</span>
                    <span
                      class="preset-difficulty"
                      style={{ color: DIFFICULTY_COLORS[session.difficulty] }}
                    >
                      {session.difficulty}
                    </span>
                  </div>
                  <p class="preset-description">{session.description}</p>
                  <div class="preset-meta">
                    <span class="preset-category-badge">
                      {CATEGORY_LABELS[session.category]}
                    </span>
                    <span class="preset-item-count">
                      {session.items.length} items
                    </span>
                    <span class="preset-duration">
                      ~{estimateDuration(session.items)}
                    </span>
                  </div>
                  <button
                    class="preset-start-btn"
                    onClick={() => handlePlay(session)}
                  >
                    Start
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
  )
}
