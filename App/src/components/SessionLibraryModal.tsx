// ============================================================
// SessionLibraryModal — Manage saved practice sessions
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { appStore } from '@/stores/app-store'
import { melodyStore } from '@/stores/melody-store'
import type { SavedUserSession, SessionCategory, SessionDifficulty, } from '@/types'

interface SessionLibraryModalProps {
  isOpen: boolean
  close: () => void
}

export const SessionLibraryModal: Component<SessionLibraryModalProps> = (
  props,
) => {
  const [searchQuery, setSearchQuery] = createSignal('')
  const [isEditing, setIsEditing] = createSignal<SavedUserSession | null>(null)

  const sessions = createMemo(() => melodyStore.getSessions())

  const filteredSessions = createMemo(() => {
    const query = searchQuery().toLowerCase()
    return sessions()
      .filter(
        (s: SavedUserSession) =>
          (s.name as string).toLowerCase().includes(query) ||
          (s.category as string).toLowerCase().includes(query),
      )
      .sort(
        (a: SavedUserSession, b: SavedUserSession) =>
          (b.lastPlayed ?? b.created) - (a.lastPlayed ?? a.created),
      )
  })

  const handlePlay = (session: SavedUserSession) => {
    appStore.loadSession(session)
    props.close()
  }

  const handleDelete = (id: string) => {
    if (confirm('Delete this session?')) {
      melodyStore.deleteSession(id)
      const editing = isEditing()
      if (editing !== null && editing.id === id) setIsEditing(null)
    }
  }

  const handleEdit = (session: SavedUserSession) => {
    setIsEditing(session)
    setNameInput(session.name)
    setDifficulty(session.difficulty)
    setCategory(session.category)
  }

  const handleSave = () => {
    const editing = isEditing()
    if (editing !== null) {
      const updated: SavedUserSession = {
        ...editing,
        name: nameInput(),
        difficulty: difficulty(),
        category: category(),
        lastPlayed: Date.now(),
      }
      melodyStore.updateUserSession(updated)
    }
    setIsEditing(null)
    appStore.showNotification('Session saved', 'success')
  }

  const handleCancel = () => {
    setIsEditing(null)
  }

  const difficultyOptions: Array<{ value: SessionDifficulty; label: string }> =
    [
      { value: 'beginner', label: 'Beginner' },
      { value: 'intermediate', label: 'Intermediate' },
      { value: 'advanced', label: 'Advanced' },
    ]

  const categoryOptions: Array<{ value: SessionCategory; label: string }> = [
    { value: 'vocal', label: 'Vocal' },
    { value: 'instrumental', label: 'Instrumental' },
    { value: 'ear-training', label: 'Ear Training' },
    { value: 'general', label: 'General' },
  ]

  const [nameInput, setNameInput] = createSignal('')
  const [difficulty, setDifficulty] =
    createSignal<SessionDifficulty>('beginner')
  const [category, setCategory] = createSignal<SessionCategory>('general')

  const resetForm = () => {
    setNameInput('')
    setDifficulty('beginner')
    setCategory('general')
  }

  return (
    <Show when={props.isOpen}>
      <div class="modal-overlay" onClick={props.close}>
        <div class="library-modal" onClick={(e) => e.stopPropagation()}>
          <div class="library-header">
            <h2>Practice Sessions</h2>
            <button class="close-btn" onClick={props.close}>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="currentColor"
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                />
              </svg>
            </button>
          </div>

          {isEditing() !== null ? (
            <div class="edit-session-form">
              <h3>Edit Session</h3>

              <div class="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={nameInput()}
                  onInput={(e) => setNameInput(e.currentTarget.value)}
                  placeholder="Session name"
                />
              </div>

              <div class="form-group">
                <label>Difficulty</label>
                <select
                  value={difficulty()}
                  onChange={(e) =>
                    setDifficulty(e.currentTarget.value as SessionDifficulty)
                  }
                >
                  {difficultyOptions.map((opt) => (
                    <option value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div class="form-group">
                <label>Category</label>
                <select
                  value={category()}
                  onChange={(e) =>
                    setCategory(e.currentTarget.value as SessionCategory)
                  }
                >
                  {categoryOptions.map((opt) => (
                    <option value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div class="form-actions">
                <button class="cancel-btn" onClick={handleCancel}>
                  Cancel
                </button>
                <button class="save-btn" onClick={handleSave}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div class="library-content">
              <input
                type="text"
                class="search-input"
                placeholder="Search sessions..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
              />

              <button
                class="new-btn"
                onClick={() => {
                  setIsEditing({
                    id: `session-${Date.now()}`,
                    name: '',
                    author: 'User',
                    items: [],
                    created: Date.now(),
                    difficulty: 'beginner',
                    category: 'general',
                  })
                  resetForm()
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path
                    fill="currentColor"
                    d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"
                  />
                </svg>
                New Session
              </button>

              <div class="library-list">
                <For each={filteredSessions()}>
                  {(session) => (
                    <div class="library-item">
                      <div class="item-main">
                        <div class="item-title">{session.name}</div>
                        <div class="item-meta">
                          <span
                            class={`difficulty-badge ${session.difficulty}`}
                          >
                            {session.difficulty}
                          </span>
                          <span>•</span>
                          <span>{session.category}</span>
                          <span>•</span>
                          <span>{session.items.length} items</span>
                          <Show when={session.lastPlayed}>
                            <span>•</span>
                            <span>
                              {new Date(
                                session.lastPlayed!,
                              ).toLocaleDateString()}
                            </span>
                          </Show>
                        </div>
                      </div>
                      <div class="item-actions">
                        <button
                          class="action-btn play-btn"
                          onClick={() => handlePlay(session)}
                          title="Play"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14">
                            <path fill="currentColor" d="M8 5v14l11-7z" />
                          </svg>
                        </button>
                        <button
                          class="action-btn edit-btn"
                          onClick={() => handleEdit(session)}
                          title="Edit"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14">
                            <path
                              fill="currentColor"
                              d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"
                            />
                          </svg>
                        </button>
                        <button
                          class="action-btn delete-btn"
                          onClick={() => handleDelete(session.id)}
                          title="Delete"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14">
                            <path
                              fill="currentColor"
                              d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </For>

                {filteredSessions().length === 0 && (
                  <div class="empty-state">
                    <p>
                      No sessions found. Create a new session to get started!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Show>
  )
}
