// ============================================================
// PresetsLibraryModal — Static practice session templates
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { PRACTICE_SESSIONS } from '@/data/sessions'
import { appStore } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import { createMelodyItem, createScaleItem } from '@/stores/session-store'
import type { PlaybackSession, SessionCategory, SessionDifficulty, SessionItem, } from '@/types'

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

interface PresetsLibraryModalProps {
  isOpen: boolean
  close: () => void
}

export const PresetsLibraryModal: Component<PresetsLibraryModalProps> = (
  props,
) => {
  // ===========================================
  // 1. Signals - at the top
  // ===========================================
  const [activeCategory, setActiveCategory] = createSignal<
    SessionCategory | 'all'
  >('all')

  // ===========================================
  // 2. Memos - next
  // ===========================================
  const filteredSessions = createMemo(() => {
    const cat = activeCategory()
    if (cat === 'all') return PRACTICE_SESSIONS
    return PRACTICE_SESSIONS.filter((s) => s.category === cat)
  })

  // ===========================================
  // 3. Regular functions - event handlers
  // ===========================================

  function estimateDuration(items: SessionItem[]): string {
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

  const handlePlay = (session: (typeof PRACTICE_SESSIONS)[number]) => {
    // Convert template items to session items using factory functions
    // Load melody data into melodyStore before creating session items
    const sessionMelodies = session.items
      .filter(
        (item) =>
          item.type === 'melody' &&
          item.melodyId !== undefined &&
          item.melodyId !== null,
      )
      .map((item) => item.melodyId!)
      .filter((id, index, self) => self.indexOf(id) === index) // Deduplicate

    // Load each melody into melodyStore if not already loaded
    sessionMelodies.forEach((melodyId) => {
      const library = melodyStore.melodyLibrary()
      const existingMelody = library.melodies[melodyId]
      if (existingMelody === undefined || existingMelody === null) {
        // Find the melody in the library by matching names
        const allMelodies = Object.entries(library.melodies)
        for (const [, melody] of allMelodies) {
          if (melody.name === session.name) {
            melodyStore.updateMelody(melody.id, {
              name: session.name,
              items: melody.items,
            })
            break
          }
        }
      }
    })

    // Convert template items to session items using factory functions
    // Include preset items as they can be played as embedded melodies
    const items = session.items
      .filter((item) => item.type !== 'rest') // Keep scale and melody items
      .map((item) => {
        switch (item.type) {
          case 'scale' as never:
            return createScaleItem(
              item.label,
              item.scaleType ?? 'major',
              item.beats ?? 8,
              item.startBeat,
            )
          case 'melody':
            return createMelodyItem(
              item.label,
              item.melodyId ?? 'unknown',
              item.startBeat,
            )
          case 'preset' as never:
            // For preset items, load the embedded melody data if available
            if (item.items && item.items.length > 0) {
              return createMelodyItem(
                item.label,
                `${session.id}-${item.id}`,
                item.startBeat,
              )
            }
            return createMelodyItem(
              item.label,
              (item.melodyId as string) ?? 'unknown',
              item.startBeat,
            )
          default:
            return createScaleItem(item.label, 'major', 8, item.startBeat)
        }
      })

    const savedSession: PlaybackSession = {
      id: `preset-${session.id}`,
      name: session.name,
      author: 'System',
      deletable: false,
      items,
      created: Date.now(),
      lastPlayed: Date.now(),
      difficulty: session.difficulty as SessionDifficulty,
      category: session.category as SessionCategory,
    }

    console.log('[Library-Presets-Modal] Loading session', savedSession)
    appStore.loadSession(savedSession)
    // Small delay to allow session state to initialize before closing modal
    setTimeout(() => props.close(), 100)
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
              class={`session-cat-btn ${activeCategory() === 'warmup' ? 'active' : ''}`}
              onClick={() => setActiveCategory('warmup')}
            >
              Warmup
            </button>
            <button
              class={`session-cat-btn ${activeCategory() === 'scales' ? 'active' : ''}`}
              onClick={() => setActiveCategory('scales')}
            >
              Scales
            </button>
            <button
              class={`session-cat-btn ${activeCategory() === 'melodic' ? 'active' : ''}`}
              onClick={() => setActiveCategory('melodic')}
            >
              Melodic
            </button>
            <button
              class={`session-cat-btn ${activeCategory() === 'rhythmic' ? 'active' : ''}`}
              onClick={() => setActiveCategory('rhythmic')}
            >
              Rhythmic
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
                      {CATEGORY_LABELS[session.category] ?? session.category}
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
