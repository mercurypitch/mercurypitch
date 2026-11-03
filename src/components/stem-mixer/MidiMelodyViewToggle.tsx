// ============================================================
// MidiMelodyViewToggle — Roll or Notes, in the MIDI Melody header
// ============================================================
//
// Lives in the panel header, which the grid workspace also uses as a drag
// handle, so a press on it must not start a panel drag.

import { For } from 'solid-js'
import styles from './MidiMelodyViewToggle.module.css'

export type MidiMelodyView = 'roll' | 'notes'

export interface MidiMelodyViewToggleProps {
  view: MidiMelodyView
  onChange: (view: MidiMelodyView) => void
}

const VIEWS: readonly { view: MidiMelodyView; label: string }[] = [
  { view: 'roll', label: 'Roll' },
  { view: 'notes', label: 'Notes' },
]

export function MidiMelodyViewToggle(props: MidiMelodyViewToggleProps) {
  return (
    <div
      class={styles.toggle}
      role="group"
      aria-label="MIDI Melody view"
      data-tour="mixer.midi-view"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <For each={VIEWS}>
        {(option) => (
          <button
            type="button"
            class={styles.option}
            aria-pressed={props.view === option.view}
            onClick={() => props.onChange(option.view)}
          >
            {option.label}
          </button>
        )}
      </For>
    </div>
  )
}
