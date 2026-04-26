// ============================================================
// SessionEditorTimeline — Visual timeline for session items
// Horizontal scrollable list with drag-and-drop
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { appStore, melodyStore } from '@/stores'
import type { SessionItem } from '@/types'

interface SessionEditorTimelineProps {
  sessionItems: SessionItem[]
  onSave?: (items: SessionItem[]) => void
  onDeleteItem: (itemId: string) => void
  onAddRest: (startBeat: number, duration: number) => void
  onDragOver: () => void
}

export const SessionEditorTimeline: Component<SessionEditorTimelineProps> = (
  props,
) => {
  const [draggableItem, setDraggableItem] = createSignal<string | null>(null)

  const addRestBetween = (index: number) => {
    const currentItem = props.sessionItems[index]
    const startBeat = currentItem.startBeat
    const duration = 4000
    props.onAddRest(startBeat, duration)
  }

  const createDragOverHandler = (index: number) => (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'copy'
    props.onDragOver()
  }

  const handleDrop = (e: DragEvent, index: number) => {
    e.preventDefault()
    const melodyId = e.dataTransfer?.getData('text/plain')
    if (!melodyId) return

    const melody = melodyStore.getMelody(melodyId)
    if (!melody) return

    const newItem: SessionItem = {
      id: `item-${Date.now()}`,
      type: 'melody',
      startBeat: props.sessionItems[index].startBeat,
      label: melody.name,
      melodyId,
    }

    const sessionId = appStore.userSession()?.id
    if (sessionId) {
      melodyStore.updateSessionItem(sessionId, newItem.id, newItem)
    }

    // Update local state to trigger re-render
    const updatedItems = [...props.sessionItems.slice(0, index + 1), newItem, ...props.sessionItems.slice(index + 1)]
    setDraggableItem(null)
  }

  const restIcons = [
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
                  onDragStart={(e) => setDraggableItem(item.id)}
                  data-id={item.id}
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
                    {item.restMs && (
                      <span class="item-duration">Duration: {getRestDuration(item.restMs)}</span>
                    )}
                  </div>
                </div>

                {index() < props.sessionItems.length - 1 && (
                  <div
                    class="timeline-drop-zone rest-zone"
                    onClick={() => addRestBetween(index())}
                    onDragOver={createDragOverHandler(index())}
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
                if (item.restMs) return acc + item.restMs
                if (item.beats) {
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
