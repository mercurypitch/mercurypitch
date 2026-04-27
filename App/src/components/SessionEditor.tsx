// ============================================================
// SessionEditor — Collapsible session editor container
// Shows melody pill list and timeline, togglable by header
// Auto-saves session changes via session-store
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { appStore, melodyStore } from '@/stores'
import { addItemToSession,deleteSessionItem } from '@/stores/session-store'
import type { SessionItem } from '@/types'
import { MelodyPillList } from './MelodyPillList'
import { SessionEditorTimeline } from './SessionEditorTimeline'

interface SessionEditorProps {
  currentSession?: SessionItem[]
}

export const SessionEditor: Component<SessionEditorProps> = (props) => {
  const [expanded, setExpanded] = createSignal(true)
  const [selectedMelodyIds, setSelectedMelodyIds] = createSignal<Set<string>>(new Set())

  const sessionItems = () => {
    if (props.currentSession) return props.currentSession
    if (appStore.userSession()) {
      return appStore.userSession()?.items || []
    }
    return []
  }

  // Function to add melodies to session - handled via drag-drop and click from MelodyPillList
  const _handleAddMelodyToSession = (_melodyId: string) => {
    const session = appStore.getUserSession()
    if (!session) {
      appStore.showNotification('No active session to add melody to', 'error')
      return
    }

    const newSessionItem: Omit<SessionItem, 'id'> = {
      type: 'melody',
      label: `Melody`,
      melodyId: _melodyId,
      startBeat: sessionItems().length > 0 ? sessionItems()[sessionItems().length - 1].startBeat! + 16 : 0,
    }

    addItemToSession(session.id, newSessionItem)
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
    const session = appStore.getUserSession()
    if (!session) {
      appStore.showNotification('No active session', 'error')
      return
    }

    // Remove the item from the session using session-store
    deleteSessionItem(session.id, itemId)

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
    const session = appStore.getUserSession()
    if (!session) {
      appStore.showNotification('No active session to add melody to', 'error')
      return
    }

    const newSessionItem: Omit<SessionItem, 'id'> = {
      type: 'melody',
      label: `Melody`,
      melodyId: melodyId,
      startBeat: targetItemIndex !== undefined ? sessionItems()[targetItemIndex].startBeat! : sessionItems().length > 0 ? sessionItems()[sessionItems().length - 1].startBeat! + 16 : 0,
    }

    addItemToSession(session.id, newSessionItem)
    appStore.showNotification(`Melody added to session`, 'success')
  }

  const _handleDragOver = (_index: number) => {
    // Visual feedback can be added here
  }

  const handleAddRest = (startBeat: number, duration: number) => {
    const newItem: SessionItem = {
      id: `rest-${Date.now()}`,
      type: 'rest',
      startBeat,
      label: 'Rest',
      restMs: duration,
    }
    const sessionId = appStore.userSession()?.id
    if (sessionId !== null && sessionId !== undefined) {
      melodyStore.updateSessionItem(sessionId, newItem.id, newItem)
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

      <Show when={expanded()}>
        <div class="session-editor-content">
          <div class="melody-library-section">
            <h4 class="section-title">Melody Library</h4>
            <MelodyPillList
              selectedMelodyIds={selectedMelodyIds()}
              onMelodySelect={handleMelodySelect}
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
