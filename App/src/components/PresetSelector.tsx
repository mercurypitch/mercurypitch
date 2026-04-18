// ============================================================
// PresetSelector — Shared melody management component
// Used in sidebar for both Practice and Editor tabs
// ============================================================

import { Component, createSignal, createMemo, onMount } from 'solid-js'
import { appStore, savePreset, loadPreset, deletePreset, initPresets, type PresetData, } from '@/stores/app-store'
import { melodyStore } from '@/stores/melody-store'
import { copyShareURL } from '@/lib/share-url'
import { buildSampleMelody } from '@/lib/scale-data'

interface PresetSelectorProps {
  /** Called when a preset is loaded */
  onLoad?: (preset: PresetData) => void
}

export const PresetSelector: Component<PresetSelectorProps> = (props) => {
  const [saveName, setSaveName] = createSignal<string>('')

  // Create default preset if none exist
  onMount(() => {
    initPresets()
    const presets = Object.keys(appStore.presets())
    if (presets.length === 0) {
      // Create a default melody preset
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
        scale: melodyStore.currentScale().map((s) => ({
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

  // Reactive preset names from appStore - must call presets() to track signal changes
  const presetNames = createMemo(() => {
    return Object.keys(appStore.presets()).sort()
  })

  const currentName = createMemo(() => appStore.currentPresetName() ?? '')

  // Sync save-name input when a preset is selected
  const handleLoad = (name: string) => {
    if (!name) return
    setSaveName(name)
    const preset = loadPreset(name)
    if (preset) {
      props.onLoad?.(preset)
    }
  }

  const handleSave = () => {
    const name = saveName().trim()
    if (!name) {
      appStore.showNotification(
        'Please enter a melody name before saving',
        'warning',
      )
      return
    }

    const melody = melodyStore.items
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
      scale: melodyStore.currentScale().map((s) => ({
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
    melodyStore.setMelody([])
    appStore.setCurrentPresetName(null)
    appStore.showNotification('Melody cleared', 'info')
  }

  const handleDelete = () => {
    const name = saveName().trim() || currentName()
    if (!name) return
    deletePreset(name)
    setSaveName('')
    appStore.showNotification(`Melody "${name}" deleted`, 'info')
  }

  const handleShare = async () => {
    const melody = melodyStore.items
    if (melody.length === 0) {
      appStore.showNotification('Nothing to share', 'warning')
      return
    }
    const totalBeats = Math.max(...melody.map((n) => n.startBeat + n.duration))
    const ok = await copyShareURL(
      melody,
      appStore.bpm(),
      appStore.keyName(),
      appStore.scaleType(),
      totalBeats,
    )
    appStore.showNotification(
      ok ? 'Share URL copied to clipboard!' : 'Failed to copy URL',
      ok ? 'success' : 'error',
    )
  }

  return (
    <div class="preset-selector">
      <input
        type="text"
        list="preset-datalist"
        id="preset-select"
        placeholder="— Select or type melody —"
        value={currentName()}
        onChange={(e) => handleLoad(e.currentTarget.value)}
        onBlur={(e) => setSaveName(e.currentTarget.value)}
      />
      <datalist id="preset-datalist">
        {presetNames().map((name) => (
          <option value={name} />
        ))}
      </datalist>

      <button
        class="ctrl-btn small preset-new-btn"
        onClick={handleNew}
        title="New melody"
      >
        +
      </button>

      <input
        type="text"
        id="preset-name-input"
        placeholder="Melody name"
        value={saveName()}
        onInput={(e) => setSaveName(e.currentTarget.value)}
      />
      <button
        class="ctrl-btn small preset-save-btn"
        onClick={handleSave}
        title="Save melody"
      >
        Save
      </button>
      {currentName() && (
        <button
          class="ctrl-btn small danger preset-delete-btn"
          onClick={handleDelete}
          title="Delete melody"
        >
          ×
        </button>
      )}

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
