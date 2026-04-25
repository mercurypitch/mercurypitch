// ============================================================
// LibraryTab — Quick access to saved melodies and sessions
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, For, onMount, Show } from 'solid-js'
import { appStore } from '@/stores/app-store'
import { melodyStore } from '@/stores/melody-store'
import type { MelodyData, SessionItem } from '@/types'

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

  // User session (new melody-ID model)
  const userSession = createMemo(() => appStore.userSession?.() ?? null)
  const sessionMelodyIds = createMemo(() => {
    const session = userSession()
    return session?.melodyIds ?? []
  })
  const selectedMelodyIds = createMemo(
    () => appStore.getSelectedMelodyIds?.() ?? [],
  )
  const sessionMelodies = createMemo(() => {
    const ids = sessionMelodyIds()
    return ids
      .map((id) => melodyStore.getMelody(id))
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

  const handlePlay = (melody: MelodyData) => {
    melodyStore.loadMelody(melody.id)
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

      {/* Recent Melodies Section */}
      <div class="recent-section">
        <p class="section-label">Recent Melodies</p>
        {recentMelodies().length === 0 ? (
          <p class="empty-tip">
            No melodies yet. Click "Melodies" to create one!
          </p>
        ) : (
          <For each={recentMelodies()}>
            {(m) => (
              <div class="recent-item" onClick={() => handlePlay(m)}>
                <span class="recent-name">{m.name}</span>
                <span class="recent-meta">{m.bpm} BPM</span>
              </div>
            )}
          </For>
        )}
      </div>

      {/* Quick Actions */}
      <div class="quick-actions">
        <button class="quick-action-btn" onClick={openPresetsLibrary}>
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path
              fill="currentColor"
              d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"
            />
          </svg>
          Quick Start
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
