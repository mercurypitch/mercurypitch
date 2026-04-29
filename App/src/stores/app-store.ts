import { createSignal } from 'solid-js'
import { AudioEngine } from '@/lib/audio-engine'

// ── Key / Scale / Presets ──────────────────────────────────

export const [keyName, setKeyName] = createSignal<string>('C')
export const [scaleType, setScaleType] = createSignal<string>('major')
export const [instrument, setInstrument] = createSignal<InstrumentType>('sine')
export const [currentPresetName, setCurrentPresetName] = createSignal<
  string | null
>(null)

export type InstrumentType = 'sine' | 'piano' | 'organ' | 'strings' | 'synth'

export const [octave, setOctave] = createSignal<number>(4)

// ── Audio Engine (single instance) ─────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _audioEngineInstance: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function initAudioEngine(): Promise<any> {
  if (_audioEngineInstance !== null && _audioEngineInstance !== undefined) {
    return _audioEngineInstance
  }

  _audioEngineInstance = new AudioEngine()
  return _audioEngineInstance
}

// ── Practice ────────────────────────────────────────────────
// Temporary signals kept here for backwards compatibility until
// features/practice controller migration
export const [practiceCount, setPracticeCount] = createSignal<number>(0)
export const [lastScore, setLastScore] = createSignal<number | null>(null)

// ── Sessions backward compat ────────────────────────────────

// Moved to user-session-store
