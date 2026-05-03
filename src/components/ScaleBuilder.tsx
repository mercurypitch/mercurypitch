// ============================================================
// ScaleBuilder — Modal for creating custom scales
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { NOTE_NAMES } from '@/lib/scale-data'
import { keyName, setScaleType, showNotification } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import { customScales, customScaleTypeId, deleteCustomScale, saveCustomScale, } from '@/stores/settings-store'
import type { NoteName } from '@/types'
import styles from './ScaleBuilder.module.css'

interface ScaleBuilderProps {
  isOpen: boolean
  onClose: () => void
}

export const ScaleBuilder: Component<ScaleBuilderProps> = (props) => {
  const [customNotes, setCustomNotes] = createSignal<Set<string>>(new Set())
  const [scaleName, setScaleName] = createSignal<string>('My Scale')

  // Current base notes (C through B)
  const baseNotes = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ]

  // Toggle a note in the custom scale
  const toggleNote = (note: string) => {
    const notes = new Set(customNotes())
    if (notes.has(note)) {
      notes.delete(note)
    } else {
      notes.add(note)
    }
    setCustomNotes(notes)
  }

  // Select all natural notes (no sharps/flats)
  const selectNaturalNotes = () => {
    setCustomNotes(new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']))
  }

  // Clear all selections
  const clearAll = () => {
    setCustomNotes(new Set<string>())
  }

  // Save the custom scale (without applying)
  const saveScale = () => {
    const name = scaleName().trim() || 'Custom Scale'
    if (customNotes().size === 0) return
    saveCustomScale(name, Array.from(customNotes()))
    showNotification(`Scale "${name}" saved`, 'success')
  }

  // Load a saved scale into the builder
  const loadScale = (name: string) => {
    const scales = customScales()
    const scale = scales[name]
    if (scale !== null && scale !== undefined) {
      setScaleName(name)
      setCustomNotes(new Set(scale))
    }
  }

  // Delete a saved scale; if it's the active one, revert to major
  const handleDeleteScale = (name: string) => {
    deleteCustomScale(name)

    // If the deleted scale was the active custom scale, revert to major
    try {
      const current = localStorage.getItem('pitchperfect_active_custom_scale')
      if (current !== null && current.includes(`:${name}:`)) {
        localStorage.removeItem('pitchperfect_active_custom_scale')
        setScaleType('major')
        melodyStore.refreshScale(
          keyName(),
          melodyStore.getCurrentOctave(),
          'major',
        )
        showNotification('Reverted to Major scale', 'info')
      }
    } catch {
      /* empty */
    }
  }

  // Apply the custom scale — also auto-saves it
  const applyScale = () => {
    if (customNotes().size < 2) {
      showNotification('Select at least 2 notes for a scale', 'warning')
      return
    }

    const name = scaleName().trim() || 'Custom Scale'
    const notes = Array.from(customNotes())

    // Auto-save so it appears in the dropdown
    saveCustomScale(name, notes)

    const customId = customScaleTypeId(name, notes)

    // Store active custom scale marker
    try {
      localStorage.setItem('pitchperfect_active_custom_scale', customId)
    } catch {
      /* empty */
    }

    // Update scale type (sidebar dropdown reacts to this)
    setScaleType(customId)

    // Refresh the scale
    melodyStore.refreshScale(
      keyName(),
      melodyStore.getCurrentOctave(),
      customId,
    )

    props.onClose()
    showNotification(`Custom scale "${name}" applied`, 'success')
  }

  // Preview the scale as a list of notes
  const previewScale = createMemo(() => {
    const notes = Array.from(customNotes()).sort((a, b) => {
      return (
        NOTE_NAMES.indexOf(a as NoteName) - NOTE_NAMES.indexOf(b as NoteName)
      )
    })
    return notes
  })

  const handleOpen = () => {
    // Try to load current custom scale if active
    try {
      const current = localStorage.getItem('pitchperfect_active_custom_scale')
      if (
        current !== null &&
        current !== undefined &&
        current.startsWith('custom:')
      ) {
        const parts = current.split(':')
        if (parts.length >= 3) {
          setScaleName(parts[1])
          setCustomNotes(new Set(parts[2].split(',')))
        }
      }
    } catch {
      /* empty */
    }
  }

  createEffect(() => {
    if (props.isOpen) {
      handleOpen()
    }
  })

  return (
    <Show when={props.isOpen}>
      <div
        class="modal-overlay"
        onClick={() => {
          props.onClose()
        }}
      >
        <div
          class={`modal-content ${styles.scaleBuilder}`}
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          <div class="modal-header">
            <h2>Custom Scale Builder</h2>
            <button
              class="modal-close"
              onClick={() => {
                props.onClose()
              }}
            >
              &times;
            </button>
          </div>

          <div class="modal-body">
            <p class={styles.scaleDesc}>
              Select the notes to include in your custom scale. Click the note
              buttons to toggle them on/off.
            </p>

            {/* Note buttons */}
            <div class={styles.scaleNotesGrid}>
              <For each={baseNotes}>
                {(note) => (
                  <button
                    class={`${styles.scaleNoteBtn} ${customNotes().has(note) ? 'active' : ''} ${note.includes('#') ? styles.blackKey : styles.whiteKey}`}
                    onClick={() => {
                      toggleNote(note)
                    }}
                  >
                    {note}
                  </button>
                )}
              </For>
            </div>

            {/* Quick actions */}
            <div class={styles.scaleQuickActions}>
              <button class={styles.btnSecondary} onClick={selectNaturalNotes}>
                Natural Notes (7)
              </button>
              <button class={styles.btnSecondary} onClick={clearAll}>
                Clear All
              </button>
            </div>

            {/* Preview */}
            <div class={styles.scalePreview}>
              <h4>Selected Notes ({customNotes().size})</h4>
              <div class={styles.scalePreviewNotes}>
                <For
                  each={previewScale()}
                  fallback={<span class={styles.noNotes}>No notes selected</span>}
                >
                  {(note) => <span class={styles.previewNote}>{note}</span>}
                </For>
              </div>
            </div>

            {/* Scale name */}
            <div class={styles.scaleNameRow}>
              <label for="scale-name-input">Scale Name:</label>
              <input
                id="scale-name-input"
                type="text"
                value={scaleName()}
                onInput={(e) => setScaleName(e.currentTarget.value)}
                placeholder="My Custom Scale"
                class={styles.scaleNameInput}
              />
            </div>

            {/* Saved scales */}
            <Show when={Object.keys(customScales()).length > 0}>
              <div class={styles.savedScales}>
                <h4>Saved Scales</h4>
                <div class={styles.savedScalesList}>
                  <For each={Object.keys(customScales()).sort()}>
                    {(name) => (
                      <div class={styles.savedScaleItem}>
                        <button
                          class={styles.btnSmall}
                          onClick={() => {
                            loadScale(name)
                          }}
                        >
                          {name}
                        </button>
                        <button
                          class={styles.btnDelete}
                          onClick={() => {
                            handleDeleteScale(name)
                          }}
                          title="Delete"
                        >
                          &times;
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>

          <div class="modal-footer">
            <button
              class={styles.btnSecondary}
              onClick={saveScale}
              disabled={customNotes().size === 0}
            >
              Save Scale
            </button>
            <button
              class={styles.btnPrimary}
              onClick={applyScale}
              disabled={customNotes().size < 2}
            >
              Apply Scale
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}
