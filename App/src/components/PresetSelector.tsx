// ============================================================
// PresetSelector — Shared melody management component
// Used in sidebar for both Practice and Editor tabs
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, onMount } from 'solid-js'
import { buildSampleMelody } from '@/lib/scale-data'
import { copyShareURL } from '@/lib/share-url'
import type { PresetData } from '@/stores/app-store'
import { appStore, deletePreset, initPresets, savePreset, } from '@/stores/app-store'
import { melodyStore } from '@/stores/melody-store'

export const PresetSelector: Component = () => {
  const [saveName, setSaveName] = createSignal<string>('')

  // Load melody from library on mount
  onMount(() => {
    initPresets()
    const library = melodyStore.getMelodyLibrary()
    if (Object.keys(library.melodies).length === 0) {
      const defaultMelody = buildSampleMelody('C', 4)
      melodyStore.setMelody(defaultMelody)
      const data: PresetData = {
        notes: defaultMelody.map((n) => ({
          midi: n.note.midi,
          startBeat: n.startBeat,
          duration: n.duration,
          effectType: n.effectType,
          linkedTo: n.linkedTo,
        })),
        totalBeats: 20,
        bpm: appStore.bpm(),
        scale: melodyStore.currentScale.map((s) => ({
          midi: s.midi,
          name: s.name,
          octave: s.octave,
          freq: s.freq,
        })),
      }
      savePreset('Default Melody', data)
      setSaveName('Default Melody')
    }
  })

  const presetNames = createMemo(() => Object.keys(appStore.presets()).sort())

  const currentName = createMemo(() => appStore.currentPresetName() ?? '')

  const handleSave = () => {
    const name = saveName().trim()
    if (!name) {
      appStore.showNotification(
        'Please enter a melody name before saving',
        'warning',
      )
      return
    }

    const melody = melodyStore.getCurrentItems()
    const totalBeats =
      melody.length > 0
        ? Math.max(...melody.map((n) => n.startBeat + n.duration))
        : 16

    const data: PresetData = {
      notes: melody.map((n) => ({
        midi: n.note.midi,
        startBeat: n.startBeat,
        duration: n.duration,
        effectType: n.effectType,
        linkedTo: n.linkedTo,
      })),
      totalBeats,
      bpm: appStore.bpm(),
      scale: melodyStore.currentScale.map((s) => ({
        midi: s.midi,
        name: s.name,
        octave: s.octave,
        freq: s.freq,
      })),
    }

    savePreset(name, data)
    setSaveName(name)
    appStore.showNotification(`Melody "${name}" saved`, 'success')
  }

  const handleNew = () => {
    setSaveName('')
    _ = melodyStore.createNewMelody()
    appStore.setCurrentPresetName(null)
    appStore.showNotification('New melody created', 'info')
  }

  const handleDelete = () => {
    const name = saveName().trim() || currentName()
    if (!name) return
    deletePreset(name)
    setSaveName('')
    appStore.showNotification(`Melody "${name}" deleted`, 'info')
  }

  const handleShare = () => {
    const melody = melodyStore.getCurrentItems()
    if (melody.length === 0) {
      appStore.showNotification('Nothing to share', 'warning')
      return
    }
    const totalBeats = Math.max(...melody.map((n) => n.startBeat + n.duration))
    copyShareURL(
      melody,
      appStore.bpm(),
      appStore.keyName(),
      appStore.scaleType(),
      totalBeats,
    )
      .then((ok) => {
        appStore.showNotification(
          ok ? 'Share URL copied to clipboard!' : 'Failed to copy URL',
          ok ? 'success' : 'error',
        )
      })
      .catch(() => {
        appStore.showNotification('Failed to copy URL', 'error')
      })
  }

  return (
    <div class="preset-selector">
      {/* Name input with datalist - simple autocomplete */}
      <input
        type="text"
        list="preset-datalist"
        id="preset-name-input"
        placeholder="Melody name"
        value={saveName()}
        onInput={(e) => setSaveName(e.currentTarget.value)}
      />
      <datalist id="preset-datalist">
        {presetNames().map((name) => (
          <option value={name} />
        ))}
      </datalist>

      {/* Save button */}
      <button
        class="ctrl-btn small preset-save-btn"
        onClick={handleSave}
        title="Save melody"
      >
        Save
      </button>

      {/* New button */}
      <button
        class="ctrl-btn small preset-new-btn"
        onClick={handleNew}
        title="New melody"
      >
        +
      </button>

      {/* Delete button - shown when a preset is selected */}
      {currentName() && (
        <button
          class="ctrl-btn small danger preset-delete-btn"
          onClick={handleDelete}
          title="Delete melody"
        >
          ×
        </button>
      )}

      {/* Share button */}
      <button
        class="share-btn small"
        onClick={handleShare}
        title="Copy share link"
      >
        Share
      </button>
    </div>
  )
}