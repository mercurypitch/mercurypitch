// ============================================================
// SessionEditor — Collapsible session editor container
// Shows melody pill list and timeline, togglable by header
// Auto-saves session changes via session-store
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { appStore, melodyStore } from '@/stores'
import { addItemToSession, deleteSessionItem } from '@/stores/session-store'
import type { SavedUserSession, SessionItem } from '@/types'
import { MelodyPillList } from './MelodyPillList'
import { SessionEditorTimeline } from './SessionEditorTimeline'

interface SessionEditorProps {
  currentSession?: SessionItem[]
}

export const SessionEditor: Component<SessionEditorProps> = (props) => {
  const [expanded, setExpanded] = createSignal(true)
  const [selectedMelodyIds, setSelectedMelodyIds] = createSignal<Set<string>>(new Set())
  const [restDurationInput, setRestDurationInput] = createSignal(4000)

  const sessions = (): SavedUserSession[] => {
    const userSessions = melodyStore.getSessions()
    const defaultSession = melodyStore.getDefaultSession()
    return defaultSession === null ? userSessions : [defaultSession, ...userSessions]
  }

  const currentSession = () => {
    return appStore.userSession() || melodyStore.getActiveSession?.() || melodyStore.getDefaultSession() || sessions()[0]
  }

  const activateSession = (session: SavedUserSession): void => {
    appStore.setActiveUserSession(session)
    const firstMelodyItem = session.items.find(
      (item) => item.type === 'melody' && item.melodyId !== undefined,
    )
    if (firstMelodyItem?.melodyId !== undefined) {
      melodyStore.loadMelody(firstMelodyItem.melodyId)
    }
  }

  const sessionItems = () => {
    if (props.currentSession) return props.currentSession
    const session = currentSession()
    if (session !== null && session !== undefined) {
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
    }
  }

  const getSessionEndBeat = (): number => {
    const items = sessionItems()
    if (items.length === 0) return 0

    return items.reduce((maxBeat, item) => {
      const itemLength =
        item.type === 'rest'
          ? Math.max(1, Math.ceil((item.restMs ?? restDurationInput()) / 1000))
          : item.beats ?? 16
      return Math.max(maxBeat, item.startBeat + itemLength)
    }, 0)
  }

  // Function to add melodies to session - handled via drag-drop and click from MelodyPillList
  const _handleAddMelodyToSession = (_melodyId: string) => {
    const session = currentSession()
    if (session === null || session === undefined) {
      appStore.showNotification('No active session to add melody to', 'error')
      return
    }

    const melody = melodyStore.getMelody(_melodyId)

    const newSessionItem: Omit<SessionItem, 'id'> = {
      type: 'melody',
      label: melody?.name ?? 'Melody',
      melodyId: _melodyId,
      startBeat: getSessionEndBeat(),
    }

    const updatedSession = addItemToSession(session.id, newSessionItem)
    if (updatedSession !== undefined) {
      appStore.setActiveUserSession(updatedSession)
    }
    setSelectedMelodyIds(prev => {
      const next = new Set(prev)
      next.add(_melodyId)
      return next
    })
  }

  const handleMelodySelect = (melodyId: string) => {
    // Select the melody but don't add it to session (this is separate functionality)
    const current = selectedMelodyIds()
    if (current.has(melodyId)) {
      const next = new Set(current)
      next.delete(melodyId)
      setSelectedMelodyIds(next)
    } else {
      const next = new Set(current)
      next.add(melodyId)
      setSelectedMelodyIds(next)
    }
  }

  const handleDeleteItem = (itemId: string) => {
    const session = currentSession()
    if (session === null || session === undefined) {
      appStore.showNotification('No active session', 'error')
      return
    }

    // Remove the item from the session using session-store
    const updatedSession = deleteSessionItem(session.id, itemId)
    if (updatedSession !== undefined) {
      appStore.setActiveUserSession(updatedSession)
    }

    // Update selected melody IDs if needed
    setSelectedMelodyIds(prev => {
      const next = new Set(prev)
      next.delete(itemId)
      return next
    })
  }

  const handleDragStart = (_melodyId: string) => {
    // Handled by MelodyPillList
  }

  const handleDrop = (melodyId: string, targetItemIndex?: number) => {
    const session = currentSession()
    if (session === null || session === undefined) {
      appStore.showNotification('No active session to add melody to', 'error')
      return
    }

    const melody = melodyStore.getMelody(melodyId)

    const newSessionItem: Omit<SessionItem, 'id'> = {
      type: 'melody',
      label: melody?.name ?? 'Melody',
      melodyId: melodyId,
      startBeat: targetItemIndex !== undefined ? sessionItems()[targetItemIndex]?.startBeat ?? getSessionEndBeat() : getSessionEndBeat(),
    }

    const updatedSession = addItemToSession(session.id, newSessionItem)
    if (updatedSession !== undefined) {
      appStore.setActiveUserSession(updatedSession)
    }
    appStore.showNotification(`Melody added to session`, 'success')
  }

  const _handleDragOver = (_index: number) => {
    // Visual feedback can be added here
  }

  const handleAddRest = (startBeat: number, duration?: number) => {
    const newItem: Omit<SessionItem, 'id'> = {
      type: 'rest',
      startBeat,
      label: `Rest (${Math.round((duration ?? restDurationInput()) / 1000)}s)`,
      restMs: duration ?? restDurationInput(),
    }
    const session = currentSession()
    if (session !== null && session !== undefined) {
      const updatedSession = addItemToSession(session.id, newItem)
      if (updatedSession !== undefined) {
        appStore.setActiveUserSession(updatedSession)
      }
    }
  }

  return (
    <div class="session-editor">
      <div class="session-editor-header" onClick={() => setExpanded(!expanded())}>
        <div class="session-editor-title">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
          </svg>
          <span>Session Editor</span>
          <select
            class="session-select"
            value={currentSession()?.id || ''}
            onChange={handleSessionChange}
            onClick={(e) => e.stopPropagation()}
            style={{ 'margin-left': '12px', 'padding': '2px 8px', 'background': 'var(--bg-tertiary)', 'color': 'var(--text-primary)', 'border': '1px solid var(--border)' }}
          >
            <For each={sessions()}>
              {(s: SavedUserSession) => (
                <option value={s.id}>{s.name}</option>
              )}
            </For>
          </select>
        </div>
        
        <div class="session-editor-actions" style={{ display: 'flex', 'align-items': 'center', 'gap': '12px' }} onClick={(e) => e.stopPropagation()}>
          <div class="rest-input-group" style={{ display: 'flex', 'align-items': 'center', 'gap': '4px' }}>
            <label for="rest-duration" style={{ 'font-size': '0.8rem' }}>Rest (ms):</label>
            <input
              id="rest-duration"
              type="number"
              min="500"
              step="500"
              value={restDurationInput()}
              onInput={(e) => setRestDurationInput(Number(e.currentTarget.value) || 4000)}
              style={{ width: '60px', padding: '2px 4px', 'font-size': '0.8rem' }}
            />
          </div>
          <button class="toggle-btn">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              class={`toggle-icon ${expanded() ? 'expanded' : 'collapsed'}`}
            >
              <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
            </svg>
          </button>
        </div>
      </div>

      <Show when={expanded()}>
        <div class="session-editor-content">
          <div class="melody-library-section">
            <h4 class="section-title">Melody Library</h4>
            <MelodyPillList
              selectedMelodyIds={selectedMelodyIds()}
              onMelodySelect={handleMelodySelect}
              onMelodyAdd={_handleAddMelodyToSession}
            />
          </div>

          <div class="timeline-section">
            <div class="section-header">
              <h4 class="section-title">Session Timeline</h4>
              {sessionItems().length > 0 && (
                <span class="item-count">{sessionItems().length} items</span>
              )}
            </div>
            <SessionEditorTimeline
              sessionItems={sessionItems()}
              onDeleteItem={handleDeleteItem}
              onAddRest={handleAddRest}
              restDuration={restDurationInput()}
              onDragOver={_handleDragOver}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
            />
          </div>
        </div>
      </Show>
    </div>
  )
}
