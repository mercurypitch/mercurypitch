import type { Component } from 'solid-js'
import { createMemo, For } from 'solid-js'
import { CHORD_TYPES } from '@/lib/guitar/chord-utils'
import { NOTE_NAMES } from '@/lib/note-utils'
import { SCALE_DEFINITIONS } from '@/lib/scale-data'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

export interface ChordSelectorProps {
  selectedKey: () => string
  selectedScale: () => string
  selectedChord: () => string | null
  onChordChange: (chord: string | null) => void
}

export const ChordSelector: Component<ChordSelectorProps> = (props) => {
  const diatonicChords = createMemo(() => {
    const keyIdx = NOTE_NAMES.indexOf(props.selectedKey())
    if (keyIdx === -1) return []
    const scale = SCALE_DEFINITIONS[props.selectedScale()]
    if (scale === undefined) return []

    const degs = scale.degrees
    const chords: Array<{ value: string; label: string }> = []

    // Build triads from the scale — use up to 7 degrees for diatonic harmony
    const n = Math.min(degs.length, 7)
    for (let i = 0; i < n; i++) {
      const root = (keyIdx + degs[i]) % 12
      const rootName = NOTE_NAMES[root]

      // Build triad: root, third (i+2), fifth (i+4) — wrap within the scale
      const thirdDeg = degs[(i + 2) % degs.length]
      const fifthDeg = degs[(i + 4) % degs.length]
      const third = (keyIdx + thirdDeg) % 12
      const fifth = (keyIdx + fifthDeg) % 12

      const thirdInterval = (third - root + 12) % 12
      const fifthInterval = (fifth - root + 12) % 12
      let quality = 'maj'
      if (fifthInterval === 6) quality = 'dim'
      else if (thirdInterval === 3) quality = 'min'
      else if (thirdInterval === 4 && fifthInterval === 8) quality = 'aug'

      chords.push({
        value: quality,
        label: `${ROMAN[i]} (${rootName} ${CHORD_TYPES[quality].label})`,
      })
    }

    return chords
  })

  return (
    <div class="gp-key-scale-group">
      <label class="gp-key-scale-label">Chord</label>
      <select
        class="gp-key-scale-select gp-chord-select"
        value={props.selectedChord() ?? ''}
        onChange={(e) => {
          const v = e.currentTarget.value
          props.onChordChange(v || null)
        }}
      >
        <option value="">None</option>
        <For each={diatonicChords()}>
          {(c) => <option value={c.value}>{c.label}</option>}
        </For>
      </select>
    </div>
  )
}
