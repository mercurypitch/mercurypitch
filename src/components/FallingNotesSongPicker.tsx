import type { Component } from 'solid-js'
import { createMemo, createSignal, For, onMount, Show } from 'solid-js'
import { importMelodyFromMIDI } from '@/lib/piano-roll'
import type { FallingNote } from '@/stores/falling-notes-store'
import { getAllMelodies } from '@/stores/melody-store'
import type { MelodyData, MelodyItem } from '@/types'

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
  const [isModalOpen, setIsModalOpen] = createSignal(false)

  const melodies = createMemo(() =>
    getAllMelodies().filter((m) => m.items.length > 0),
  )

  const currentMelodyName = createMemo(() => {
    const id = selectedId()
    if (id === null || id === '') return 'Select a song...'
    const m = melodies().find((x) => x.id === id)
    return m ? m.name : 'Select a song...'
  })

  const handleLoadWithId = (
    id: string,
    melodyList: MelodyData[],
    onLoad: typeof props.onSongLoaded,
  ) => {
    const melody = melodyList.find((m) => m.id === id)
    if (!melody) return
    const notes = melodyToFallingNotes(melody.items)
    onLoad(notes, melody.name, melody.bpm)
  }

  onMount(() => {
    const list = melodies()
    if (list.length > 0) {
      setSelectedId(list[0].id)
      handleLoadWithId(list[0].id, list, props.onSongLoaded)
    }
  })

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
        setSelectedId(null)
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
        <button class="fn-song-select-btn" onClick={() => setIsModalOpen(true)}>
          <span class="fn-song-name">🎵 {currentMelodyName()}</span>
          <span class="fn-song-arrow">▼</span>
        </button>

        <button class="fn-btn fn-btn-import" onClick={handleMidiImport}>
          Import MIDI
        </button>
      </div>

      {importStatus() && <div class="fn-import-status">{importStatus()}</div>}

      <Show when={isModalOpen()}>
        <div class="fn-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div class="fn-modal-content" onClick={(e) => e.stopPropagation()}>
            <div class="fn-modal-header">
              <h3>Select a Song</h3>
              <button
                class="fn-modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div class="fn-modal-list">
              <For each={melodies()}>
                {(m: MelodyData) => (
                  <button
                    class="fn-modal-item"
                    classList={{ 'fn-modal-active': selectedId() === m.id }}
                    onClick={() => {
                      setSelectedId(m.id)
                      const currentMelodies = melodies()
                      const onLoad = props.onSongLoaded
                      queueMicrotask(() =>
                        handleLoadWithId(m.id, currentMelodies, onLoad),
                      )
                      setIsModalOpen(false)
                    }}
                  >
                    <div class="fn-item-name">{m.name}</div>
                    <div class="fn-item-meta">
                      {m.items.length} notes • {m.bpm} BPM • {m.key}
                    </div>
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}
