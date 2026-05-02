import { IS_DEV } from '@/lib/defaults'
import type { PitchAlgorithm } from '@/lib/pitch-detector'
import { createPersistedSignal } from '@/lib/storage'

export type { PitchAlgorithm }

export type SensitivityPreset = 'quiet' | 'home' | 'noisy'
export type AccuracyTier = 'learning' | 'singer' | 'professional'

export interface SettingsConfig {
  detectionThreshold: number
  sensitivity: number
  minConfidence: number
  minAmplitude: number
  bands: Array<{ threshold: number; band: number; color: string }>
  /** Optional for backwards compatibility with older persisted settings/tests. */
  tonicAnchor?: boolean
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

const ACCURACY_PRESETS: Record<
  AccuracyTier,
  Array<{ threshold: number; band: number; color: string }>
> = {
  learning: [
    { threshold: 15, band: 100, color: '#3fb950' },
    { threshold: 30, band: 90, color: '#58a6ff' },
    { threshold: 50, band: 75, color: '#2dd4bf' },
    { threshold: 75, band: 50, color: '#d29922' },
    { threshold: 999, band: 0, color: '#f85149' },
  ],
  singer: [
    { threshold: 8, band: 100, color: '#3fb950' },
    { threshold: 15, band: 90, color: '#58a6ff' },
    { threshold: 25, band: 75, color: '#2dd4bf' },
    { threshold: 40, band: 50, color: '#d29922' },
    { threshold: 999, band: 0, color: '#f85149' },
  ],
  professional: [
    { threshold: 0, band: 100, color: '#3fb950' },
    { threshold: 3, band: 90, color: '#58a6ff' },
    { threshold: 8, band: 75, color: '#2dd4bf' },
    { threshold: 15, band: 50, color: '#d29922' },
    { threshold: 999, band: 0, color: '#f85149' },
  ],
}

export const DEFAULT_SETTINGS: SettingsConfig = {
  ...SENSITIVITY_PRESETS.noisy, // Use noisy as default config values
  bands: ACCURACY_PRESETS.learning,
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

/**
 * "Flame mode" — visual fire effect on the currently-playing note
 * during practice/playback. Persisted so it survives reloads. Toggleable
 * from the Settings panel and (in v3+) the practice toolbar.
 */
export const [flameMode, setFlameMode] = createPersistedSignal<boolean>(
  'pitchperfect_flame_mode',
  false,
)

/**
 * Color-code already-played notes by their pitch-accuracy rating
 * (perfect → green, off → red, with a smooth ramp in between).
 * Practice tab only. Persisted so it survives reloads.
 */
export const [colorCodeNotes, setColorCodeNotes] =
  createPersistedSignal<boolean>('pitchperfect_color_code_notes', true)

/** Show the Practice sidebar note list. Hidden by default to reduce clutter. */
export const [showSidebarNoteList, setShowSidebarNoteList] =
  createPersistedSignal<boolean>(
    'pitchperfect_sidebar_note_list_visible_v2',
    false,
  )

/**
 * Show a numeric accuracy percentage (0-100%) on each played note
 * in the PitchCanvas and NoteList. Defaults on so the user sees the
 * new behavior immediately.
 */
export const [showAccuracyPercent, setShowAccuracyPercent] =
  createPersistedSignal<boolean>('pitchperfect_accuracy_percent', IS_DEV)

// ── Pitch Detection Algorithm ─────────────────────────────────────
//
// Choose between YIN (classic, well-tested) and McLeod Pitch Method
// (MPM — better harmonic handling, fewer octave errors on complex
// timbres). Default: YIN for stability.
export const [pitchAlgorithm, setPitchAlgorithm] =
  createPersistedSignal<PitchAlgorithm>('pitchperfect_pitch_algorithm', 'mpm')

// ── Pitch Detection Buffer Size ───────────────────────────────────
//
// Larger buffers give better accuracy (especially for low frequencies)
// but increase latency. 2048 is the sweet spot for most voices.
export type PitchBufferSize = 512 | 1024 | 2048 | 4096
export const PITCH_BUFFER_SIZES: PitchBufferSize[] = [512, 1024, 2048, 4096]
export const PITCH_BUFFER_LABELS: Record<PitchBufferSize, string> = {
  512: '512',
  1024: '1K',
  2048: '2K',
  4096: '4K',
}
export const PITCH_BUFFER_DESCRIPTIONS: Record<PitchBufferSize, string> = {
  512: 'Lowest latency, less accurate on low notes',
  1024: 'Low latency, good for higher voices',
  2048: 'Balanced (recommended)',
  4096: 'High accuracy, more latency',
}
export const [pitchBufferSize, setPitchBufferSize] =
  createPersistedSignal<PitchBufferSize>('pitchperfect_pitch_buffer_size', 2048)

// ── Custom Scales ─────────────────────────────────────────────────
//
// Persisted map of user-created scales: { "My Scale": ["C","D","E",...] }
// Reactive so the sidebar dropdown auto-updates when scales are
// saved/deleted from the ScaleBuilder.
export type CustomScalesMap = Record<string, string[]>

export const [customScales, setCustomScales] =
  createPersistedSignal<CustomScalesMap>('pitchperfect_custom_scales', {})

/** Save (or overwrite) a named custom scale. */
export function saveCustomScale(name: string, notes: string[]): void {
  setCustomScales((prev) => ({ ...prev, [name]: notes }))
}

/** Delete a named custom scale. */
export function deleteCustomScale(name: string): void {
  setCustomScales((prev) => {
    const next = { ...prev }
    delete next[name]
    return next
  })
}

/** Encode a custom scale as the scale-type string used by the dropdown. */
export function customScaleTypeId(name: string, notes: string[]): string {
  return `custom:${name}:${notes.join(',')}`
}

/** Check whether a scale-type string represents a custom scale. */
export function isCustomScaleType(st: string): boolean {
  return st.startsWith('custom:')
}

/** Parse a custom scale-type string into { name, notes }. */
export function parseCustomScaleType(
  st: string,
): { name: string; notes: string[] } | null {
  if (!st.startsWith('custom:')) return null
  const parts = st.split(':')
  if (parts.length < 3) return null
  return { name: parts[1], notes: parts[2].split(',') }
}

// ── Character-themed playback sounds ───────────────────────────────
//
// Each guide character maps to a different timbre + small detune /
// volume nudge so the practice tab "feels" different per persona.
// The user picks a character via <CharacterIcons> in the sidebar; the
// EngineContext effect listens to `selectedCharacter` and (when
// `characterSounds` is enabled) calls `audioEngine.setInstrument(...)`
// with the mapped instrument. Disabling the toggle restores the
// instrument the user picked from the dropdown in Settings.
export type CharacterName =
  | 'blaze'
  | 'aria'
  | 'flux'
  | 'luna'
  | 'glint'
  | 'echo'

export const [selectedCharacter, setSelectedCharacter] =
  createPersistedSignal<CharacterName>('pitchperfect_character', 'aria')

export const [characterSounds, setCharacterSounds] =
  createPersistedSignal<boolean>('pitchperfect_character_sounds', true)

const SHOW_PLAYBACK_SETUP_KEY = 'pitchperfect_show_playback_setup_label'
const SHOW_STATS_KEY = 'pitchperfect_show_stats'
const SHOW_PITCH_DISPLAY_KEY = 'pitchperfect_show_pitch_display'

export const [showPlaybackSetupInfo, setShowPlaybackSetup] =
  createPersistedSignal<boolean>(SHOW_PLAYBACK_SETUP_KEY, true)
export const [showStats, setShowStats] = createPersistedSignal<boolean>(
  SHOW_STATS_KEY,
  true,
)
export const [showPitchDisplay, setShowPitchDisplay] =
  createPersistedSignal<boolean>(SHOW_PITCH_DISPLAY_KEY, true)

// FIXME: Initialization functions mapped to no-ops to support old init pattern gracefully
// before they are completely removed. Storage loading happens on signal creation now.
export function initSettings(): void {}
export function initADSR(): void {}
export function initReverb(): void {}

// ── Accuracy Presets ───────────────────────────────────────────────────

export const [accuracyTier, _setAccuracyTier] =
  createPersistedSignal<AccuracyTier>('pitchperfect_accuracy_tier', 'singer')

// Each accuracy tier implies a different mic sensitivity.
// "quiet" has the LOWEST thresholds (most forgiving, easiest to trigger) —
// perfect for beginners who need the tracker to pick up anything.
// "noisy" has the HIGHEST thresholds (requires strong, clean signal) —
// suited for pros who want to filter out everything but precise singing.
const TIER_SENSITIVITY: Record<AccuracyTier, SensitivityPreset> = {
  learning: 'quiet',
  singer: 'home',
  professional: 'noisy',
}

/** Apply accuracy tier preset to current settings */
export function applyAccuracyTier(tier: AccuracyTier): void {
  const bands = ACCURACY_PRESETS[tier]
  const base = SENSITIVITY_PRESETS[TIER_SENSITIVITY[tier]]
  setSettings((s) => ({
    ...base,
    bands,
    tonicAnchor: s.tonicAnchor,
  }))
  _setSensitivityPreset(TIER_SENSITIVITY[tier])
  _setAccuracyTier(tier)
}

/** Get current accuracy tier preset information */
export function getAccuracyTierInfo(tier: AccuracyTier): {
  label: string
  description: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
} {
  const info = {
    learning: {
      label: 'Learning',
      description:
        'Perfect pitch means being within 15 cents of the target note. Great for beginners.',
      difficulty: 'Beginner',
    },
    singer: {
      label: 'Singer',
      description:
        'Perfect pitch means being within 8 cents of the target note. For intermediate singers.',
      difficulty: 'Intermediate',
    },
    professional: {
      label: 'Professional',
      description:
        'Perfect pitch means being within 0 cents of the target note. For advanced virtuosos.',
      difficulty: 'Advanced',
    },
  } as const
  return info[tier]
}
