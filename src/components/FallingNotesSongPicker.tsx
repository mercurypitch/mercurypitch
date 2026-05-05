// ============================================================
// FallingNotesSongPicker — Song selector for falling notes game
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For } from 'solid-js'
import type { MelodyData, MelodyItem } from '@/types'
import { getAllMelodies, loadMelody } from '@/stores/melody-store'
import { importMelodyFromMIDI } from '@/lib/piano-roll'
import type { FallingNote } from '@/stores/falling-notes-store'

interface FallingNotesSongPickerProps {
  onSongLoaded: (notes: FallingNote[], name: string, bpm: number) => void
}

function melodyToFallingNotes(items: MelodyItem[]): FallingNote[] {
  return items.map((item, i) => ({
    id: item.id ?? i,
    midi: item.note.midi,
    name: item.note.name,
    startBeat: item.startBeat,
    duration: item.duration,
    targetFreq: item.note.freq,
  }))
}

export const FallingNotesSongPicker: Component<FallingNotesSongPickerProps> = (
  props,
) => {
  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  const [importStatus, setImportStatus] = createSignal<string>('')

  const melodies = () => getAllMelodies().filter((m) => m.items.length > 0)

  const handleLoadWithId = (id: string) => {
    const melody = loadMelody(id)
    if (!melody) return

    const notes = melodyToFallingNotes(melody.items)
    props.onSongLoaded(notes, melody.name, melody.bpm)
  }

  const handleMidiImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.mid,.midi'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return

      try {
        setImportStatus('Parsing...')
        const buffer = await file.arrayBuffer()
        const data = new Uint8Array(buffer)
        const items = importMelodyFromMIDI(data)

        if (!items || items.length === 0) {
          setImportStatus('No notes found in MIDI file')
          return
        }

        const name = file.name.replace(/\.(mid|midi)$/i, '')
        const bpm = 120
        const fallingNotes = melodyToFallingNotes(items)
        props.onSongLoaded(fallingNotes, name, bpm)
        setImportStatus(`Loaded: ${name} (${items.length} notes)`)
      } catch (err) {
        setImportStatus(`Import failed: ${String(err)}`)
      }
    }
    input.click()
  }

  return (
    <div id="falling-notes-song-picker">
      <div class="fn-picker-row">
        <select
          class="fn-song-select"
          value={selectedId() ?? ''}
          onChange={(e) => {
            const id = e.currentTarget.value || null
            setSelectedId(id)
            if (id) handleLoadWithId(id)
          }}
        >
          <option value="">-- Select a song --</option>
          <For each={melodies()}>
            {(m: MelodyData) => (
              <option value={m.id}>
                {m.name} ({m.items.length} notes, {m.bpm} BPM, {m.key})
              </option>
            )}
          </For>
        </select>

        <button class="fn-btn fn-btn-import" onClick={handleMidiImport}>
          Import MIDI
        </button>
      </div>

      {importStatus() && (
        <div class="fn-import-status">{importStatus()}</div>
      )}
    </div>
  )
}
