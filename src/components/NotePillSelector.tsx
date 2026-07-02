import type { Component } from 'solid-js'
import { For, onCleanup } from 'solid-js'
import { midiToFrequency, noteToMidi } from '@/lib/frequency-to-note'
import { initAudioEngine } from '@/stores/app-store'

interface NotePillSelectorProps {
  notes: string[]
  selected: string
  onChange: (note: string) => void
  label?: string
  class?: string
  /** Notes to render greyed-out and non-selectable (e.g. the other endpoint). */
  disabledNotes?: string[]
  /** Play a short reference tone when a note is picked (default on). */
  previewSound?: boolean
}

const PREVIEW_MS = 550

export const NotePillSelector: Component<NotePillSelectorProps> = (props) => {
  const isDisabled = (note: string): boolean =>
    props.disabledNotes?.includes(note) ?? false

  // Preview the picked note so users hear the target, not just read it.
  // Re-clicking cuts the previous preview short instead of stacking voices;
  // the generation counter covers rapid clicks that race the async engine
  // init (a superseded preview stops itself as soon as its id resolves).
  let previewNoteId: number | undefined
  let previewGen = 0
  const previewNote = (note: string) => {
    if (props.previewSound === false) return
    const midi = noteToMidi(note)
    if (Number.isNaN(midi)) return
    const gen = ++previewGen
    void initAudioEngine().then(async (engine) => {
      if (previewNoteId !== undefined) engine.stopNote(previewNoteId)
      const id = await engine.playNote(midiToFrequency(midi), PREVIEW_MS)
      if (gen !== previewGen) {
        if (id !== undefined) engine.stopNote(id)
        return
      }
      previewNoteId = id
    })
  }
  onCleanup(() => {
    if (previewNoteId !== undefined) {
      void initAudioEngine().then((engine) => {
        if (previewNoteId !== undefined) engine.stopNote(previewNoteId)
      })
    }
  })

  return (
    <div class={`note-pill-selector ${props.class ?? ''}`}>
      {props.label != null && (
        <span class="note-pill-selector-label">{props.label}</span>
      )}
      <div class="note-pill-row">
        <For each={props.notes}>
          {(note) => (
            <button
              type="button"
              class={`note-pill${note === props.selected ? ' note-pill-selected' : ''}`}
              disabled={isDisabled(note)}
              onClick={() => {
                if (isDisabled(note)) return
                props.onChange(note)
                previewNote(note)
              }}
              aria-pressed={note === props.selected}
            >
              {note}
            </button>
          )}
        </For>
      </div>
    </div>
  )
}
