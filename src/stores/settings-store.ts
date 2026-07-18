import type { PracticeScope, UiMode } from '@/features/tabs/constants'
import { IS_DEV } from '@/lib/defaults'
import type { PitchAlgorithm } from '@/lib/pitch-detector'
import { createPersistedSignal } from '@/lib/storage'

export type { PitchAlgorithm }

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

export type SensitivityPreset = 'quiet' | 'home' | 'noisy'
export type AccuracyTier = 'learning' | 'singer' | 'professional'
export type FontFamily = 'inter' | 'outfit' | 'plus-jakarta-sans' | 'system'
export type VocalRangePreset =
  | 'soprano'
  | 'mezzo-soprano'
  | 'alto'
  | 'tenor'
  | 'baritone'
  | 'bass'

export const VOCAL_RANGES: Record<
  VocalRangePreset,
  { label: string; minOctave: number; maxOctave: number; defaultOctave: number }
> = {
  soprano: { label: 'Soprano', minOctave: 4, maxOctave: 6, defaultOctave: 4 },
  'mezzo-soprano': {
    label: 'Mezzo-Soprano',
    minOctave: 3,
    maxOctave: 5,
    defaultOctave: 4,
  },
  alto: { label: 'Alto', minOctave: 3, maxOctave: 5, defaultOctave: 3 },
  tenor: { label: 'Tenor', minOctave: 3, maxOctave: 5, defaultOctave: 3 },
  baritone: { label: 'Baritone', minOctave: 2, maxOctave: 4, defaultOctave: 2 },
  bass: { label: 'Bass', minOctave: 2, maxOctave: 4, defaultOctave: 2 },
}

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

// ── TODO: Merge custom settings from UVR branch with dev settings ─────────────────────────────
// The dev branch has new settings in the multi-setting form in SettingsPanel.
// We need to add: perfect pitch sensitivity sliders, camera preview toggle,
// and other UVR-specific controls while maintaining backward compatibility.

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

export const [fontFamily, setFontFamily] = createPersistedSignal<FontFamily>(
  'pitchperfect_font',
  'inter',
)

export const [vocalRangePreset, setVocalRangePreset] =
  createPersistedSignal<VocalRangePreset>('pitchperfect_vocal_range', 'tenor')

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

// ── Swipe-to-change-tabs (mobile) ───────────────────────────────────
// Opt-in and OFF by default: with the bottom tab bar now the primary way
// to move between views on a phone, a half-screen horizontal swipe was
// firing accidental tab changes. Users who want the gesture can re-enable
// it in Settings → Display & Controls.
export const [swipeNavEnabled, setSwipeNavEnabled] =
  createPersistedSignal<boolean>('pitchperfect_swipe_nav', false)

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

