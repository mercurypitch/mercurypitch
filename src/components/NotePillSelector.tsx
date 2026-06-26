import type { Component } from 'solid-js'
import { For } from 'solid-js'

interface NotePillSelectorProps {
  notes: string[]
  selected: string
  onChange: (note: string) => void
  label?: string
  class?: string
  /** Notes to render greyed-out and non-selectable (e.g. the other endpoint). */
  disabledNotes?: string[]
}

export const NotePillSelector: Component<NotePillSelectorProps> = (props) => {
  const isDisabled = (note: string): boolean =>
    props.disabledNotes?.includes(note) ?? false
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
                if (!isDisabled(note)) props.onChange(note)
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
