import { createPersistedSignal } from '@/lib/storage'
import { createSignal } from 'solid-js'
import type { AccuracyBand } from '@/types'

export type SensitivityPreset = 'quiet' | 'home' | 'noisy'

export interface SettingsConfig {
  detectionThreshold: number
  sensitivity: number
  minConfidence: number
  minAmplitude: number
  bands: AccuracyBand[]
  tonicAnchor: boolean
}

export interface ADSRConfig {
  attack: number
  decay: number
  sustain: number
  release: number
}

export type ReverbType = 'off' | 'room' | 'hall' | 'cathedral'

export interface ReverbConfig {
  wetness: number
  type: ReverbType
}

export const SENSITIVITY_PRESETS: Record<
  SensitivityPreset,
  Omit<SettingsConfig, 'bands' | 'tonicAnchor'>
> = {
  quiet: {
    detectionThreshold: 0.05,
    sensitivity: 7,
    minConfidence: 0.3,
    minAmplitude: 1,
  },
  home: {
    detectionThreshold: 0.1,
    sensitivity: 5,
    minConfidence: 0.5,
    minAmplitude: 2,
  },
  noisy: {
    detectionThreshold: 0.2,
    sensitivity: 9,
    minConfidence: 0.7,
    minAmplitude: 4,
  },
}

const DEFAULT_BANDS: AccuracyBand[] = [
  { threshold: 0, band: 100, color: '#3fb950' },
  { threshold: 10, band: 90, color: '#58a6ff' },
  { threshold: 25, band: 75, color: '#2dd4bf' },
  { threshold: 50, band: 50, color: '#d29922' },
  { threshold: 999, band: 0, color: '#f85149' },
]

export const DEFAULT_SETTINGS: SettingsConfig = {
  ...SENSITIVITY_PRESETS.noisy, // Use noisy as default config values
  bands: DEFAULT_BANDS,
  tonicAnchor: false,
}

export const DEFAULT_ADSR: ADSRConfig = {
  attack: 10,
  decay: 100,
  sustain: 70,
  release: 200,
}

export const DEFAULT_REVERB: ReverbConfig = {
  wetness: 30,
  type: 'room',
}

export const [sensitivityPreset, _setSensitivityPreset] =
  createPersistedSignal<SensitivityPreset>(
    'pitchperfect_sensitivity_preset',
    'noisy',
  )

export const [settings, setSettings] = createPersistedSignal<SettingsConfig>(
  'pitchperfect_settings',
  DEFAULT_SETTINGS,
)

export const [adsr, setAdsr] = createPersistedSignal<ADSRConfig>(
  'pitchperfect_adsr',
  DEFAULT_ADSR,
)

export const [reverbConfig, setReverbConfigSignal] =
  createPersistedSignal<ReverbConfig>('pitchperfect_reverb', DEFAULT_REVERB)

// ── Setters ─────────────────────────────────────────────────────────

export function setSensitivityPresetValue(value: SensitivityPreset): void {
  _setSensitivityPreset(value)
}

export function applySensitivityPreset(preset: SensitivityPreset): void {
  const config = SENSITIVITY_PRESETS[preset]
  setSettings((s) => ({ ...s, ...config }))
  _setSensitivityPreset(preset)
}

export function setDetectionThreshold(value: number): void {
  setSettings((s) => ({
    ...s,
    detectionThreshold: Math.max(0.05, Math.min(0.2, value)),
  }))
}

export function setSensitivity(value: number): void {
  setSettings((s) => ({
    ...s,
    sensitivity: Math.max(1, Math.min(10, value)),
  }))
}

export function setMinConfidence(value: number): void {
  setSettings((s) => ({
    ...s,
    minConfidence: Math.max(0.3, Math.min(0.9, value)),
  }))
}

export function setMinAmplitude(value: number): void {
  setSettings((s) => ({
    ...s,
    minAmplitude: Math.max(1, Math.min(10, value)),
  }))
}

export function setTonicAnchor(enabled: boolean): void {
  setSettings((s) => ({ ...s, tonicAnchor: enabled }))
}

export function setBand(index: number, threshold: number): void {
  setSettings((s) => {
    const bands = [...s.bands]
    bands[index] = { ...bands[index], threshold }
    bands.sort((a, b) => a.threshold - b.threshold)
    return { ...s, bands }
  })
}

export function getBandRating(avgCents: number | null): number {
  if (avgCents === null) return 0
  const currentBands = settings().bands
  for (const b of currentBands) {
    if (avgCents <= b.threshold) return b.band
  }
  return 0
}

export function setAttack(value: number): void {
  setAdsr((a) => ({ ...a, attack: Math.max(0, Math.min(1000, value)) }))
}

export function setDecay(value: number): void {
  setAdsr((a) => ({ ...a, decay: Math.max(0, Math.min(1000, value)) }))
}

export function setSustain(value: number): void {
  setAdsr((a) => ({ ...a, sustain: Math.max(0, Math.min(100, value)) }))
}

export function setRelease(value: number): void {
  setAdsr((a) => ({ ...a, release: Math.max(0, Math.min(2000, value)) }))
}

export function setReverbWetness(value: number): void {
  setReverbConfigSignal((c) => ({
    ...c,
    wetness: Math.max(0, Math.min(100, value)),
  }))
}

export function setReverbType(type: ReverbType): void {
  setReverbConfigSignal((c) => ({ ...c, type }))
}

// ── Grid Lines ──────────────────────────────────────────────────────
export const [gridLinesVisible, setGridLinesVisible] =
  createPersistedSignal<boolean>('pitchperfect_grid', true)

export function toggleGridLines(): void {
  setGridLinesVisible(!gridLinesVisible())
}

export function setGridLines(visible: boolean): void {
  setGridLinesVisible(visible)
}

// Initialization functions mapped to no-ops to support old init pattern gracefully
// before they are completely removed. Storage loading happens on signal creation now.
export function initSettings(): void {}
export function initADSR(): void {}
export function initReverb(): void {}
