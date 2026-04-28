// ============================================================
// LibraryTab — Quick access to saved melodies and sessions
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, For, onMount, Show } from 'solid-js'
import { appStore } from '@/stores/app-store'
import { getActiveSession } from '@/stores/melody-store'
import { melodyStore } from '@/stores/melody-store'
import { createSession, getSessionStore, saveSession } from '@/stores/session-store'
import type { MelodyData, SavedUserSession, SessionItem } from '@/types'

export const LibraryTab: Component = () => {
  const library = createMemo(() => melodyStore.getMelodyLibrary())

  const recentMelodies = createMemo(() => {
    const items = Object.values(library().melodies) as MelodyData[]
    return [...items]
      .sort(
        (a: MelodyData, b: MelodyData) =>
          (b.lastPlayed ?? b.playCount ?? 0) -
          (a.lastPlayed ?? a.playCount ?? 0),
      )
      .slice(0, 5)
  })

  const recentSessions = createMemo(() => {
    const sessions = Object.values(library().sessions).filter(
      (s): s is SavedUserSession => s !== null && s.id !== 'default'
    )
    return [...sessions]
      .sort(
        (a: SavedUserSession, b: SavedUserSession) =>
          (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0),
      )
      .slice(0, 5)
  })

  const recentItems = createMemo(() => {
    const items: Array<{type: 'melody', data: MelodyData} | {type: 'session', data: SavedUserSession}> = []

    // Add recent melodies
    const melodies = recentMelodies()
    items.push(...melodies.map((m): {type: 'melody', data: MelodyData} => ({type: 'melody', data: m})))

    // Add recent sessions (exclude default)
    const sessions = recentSessions()
    items.push(...sessions.map((s): {type: 'session', data: SavedUserSession} => ({type: 'session', data: s})))

    // Sort by lastPlayed
    return items.sort(
      (a, b) => (b.data.lastPlayed ?? 0) - (a.data.lastPlayed ?? 0)
    ).slice(0, 8)
  })

  // User session (new melody-ID model)
  const userSession = createMemo(() => {
    const session = appStore.userSession?.() ?? getActiveSession()
    return session ?? null
  })
  const sessionMelodyIds = createMemo(() => {
    const session = userSession()
    if (!session || session.items === undefined) return []
    return session.items
      .filter((item: SessionItem) => item.melodyId !== null)
      .map((item: SessionItem) => item.melodyId as string)
  })

  const selectedMelodyIds = createMemo(
    () => appStore.getSelectedMelodyIds?.() ?? [],
  )
  const sessionMelodies = createMemo(() => {
    const ids = sessionMelodyIds()
    return ids
      .map((id: string) => melodyStore.getMelody(id))
      .filter((m): m is MelodyData => m !== undefined)
  })

  // Practice session items (legacy model)
  const practiceSessionItems = createMemo(
    () => appStore.practiceSession()?.items ?? [],
  )
  const currentSessionItemIndex = createMemo(() =>
    appStore.getCurrentSessionItemIndex(),
  )
  const hasActivePracticeSession = createMemo(
    () => appStore.practiceSession() !== null,
  )

  const openLibrary = () => {
    appStore.showLibrary()
  }

  const openSessionLibrary = (): void => {
    appStore.showSessionLibrary()
  }

  const openPresetsLibrary = () => {
    appStore.showPresetsLibrary()
  }

  const handleNewSession = () => {
    console.info('[LibraryTab] handleNewSession called')
    // Create a new user-deletable session
    const newSession = createSession('New Session')
    // Set as active session
    appStore.setActiveUserSession(newSession)
    // Ensure it's saved to the library
    saveSession(newSession)
    // Persist active session ID
    melodyStore.setActiveSessionId(newSession.id)
    console.info('[LibraryTab] New session created:', newSession.id, 'setActiveSessionId:', melodyStore.getActiveSessionId())
    // Select the first melody item if available
    if (newSession.items.length > 0) {
      const firstItem = newSession.items[0]
      if (firstItem.type === 'melody' && 'melodyId' in firstItem) {
        const melodyId = (firstItem as { melodyId: string }).melodyId
        if (melodyId && typeof melodyId === 'string') {
          melodyStore.loadMelody(melodyId)
        }
      }
    }
    appStore.showNotification('New session created', 'success')
  }

  const handleRecentItemClick = (item: {type: 'melody', data: MelodyData} | {type: 'session', data: SavedUserSession}) => {
    if (item.type === 'melody') {
      // Load melody into editor
      melodyStore.loadMelody(item.data.id)

      // Ensure default session is loaded if no active session exists
      const activeSessionId = melodyStore.getActiveSessionId()
      if (activeSessionId === null) {
        const defaultSession = getSessionStore('default')
        if (defaultSession !== undefined && defaultSession !== null) {
          appStore.setActiveUserSession(defaultSession)
          melodyStore.setActiveSessionId(defaultSession.id)
        }
      } else {
        const activeSession = getSessionStore(activeSessionId)
        if (activeSession !== null) {
          appStore.setActiveUserSession(activeSession)
        }
      }
    } else if (item.type === 'session') {
      // Load session as active
      appStore.setActiveUserSession(item.data)
      // Load first melody in session if exists
      let firstMelodyId: string | undefined = undefined
      for (const i of item.data.items) {
        if (i.melodyId !== null && i.melodyId !== undefined) {
          firstMelodyId = i.melodyId
          break
        }
      }
      if (firstMelodyId !== undefined) {
        melodyStore.loadMelody(firstMelodyId)
      }
    }
  }

  // Get icon for session item type
  const getItemIcon = (item: SessionItem): string => {
    switch (item.type) {
      case 'scale':
        return '♩'
      case 'rest':
        return '⏸'
      case 'preset':
        return '♪'
      case 'melody':
        return '🎵'
      default:
        return '•'
    }
  }

  // Get icon for melody data
  const getMelodyIcon = (melody: MelodyData): string => {
    if (melody.scaleType === 'chromatic') return '♩'
    if (melody.scaleType === 'major' || melody.scaleType === 'minor') return '♩'
    return '♪'
  }

  const handleMelodyClick = (melodyId: string, e: MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      appStore.toggleMelodySelection?.(melodyId)
    } else {
      // Single click: load into editor
      melodyStore.loadMelody(melodyId)

      // Ensure default session is loaded if no active session exists
      const sid = melodyStore.getActiveSessionId()
      if (sid === null) {
        const defaultSession = getSessionStore('default')
        if (defaultSession !== undefined && defaultSession !== null) {
          appStore.setActiveUserSession(defaultSession)
          melodyStore.setActiveSessionId(defaultSession.id)
        }
      } else {
        const activeSession = getSessionStore(sid)
        if (activeSession !== null) {
          appStore.setActiveUserSession(activeSession)
        }
      }
    }
  }

  const handleMelodyDoubleClick = (melodyId: string) => {
    handlePlayMelodyInSession(melodyId)
  }

  /**
   * Get the session playback handler from window (set by App.tsx)
   */
  const getSessionPlaybackHandler = (): ((melodyId: string) => void) | null => {
    return (
      (
        window as unknown as {
          __loadAndPlayMelodyForSession?: (melodyId: string) => void
        }
      ).__loadAndPlayMelodyForSession ?? null
    )
  }

  const handlePlaySelected = () => {
    const ids = appStore.getSelectedMelodyIds?.() ?? []
    const handler = getSessionPlaybackHandler()
    if (ids.length > 0 && handler !== null) {
      handler(ids[0])
    } else {
      // Fallback: just load the melody
      melodyStore.loadMelody(ids[0])
    }
  }

  /**
   * Play a specific melody in session context
   */
  const handlePlayMelodyInSession = (melodyId: string) => {
    const handler = getSessionPlaybackHandler()
    if (handler !== null) {
      handler(melodyId)
    } else {
      melodyStore.loadMelody(melodyId)
    }
  }

  /**
   * Play all melodies in the session sequentially
   * This sets up a callback to play the next melody when current one completes
   */
  const handlePlaySessionSequence = () => {
    const ids = sessionMelodyIds()
    if (ids.length === 0) return

    // Get the sequence playback handler from window (set by App.tsx)
    const handler = (
      window as unknown as {
        __playSessionSequence?: (melodyIds: string[]) => void
      }
    ).__playSessionSequence

    if (handler !== undefined) {
      handler(ids)
    }
  }

  onMount(() => {
    library()
  })

  return (
    <div class="library-tab">
      <div class="tab-header">
        <h3>Library</h3>
        <div class="tab-actions">
          <button
            class="tab-action-btn"
            onClick={openLibrary}
            title="Open Melodies"
          >
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path
                fill="currentColor"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
              />
            </svg>
            Melodies
          </button>
          <button
            class="tab-action-btn"
            onClick={openPresetsLibrary}
            title="Open Presets"
          >
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path
                fill="currentColor"
                d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"
              />
            </svg>
            Presets
          </button>
        </div>
      </div>

      {/* User Session Melodies (new melody-ID model) */}
      <Show when={userSession() !== null}>
        <div class="session-items-section">
          <div class="session-header">
            <p class="section-label">
              {userSession()?.name ?? 'Session'} ({sessionMelodies().length})
            </p>
            <div class="session-actions">
              <button
                class="pill-action-btn"
                onClick={handlePlaySessionSequence}
                title="Play All in sequence"
              >
                ▶▶
              </button>
              <Show when={selectedMelodyIds().length > 1}>
                <button
                  class="pill-action-btn"
                  onClick={handlePlaySelected}
                  title="Play Selected"
                >
                  ▶ Selected
                </button>
              </Show>
              <Show
                when={
                  selectedMelodyIds().length > 0 &&
                  sessionMelodies().length > selectedMelodyIds().length
                }
              >
                <button
                  class="pill-action-btn"
                  onClick={() => appStore.selectAllMelodies?.()}
                  title="Select All"
                >
                  ✓
                </button>
              </Show>
              <Show when={selectedMelodyIds().length > 0}>
                <button
                  class="pill-action-btn"
                  onClick={() => appStore.clearMelodySelection?.()}
                  title="Clear Selection"
                >
                  ✕
                </button>
              </Show>
            </div>
          </div>
          <Show
            when={sessionMelodies().length > 0}
            fallback={
              <p class="empty-tip">
                No melodies in session. Save a melody and use "Save & Add to
                Session".
              </p>
            }
          >
            <div class="session-items-pills">
              <For each={sessionMelodies()}>
                {(melody) => (
                  <span
                    class={`session-item-pill melody-pill ${
                      selectedMelodyIds().includes(melody.id) ? 'selected' : ''
                    }`}
                    title={melody.name}
                    onClick={(e) => handleMelodyClick(melody.id, e)}
                    onDblClick={() => handleMelodyDoubleClick(melody.id)}
                  >
                    <span class="pill-icon">{getMelodyIcon(melody)}</span>
                    <span class="pill-label">{melody.name}</span>
                    <Show when={melody.tags && melody.tags.length > 0}>
                      <span class="pill-tags">
                        {(melody.tags as string[]).slice(0, 2).map((tag, _idx) => (
                          <span class="pill-tag">{tag}</span>
                        ))}
                        {(melody.tags as string[]).length > 2 && (
                          <span class="pill-tag more">+{(melody.tags as string[]).length - 2}</span>
                        )}
                      </span>
                    </Show>
                  </span>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      {/* Practice Session Items (legacy model) */}
      <Show when={hasActivePracticeSession()}>
        <div class="session-items-section practice-session">
          <p class="section-label">
            Practice ({practiceSessionItems().length})
          </p>
          <div class="session-items-pills">
            <For each={practiceSessionItems()}>
              {(item, index) => (
                <span
                  class={`session-item-pill ${
                    index() === currentSessionItemIndex() ? 'active' : ''
                  }`}
                  title={`${item.type}: ${item.label}`}
                >
                  <span class="pill-icon">{getItemIcon(item)}</span>
                  <span class="pill-label">{item.label}</span>
                  <Show
                    when={
                      item.repeat !== undefined &&
                      item.repeat !== null &&
                      item.repeat > 1
                    }
                  >
                    <span class="pill-repeat">×{item.repeat}</span>
                  </Show>
                </span>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Recent Items Section */}
      <div class="recent-section recent-items-section">
        <p class="section-label">Recent Items</p>
        {recentItems().length === 0 ? (
          <p class="empty-tip">
            No items yet. Click "Melodies" or "Sessions" to get started!
          </p>
        ) : (
          <For each={recentItems()}>
            {(item) => (
              <div class="recent-item" onClick={() => handleRecentItemClick(item)}>
                {item.type === 'melody' ? (
                  <>
                    <span class="recent-name">{item.data.name}</span>
                    <span class="recent-meta">{item.data.bpm} BPM</span>
                    <Show when={item.data.tags && item.data.tags.length > 0}>
                      <div class="recent-tags">
                        {(item.data.tags as string[]).slice(0, 2).map((tag, _idx) => (
                          <span class="recent-tag">{tag}</span>
                        ))}
                        {(item.data.tags as string[]).length > 2 && (
                          <span class="recent-tag more">+{(item.data.tags as string[]).length - 2}</span>
                        )}
                      </div>
                    </Show>
                  </>
                ) : (
                  <>
                    <span class="recent-name">{item.data.name}</span>
                    <span class="recent-meta">{item.data.items.length} items</span>
                  </>
                )}
              </div>
            )}
          </For>
        )}
      </div>

      {/* Quick Actions */}
      <div class="quick-actions">
        <button class="quick-action-btn" onClick={handleNewSession}>
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path
              fill="currentColor"
              d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"
            />
          </svg>
          New Session
        </button>
        <button class="quick-action-btn" onClick={openSessionLibrary}>
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path
              fill="currentColor"
              d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"
            />
          </svg>
          Sessions
        </button>
      </div>
    </div>
  )
}
