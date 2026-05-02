// ============================================================
// SessionLibraryModal — Manage saved practice sessions
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { appStore, melodyStore, setActiveTab, setEditorView } from '@/stores'
import { setActiveUserSession, showNotification } from '@/stores'
import { createSession, saveSession } from '@/stores/session-store'
import type { PlaybackSession, SessionCategory, SessionDifficulty, } from '@/types'
import { SessionMiniTimeline } from './SessionMiniTimeline'

// Drag and drop state
type DragState =
  | null
  | { type: 'melody'; melodyId: string }
  | { type: 'playlist'; playlistId: string }
  | { type: 'session'; sessionId: string }

interface SessionLibraryModalProps {
  isOpen: boolean
  close: () => void
}

export const SessionLibraryModal: Component<SessionLibraryModalProps> = (
  props,
) => {
  const [searchQuery, setSearchQuery] = createSignal('')
  const [dragState, setDragState] = createSignal<DragState>(null)

  const sessions = createMemo(() => melodyStore.getSessions())

  const filteredSessions = createMemo(() => {
    const query = searchQuery().toLowerCase()
    return sessions()
      .filter(
        (s: PlaybackSession) =>
          (s.name as string).toLowerCase().includes(query) ||
          (s.category as string).toLowerCase().includes(query),
      )
      .sort(
        (a: PlaybackSession, b: PlaybackSession) =>
          (b.lastPlayed ?? b.created) - (a.lastPlayed ?? a.created),
      )
  })

  /**
   * Start playing the selected session, exactly like the Library tab's
   * "Play All in sequence" button does.
   *
   * Flow (must match LibraryTab.handlePlaySessionSequence so users get
   * consistent behavior regardless of which UI they came from):
   *   1. Make `session` the active user-session (so userSession() returns
   *      it inside the playback controller).
   *   2. Switch to the Practice tab + Practice playMode (the per-item
   *      runner only triggers when playMode === 'practice').
   *   3. Close the modal so the practice canvas is visible.
   *   4. Trigger window.__pp.playSessionSequence(...) which the bridge
   *      maps to useSessionSequencer.playSessionSequence — same code path
   *      as the Library button.
   *
   * The previous handler only called `appStore.loadSession()` (which
   * sets the active session) and closed the modal — it never actually
   * started playback, so the Play button appeared to do nothing.
   */
  const handlePlay = (session: PlaybackSession) => {
    setActiveUserSession(session)
    // appStore.loadSession also seeds bpm/key/scale and other UI state
    // that Play-All relies on (it's called indirectly via the bridge).
    // Calling it here keeps the two routes identical.
    appStore.loadSession(session)
    setActiveTab('practice')
    // playMode is forced to 'practice' inside usePlaybackController's
    // playSessionSequence() handler, so we don't need to set it here —
    // and there's no store-level setPlayMode export (it's an App-local
    // signal). Setting the active tab + closing the modal + invoking
    // the bridge is enough.
    props.close()

    const win = window as unknown as {
      __pp?: { playSessionSequence?: (melodyIds: string[]) => void }
      __playSessionSequence?: (melodyIds: string[]) => void
    }
    const handler = win.__pp?.playSessionSequence ?? win.__playSessionSequence
    if (handler !== undefined) {
      // The handler reads userSession() internally; the ids array is
      // ignored by the production sequencer, so an empty array is fine.
      handler([])
    }
  }

  const handleDelete = (id: string) => {
    if (confirm('Delete this session?')) {
      melodyStore.deleteSession(id)
    }
  }

  const handleEdit = (session: PlaybackSession) => {
    setActiveUserSession(session)
    const firstMelodyItem = session.items.find(
      (item) => item.type === 'melody' && item.melodyId !== undefined,
    )
    if (firstMelodyItem?.melodyId !== undefined) {
      melodyStore.loadMelody(firstMelodyItem.melodyId)
    }
    setActiveTab('editor')
    setEditorView('session-editor')
  }

  // Drag and drop handlers
  const handleDragStartSession = (e: DragEvent, sessionId: string) => {
    setDragState({ type: 'session', sessionId })
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('sessionId', sessionId)
    }
  }

  const handleDragEnd = () => {
    setDragState(null)
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
  }

  const handleDropSessionToPlaylist = (e: DragEvent, sessionId: string) => {
    e.preventDefault()
    const state = dragState()
    if (state !== null && state.type === 'playlist') {
      melodyStore.addSessionToPlaylist(state.playlistId, sessionId)
      showNotification('Session added to playlist', 'success')
      setDragState(null)
    }
  }

  const _difficultyOptions: Array<{ value: SessionDifficulty; label: string }> =
    [
      { value: 'beginner', label: 'Beginner' },
      { value: 'intermediate', label: 'Intermediate' },
      { value: 'advanced', label: 'Advanced' },
    ]

  const _categoryOptions: Array<{ value: SessionCategory; label: string }> = [
    { value: 'vocal', label: 'Vocal' },
    { value: 'warmup', label: 'Warmup' },
    { value: 'scales', label: 'Scales' },
    { value: 'melodic', label: 'Melodic' },
    { value: 'rhythmic', label: 'Rhythmic' },
    { value: 'ear_training', label: 'Ear Training' },
    { value: 'custom', label: 'Custom' },
  ]

  return (
    <Show when={props.isOpen}>
      <div class="modal-overlay" onClick={() => props.close()}>
        <div class="library-modal" onClick={(e) => e.stopPropagation()}>
          <div class="library-header">
            <h2>Practice Sessions</h2>
            <button class="close-btn" onClick={() => props.close()}>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="currentColor"
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                />
              </svg>
            </button>
          </div>

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
                console.info('[SessionLibraryModal] New Session clicked')
                const newSession = createSession(
                  `New Session ${melodyStore.getSessions().length + 1}`,
                )
                saveSession(newSession)
                setActiveUserSession(newSession)
                showNotification('New session created', 'success')
                // Navigate to Editor for editing
                setActiveTab('editor')
                setEditorView('session-editor')
                console.info(
                  '[SessionLibraryModal] New session:',
                  newSession.id,
                  'activeSessionId:',
                  melodyStore.getActiveSessionId(),
                )
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
                  <div
                    class="library-item session-library-item"
                    draggable={dragState()?.type === 'playlist'}
                    onDragStart={(e) => handleDragStartSession(e, session.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropSessionToPlaylist(e, session.id)}
                  >
                    <div class="item-main">
                      <div class="item-title">{session.name}</div>
                      <div class="item-meta">
                        <span class={`difficulty-badge ${session.difficulty}`}>
                          {session.difficulty}
                        </span>
                        <span>•</span>
                        <span>{session.category}</span>
                        <span>•</span>
                        <span>{session.items.length} items</span>
                        <Show when={session.lastPlayed}>
                          <span>•</span>
                          <span>
                            {new Date(session.lastPlayed!).toLocaleDateString()}
                          </span>
                        </Show>
                      </div>
                      {/*
                        Read-only mini timeline preview (Task 5).
                        Renders one pill per session item so the user
                        can scan a session's contents at a glance
                        without opening the editor. Drag/edit/delete
                        actions remain on the card-level item-actions
                        cluster below.
                      */}
                      <SessionMiniTimeline session={session} />
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
                  <p>No sessions found. Create a new session to get started!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
