// ============================================================
// ScaleBuilder — Modal for creating custom scales
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { NOTE_NAMES } from '@/lib/scale-data'
import { appStore } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import type { NoteName } from '@/types'

interface ScaleBuilderProps {
  isOpen: boolean
  onClose: () => void
}

export const ScaleBuilder: Component<ScaleBuilderProps> = (props) => {
  const [customNotes, setCustomNotes] = createSignal<Set<string>>(new Set())
  const [scaleName, setScaleName] = createSignal<string>('My Scale')
  const [savedScales, setSavedScales] = createSignal<Record<string, string[]>>(
    {},
  )

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

  // Load custom scales from storage on open
  const loadSavedScales = () => {
    try {
      const stored = localStorage.getItem('pitchperfect_custom_scales')
      if (stored !== null && stored !== '') {
        setSavedScales(JSON.parse(stored))
      }
    } catch {
      /* empty */
    }
  }

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

  // Save the custom scale
  const saveScale = () => {
    const name = scaleName().trim() || 'Custom Scale'
    if (customNotes().size === 0) return

    const updated = { ...savedScales(), [name]: Array.from(customNotes()) }
    setSavedScales(updated)
    try {
      localStorage.setItem(
        'pitchperfect_custom_scales',
        JSON.stringify(updated),
      )
    } catch {
      /* empty */
    }

    appStore.showNotification(`Scale "${name}" saved`, 'success')
  }

  // Load a saved scale
  const loadScale = (name: string) => {
    const scale = savedScales()[name]
    if (scale !== null && scale !== undefined) {
      setScaleName(name)
      setCustomNotes(new Set(scale))
    }
  }

  // Delete a saved scale
  const deleteScale = (name: string) => {
    const updated = { ...savedScales() }
    delete updated[name]
    setSavedScales(updated)
    try {
      localStorage.setItem(
        'pitchperfect_custom_scales',
        JSON.stringify(updated),
      )
    } catch {
      /* empty */
    }
  }

  // Apply the custom scale to the app
  const applyScale = () => {
    if (customNotes().size < 2) {
      appStore.showNotification(
        'Select at least 2 notes for a scale',
        'warning',
      )
      return
    }

    // Create a custom scale type name
    const customName = `custom:${scaleName().trim()}:${Array.from(customNotes()).join(',')}`

    // Store custom scale info in localStorage for refreshScale to use
    try {
      localStorage.setItem('pitchperfect_active_custom_scale', customName)
    } catch {
      /* empty */
    }

    // Update scale type (will use custom logic)
    appStore.setScaleType(customName)

    // Refresh the scale
    melodyStore.refreshScale(
      appStore.keyName(),
      melodyStore.getCurrentOctave(),
      customName,
    )

    props.onClose()
    appStore.showNotification(
      `Custom scale "${scaleName()}" applied`,
      'success',
    )
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
    loadSavedScales()
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
          class="modal-content scale-builder"
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
            <p class="scale-desc">
              Select the notes to include in your custom scale. Click the note
              buttons to toggle them on/off.
            </p>

            {/* Note buttons */}
            <div class="scale-notes-grid">
              <For each={baseNotes}>
                {(note) => (
                  <button
                    class={`scale-note-btn ${customNotes().has(note) ? 'active' : ''} ${note.includes('#') ? 'black-key' : 'white-key'}`}
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
            <div class="scale-quick-actions">
              <button class="btn-secondary" onClick={selectNaturalNotes}>
                Natural Notes (7)
              </button>
              <button class="btn-secondary" onClick={clearAll}>
                Clear All
              </button>
            </div>

            {/* Preview */}
            <div class="scale-preview">
              <h4>Selected Notes ({customNotes().size})</h4>
              <div class="scale-preview-notes">
                <For
                  each={previewScale()}
                  fallback={<span class="no-notes">No notes selected</span>}
                >
                  {(note) => <span class="preview-note">{note}</span>}
                </For>
              </div>
            </div>

            {/* Scale name */}
            <div class="scale-name-row">
              <label for="scale-name-input">Scale Name:</label>
              <input
                id="scale-name-input"
                type="text"
                value={scaleName()}
                onInput={(e) => setScaleName(e.currentTarget.value)}
                placeholder="My Custom Scale"
                class="scale-name-input"
              />
            </div>

            {/* Saved scales */}
            <Show when={Object.keys(savedScales()).length > 0}>
              <div class="saved-scales">
                <h4>Saved Scales</h4>
                <div class="saved-scales-list">
                  <For each={Object.keys(savedScales()).sort()}>
                    {(name) => (
                      <div class="saved-scale-item">
                        <button
                          class="btn-small"
                          onClick={() => {
                            loadScale(name)
                          }}
                        >
                          {name}
                        </button>
                        <button
                          class="btn-delete"
                          onClick={() => {
                            deleteScale(name)
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
              class="btn-secondary"
              onClick={saveScale}
              disabled={customNotes().size === 0}
            >
              Save Scale
            </button>
            <button
              class="btn-primary"
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
