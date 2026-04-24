// ============================================================
// PresetSelector — Shared melody management component
// Used in sidebar for both Practice and Editor tabs
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal } from 'solid-js'
import { copyShareURL } from '@/lib/share-url'
import { appStore } from '@/stores/app-store'
import { melodyStore } from '@/stores/melody-store'
import type { MelodyData, MelodyItem } from '@/types'

export const PresetSelector: Component = () => {
  const [saveName, setSaveName] = createSignal<string>('')

  const melodies = createMemo(() => melodyStore.getAllMelodies())

  const currentName = createMemo(() => {
    const activeMelody = melodyStore.currentMelody()
    return activeMelody !== null ? activeMelody.name : ''
  })

  const handleSave = () => {
    const name = saveName().trim()
    if (!name) {
      appStore.showNotification(
        'Please enter a melody name before saving',
        'warning',
      )
      return
    }

    // Get current melody items and build melody data
    const items = melodyStore.getCurrentItems()

    const currentMelody = melodyStore.getCurrentMelody()
    const bpm = currentMelody?.bpm ?? appStore.bpm()
    const key = currentMelody?.key ?? appStore.keyName()
    const scaleType = currentMelody?.scaleType ?? appStore.scaleType()

    const notes: MelodyItem[] = items.map((n) => ({
      note: n.note,
      duration: n.duration,
      startBeat: n.startBeat,
      velocity: n.velocity,
      id: n.id,
      effectType: n.effectType,
      linkedTo: n.linkedTo,
    }))

    // Construct complete MelodyData object
    const data: MelodyData = {
      id: currentMelody?.id ?? `melody-${Date.now()}`,
      name,
      bpm,
      key,
      scaleType,
      items: notes,
      createdAt: currentMelody?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    }

    // Save to library
    melodyStore.updateMelody(currentMelody?.id ?? data.id, data)
    appStore.setTempo(bpm)
    appStore.setKeyName(key)
    appStore.setScaleType(scaleType)

    setSaveName(name)
    appStore.showNotification(`Melody "${name}" saved to library`, 'success')
  }

  const handleNew = () => {
    setSaveName('')
    melodyStore.createNewMelody()
    appStore.setCurrentPresetName(null)
    appStore.showNotification('New melody created', 'info')
  }

  const handleDelete = () => {
    const name = saveName().trim() || currentName()
    if (!name) return
    const currentMelody = melodyStore.getCurrentMelody()
    if (currentMelody !== null) {
      melodyStore.deleteMelody(currentMelody.id)
      setSaveName('')
      appStore.showNotification(`Melody "${name}" deleted`, 'info')
    }
  }

  const handleShare = () => {
    const items = melodyStore.getCurrentItems()
    if (items.length === 0) {
      appStore.showNotification('Nothing to share', 'warning')
      return
    }
    const totalBeats = Math.max(...items.map((n) => n.startBeat + n.duration))
    copyShareURL(
      items,
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
        {melodies().map((m) => (
          <option value={m.name} />
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

      {/* Delete button - shown when a melody is selected */}
      {currentName() !== '' && (
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
