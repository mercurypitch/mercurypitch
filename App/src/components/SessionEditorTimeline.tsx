// ============================================================
// SessionEditorTimeline — Visual timeline for session items
// Horizontal scrollable list with drag-and-drop
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For } from 'solid-js'
import { appStore, melodyStore } from '@/stores'
import type { SessionItem } from '@/types'

interface SessionEditorTimelineProps {
  sessionItems: SessionItem[]
  onSave?: (items: SessionItem[]) => void
  onDeleteItem: (itemId: string) => void
  onAddRest: (startBeat: number, duration: number) => void
  onDragOver: (index: number) => void
  onDragStart?: (itemId: string) => void
  onDrop?: (itemId: string, targetIndex: number) => void
}

export const SessionEditorTimeline: Component<SessionEditorTimelineProps> = (
  props,
) => {
  const [draggedItemId, setDraggedItemId] = createSignal<string | null>(null)
  const [dragSourceIndex, setDragSourceIndex] = createSignal<number>(-1)

  const addRestBetween = (index: number) => {
    const currentItem = props.sessionItems[index]
    const startBeat = currentItem.startBeat
    const duration = 4000
    props.onAddRest(startBeat, duration)
  }

  // Desktop drag handlers
  const handleDragStart = (e: DragEvent, item: SessionItem, index: number) => {
    setDraggedItemId(item.id)
    setDragSourceIndex(index)
    // Set data for drag transfer
    const dataTransfer = e.dataTransfer
    if (dataTransfer?.setData) {
      dataTransfer.setData('text/plain', item.id)
    }
    if (dataTransfer) {
      dataTransfer.effectAllowed = 'move'
    }
  }

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault()
    const dataTransfer = e.dataTransfer
    if (dataTransfer) {
      dataTransfer.dropEffect = 'move'
    }
    props.onDragOver(index)
  }

  const handleDrop = (e: DragEvent, targetIndex: number) => {
    e.preventDefault()
    const sourceIndex = dragSourceIndex()
    const sourceId = draggedItemId()

    if (sourceIndex === -1 || sourceId === null || sourceIndex === targetIndex) {
      setDraggedItemId(null)
      setDragSourceIndex(-1)
      return
    }

    // Reorder items in the array
    const items = [...props.sessionItems]
    const [removed] = items.splice(sourceIndex, 1)
    items.splice(targetIndex, 0, removed)

    // Update the session with new order
    const sessionId = appStore.userSession()?.id
    if (sessionId !== null && sessionId !== undefined) {
      // Create updated session with reordered items
      const updatedSession = appStore.userSession()!
      melodyStore.updateUserSession({
        ...updatedSession,
        items: items,
      })
    }

    setDraggedItemId(null)
    setDragSourceIndex(-1)
  }

  const handleDragEnd = () => {
    setDraggedItemId(null)
    setDragSourceIndex(-1)
  }

  // Mobile touch handlers (future implementation)
  const _touchStart = (_e: TouchEvent, _item: SessionItem, _index: number) => {
    // Future implementation of mobile touch drag-and-drop
  }

  const _touchMove = (_e: TouchEvent) => {
    // Future implementation of mobile touch drag-and-drop
  }

  const _touchEnd = (_e: TouchEvent, _targetIndex: number) => {
    // Future implementation of mobile touch drag-and-drop
  }

  const _restIcons = [
    '⋯' /* ellipsis */,
    '⏸',
    '⏯',
    '⏯️',
  ]

  const getRestDuration = (restMs: number) => {
    if (restMs < 1000) return `${Math.round(restMs / 100)}s`
    if (restMs < 60000) return `${Math.round(restMs / 1000)}s`
    const m = Math.floor(restMs / 60000)
    const s = Math.round((restMs % 60000) / 1000)
    return `${m}m ${s}s`
  }

  return (
    <div class="session-editor-timeline">
      <div class="timeline-track">
        <div class="timeline-items">
          {props.sessionItems.length === 0 && (
            <div class="empty-state">
              <p>Add items by dragging from the melody list above</p>
            </div>
          )}

          <For each={props.sessionItems}>
            {(item, index) => (
              <>
                <div
                  class="timeline-item"
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, item, index())}
                  onDragOver={(e) => handleDragOver(e, index())}
                  onDrop={(e) => handleDrop(e, index())}
                  onDragEnd={handleDragEnd}
                >
                  <div class="item-header">
                    <span class="item-type-icon">
                      {item.type === 'melody' ? '🎵' : item.type === 'scale' ? '🎹' : '⏸'}
                    </span>
                    <span class="item-label">{item.label}</span>
                    <button
                      class="item-delete-btn"
                      onClick={() => props.onDeleteItem(item.id)}
                      title="Delete this item"
                    >
                      ×
                    </button>
                  </div>
                  <div class="item-details">
                    <span class="item-start-beat">Start: {item.startBeat}</span>
                    {item.restMs !== null && item.restMs !== undefined && item.restMs > 0 && (
                      <span class="item-duration">Duration: {getRestDuration(item.restMs)}</span>
                    )}
                  </div>
                </div>

                {index() < props.sessionItems.length - 1 && (
                  <div
                    class="timeline-drop-zone rest-zone"
                    onClick={() => addRestBetween(index())}
                    onDragOver={(e) => handleDragOver(e, index())}
                    onDrop={(e) => handleDrop(e, index())}
                  >
                    <span class="rest-placeholder">+</span>
                    <span class="rest-hint">Add Rest</span>
                  </div>
                )}
              </>
            )}
          </For>
        </div>
      </div>

      <div class="timeline-footer">
        <span class="timeline-info">
          {props.sessionItems.length} item{props.sessionItems.length !== 1 ? 's' : ''}
          {props.sessionItems.length > 0 && (
            <>
              {' • '}
              Total duration: {props.sessionItems.reduce((acc, item) => {
                if (item.restMs !== null && item.restMs !== undefined && item.restMs > 0) return acc + item.restMs
                if (item.beats !== null && item.beats !== undefined && item.beats > 0) {
                  return acc + (item.beats / 4) * (120 / (appStore.bpm() || 120))
                }
                return acc
              }, 0) / 1000} seconds
            </>
          )}
        </span>
      </div>
    </div>
  )
}
