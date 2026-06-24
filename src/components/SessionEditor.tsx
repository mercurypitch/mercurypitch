// ============================================================
// SessionEditor — Collapsible session editor container
// Shows melody pill list and timeline, togglable by header
// Auto-saves session changes via session-store
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import type { LibraryEntry } from '@/components/shared'
import { MelodyLibraryList } from '@/components/shared'
import { SafeSelect } from '@/components/shared/SafeSelect'
import { melodyStore, setActiveUserSession, showActionNotification, showNotification, userSession, } from '@/stores'
import { addItemToSession, deleteSessionItem, insertItemInSession, } from '@/stores/session-store'
import type { PlaybackSession, SessionItem } from '@/types'
import styles from './SessionEditor.module.css'
import { SessionEditorTimeline } from './SessionEditorTimeline'

interface SessionEditorProps {
  currentSession?: SessionItem[]
}

export const SessionEditor: Component<SessionEditorProps> = (props) => {
  const [expanded, setExpanded] = createSignal(true)
  const [restDurationInput, setRestDurationInput] = createSignal(4000)
  const [searchQuery, setSearchQuery] = createSignal('')

  const sessions = (): PlaybackSession[] => {
    const sessions = melodyStore.getSessions()
    return sessions
  }

  // BUGFIX: read the active session through the REACTIVE `userSession`
  // signal (set by setActiveUserSession). Previously this called
  // `melodyStore.getActiveSession()` which is a synchronous lookup
  // through localStorage and is NOT a SolidJS-tracked signal — so when
  // the user clicked a melody pill in MelodyPillList and the handler
  // updated the active session, the timeline below never re-rendered
  // because nothing in this memo was reactive to the change.
  //
  // The fallback to `sessions()[0]` is kept for the brief window before
  // an active session is set on first launch.
  const currentSession = () => {
    return userSession() ?? sessions()[0]
  }

  const activateSession = (session: PlaybackSession): void => {
    setActiveUserSession(session)
    const firstMelodyItem = session.items.find(
      (item) => item.type === 'melody' && item.melodyId !== undefined,
    )
    if (firstMelodyItem?.melodyId !== undefined) {
      melodyStore.loadMelody(firstMelodyItem.melodyId)
    }
  }

  const getNoteCount = (count: number) => {
    return `${count} note${count === 1 ? '' : 's'}`
  }

  const filteredMelodyItems = createMemo<LibraryEntry[]>(() => {
    const query = searchQuery().toLowerCase()
    const allMelodies = melodyStore.getAllMelodies()
    const filtered = allMelodies.filter((m) =>
      m.name.toLowerCase().includes(query),
    )

    return filtered.map((melody) => ({
      id: melody.id,
      kind: 'melody' as const,
      title: melody.name ?? 'Untitled',
      meta: `${melody.key} • ${melody.bpm} BPM • ${getNoteCount(melody.items.length)}${(melody.playCount ?? 0) > 0 ? ` • ${melody.playCount} plays` : ''}`,
      author: melody.author ?? undefined,
      tags: melody.tags as string[] | undefined,
      raw: melody,
    }))
  })

  const sessionItems = () => {
    if (props.currentSession) return props.currentSession
    const session = currentSession()
    if (session != null) {
      return session.items ?? []
    }
    return []
  }

  const handleSessionChange = (e: Event) => {
    const target = e.target as HTMLSelectElement
    const sessionId = target.value
    const session = melodyStore.getSession(sessionId)
    if (session) {
      activateSession(session)
    } else {
      console.warn(
        `[WARN]-[SessionEditor]: Session with ID: '${sessionId}' not found!`,
      )
    }
  }

  const getSessionEndBeat = (): number => {
    const items = sessionItems()
    if (items.length === 0) return 0

    // eslint-disable-next-line solid/reactivity
    return items.reduce((maxBeat, item) => {
      const itemLength =
        item.type === 'rest'
          ? Math.max(1, Math.ceil((item.restMs ?? restDurationInput()) / 1000))
          : (item.beats ?? 16)
      return Math.max(maxBeat, item.startBeat + itemLength)
    }, 0)
  }

  const handleDeleteItem = (itemId: string) => {
    const session = currentSession()
    if (session == null) {
      showNotification('No active session', 'error')
      return
    }

    const itemIndex = session.items.findIndex((i) => i.id === itemId)
    const deletedItem = itemIndex !== -1 ? session.items[itemIndex] : undefined
    // Remove the item from the session using session-store
    const updatedSession = deleteSessionItem(session.id, itemId)
    if (updatedSession !== undefined) {
      setActiveUserSession(updatedSession)
      if (deletedItem !== undefined) {
        const itemLabel =
          deletedItem.type === 'rest'
            ? 'Rest'
            : (deletedItem.melodyId ?? 'Item')
        showActionNotification(`Removed "${itemLabel}"`, 'warning', {
          label: 'Undo',
          onClick: () => {
            const { id: _id, ...itemWithoutId } = deletedItem
            const restored = insertItemInSession(
              session.id,
              itemWithoutId,
              itemIndex,
            )
            if (restored !== undefined) setActiveUserSession(restored)
            showNotification(`Restored "${itemLabel}"`, 'success')
          },
        })
      }
    }
  }

  const handleDragStartTimeline = (_melodyId: string) => {
    // Handled by MelodyPillList / SessionEditorTimeline
  }

  const handleDragStartList = (e: DragEvent, melodyId: string) => {
    if (e.dataTransfer == null) return
    e.dataTransfer.setData('text/plain', melodyId)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDrop = (melodyId: string, targetItemIndex?: number) => {
    const session = currentSession()
    if (session == null) {
      showNotification('No active session to add melody to', 'error')
      return
    }

    const melody = melodyStore.getMelody(melodyId)

    const newSessionItem: Omit<SessionItem, 'id'> = {
      type: 'melody',
      label: melody?.name ?? 'Melody',
      melodyId: melodyId,
      startBeat:
        targetItemIndex !== undefined
          ? (sessionItems()[targetItemIndex]?.startBeat ?? getSessionEndBeat())
          : getSessionEndBeat(),
    }

    const updatedSession = addItemToSession(session.id, newSessionItem)
    if (updatedSession !== undefined) {
      setActiveUserSession(updatedSession)
    }
    showNotification(`Melody added to session`, 'success')
  }

  const _handleDragOver = (_index: number) => {
    // Visual feedback can be added here
  }

  const handleAddRest = (
    startBeat: number,
    duration?: number,
    insertIndex?: number,
  ) => {
    const newItem: Omit<SessionItem, 'id'> = {
      type: 'rest',
      startBeat,
      label: `Rest (${Math.round((duration ?? restDurationInput()) / 1000)}s)`,
      restMs: duration ?? restDurationInput(),
    }
    const session = currentSession()
    if (session == null) return

    // When the user clicks an "+ Add Rest" zone between two items, the
    // timeline passes the array index where the new rest should land.
    // Otherwise (trailing zone / no index), we fall back to the
    // append-at-end behavior provided by addItemToSession. See
    // session-store.ts:insertItemInSession for why we need the splice
    // path — addItemToSession routes through a Map and always appends.
    const updatedSession =
      insertIndex !== undefined
        ? insertItemInSession(session.id, newItem, insertIndex)
        : addItemToSession(session.id, newItem)
    if (updatedSession !== undefined) {
      setActiveUserSession(updatedSession)
    }
  }

  return (
    <div class={styles.sessionEditor} data-testid="session-editor">
      <div
        class={styles.sessionEditorHeader}
        data-testid="session-editor-header"
        onClick={() => setExpanded(!expanded())}
      >
        <div
          class={styles.sessionEditorTitle}
          data-testid="session-editor-title"
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="currentColor"
              d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"
            />
          </svg>
          <span>Session Editor</span>
          <SafeSelect
            class="session-select"
            value={currentSession()?.id || ''}
            onChange={handleSessionChange}
            onClick={(e) => e.stopPropagation()}
            style={{
              'margin-left': '12px',
              padding: '2px 8px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          >
            <For each={sessions()}>
              {(s: PlaybackSession) => <option value={s.id}>{s.name}</option>}
            </For>
          </SafeSelect>
        </div>

        <div
          class="session-editor-actions"
          style={{ display: 'flex', 'align-items': 'center', gap: '12px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            class="rest-input-group"
            style={{ display: 'flex', 'align-items': 'center', gap: '4px' }}
          >
            <label for="rest-duration" style={{ 'font-size': '0.8rem' }}>
              Rest (ms):
            </label>
            <input
              id="rest-duration"
              type="number"
              min="500"
              step="500"
              value={restDurationInput()}
              onInput={(e) =>
                setRestDurationInput(Number(e.currentTarget.value) || 4000)
              }
              style={{
                width: '60px',
                padding: '2px 4px',
                'font-size': '0.8rem',
              }}
            />
          </div>
          <button
            class={styles.toggleBtn}
            aria-label="Toggle rest settings"
            aria-expanded={expanded()}
            onClick={() => setExpanded(!expanded())}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              class={styles.toggleIcon}
              classList={{
                [styles.toggleIconExpanded]: expanded(),
                [styles.toggleIconCollapsed]: !expanded(),
              }}
            >
              <path
                fill="currentColor"
                d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"
              />
            </svg>
          </button>
        </div>
      </div>

      <Show when={expanded()}>
        <div
          class={styles.sessionEditorContent}
          data-testid="session-editor-content"
        >
          <div class={styles.melodyLibrarySection}>
            <div
              style={{
                display: 'flex',
                'justify-content': 'space-between',
                'align-items': 'center',
                'margin-bottom': '12px',
              }}
            >
              <h4 class={styles.sectionTitle} style={{ margin: 0 }}>
                Melody Library
              </h4>
            </div>

            <input
              type="text"
              class="search-input"
              data-testid="melody-search-input"
              style={{
                'margin-bottom': '12px',
                width: '100%',
                padding: '8px 12px',
                'border-radius': '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }}
              placeholder="Search melodies..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
            />

            <MelodyLibraryList
              mode="single"
              kinds={['melody']}
              entries={filteredMelodyItems()}
              onDragStart={(item, e) => handleDragStartList(e, item.id)}
            />
          </div>

          <div class="timeline-section">
            <div class={styles.sectionHeader}>
              <h4 class={styles.sectionTitle}>Session Timeline</h4>
              {sessionItems().length > 0 && (
                <span class={styles.itemCount}>
                  {sessionItems().length} items
                </span>
              )}
            </div>
            <SessionEditorTimeline
              sessionItems={sessionItems()}
              onDeleteItem={handleDeleteItem}
              onAddRest={handleAddRest}
              restDuration={restDurationInput()}
              onDragOver={_handleDragOver}
              onDragStart={handleDragStartTimeline}
              onDrop={handleDrop}
            />
          </div>
        </div>
      </Show>
    </div>
  )
}
