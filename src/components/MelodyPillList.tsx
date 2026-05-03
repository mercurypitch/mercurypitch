// ============================================================
// MelodyPillList — Draggable list of available melodies
// Used for dragging melodies into a Session Editor timeline
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For } from 'solid-js'
import { melodyStore } from '@/stores'
import styles from './MelodyPillList.module.css'

interface MelodyPillListProps {
  selectedMelodyIds?: Set<string>
  onMelodySelect?: (id: string) => void
  onMelodyAdd?: (id: string) => void
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
      .sort((a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name),
      )
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
    <div class={`${styles.melodyPillList} ${props.className ?? ''}`}>
      <div class={styles.pillListHeader}>
        <input
          type="text"
          class={styles.searchInput}
          placeholder="Search melodies..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
        />
        {props.onSelectAll && (
          <button class={styles.selectAllBtn} onClick={props.onSelectAll}>
            Select All
          </button>
        )}
        {props.onClearSelection && (
          <button class={styles.clearSelectionBtn} onClick={props.onClearSelection}>
            Clear
          </button>
        )}
      </div>

      <div class={styles.pillListItems}>
        <For each={filteredMelodies()}>
          {(melody) => (
            <div
              class={pillClass(melody.id)}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, melody.id)}
              onClick={(e) => {
                // Only add to session if we're in Session Editor context
                const parentElement = e.target as HTMLElement
                const isInSessionEditor =
                  parentElement.closest('.session-editor')
                if (isInSessionEditor && props.onMelodyAdd) {
                  props.onMelodyAdd(melody.id)
                } else {
                  props.onMelodySelect?.(melody.id)
                }
              }}
              title={melody.name}
            >
              <span class={styles.pillName}>{melody.name}</span>
              <span class={styles.pillBpm}>{melody.bpm}</span>
            </div>
          )}
        </For>

        {filteredMelodies().length === 0 && (
          <div class={styles.emptyState}>
            <p>No melodies found</p>
          </div>
        )}
      </div>
    </div>
  )
}
