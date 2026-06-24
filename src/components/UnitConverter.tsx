// ============================================================
// UnitConverter — Frequency ↔ MIDI ↔ Note Name converter
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For } from 'solid-js'
import { midiToNoteName } from '@/lib/frequency-to-note'

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
    <div
      class="unit-converter"
      style={{
        padding: '12px',
        background: 'rgba(255,255,255,0.03)',
        'border-radius': '8px',
        border: '1px solid rgba(255,255,255,0.08)',
        'font-size': '0.8rem',
      }}
    >
      <h3
        style={{
          margin: '0 0 10px 0',
          'font-size': '0.85rem',
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        📐 Unit Converter
      </h3>

      <div style={{ display: 'flex', gap: '12px', 'flex-wrap': 'wrap' }}>
        {/* Freq → MIDI */}
        <div
          style={{
            flex: 1,
            'min-width': '140px',
            padding: '8px',
            background: 'rgba(255,255,255,0.03)',
            'border-radius': '4px',
          }}
        >
          <div
            style={{
              'font-size': '0.7rem',
              color: 'rgba(255,255,255,0.4)',
              'margin-bottom': '4px',
            }}
          >
            Frequency
          </div>
          <input
            type="number"
            value={freqInput()}
            onInput={(e) => setFreqInput(e.currentTarget.value)}
            placeholder="440"
            style={{
              width: '80px',
              padding: '4px 6px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              'border-radius': '3px',
              color: '#fff',
              'font-size': '0.8rem',
            }}
          />
          <span
            style={{
              'margin-left': '4px',
              'font-size': '0.7rem',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            Hz
          </span>
          {fromFreq() !== null && (
            <div
              style={{
                'margin-top': '4px',
                'font-size': '0.75rem',
                color: '#58a6ff',
              }}
            >
              {fromFreq()!.name} {formatCents(fromFreq()!.cents)} · MIDI{' '}
              {fromFreq()!.midi.toFixed(1)}
            </div>
          )}
        </div>

        {/* MIDI → Freq */}
        <div
          style={{
            flex: 1,
            'min-width': '140px',
            padding: '8px',
            background: 'rgba(255,255,255,0.03)',
            'border-radius': '4px',
          }}
        >
          <div
            style={{
              'font-size': '0.7rem',
              color: 'rgba(255,255,255,0.4)',
              'margin-bottom': '4px',
            }}
          >
            MIDI Note
          </div>
          <input
            type="number"
            value={midiInput()}
            onInput={(e) => setMidiInput(e.currentTarget.value)}
            placeholder="69"
            min="0"
            max="127"
            style={{
              width: '60px',
              padding: '4px 6px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              'border-radius': '3px',
              color: '#fff',
              'font-size': '0.8rem',
            }}
          />
          {fromMidi() !== null && (
            <div
              style={{
                'margin-top': '4px',
                'font-size': '0.75rem',
                color: '#58a6ff',
              }}
            >
              {fromMidi()!.freq.toFixed(1)} Hz · {fromMidi()!.name}{' '}
              {formatCents(fromMidi()!.cents)}
            </div>
          )}
        </div>

        {/* Note → Freq */}
        <div
          style={{
            flex: 1,
            'min-width': '140px',
            padding: '8px',
            background: 'rgba(255,255,255,0.03)',
            'border-radius': '4px',
          }}
        >
          <div
            style={{
              'font-size': '0.7rem',
              color: 'rgba(255,255,255,0.4)',
              'margin-bottom': '4px',
            }}
          >
            Note Name
          </div>
          <select
            value={noteInput()}
            onChange={(e) => setNoteInput(e.currentTarget.value)}
            style={{
              padding: '4px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              'border-radius': '3px',
              color: '#fff',
              'font-size': '0.8rem',
            }}
          >
            <For each={NOTE_NAMES}>
              {(n: string) => <option value={n}>{n}</option>}
            </For>
          </select>
          <input
            type="number"
            value={octaveInput()}
            onInput={(e) => setOctaveInput(e.currentTarget.value)}
            placeholder="4"
            min="0"
            max="9"
            style={{
              width: '40px',
              padding: '4px 6px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              'border-radius': '3px',
              color: '#fff',
              'font-size': '0.8rem',
              'margin-left': '4px',
            }}
          />
          {fromNote() !== null && (
            <div
              style={{
                'margin-top': '4px',
                'font-size': '0.75rem',
                color: '#58a6ff',
              }}
            >
              {fromNote()!.freq.toFixed(1)} Hz · MIDI{' '}
              {fromNote()!.midi.toFixed(1)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
