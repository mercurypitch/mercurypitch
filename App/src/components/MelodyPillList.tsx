// ============================================================
// MelodyPillList — Draggable list of available melodies
// Used for dragging melodies into a Session Editor timeline
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For } from 'solid-js'
import { melodyStore } from '@/stores'

interface MelodyPillListProps {
  selectedMelodyIds?: Set<string>
  onMelodySelect?: (id: string) => void
  onSelectAll?: () => void
  onClearSelection?: () => void
  className?: string
}

export const MelodyPillList: Component<MelodyPillListProps> = (props) => {
  const [searchQuery, setSearchQuery] = createSignal('')

  const melodies = () => melodyStore.getAllMelodies()

  const filteredMelodies = () => {
    const query = searchQuery().toLowerCase()
    return melodies()
      .filter((m: { name: string }) => m.name.toLowerCase().includes(query))
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))
  }

  const pillClass = (melodyId: string) => {
    const selected = props.selectedMelodyIds?.has(melodyId) ?? false
    return `melody-pill ${selected ? 'selected' : ''}`
  }

  const handleDragStart = (e: DragEvent, melodyId: string) => {
    if (e.dataTransfer === null || e.dataTransfer === undefined) return
    e.dataTransfer.setData('text/plain', melodyId)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div class={`melody-pill-list ${props.className ?? ''}`}>
      <div class="pill-list-header">
        <input
          type="text"
          class="search-input"
          placeholder="Search melodies..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
        />
        {props.onSelectAll && (
          <button class="select-all-btn" onClick={props.onSelectAll}>
            Select All
          </button>
        )}
        {props.onClearSelection && (
          <button class="clear-selection-btn" onClick={props.onClearSelection}>
            Clear
          </button>
        )}
      </div>

      <div class="pill-list-items">
        <For each={filteredMelodies()}>
          {(melody) => (
            <div
              class={pillClass(melody.id)}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, melody.id)}
              onClick={() => props.onMelodySelect?.(melody.id)}
              title={melody.name}
            >
              <span class="pill-name">{melody.name}</span>
              <span class="pill-bpm">{melody.bpm}</span>
            </div>
          )}
        </For>

        {filteredMelodies().length === 0 && (
          <div class="empty-state">
            <p>No melodies found</p>
          </div>
        )}
      </div>
    </div>
  )
}
