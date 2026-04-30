// ============================================================
// LibraryTab — Quick access to saved melodies and sessions
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, For, onMount, Show } from 'solid-js'
import { buildSessionItemMelody } from '@/lib/session-builder'
import { appStore, setEditorView, showSessionPresetsLibrary } from '@/stores'
import { setActiveTab, setActiveUserSession, showLibrary, showNotification, showSessionLibrary, userSession as userSessionSignal, } from '@/stores'
import { getActiveSession, getSessions } from '@/stores/melody-store'
import { melodyStore } from '@/stores/melody-store'
import { playback } from '@/stores/playback-store'
import { createSession, getDefaultSession, getSession, saveSession, } from '@/stores/session-store'
import type { MelodyData, PlaybackSession, SessionItem } from '@/types'


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
      (s): s is PlaybackSession => s !== null && s.id !== 'default',
    )
    return [...sessions]
      .sort(
        (a: PlaybackSession, b: PlaybackSession) =>
          (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0),
      )
      .slice(0, 5)
  })

  const _recentItems = createMemo(() => {
    const items: Array<
      | { type: 'melody'; data: MelodyData }
      | { type: 'session'; data: PlaybackSession }
    > = []

    // Add recent melodies
    const melodies = recentMelodies()
    items.push(
      ...melodies.map((m): { type: 'melody'; data: MelodyData } => ({
        type: 'melody',
        data: m,
      })),
    )

    // Add recent sessions (exclude default)
    const sessions = recentSessions()
    items.push(
      ...sessions.map((s): { type: 'session'; data: PlaybackSession } => ({
        type: 'session',
        data: s,
      })),
    )

    // Sort by lastPlayed
    return items
      .sort((a, b) => (b.data.lastPlayed ?? 0) - (a.data.lastPlayed ?? 0))
      .slice(0, 8)
  })

  // User session (new melody-ID model)
  const userSession = createMemo(() => {
    const explicitSession = userSessionSignal?.()
    const activeSession = getActiveSession()
    const defaultSession = getDefaultSession()
    return explicitSession ?? activeSession ?? defaultSession ?? null
  })

  const allSessions = createMemo(() => {
    const sessions = Object.values(library().sessions).filter(
      (session): session is PlaybackSession =>
        session !== null && session !== undefined,
    )
    const explicitSession = userSessionSignal?.()
    const defaultSession = getDefaultSession()
    const sessionMap = new Map<string, PlaybackSession>()

    if (defaultSession !== null) {
      sessionMap.set(defaultSession.id, defaultSession)
    }

    if (explicitSession !== null && explicitSession !== undefined) {
      sessionMap.set(explicitSession.id, explicitSession)
    }

    for (const session of sessions) {
      sessionMap.set(session.id, session)
    }

    return Array.from(sessionMap.values()).sort((a, b) => {
      if (a.id === 'default') return -1
      if (b.id === 'default') return 1
      return (b.created ?? 0) - (a.created ?? 0)
    })
  })

  const activeMelodyId = createMemo(
    () => melodyStore.getCurrentMelody()?.id ?? null,
  )

  const sessionMelodyIds = createMemo(() => {
    const session = userSession()
    if (session === null || session.items === undefined) return []
    return session.items
      .filter(
        (item: SessionItem) =>
          item.melodyId !== null && item.melodyId !== undefined,
      )
      .map((item: SessionItem) => item.melodyId as string)
  })

  const selectedMelodyIds = createMemo(
    () => appStore.getSelectedMelodyIds?.() ?? [],
  )

  const sessionItems = createMemo(() => {
    const session = userSession()
    if (session === null || session.items === undefined) return []

    return session.items.map((item) => {
      if (
        item.type === 'melody' &&
        item.melodyId !== null &&
        item.melodyId !== undefined
      ) {
        const melodyData = melodyStore.getMelody(item.melodyId)
        return {
          ...item,
          melodyData,
        }
      }
      return item
    })
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
    showLibrary()
  }

  const openSessionLibrary = (): void => {
    showSessionLibrary()
  }

  const setActiveSessionAndSelectFirstMelody = (
    session: PlaybackSession,
  ): void => {
    setActiveUserSession(session)
    const firstMelodyItem = session.items.find(
      (item) => item.type === 'melody' && item.melodyId !== undefined,
    )
    if (firstMelodyItem?.melodyId !== undefined) {
      melodyStore.loadMelody(firstMelodyItem.melodyId)
    }
  }

  const handleSessionChange = (e: Event): void => {
    const sessionId = (e.currentTarget as HTMLSelectElement).value
    // v3: dropdown also lists playlists (with id "playlist:<id>") so the
    // user can promote a playlist into the active-session slot. Detect the
    // synthetic prefix and build a synthetic session via melody-store.
    if (sessionId.startsWith('playlist:')) {
      const playlistId = sessionId.slice('playlist:'.length)
      const synth = melodyStore.buildPlaylistAsSession(playlistId)
      if (synth !== null) {
        setActiveSessionAndSelectFirstMelody(synth)
      }
      return
    }
    const session = getSession(sessionId)
    if (session !== undefined) {
      setActiveSessionAndSelectFirstMelody(session)
    }
  }

  // List of playlists for the active-session dropdown (rendered as a
  // separate <optgroup>).
  const allPlaylists = createMemo(() => {
    const playlists = library().playlists
    return Object.entries(playlists).map(([id, p]) => ({
      id: `playlist:${id}`,
      name: p.name,
      count: p.melodyKeys.length + (p.sessionKeys?.length ?? 0),
    }))
  })

  const handleNewSession = () => {
    console.info('[LibraryTab] handleNewSession called')
    // Create a new user-deletable session
    const newSession = createSession(`New Session ${getSessions().length + 1}`)
    // Ensure it's saved to the library
    saveSession(newSession)
    // Set as active session after saving so the sidebar immediately reflects an empty session
    setActiveUserSession(newSession)
    console.info(
      '[LibraryTab] New session created:',
      newSession.id,
      'setActiveSessionId:',
      melodyStore.getActiveSessionId(),
    )
    showNotification('New session created', 'success')
  }

  const handleQuickNewMelody = (): void => {
    const baseName = `New Melody ${melodyStore.getMelodyCount() + 1}`
    const newMelody = melodyStore.createNewMelody(baseName, 'User')
    const updatedSession = melodyStore.addMelodyToActiveSession(
      newMelody.id,
      newMelody.name,
    )
    if (updatedSession !== undefined) {
      setActiveUserSession(updatedSession)
    }
    melodyStore.loadMelody(newMelody.id)
    setActiveTab('editor')
    setEditorView('piano-roll')
    showNotification(`Melody "${newMelody.name}" created`, 'success')
  }

  const _handleRecentItemClick = (
    item:
      | { type: 'melody'; data: MelodyData }
      | { type: 'session'; data: PlaybackSession },
  ) => {
    if (item.type === 'melody') {
      // Load melody into editor
      melodyStore.loadMelody(item.data.id)

      // Ensure default session is loaded if no active session exists
      const activeSessionId = melodyStore.getActiveSessionId()
      if (activeSessionId === null) {
        const defaultSession = getSession('default')
        if (defaultSession !== undefined && defaultSession !== null) {
          setActiveUserSession(defaultSession)
          melodyStore.setActiveSessionId(defaultSession.id)
        }
      } else {
        const activeSession = getSession(activeSessionId)
        if (activeSession !== undefined) {
          setActiveUserSession(activeSession)
        }
      }
    } else if (item.type === 'session') {
      // Load session as active
      setActiveSessionAndSelectFirstMelody(item.data)
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
      case 'scale' as never:
        return '♩'
      case 'rest':
        return '⏸'
      case 'preset' as never:
        return '♪'
      case 'melody':
        return '🎵'
      default:
        return '•'
    }
  }

  // Get icon for melody data
  const getMelodyIcon = (melody: MelodyData | undefined): string => {
    if (melody === undefined) return '♪'
    if (melody.scaleType === 'chromatic') return '♩'
    if (melody.scaleType === 'major' || melody.scaleType === 'minor') return '♩'
    return '♪'
  }

  const handleMelodyClick = (melodyId: string, e: MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      appStore.toggleMelodySelection?.(melodyId)
      return
    }
    // Guard: changing the active melody mid-playback would desync the
    // PlaybackRuntime (which is currently iterating notes from the old
    // melody) from melodyStore (the new melody) and visually swap the
    // canvas under the playhead. Disallow until the user has fully
    // stopped. We treat "playing" and "paused" as locked; only when the
    // global transport store reports stopped can the sidebar mutate the
    // active melody.
    if (!playback.isStopped()) {
      showNotification(
        'Stop playback before switching melody',
        'info',
      )
      return
    }
    // Single click: select for playback. We do NOT switch tabs anymore —
    // selection is purely a Practice/sidebar action; the user can decide
    // when to open the editor (double-click goes via handleMelodyDoubleClick
    // → handlePlayMelodyInSession). This was previously force-switching to
    // the editor tab, which was wrong UX.
    melodyStore.loadMelody(melodyId)
    // The PracticeCanvas reads `playbackDisplayMelody() ?? melodyStore.items()`

    // and previously kept showing the stale post-play session melody after
    // a sidebar click. The fix lives in usePlaybackController.ts as a
    // createEffect on melodyStore.getCurrentMelody()?.id which clears the
    // display whenever the active melody id changes while stopped — so the
    // loadMelody() call above is sufficient here; no manual clear needed.



    // Ensure default session is loaded if no active session exists.
    const sid = melodyStore.getActiveSessionId()
    if (sid === null) {
      const defaultSession = getSession('default')
      if (defaultSession !== undefined && defaultSession !== null) {
        setActiveUserSession(defaultSession)
        melodyStore.setActiveSessionId(defaultSession.id)
      }
    } else {
      const activeSession = getSession(sid)
      if (activeSession !== undefined) {
        setActiveUserSession(activeSession)
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
    if (ids.length > 0) {
      if (handler !== null) {
        handler(ids[0])
      } else {
        // Fallback: just load the melody
        melodyStore.loadMelody(ids[0])
      }
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
   * This sets up a callback to play the next melody when the current one completes
   */
  const handlePlaySessionSequence = () => {
    const ids = sessionMelodyIds()
    if ((userSession()?.items.length ?? 0) === 0) return

    // Get the sequence playback handler from App.tsx.
    // Production bridge lives under window.__pp. The old top-level
    // __playSessionSequence alias is e2e/test-only (exposeForE2E), so
    // reading only that alias made the real UI button a no-op in normal
    // app mode.
    const win = window as unknown as {
      __pp?: { playSessionSequence?: (melodyIds: string[]) => void }
      __playSessionSequence?: (melodyIds: string[]) => void
    }
    const handler = win.__pp?.playSessionSequence ?? win.__playSessionSequence

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
            title="Open Library"
          >
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path
                fill="currentColor"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
              />
            </svg>
            Browse
          </button>
          <button
            class="tab-action-btn"
            onClick={showSessionPresetsLibrary}
            title="Browse Sessions"
          >
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path
                fill="currentColor"
                d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"
              />
            </svg>
            Sessions
          </button>
        </div>
      </div>

      {/* User Session Melodies (new melody-ID model) */}
      <Show when={userSession() !== null}>
        <div class="session-items-section">
          <div class="session-header">
            <div class="active-session-summary">
              <p class="section-label">Active Session</p>
              <select
                class="session-select sidebar-session-select"
                onChange={handleSessionChange}
                title="Choose active session"
              >
                {/*
                  NOTE: We mark `selected` per-<option> instead of using the
                  controlled `value=` prop on <select>. With dynamic
                  <optgroup>/<For> children, the `value` prop applies before
                  options exist on the first render, so the displayed label
                  doesn't update when `userSession()` changes. Setting
                  `selected` reactively on the matching option keeps the
                  display in sync with the active session/playlist.
                */}
                <optgroup label="Sessions">
                  <For each={allSessions()}>
                    {(session) => (
                      <option
                        value={session.id}
                        selected={userSession()?.id === session.id}
                      >
                        {session.name}
                      </option>
                    )}
                  </For>
                </optgroup>
                <Show when={allPlaylists().length > 0}>
                  <optgroup label="Playlists">
                    <For each={allPlaylists()}>
                      {(p) => (
                        <option
                          value={p.id}
                          selected={userSession()?.id === p.id}
                        >
                          {p.name} ({p.count})
                        </option>
                      )}
                    </For>
                  </optgroup>
                </Show>
              </select>

              <span class="section-meta">
                {sessionItems().length} item
                {sessionItems().length === 1 ? '' : 's'}
              </span>
            </div>
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
                  sessionItems().filter((i) => i.type === 'melody').length >
                    selectedMelodyIds().length
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
            when={sessionItems().length > 0}
            fallback={
              <p class="empty-tip">
                No melodies in this session yet. Create a melody to add it here.
              </p>
            }
          >
            <div class="session-items-pills">
              <For each={sessionItems()}>
                {(item: SessionItem & { melodyData?: MelodyData }) => {
                  // ────────────────────────────────────────────────
                  // BUGFIX: previously these were `const`s computed once
                  // when the For row was created. That made the "active"
                  // and "selected" classes stick to whichever melody was
                  // current at first render — clicking another pill
                  // updated `currentMelody` but the row's class string
                  // was already baked in, so the wrong pill kept the
                  // highlight. Wrap each derived value in an accessor
                  // so SolidJS re-runs them when signals change.
                  // ────────────────────────────────────────────────
                  const melodyId = (): string | null =>
                    item.type === 'melody' &&
                    item.melodyId !== null &&
                    item.melodyId !== undefined
                      ? item.melodyId
                      : null
                  const isMelody = (): boolean => melodyId() !== null
                  const isMissingMelody = (): boolean =>
                    isMelody() && item.melodyData === undefined
                  const isSelected = (): boolean => {
                    const id = melodyId()
                    return id !== null && selectedMelodyIds().includes(id)
                  }
                  const isActiveMelody = (): boolean =>
                    melodyId() !== null && melodyId() === activeMelodyId()
                  const itemLabel = (): string =>
                    isMelody() &&
                    !isMissingMelody() &&
                    item.melodyData !== undefined
                      ? item.melodyData.name
                      : item.label

                  const isClickable = item.type !== 'rest'

                  const handleClickItem = (e: MouseEvent) => {
                    if (!isClickable) return
                    const id = melodyId()
                    if (id !== null && !isMissingMelody()) {
                      handleMelodyClick(id, e)
                      return
                    }
                    // Legacy scale/preset items — flatten into a transient
                    // melody. Single-click should not switch tabs.
                    const built = buildSessionItemMelody(item)
                    if (built.length > 0) melodyStore.setMelody(built)
                  }
                  const handleDblClickItem = () => {
                    const id = melodyId()
                    if (id !== null && !isMissingMelody()) {
                      handleMelodyDoubleClick(id)
                    }
                  }

                  // Build the class string reactively. We compose with a
                  // function so each signal access stays inside the JSX
                  // reactive scope — Solid's compiler picks it up.
                  //
                  // Adds a `disabled` modifier whenever playback is not
                  // fully stopped — clicks are already gated by the
                  // playback.isStopped() guard in handleMelodyClick, but
                  // visual feedback (cursor + opacity) makes it clear
                  // why the click did nothing. The currently-active
                  // melody pill keeps its `active` style untouched so
                  // the user can still see which session item is
                  // playing right now.
                  const isLocked = (): boolean => !playback.isStopped()
                  const pillClass = (): string =>
                    [
                      'session-item-pill',
                      isMelody() ? 'melody-pill' : '',
                      isClickable ? 'clickable' : '',
                      isSelected() ? 'selected' : '',
                      isActiveMelody() ? 'active' : '',
                      isLocked() && !isActiveMelody() ? 'pill-disabled' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')


                  return (
                    <span
                      class={pillClass()}
                      title={itemLabel()}
                      data-melody-id={melodyId() ?? ''}
                      data-item-id={item.id}
                      onClick={handleClickItem}
                      onDblClick={handleDblClickItem}
                    >
                      <span class="pill-icon">
                        {isMelody() &&
                        !isMissingMelody() &&
                        item.melodyData !== undefined
                          ? getMelodyIcon(item.melodyData)
                          : getItemIcon(item)}
                      </span>
                      <span class="pill-label">{itemLabel()}</span>

                      <Show
                        when={
                          isMelody() &&
                          !isMissingMelody() &&
                          item.melodyData !== undefined &&
                          item.melodyData.tags !== undefined &&
                          item.melodyData.tags.length > 0
                        }
                      >
                        <span class="pill-tags">
                          {(item.melodyData?.tags as string[])
                            .slice(0, 2)
                            .map((tag) => (
                              <span class="pill-tag">{tag}</span>
                            ))}
                          {item.melodyData !== undefined &&
                            item.melodyData.tags !== undefined &&
                            (item.melodyData.tags as string[]).length > 2 && (
                              <span class="pill-tag more">
                                +{(item.melodyData.tags as string[]).length - 2}
                              </span>
                            )}
                        </span>
                      </Show>

                      <Show
                        when={
                          !isMelody() &&
                          item.type === 'rest' &&
                          item.restMs !== undefined &&
                          item.restMs !== null
                        }
                      >
                        <span class="pill-meta">
                          {Math.round((item.restMs ?? 0) / 1000)}s
                        </span>
                      </Show>

                      <Show
                        when={
                          !isMelody() &&
                          (item.type as string) === 'scale' &&
                          item.scaleType !== undefined &&
                          item.scaleType !== null
                        }
                      >
                        <span class="pill-meta">{item.scaleType}</span>
                      </Show>
                    </span>
                  )
                }}
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
      {/*<div class="recent-section recent-items-section">*/}
      {/*  <p class="section-label">Recent Items</p>*/}
      {/*  {recentItems().length === 0 ? (*/}
      {/*    <p class="empty-tip">*/}
      {/*      No items yet. Click "Melodies" or "Sessions" to get started!*/}
      {/*    </p>*/}
      {/*  ) : (*/}
      {/*    <For each={recentItems()}>*/}
      {/*      {(item) => (*/}
      {/*        <div*/}
      {/*          class="recent-item"*/}
      {/*          onClick={() => handleRecentItemClick(item)}*/}
      {/*        >*/}
      {/*          {item.type === 'melody' ? (*/}
      {/*            <>*/}
      {/*              <span class="recent-name">{item.data.name}</span>*/}
      {/*              <span class="recent-meta">{item.data.bpm} BPM</span>*/}
      {/*              <Show*/}
      {/*                when={*/}
      {/*                  item.data.tags !== undefined &&*/}
      {/*                  item.data.tags !== null &&*/}
      {/*                  item.data.tags.length > 0*/}
      {/*                }*/}
      {/*              >*/}
      {/*                <div class="recent-tags">*/}
      {/*                  {(item.data.tags as string[]).slice(0, 2).map((tag) => (*/}
      {/*                    <span class="recent-tag">{tag}</span>*/}
      {/*                  ))}*/}
      {/*                  {item.data.tags !== undefined &&*/}
      {/*                    item.data.tags !== null &&*/}
      {/*                    (item.data.tags as string[]).length > 2 && (*/}
      {/*                      <span class="recent-tag more">*/}
      {/*                        +{(item.data.tags as string[]).length - 2}*/}
      {/*                      </span>*/}
      {/*                    )}*/}
      {/*                </div>*/}
      {/*              </Show>*/}
      {/*            </>*/}
      {/*          ) : (*/}
      {/*            <>*/}
      {/*              <span class="recent-name">{item.data.name}</span>*/}
      {/*              <span class="recent-meta">*/}
      {/*                {item.data.items.length} items*/}
      {/*              </span>*/}
      {/*            </>*/}
      {/*          )}*/}
      {/*        </div>*/}
      {/*      )}*/}
      {/*    </For>*/}
      {/*  )}*/}
      {/*</div>*/}

      {/* Quick Actions */}
      <div class="quick-actions">
        <button class="quick-action-btn" onClick={handleNewSession}>
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          New Session
        </button>
        <button class="quick-action-btn" onClick={handleQuickNewMelody}>
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path
              fill="currentColor"
              d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6zM8 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"
            />
          </svg>
          New Melody
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
