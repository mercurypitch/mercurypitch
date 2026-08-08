// ============================================================
// UnitConverter — Frequency / MIDI / note-name cross-reference
//
// Lab-exclusive: the only mount point is the Spectral workbench tab. All
// styling lives in the sibling module — the panel used to carry ~25 literal
// rgba() values inline, which meant it only looked right in the dark theme.
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For } from 'solid-js'
import { midiToNoteName } from '@/lib/frequency-to-note'
import { SpeedGauge } from './icons'
import styles from './UnitConverter.module.css'

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(Math.max(1, freq) / 440)
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

function noteToFreq(note: string, octave: number): number {
  const idx = NOTE_NAMES.indexOf(note)
  if (idx < 0) return 440
  return midiToFreq(idx + (octave + 1) * 12)
}

function formatCents(cents: number): string {
  const sign = cents >= 0 ? '+' : ''
  return `${sign}${cents.toFixed(0)}¢`
}

export const UnitConverter: Component = () => {
  const [freqInput, setFreqInput] = createSignal('440')
  const [midiInput, setMidiInput] = createSignal('69')
  const [noteInput, setNoteInput] = createSignal('A')
  const [octaveInput, setOctaveInput] = createSignal('4')

  const fromFreq = createMemo(() => {
    const f = parseFloat(freqInput())
    if (isNaN(f) || f <= 0) return null
    const midi = freqToMidi(f)
    const name = midiToNoteName(Math.round(midi))
    const cents = (midi - Math.round(midi)) * 100
    return { midi, name, cents }
  })

  const fromMidi = createMemo(() => {
    const m = parseFloat(midiInput())
    if (isNaN(m) || m < 0 || m > 127) return null
    const freq = midiToFreq(m)
    const name = midiToNoteName(Math.round(m))
    const cents = (m - Math.round(m)) * 100
    return { freq, name, cents }
  })

  const fromNote = createMemo(() => {
    const oct = parseInt(octaveInput())
    if (isNaN(oct)) return null
    const freq = noteToFreq(noteInput(), oct)
    const midi = freqToMidi(freq)
    return { freq, midi }
  })

  return (
    <div class={styles.panel}>
      <h3 class={styles.title}>
        <span aria-hidden="true">
          <SpeedGauge />
        </span>
        Unit converter
      </h3>

      <div class={styles.lanes}>
        {/* Frequency → note name + MIDI */}
        <div class={styles.lane}>
          <span class={styles.laneLabel}>Frequency</span>
          <div class={styles.control}>
            <input
              aria-label="Frequency in hertz"
              class={styles.field}
              onInput={(e) => setFreqInput(e.currentTarget.value)}
              placeholder="440"
              type="number"
              value={freqInput()}
            />
            <span class={styles.unit}>Hz</span>
          </div>
          {fromFreq() !== null && (
            <div class={styles.out}>
              <span class={styles.outMain}>{fromFreq()!.name}</span>
              <span class={styles.outMeta}>
                {formatCents(fromFreq()!.cents)}
              </span>
              <span class={styles.outMeta}>
                MIDI {fromFreq()!.midi.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        {/* MIDI → frequency + note name */}
        <div class={styles.lane}>
          <span class={styles.laneLabel}>MIDI note</span>
          <div class={styles.control}>
            <input
              aria-label="MIDI note number"
              class={styles.field}
              max="127"
              min="0"
              onInput={(e) => setMidiInput(e.currentTarget.value)}
              placeholder="69"
              type="number"
              value={midiInput()}
            />
          </div>
          {fromMidi() !== null && (
            <div class={styles.out}>
              <span class={styles.outMain}>
                {fromMidi()!.freq.toFixed(1)}
                <span class={styles.outUnit}>Hz</span>
              </span>
              <span class={styles.outMeta}>{fromMidi()!.name}</span>
              <span class={styles.outMeta}>
                {formatCents(fromMidi()!.cents)}
              </span>
            </div>
          )}
        </div>

        {/* Note name + octave → frequency + MIDI */}
        <div class={styles.lane}>
          <span class={styles.laneLabel}>Note name</span>
          <div class={styles.control}>
            <select
              aria-label="Note name"
              class={styles.select}
              onChange={(e) => setNoteInput(e.currentTarget.value)}
              value={noteInput()}
            >
              <For each={NOTE_NAMES}>
                {(n: string) => <option value={n}>{n}</option>}
              </For>
            </select>
            <input
              aria-label="Octave"
              class={`${styles.field} ${styles.fieldTight}`}
              max="9"
              min="0"
              onInput={(e) => setOctaveInput(e.currentTarget.value)}
              placeholder="4"
              type="number"
              value={octaveInput()}
            />
          </div>
          {fromNote() !== null && (
            <div class={styles.out}>
              <span class={styles.outMain}>
                {fromNote()!.freq.toFixed(1)}
                <span class={styles.outUnit}>Hz</span>
              </span>
              <span class={styles.outMeta}>
                MIDI {fromNote()!.midi.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
