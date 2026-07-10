// ============================================================
// SessionBrowser — Modal for browsing and selecting practice sessions
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For } from 'solid-js'
import modalStyles from '@/components/Modal.module.css'
import { PRACTICE_SESSIONS } from '@/data/sessions'
import type { SessionCategory, SessionDifficulty, SessionTemplate, } from '@/types'

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
    if ((item.type as string) === 'scale') beats += item.beats ?? 8
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
      class={modalStyles.modalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose()
      }}
    >
      <div
        class={`${modalStyles.modalContent} ${modalStyles.sessionBrowser} session-browser`}
      >
        <div class={modalStyles.modalHeader}>
          <h2>Practice Sessions</h2>
          <button
            class={modalStyles.modalCloseBtn}
            onClick={() => props.onClose()}
            title="Close"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="currentColor"
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              />
            </svg>
          </button>
        </div>

        <div class={modalStyles.sessionCategories}>
          <For each={categories}>
            {(cat) => (
              <button
                class={`${modalStyles.sessionCatBtn} ${activeCategory() === cat ? modalStyles.active : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat === 'all' ? 'All' : (CATEGORY_LABELS[cat] ?? cat)}
              </button>
            )}
          </For>
        </div>

        <div class={modalStyles.sessionList}>
          <For each={filteredSessions()}>
            {(session) => (
              <div class={modalStyles.sessionCard}>
                <div class={modalStyles.sessionCardHeader}>
                  <span class={modalStyles.sessionName}>{session.name}</span>
                  <span
                    class={modalStyles.sessionDifficulty}
                    style={{ color: DIFFICULTY_COLORS[session.difficulty] }}
                  >
                    {session.difficulty}
                  </span>
                </div>
                <p class={modalStyles.sessionDescription}>
                  {session.description}
                </p>
                <div class={modalStyles.sessionMeta}>
                  <span class={modalStyles.sessionCategoryBadge}>
                    {CATEGORY_LABELS[session.category] ?? session.category}
                  </span>
                  <span class={modalStyles.sessionItemCount}>
                    {session.items.length} items
                  </span>
                  <span class={modalStyles.sessionDuration}>
                    ~{estimateDuration(session.items)}
                  </span>
                </div>
                <button
                  class={modalStyles.sessionStartBtn}
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
