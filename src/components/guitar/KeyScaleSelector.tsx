import type { Component, JSXElement } from 'solid-js'
import { For } from 'solid-js'

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const SCALES = [
  { value: 'major', label: 'Major' },
  { value: 'natural-minor', label: 'Natural Minor' },
  { value: 'harmonic-minor', label: 'Harmonic Minor' },
  { value: 'melodic-minor', label: 'Melodic Minor' },
  { value: 'pentatonic-major', label: 'Pentatonic Major' },
  { value: 'pentatonic-minor', label: 'Pentatonic Minor' },
  { value: 'blues', label: 'Blues' },
  { value: 'dorian', label: 'Dorian' },
  { value: 'phrygian', label: 'Phrygian' },
  { value: 'lydian', label: 'Lydian' },
  { value: 'mixolydian', label: 'Mixolydian' },
  { value: 'locrian', label: 'Locrian' },
  { value: 'chromatic', label: 'Chromatic' },
]

export interface KeyScaleSelectorProps {
  selectedKey: () => string
  selectedScale: () => string
  onKeyChange: (key: string) => void
  onScaleChange: (scale: string) => void
  children?: JSXElement
}

export const KeyScaleSelector: Component<KeyScaleSelectorProps> = (props) => {
  return (
    <div class="gp-key-scale-row">
      <div class="gp-key-scale-group">
        <label class="gp-key-scale-label">Key</label>
        <select
          class="gp-key-scale-select"
          value={props.selectedKey()}
          onChange={(e) => props.onKeyChange(e.currentTarget.value)}
        >
          <For each={KEYS}>{(k) => <option value={k}>{k}</option>}</For>
        </select>
      </div>
      <div class="gp-key-scale-group">
        <label class="gp-key-scale-label">Scale</label>
        <select
          class="gp-key-scale-select"
          value={props.selectedScale()}
          onChange={(e) => props.onScaleChange(e.currentTarget.value)}
        >
          <For each={SCALES}>
            {(s) => <option value={s.value}>{s.label}</option>}
          </For>
        </select>
      </div>
      {props.children}
    </div>
  )
}
