// ============================================================
// GuitarSignalFlow — "what's hooked where" signal map
// ============================================================
//
// A small, glassy signal-flow diagram for the guitar Devices panel: your input
// source → pitch detection (your live note) → scoring. The flow lights up while
// a note is being detected, so it's instantly clear the signal is getting
// through and where it goes. Matches the 3D overlay's glass + accent-glow look.

import type { Accessor, JSX } from 'solid-js'
import { For } from 'solid-js'
import { midiToNoteNameOctave } from '@/lib/note-utils'

export interface GuitarSignalFlowProps {
  inputMode: Accessor<'keyboard' | 'mic' | 'midi'>
  detectedMidi: Accessor<number | null>
  isPlaying: Accessor<boolean>
  combo: Accessor<number>
}

const MODE_LABEL: Record<string, string> = {
  mic: 'Audio in',
  midi: 'MIDI',
  keyboard: 'Keys',
}

const MIC = [
  'M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z',
  'M5 11a7 7 0 0 0 14 0',
  'M12 18v3',
]
const MIDI = [
  'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  'M8 10h.01',
  'M16 10h.01',
  'M9 14h.01',
  'M15 14h.01',
  'M12 15h.01',
]
const KEYS = ['M3 6h18v12H3z', 'M8 6v8', 'M12 6v8', 'M16 6v8']
const WAVE = ['M3 12h3l2-6 3 12 3-9 2 3h5']
const TARGET = [
  'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  'M12 11.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1z',
]

export function GuitarSignalFlow(props: GuitarSignalFlowProps) {
  const detecting = () => props.detectedMidi() !== null
  const detectedName = () => {
    const m = props.detectedMidi()
    return m === null ? '—' : midiToNoteNameOctave(m)
  }
  const inputIcon = () => {
    const m = props.inputMode()
    return m === 'midi' ? MIDI : m === 'mic' ? MIC : KEYS
  }

  return (
    <div class="gp-flow" aria-label="Signal flow">
      <FlowNode
        icon={inputIcon()}
        eyebrow="Source"
        value={MODE_LABEL[props.inputMode()] ?? 'Input'}
        active={detecting()}
      />
      <FlowLink active={detecting()} />
      <FlowNode
        icon={WAVE}
        eyebrow="Detected"
        value={detectedName()}
        active={detecting()}
        accent
      />
      <FlowLink active={detecting()} />
      <FlowNode
        icon={TARGET}
        eyebrow="Scoring"
        value={props.combo() > 0 ? `${props.combo()}× combo` : 'Ready'}
        active={props.isPlaying()}
      />
    </div>
  )
}

function FlowNode(props: {
  icon: string[]
  eyebrow: string
  value: string
  active: boolean
  accent?: boolean
}) {
  return (
    <div
      class="gp-flow-node"
      classList={{
        'is-active': props.active,
        'is-accent': props.accent === true && props.active,
      }}
    >
      <span class="gp-flow-ico">
        <FlowIcon paths={props.icon} />
      </span>
      <span class="gp-flow-eyebrow">{props.eyebrow}</span>
      <span class="gp-flow-val">{props.value}</span>
    </div>
  )
}

function FlowLink(props: { active: boolean }) {
  return (
    <span class="gp-flow-link" classList={{ 'is-active': props.active }}>
      <svg viewBox="0 0 40 12" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="6" x2="34" y2="6" class="gp-flow-link-line" />
        <path d="M30 2l6 4-6 4" class="gp-flow-link-head" />
      </svg>
    </span>
  )
}

function FlowIcon(props: { paths: string[] }): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <For each={props.paths}>{(d) => <path d={d} />}</For>
    </svg>
  )
}