/** Restore a previously deleted custom scale (undo support). */
export function restoreCustomScale(name: string, notes: string[]): void {
  setCustomScales((prev) => ({ ...prev, [name]: notes }))
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
  | 'harmony'
  | 'nova'
  | 'spark'

export interface CharacterInfo {
  name: CharacterName
  displayName: string
  title: string
  description: string
}

export const CHARACTER_INFO: Record<CharacterName, CharacterInfo> = {
  aria: {
    name: 'aria',
    displayName: 'Aria',
    title: 'Loud Guide',
    description:
      'Boosted piano guide to help you stay on track and hear notes clearly over your own voice.',
  },
  echo: {
    name: 'echo',
    displayName: 'Echo',
    title: 'Quiet Whisper',
    description:
      'Low-volume piano backdrop that stays out of your way — perfect if you already know the melody.',
  },
  harmony: {
    name: 'harmony',
    displayName: 'Harmony',
    title: 'Harmonic Blend',
    description:
      'Plays a matching third on top of your target note, making singing exercises feel like a duet!',
  },
  nova: {
    name: 'nova',
    displayName: 'Nova',
    title: 'Octave Anchor',
    description:
      'Plays a sub-octave double to provide a deep harmonic foundation — ideal for lower registers.',
  },
  spark: {
    name: 'spark',
    displayName: 'Spark',
    title: 'Percussive Tap',
    description:
      'Plays short, staccato plucked notes to help you practice rhythmic timing and precise pitch onset.',
  },
  blaze: {
    name: 'blaze',
    displayName: 'Blaze',
    title: 'Playful Synth',
    description:
      'A fun, energetic retro synthesizer voice with a lively wobble to keep practice engaging.',
  },
  flux: {
    name: 'flux',
    displayName: 'Flux',
    title: 'Retro Organ',
    description:
      'A steady, sustained organ tone that provides solid pitch guidance.',
  },
  luna: {
    name: 'luna',
    displayName: 'Luna',
    title: 'Lush Strings',
    description:
      'A rich, warm ensemble that pads the background with sustained harmony.',
  },
  glint: {
    name: 'glint',
    displayName: 'Glint',
    title: 'Pure Tone',
    description:
      'A clean, simple sine wave with no harmonics for precise, undistracted pitch matching.',
  },
}

export const [selectedCharacter, setSelectedCharacter] =
  createPersistedSignal<CharacterName>('pitchperfect_character', 'aria')

export const [characterSounds, setCharacterSounds] =
  createPersistedSignal<boolean>('pitchperfect_character_sounds', true)

// ── App scope & UI mode ─────────────────────────────────────────
// practiceScope filters the app to one instrument's surface; uiMode picks
// between the full app ('advanced') and a practice-first UI ('simple').
// Tab visibility itself is derived in features/tabs/constants.ts.

export const [practiceScope, setPracticeScope] =
  createPersistedSignal<PracticeScope>('pitchperfect_practice_scope', 'all', {
    validator: (v): v is PracticeScope =>
      v === 'all' || v === 'singing' || v === 'guitar' || v === 'piano',
  })

export const [uiMode, setUiMode] = createPersistedSignal<UiMode>(
  'pitchperfect_ui_mode',
  'advanced',
  {
    validator: (v): v is UiMode => v === 'advanced' || v === 'simple',
  },
)

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

const SHOW_MASCOT_KEY = 'pitchperfect_show_mascot'
// Merc, the singing-page mascot dock. Shown by default; users who prefer a
// distraction-free canvas can hide it. Affects the Practice/singing HUD dock
// only — not the welcome or session-celebration Mercs.
export const [showMascot, setShowMascot] = createPersistedSignal<boolean>(
  SHOW_MASCOT_KEY,
  true,
)

/**
 * On phones the singing HUD cards (accuracy / sessions / pitch monitor) are
 * large enough to crowd the canvas, so they're hidden by default — only the
 * compact status chip and the live on-canvas pitch line stay. This toggle lets
 * the user reveal them; it has no effect on desktop, where the cards follow
 * showStats / showPitchDisplay as before. Persisted per device.
 */
export const [singingHudMobileOpen, setSingingHudMobileOpen] =
  createPersistedSignal<boolean>('pitchperfect_singing_hud_mobile', false)

/**
 * Show the legacy live-history panel (frequency / waveform bars) below the
 * practice canvas. Off by default — the in-canvas pitch monitor covers this
 * now, and hiding it reclaims vertical space.
 */
export const [showHistoryPanel, setShowHistoryPanel] =
  createPersistedSignal<boolean>('pitchperfect_show_history_panel', false)

/**
 * Show the practice-result popup modal after a run completes
 * (once mode, repeat mode, or session). Off by default so the
 * overlay doesn't interrupt the user after every run.
 */
const SHOW_PRACTICE_RESULT_POPUP_KEY = 'pitchperfect_show_practice_result_popup'
export const [showPracticeResultPopup, setShowPracticeResultPopup] =
  createPersistedSignal<boolean>(SHOW_PRACTICE_RESULT_POPUP_KEY, false)

/**
 * Show the jumping ball during playback mode. On by default.
 */
const SHOW_PLAYBACK_BALL_KEY = 'pitchperfect_show_playback_ball'
export const [showPlaybackBall, setShowPlaybackBall] =
  createPersistedSignal<boolean>(SHOW_PLAYBACK_BALL_KEY, true)

/**
 * Show the jumping ball during Focus mode. On by default — Focus mode
 * is explicitly for visual pitch tracking.
 */
const SHOW_FOCUS_BALL_KEY = 'pitchperfect_show_focus_ball'
export const [showFocusBall, setShowFocusBall] = createPersistedSignal<boolean>(
  SHOW_FOCUS_BALL_KEY,
  true,
)

/**
 * Show the playhead vertical line during playback/pause. Off by default.
 * When off, users rely solely on the jumping ball for position tracking.
 */
const SHOW_PLAYHEAD_KEY = 'pitchperfect_show_playhead'
export const [showPlayhead, setShowPlayhead] = createPersistedSignal<boolean>(
  SHOW_PLAYHEAD_KEY,
  false,
)

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
