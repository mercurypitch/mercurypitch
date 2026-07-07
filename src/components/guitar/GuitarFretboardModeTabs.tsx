import type { Component } from 'solid-js'
import { For } from 'solid-js'

export type FretboardMode =
  | 'explore'
  | 'noteQuiz'
  | 'earTraining'
  | 'jam'
  | 'melodyTranscription'
  | 'callResponse'
  | 'cagedTrainer'
  | 'chordProgression'
  | 'singToFretboard'
  | 'transcriptionTrainer'
  | 'adaptiveJam'
  | 'tuner'
  | 'riffTracker'

const MODES: Array<{ value: FretboardMode; label: string }> = [
  { value: 'explore', label: 'Explore' },
  { value: 'noteQuiz', label: 'Note Quiz' },
  { value: 'earTraining', label: 'Ear Training' },
  { value: 'jam', label: 'Jam' },
  { value: 'melodyTranscription', label: 'Melody' },
  { value: 'callResponse', label: 'Call & Response' },
  { value: 'cagedTrainer', label: 'CAGED' },
  { value: 'chordProgression', label: 'Progressions' },
  { value: 'singToFretboard', label: 'Sing' },
  { value: 'transcriptionTrainer', label: 'Transcribe' },
  { value: 'adaptiveJam', label: 'Adaptive Jam' },
  { value: 'tuner', label: 'Tuner' },
  { value: 'riffTracker', label: 'Riff Tracker' },
]

export interface GuitarFretboardModeTabsProps {
  activeMode: () => FretboardMode
  onModeChange: (mode: FretboardMode) => void
}

export const GuitarFretboardModeTabs: Component<
  GuitarFretboardModeTabsProps
> = (props) => {
  return (
    <div class="gp-key-scale-group" data-tour="guitar.mode-select">
      <label class="gp-key-scale-label">Mode</label>
      <select
        class="gp-key-scale-select"
        value={props.activeMode()}
        onChange={(e) =>
          props.onModeChange(e.currentTarget.value as FretboardMode)
        }
      >
        <For each={MODES}>
          {(m) => <option value={m.value}>{m.label}</option>}
        </For>
      </select>
    </div>
  )
}
