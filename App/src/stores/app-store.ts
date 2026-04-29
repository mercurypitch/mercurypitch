/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================
// App Store — Global application state
// ============================================================

import { createSignal } from 'solid-js'
import { AudioEngine } from '@/lib/audio-engine'
import { buildMultiOctaveScale } from '@/lib/scale-data'
import {
  getCompletedCount,
  getRemainingWalkthroughs
} from '@/stores/walkthrough-store'
import type {
  AccuracyBand,
  MelodyItem,
  MelodyNote,
  NoteName,
  PracticeSession,
  SavedUserSession,
  Session,
  SessionItem,
  SessionResult,
  SessionTemplate,
} from '@/types'
import { getMelodyLibrary,melodyStore } from './melody-store'

// ── Key / Scale ─────────────────────────────────────────────

const [keyName, setKeyName] = createSignal<string>('C')
const [scaleType, setScaleType] = createSignal<string>('major')
const [instrument, setInstrument] = createSignal<InstrumentType>('sine')
const [isRecording, setIsRecording] = createSignal<boolean>(false)

export type InstrumentType = 'sine' | 'piano' | 'organ' | 'strings' | 'synth'

// ── Audio Engine (single instance) ─────────────────────────────

let _audioEngineInstance: any = null

// Initialize audio engine (call this when app starts, not in startPracticeSession)
export async function initAudioEngine(): Promise<any> {
  if (_audioEngineInstance !== null && _audioEngineInstance !== undefined) {
    return _audioEngineInstance
  }

  _audioEngineInstance = new AudioEngine()
  return _audioEngineInstance
}

// ── Theme ────────────────────────────────────────────────────

export type ThemeMode = 'dark' | 'light'

const THEME_KEY = 'pitchperfect_theme'

// ────────────────────────────────────────────────────────────

function loadThemeFromStorage(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* empty */
  }
  return 'dark' // default to dark
}

const [theme, setThemeInternal] = createSignal<ThemeMode>(
  loadThemeFromStorage(),
)

export function setTheme(mode: ThemeMode): void {
  setThemeInternal(mode)
  try {
    localStorage.setItem(THEME_KEY, mode)
  } catch {
    /* empty */
  }
  // Apply theme to document
  document.documentElement.setAttribute('data-theme', mode)
  window.dispatchEvent(
    new CustomEvent('pitchperfect:themeChange', { detail: { theme: mode } }),
  )
}

export function toggleTheme(): void {
  const next = theme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
}

export function initTheme(): void {
  document.documentElement.setAttribute('data-theme', theme())
}

// ── Mic ──────────────────────────────────────────────────────

const [micActive, setMicActive] = createSignal<boolean>(false)
const [micWaveVisible, setMicWaveVisible] = createSignal<boolean>(true)
export { setMicWaveVisible }
const [micError, setMicError] = createSignal<string | null>(null)

export function toggleMicWaveVisible(): void {
  setMicWaveVisible((v) => !v)
}

// ── Count-in ────────────────────────────────────────────────

export type CountInOption = 0 | 1 | 2 | 4

const [countIn, setCountIn] = createSignal<CountInOption>(0)

// ── BPM ────────────────────────────────────────────────────

function loadBpmFromStorage(): number {
  try {
    const stored = localStorage.getItem('pitchperfect_bpm')
    const parsed = parseInt(stored ?? '120', 10)
    if (!isNaN(parsed) && parsed >= 40 && parsed <= 280) {
      return parsed
    }
  } catch {
    /* empty */
  }
  return 120 // default
}

function saveBpmToStorage(value: number): void {
  try {
    localStorage.setItem('pitchperfect_bpm', String(value))
  } catch (e) {
    console.warn('Failed to save BPM:', e)
  }
}

let _bpmValue = loadBpmFromStorage()
const [bpm, setBpmSignal] = createSignal<number>(_bpmValue)

export function setBpm(value: number): void {
  const clamped = Math.max(40, Math.min(280, value))
  _bpmValue = clamped
  setBpmSignal(clamped)
  saveBpmToStorage(clamped)
}

export function initBpm(): void {
  _bpmValue = loadBpmFromStorage()
  setBpmSignal(_bpmValue)
}

// ── Practice ────────────────────────────────────────────────

const [practiceCount, setPracticeCount] = createSignal<number>(0)
const [lastScore, setLastScore] = createSignal<number | null>(null)
const [sessionItemRepeat, setSessionItemRepeat] = createSignal<number>(0)

export const currentSessionItemRepeat = sessionItemRepeat

// ── User Profile (for author attribution) ────────────────────

export function userProfile(): { name: string; email?: string } {
  return {
    name: 'User',
  }
}

// ── Grid ──────────────────────────────────────────────────────

const GRID_KEY = 'pitchperfect_grid'

function loadGridVisibility(): boolean {
  try {
    return localStorage.getItem(GRID_KEY) !== 'false'
  } catch {
    return true
  }
}
const [gridLinesVisible, setGridLinesVisible] =
  createSignal<boolean>(loadGridVisibility())

export function toggleGridLines(): void {
  const next = !gridLinesVisible()
  setGridLinesVisible(next)
  try {
    localStorage.setItem(GRID_KEY, String(next))
  } catch {
    /* empty */
  }
  window.dispatchEvent(
    new CustomEvent('pitchperfect:gridToggle', { detail: { visible: next } }),
  )
}

export function setGridLines(visible: boolean): void {
  setGridLinesVisible(visible)
  try {
    localStorage.setItem(GRID_KEY, String(visible))
  } catch {
    /* empty */
  }
  window.dispatchEvent(
    new CustomEvent('pitchperfect:gridToggle', { detail: { visible } }),
  )
}

// ── Active tab ───────────────────────────────────────────────

export type ActiveTab = 'practice' | 'editor' | 'settings'
const [activeTabGetter, _setActiveTab] = createSignal<ActiveTab>('practice')
export const activeTab = activeTabGetter
export const setActiveTab = _setActiveTab

// Editor view within the Editor tab
export type EditorView = 'piano-roll' | 'session-editor'
const [editorViewGetter, _setEditorView] = createSignal<EditorView>('piano-roll')
export const editorView = editorViewGetter
export const setEditorView = _setEditorView

// ── Library Modal ───────────────────────────────────────────

const [showLibraryModal, setShowLibraryModal] = createSignal<boolean>(false)
const [showSessionLibraryModal, setShowSessionLibraryModal] =
  createSignal<boolean>(false)
const [showPresetsModal, setShowPresetsModal] = createSignal<boolean>(false)
export function showLibrary(): void {
  setShowLibraryModal(true)
}
export function hideLibrary(): void {
  setShowLibraryModal(false)
}
export function showSessionLibrary(): void {
  setShowSessionLibraryModal(true)
}
export function hideSessionLibrary(): void {
  setShowSessionLibraryModal(false)
}
export function showPresetsLibrary(): void {
  setShowPresetsModal(true)
}
export function hidePresetsLibrary(): void {
  setShowPresetsModal(false)
}
export const isLibraryModalOpen = showLibraryModal
export const isSessionLibraryModalOpen = showSessionLibraryModal
export const isPresetsModalOpen = showPresetsModal

// ── Focus Mode ─────────────────────────────────────────────────
const [focusModeGetter, _setFocusMode] = createSignal<boolean>(false)
export const focusMode = focusModeGetter
export const setFocusMode = _setFocusMode as any
export function enterFocusMode(): void {
  setFocusMode(true)
}
export function exitFocusMode(): void {
  ;(_setFocusMode as unknown as (val: boolean) => void)(false)
  ;(window as any).__exitFocusMode = exitFocusMode
}

// ── Welcome Screen (GH #131) ────────────────────────────────────
const WELCOME_KEY = 'pitchperfect_welcome_version'
const APP_VERSION = '0.1'

function shouldShowWelcome(): boolean {
  try {
    const shown = localStorage.getItem(WELCOME_KEY)
    // Show welcome on first visit or if version changed
    return shown !== APP_VERSION
  } catch {
    return true
  }
}

const [showWelcome, setShowWelcome] = createSignal(shouldShowWelcome())

export function dismissWelcome(): void {
  setShowWelcome(false)
  try {
    localStorage.setItem(WELCOME_KEY, APP_VERSION)
  } catch {
    /* empty */
  }
}

// ── Walkthrough Tutorial (GH #140, GH #199) ────────────────────
export interface WalkthroughStep {
  title: string
  targetSelector: string
  description: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** Section this step belongs to (for grouping/skipping) */
  section?: string
  /** If set, switch to this tab before showing the step */
  requiredTab?: ActiveTab
}

export interface WalkthroughSection {
  id: string
  title: string
  description: string
}

/** Check if there are remaining walkthroughs (not yet completed) */
export function hasRemainingWalkthroughs(): boolean {
  const remaining = getRemainingWalkthroughs()
  return remaining.length > 0
}

/** Check how many walkthroughs are completed */
export function getCompletedWalkthroughCount(): number {
  return getCompletedCount()
}

export const GUIDE_SECTIONS: WalkthroughSection[] = [
  {
    id: 'practice',
    title: 'Practice Tab',
    description: 'Mic, playback controls, pitch display, and scoring',
  },
  {
    id: 'toolbar',
    title: 'Toolbar',
    description: 'BPM, volume, play modes, and more',
  },
  {
    id: 'editor',
    title: 'Editor Tab',
    description: 'Build and edit melodies note by note',
  },
  {
    id: 'settings',
    title: 'Settings Tab',
    description: 'Pitch detection, accuracy bands, and theme',
  },
]

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  // ── Practice Section ──
  {
    title: 'Welcome to PitchPerfect',
    targetSelector: '#app-title',
    description:
      "PitchPerfect helps you practice and improve your musical pitch. Let's take a quick tour of the main features!",
    placement: 'bottom',
    section: 'practice',
    requiredTab: 'practice',
  },
  {
    title: 'Scale & Key',
    targetSelector: '#scale-info',
    description:
      'Choose your musical key and scale type here. The piano roll updates to match your selection automatically.',
    placement: 'right',
    section: 'practice',
    requiredTab: 'practice',
  },
  {
    title: 'Load a Melody',
    targetSelector: '.library-tab',
    description:
      'Load a preset melody from the library, import a MIDI file, or record your own. Presets give you a great head start.',
    placement: 'right',
    section: 'practice',
    requiredTab: 'practice',
  },
  {
    title: 'Mic Button',
    targetSelector: '#btn-mic',
    description:
      'Tap to activate your microphone. The app detects your pitch in real time as you sing.',
    placement: 'bottom',
    section: 'practice',
    requiredTab: 'practice',
  },
  {
    title: 'Play / Pause / Stop',
    targetSelector: '.essential-controls',
    description:
      'Play starts the backing track, Pause halts it temporarily, and Stop returns to the beginning.',
    placement: 'bottom',
    section: 'practice',
    requiredTab: 'practice',
  },
  {
    title: 'Practice Mode',
    targetSelector: '#practice-panel',
    description:
      'In Practice mode, play a melody and sing along. The app detects your pitch in real time and scores your accuracy.',
    placement: 'right',
    section: 'practice',
    requiredTab: 'practice',
  },

  // ── Toolbar Section ──
  {
    title: 'BPM Control',
    targetSelector: '#bpm-input',
    description:
      'Adjust the tempo with the number input or slider. Faster or slower practice speeds suit different comfort levels.',
    placement: 'bottom',
    section: 'toolbar',
    requiredTab: 'practice',
  },
  {
    title: 'Volume & Speed',
    targetSelector: '#volume',
    description:
      'Control the backing track volume and playback speed. Slower speeds help with difficult passages.',
    placement: 'bottom',
    section: 'toolbar',
    requiredTab: 'practice',
  },
  {
    title: 'Play Modes',
    targetSelector: '#btn-once',
    description:
      '"Once" plays a single cycle, "Repeat" loops continuously, and "Practice" runs your session in sequence.',
    placement: 'bottom',
    section: 'toolbar',
    requiredTab: 'practice',
  },
  {
    title: 'Count-In & Cycles',
    targetSelector: '#countin-display',
    description:
      'Set how many beats of count-in you want before playback starts, and how many cycles to run in Practice mode.',
    placement: 'bottom',
    section: 'toolbar',
    requiredTab: 'practice',
  },

  // ── Editor Section ──
  {
    title: 'Editor Tab',
    targetSelector: '#editor-panel',
    description:
      'The Editor tab lets you build and modify melodies. Click to switch here to explore.',
    placement: 'bottom',
    section: 'editor',
    requiredTab: 'editor',
  },
  {
    title: 'Piano Roll',
    targetSelector: '.piano-roll-container',
    description:
      'Click on the grid to add notes. Drag them to adjust pitch or timing. Right-click a note to delete it.',
    placement: 'bottom',
    section: 'editor',
    requiredTab: 'editor',
  },
  {
    title: 'Record to Piano Roll',
    targetSelector: '#record-btn',
    description:
      'Hit Record, sing into your mic, and your pitch gets captured as notes on the piano roll.',
    placement: 'bottom',
    section: 'editor',
    requiredTab: 'editor',
  },
  {
    title: 'Save Melody',
    targetSelector: '#save-melody-btn',
    description:
      'Save your melody to the library so you can load it later in Practice mode.',
    placement: 'bottom',
    section: 'editor',
    requiredTab: 'editor',
  },
  {
    title: 'Editor Toolbar',
    targetSelector: '#key-select',
    description:
      'Change key, scale, BPM, and sensitivity directly from the editor toolbar before recording or editing.',
    placement: 'bottom',
    section: 'editor',
    requiredTab: 'editor',
  },

  // ── Settings Section ──
  {
    title: 'Settings Tab',
    targetSelector: '#settings-panel',
    description:
      'Fine-tune pitch detection, accuracy scoring, and the app appearance. Click to switch to Settings.',
    placement: 'bottom',
    section: 'settings',
    requiredTab: 'settings',
  },
  {
    title: 'Pitch Detection',
    targetSelector: '#set-sensitivity',
    description:
      'Adjust sensitivity, threshold, and confidence to match your voice and environment. Lower sensitivity reduces false triggers.',
    placement: 'left',
    section: 'settings',
    requiredTab: 'settings',
  },
  {
    title: 'Practice Aids',
    targetSelector: '#set-tonic-anchor',
    description:
      'Tonic anchor gives a reference tone before singing, helping you stay in key.',
    placement: 'left',
    section: 'settings',
    requiredTab: 'settings',
  },
  {
    title: 'Accuracy Bands',
    targetSelector: '#band-perfect',
    description:
      'Customize the cent-threshold for each accuracy band. Tighter bands are more challenging.',
    placement: 'left',
    section: 'settings',
    requiredTab: 'settings',
  },
  {
    title: 'Theme & Appearance',
    targetSelector: '#vis-theme',
    description:
      'Switch between light and dark themes, toggle grid lines, and adjust the visual style.',
    placement: 'left',
    section: 'settings',
    requiredTab: 'settings',
  },
  {
    title: 'Reverb & ADSR',
    targetSelector: '#reverb-type',
    description:
      'Add reverb for a richer sound, or tweak ADSR envelope for more natural-sounding notes.',
    placement: 'left',
    section: 'settings',
    requiredTab: 'settings',
  },
]

const WALKTHROUGH_KEY = 'pitchperfect_walkthrough_done'
const GUIDE_SECTIONS_KEY = 'pitchperfect_guide_sections'
const [walkthroughActive, setWalkthroughActive] = createSignal(false)
const [walkthroughStep, setWalkthroughStep] = createSignal(0)

/** Loaded steps for the current tour (may be all or a subset) */
const [_tourSteps, setTourSteps] = createSignal<WalkthroughStep[]>(WALKTHROUGH_STEPS)
export const tourSteps = _tourSteps

/** Which sections have been completed */
function loadGuideSections(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(GUIDE_SECTIONS_KEY)
    if (stored !== null) return JSON.parse(stored)
  } catch { /* */ }
  return {}
}

function saveGuideSections(secs: Record<string, boolean>): void {
  try {
    localStorage.setItem(GUIDE_SECTIONS_KEY, JSON.stringify(secs))
  } catch { /* */ }
}

export function isGuideSectionCompleted(sectionId: string): boolean {
  return loadGuideSections()[sectionId] || false
}

export function getIncompleteGuideSections(): WalkthroughSection[] {
  const completed = loadGuideSections()
  return GUIDE_SECTIONS.filter(s => !completed[s.id])
}

function markGuideSectionCompleted(sectionId: string): void {
  const completed = loadGuideSections()
  completed[sectionId] = true
  saveGuideSections(completed)
}

/** Build step list from given section IDs */
function buildStepsFromSections(sectionIds: string[]): WalkthroughStep[] {
  return WALKTHROUGH_STEPS.filter(step => sectionIds.includes(step.section ?? ''))
}

/** Start full guide tour or specific sections */
export function startWalkthrough(sectionIds?: string[]): void {
  const sections = sectionIds ?? GUIDE_SECTIONS.map(s => s.id)
  const steps = buildStepsFromSections(sections)
  if (steps.length === 0) return
  setTourSteps(steps)
  setWalkthroughActive(true)
  setWalkthroughStep(0)
}

export function nextWalkthroughStep(): void {
  const steps = tourSteps()
  if (walkthroughStep() < steps.length - 1) {
    setWalkthroughStep((s) => s + 1)
  } else {
    endWalkthrough()
  }
}

/** Skip to the next section, or end if last */
export function skipSection(): void {
  const steps = tourSteps()
  const current = steps[walkthroughStep()]
  if (current === null || current === undefined) {
    endWalkthrough()
    return
  }
  const currentSection = current.section
  if (currentSection === null || currentSection === undefined || currentSection === '') {
    endWalkthrough()
    return
  }
  markGuideSectionCompleted(currentSection)
  // Find first step in a later section
  const nextIdx = steps.findIndex((s, i) => i > walkthroughStep() && s.section !== currentSection)
  if (nextIdx >= 0) {
    setWalkthroughStep(nextIdx)
  } else {
    endWalkthrough()
  }
}

export function prevWalkthroughStep(): void {
  if (walkthroughStep() > 0) {
    setWalkthroughStep((s) => s - 1)
  }
}

export function endWalkthrough(): void {
  // Mark all remaining sections as completed when finishing the tour
  const steps = tourSteps()
  if (steps.length > 0 && walkthroughStep() >= 0) {
    const current = steps[walkthroughStep()]
    const sec = current?.section
    if (sec !== undefined && sec !== '') {
      markGuideSectionCompleted(sec)
    }
  }
  setWalkthroughActive(false)
  setWalkthroughStep(0)
  setTourSteps(WALKTHROUGH_STEPS)
  try {
    localStorage.setItem(WALKTHROUGH_KEY, '1')
  } catch {
    /* empty */
  }
}

export function isWalkthroughActive(): boolean {
  return walkthroughActive()
}

export function getWalkthroughStep(): number {
  return walkthroughStep()
}

// ── Sensitivity Presets ─────────────────────────────────────────

export type SensitivityPreset = 'quiet' | 'home' | 'noisy'

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

export function loadSensitivityPreset(): SensitivityPreset {
  try {
    const stored = localStorage.getItem('pitchperfect_sensitivity_preset')
    if (stored === 'quiet' || stored === 'home' || stored === 'noisy')
      return stored
  } catch {
    /* empty */
  }
  return 'noisy'
}

const [sensitivityPresetGetter, _setSensitivityPreset] =
  createSignal<SensitivityPreset>(loadSensitivityPreset())
export const sensitivityPreset = sensitivityPresetGetter

export function setSensitivityPresetValue(value: SensitivityPreset): void {
  _setSensitivityPreset(value)
  try {
    localStorage.setItem('pitchperfect_sensitivity_preset', value)
  } catch {
    /* empty */
  }
  window.dispatchEvent(
    new CustomEvent('pitchperfect:sensitivityPresetChange', {
      detail: { preset: value },
    }),
  )
}

export function applySensitivityPreset(preset: SensitivityPreset): void {
  const config = SENSITIVITY_PRESETS[preset]
  setSettings((s) => ({ ...s, ...config }))
  saveSettingsToStorage({ ...settings(), ...config })
  _setSensitivityPreset(preset)
  try {
    localStorage.setItem('pitchperfect_sensitivity_preset', preset)
  } catch {
    /* empty */
  }
  window.dispatchEvent(
    new CustomEvent('pitchperfect:sensitivityPresetChange', {
      detail: { preset },
    }),
  )
}

// ── Settings ───────────────────────────────────────────────────

const SETTINGS_KEY = 'pitchperfect_settings'

export interface SettingsConfig {
  detectionThreshold: number // 0.05–0.20 (default 0.10)
  sensitivity: number // 1–10 (default 5)
  minConfidence: number // 0.30–0.90 (default 0.50)
  minAmplitude: number // 1–10 (default 5)
  bands: AccuracyBand[]
  tonicAnchor: boolean // Play tonic reference tone before each run
}

const DEFAULT_BANDS: AccuracyBand[] = [
  { threshold: 0, band: 100, color: '#3fb950' },
  { threshold: 10, band: 90, color: '#58a6ff' },
  { threshold: 25, band: 75, color: '#2dd4bf' },
  { threshold: 50, band: 50, color: '#d29922' },
  { threshold: 999, band: 0, color: '#f85149' },
]

const DEFAULT_SETTINGS: SettingsConfig = {
  detectionThreshold: 0.1,
  sensitivity: 5,
  minConfidence: 0.3,
  minAmplitude: 1,
  bands: DEFAULT_BANDS,
  tonicAnchor: false,
}

const [settings, setSettings] = createSignal<SettingsConfig>(DEFAULT_SETTINGS)

function loadSettingsFromStorage(): SettingsConfig {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw !== null && raw !== undefined && raw !== ''
      ? JSON.parse(raw)
      : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettingsToStorage(data: SettingsConfig): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('Failed to save settings:', e)
  }
}

export function initSettings(): void {
  setSettings(loadSettingsFromStorage())
}

export function setDetectionThreshold(value: number): void {
  setSettings((s) => {
    const updated = {
      ...s,
      detectionThreshold: Math.max(0.05, Math.min(0.2, value)),
    }
    saveSettingsToStorage(updated)
    return updated
  })
}

export function setSensitivity(value: number): void {
  setSettings((s) => {
    const updated = { ...s, sensitivity: Math.max(1, Math.min(10, value)) }
    saveSettingsToStorage(updated)
    return updated
  })
}

export function setMinConfidence(value: number): void {
  setSettings((s) => {
    const updated = { ...s, minConfidence: Math.max(0.3, Math.min(0.9, value)) }
    saveSettingsToStorage(updated)
    return updated
  })
}

export function setMinAmplitude(value: number): void {
  setSettings((s) => {
    const updated = { ...s, minAmplitude: Math.max(1, Math.min(10, value)) }
    saveSettingsToStorage(updated)
    return updated
  })
}

export function setTonicAnchor(enabled: boolean): void {
  setSettings((s) => {
    const updated = { ...s, tonicAnchor: enabled }
    saveSettingsToStorage(updated)
    return updated
  })
}

export function setBand(index: number, threshold: number): void {
  setSettings((s) => {
    const bands = [...s.bands]
    // Keep sorted by threshold
    bands[index] = { ...bands[index], threshold }
    bands.sort((a, b) => a.threshold - b.threshold)
    const updated = { ...s, bands }
    saveSettingsToStorage(updated)
    return updated
  })
}

export function getBandRating(avgCents: number | null): number {
  const currentBands = settings().bands
  if (avgCents === null) return 0
  for (const b of currentBands) {
    if (avgCents <= b.threshold) return b.band
  }
  return 0
}

// ── PresetData Interface ─────────────────────────────────────────

export interface PresetData {
  notes: Array<{
    midi: number
    startBeat: number
    duration: number
    effectType?: string
    linkedTo?: number[]
  }>
  totalBeats: number
  bpm: number
  scale: Array<{ midi: number; name: string; octave: number; freq: number }>
}

// ── ADSR Envelope ─────────────────────────────────────────────

export interface ADSRConfig {
  attack: number // 0–1000 ms (default 10)
  decay: number // 0–1000 ms (default 100)
  sustain: number // 0–100 (percentage, default 70)
  release: number // 0–2000 ms (default 200)
}

const ADSR_KEY = 'pitchperfect_adsr'
const DEFAULT_ADSR: ADSRConfig = {
  attack: 10,
  decay: 100,
  sustain: 70,
  release: 200,
}

function loadADSRFromStorage(): ADSRConfig {
  try {
    const raw = localStorage.getItem(ADSR_KEY)
    return raw !== null && raw !== undefined && raw !== ''
      ? JSON.parse(raw)
      : DEFAULT_ADSR
  } catch {
    return DEFAULT_ADSR
  }
}

const [adsr, setAdsr] = createSignal<ADSRConfig>(loadADSRFromStorage())

function saveADSRToStorage(data: ADSRConfig): void {
  try {
    localStorage.setItem(ADSR_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('Failed to save ADSR settings:', e)
  }
}

export function initADSR(): void {
  setAdsr(loadADSRFromStorage())
}

export function setAttack(value: number): void {
  setAdsr((a) => {
    const updated = { ...a, attack: Math.max(0, Math.min(1000, value)) }
    saveADSRToStorage(updated)
    return updated
  })
}

export function setDecay(value: number): void {
  setAdsr((a) => {
    const updated = { ...a, decay: Math.max(0, Math.min(1000, value)) }
    saveADSRToStorage(updated)
    return updated
  })
}

export function setSustain(value: number): void {
  setAdsr((a) => {
    const updated = { ...a, sustain: Math.max(0, Math.min(100, value)) }
    saveADSRToStorage(updated)
    return updated
  })
}

export function setRelease(value: number): void {
  setAdsr((a) => {
    const updated = { ...a, release: Math.max(0, Math.min(2000, value)) }
    saveADSRToStorage(updated)
    return updated
  })
}

// ── Reverb / Effects ────────────────────────────────────────

export type ReverbType = 'off' | 'room' | 'hall' | 'cathedral'

export interface ReverbConfig {
  wetness: number // 0–100 (percentage)
  type: ReverbType
}

const REVERB_KEY = 'pitchperfect_reverb'
const DEFAULT_REVERB: ReverbConfig = {
  wetness: 30,
  type: 'room',
}

function loadReverbFromStorage(): ReverbConfig {
  try {
    const raw = localStorage.getItem(REVERB_KEY)
    return raw !== null && raw !== undefined && raw !== ''
      ? JSON.parse(raw)
      : DEFAULT_REVERB
  } catch {
    return DEFAULT_REVERB
  }
}

const [reverbConfig, setReverbConfigSignal] = createSignal<ReverbConfig>(
  loadReverbFromStorage(),
)

function saveReverbToStorage(data: ReverbConfig): void {
  try {
    localStorage.setItem(REVERB_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('Failed to save reverb settings:', e)
  }
}

export function initReverb(): void {
  setReverbConfigSignal(loadReverbFromStorage())
}

export function setReverbWetness(value: number): void {
  setReverbConfigSignal((c) => {
    const updated = { ...c, wetness: Math.max(0, Math.min(100, value)) }
    saveReverbToStorage(updated)
    return updated
  })
}

export function setReverbType(type: ReverbType): void {
  setReverbConfigSignal((c) => {
    const updated = { ...c, type }
    saveReverbToStorage(updated)
    return updated
  })
}

// ── Playback Speed ──────────────────────────────────────────

const PLAYBACK_SPEED_KEY = 'pitchperfect_playback_speed'
const [playbackSpeed, setPlaybackSpeedSignal] = createSignal<number>(1.0)

function loadPlaybackSpeed(): number {
  try {
    const stored = localStorage.getItem(PLAYBACK_SPEED_KEY)
    if (stored !== null && stored !== undefined && stored !== '') {
      const speed = parseFloat(stored)
      if (!isNaN(speed) && speed >= 0.25 && speed <= 2.0) return speed
    }
  } catch {
    /* empty */
  }
  return 1.0
}

export function initPlaybackSpeed(): void {
  setPlaybackSpeedSignal(loadPlaybackSpeed())
}

export function setPlaybackSpeed(speed: number): void {
  const clamped = Math.max(0.25, Math.min(2.0, speed))
  setPlaybackSpeedSignal(clamped)
  try {
    localStorage.setItem(PLAYBACK_SPEED_KEY, String(clamped))
  } catch {
    /* empty */
  }
}

// ── Notifications ────────────────────────────────────────────

interface Notification {
  id: number
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

const [notifications, setNotifications] = createSignal<Notification[]>([])

/** Get current notifications */
export function getNotifications() {
  return notifications
}

let _notifId = 0

export function showNotification(
  message: string,
  type: Notification['type'] = 'info',
): void {
  const id = ++_notifId
  setNotifications((n) => [...n, { id, message, type }])
  setTimeout(() => {
    setNotifications((n) => n.filter((x) => x.id !== id))
  }, 3000)
}

// ── Practice Session State ────────────────────────────────────

const [practiceSession, setPracticeSession] =
  createSignal<PracticeSession | null>(null)
const [sessionItemIndex, setSessionItemIndex] = createSignal(0)
const [sessionActive, setSessionActive] = createSignal(false)
const [sessionResults, setSessionResults] = createSignal<SessionResult[]>([])
const [sessionModeSignal, setSessionMode] = createSignal(false) // true when in session flow

// Export signal getters for public access
export const currentSessionItemIndex = sessionItemIndex
export const sessionMode = sessionModeSignal

const SESSION_RESULTS_KEY = 'pitchperfect_session_results'

function loadSessionResults(): SessionResult[] {
  try {
    const raw = localStorage.getItem(SESSION_RESULTS_KEY)
    return raw !== null && raw !== undefined && raw !== ''
      ? JSON.parse(raw)
      : []
  } catch {
    return []
  }
}

function saveSessionResultsToStorage(data: SessionResult[]): void {
  try {
    localStorage.setItem(SESSION_RESULTS_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('Failed to save session results:', e)
  }
}

export function initSessionHistory(): void {
  setSessionHistory(loadSessionHistory())
  // Also load session results into reactive store
  setSessionResults(loadSessionResults().slice(0, 5))
}

export function getCurrentSessionItem(): PracticeSession['items'][0] | null {
  const session = practiceSession()
  if (!session) return null
  const idx = sessionItemIndex()
  if (idx < 0 || idx >= session.items.length) return null
  return session.items[idx]
}

export function getSessionItems(): PracticeSession['items'] {
  const session = practiceSession()
  return session?.items ?? []
}

export function getCurrentSessionItemIndex(): number {
  return sessionItemIndex()
}

export function advanceSessionItem(): void {
  const session = practiceSession()
  if (!session) return
  const currentItem = getCurrentSessionItem()
  const repeatCount = currentItem?.repeat ?? 1
  const currentRepeat = sessionItemRepeat()
  if (currentRepeat < repeatCount - 1) {
    // Repeat this item
    setSessionItemRepeat(currentRepeat + 1)
  } else {
    // Move to next item
    const next = sessionItemIndex() + 1
    if (next < session.items.length) {
      setSessionItemIndex(next)
      setSessionItemRepeat(0)
    }
  }
}

export function recordSessionItemResult(score: number): void {
  const session = practiceSession()
  if (!session) return
  setSessionResults((prev) => {
    const results: SessionResult[] = [...prev]
    results.push({
      sessionId: session.id,
      name: session.name,
      sessionName: session.name,
      completedAt: Date.now(),
      itemsCompleted: sessionItemIndex(),
      totalItems: session.items.length,
      score,
    })
    return results
  })
}

export function endPracticeSession(): SessionResult | null {
  const session = practiceSession()
  if (!session) return null

  const scores = sessionResults()
  const totalScore =
    scores.length > 0
      ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length)
      : 0

  const result: SessionResult = {
    sessionId: session.id,
    name: session.name,
    sessionName: session.name,
    completedAt: Date.now(),
    itemsCompleted: scores.length,
    totalItems: session.items.length,
    score: totalScore,
  }

  // Persist to localStorage
  const existing = loadSessionResults()
  saveSessionResultsToStorage([result, ...existing].slice(0, 50))

  // Update reactive store for sidebar display
  setSessionResults([result, ...sessionResults()].slice(0, 5))

  setSessionActive(false)
  setPracticeSession(null)
  setSessionItemIndex(0)
  setSessionItemRepeat(0)
  setSessionMode(false)
  // Don't clear sessionResults - sidebar needs to display history

  return result
}

// ── User Session (unified session model) ────────────────────

const [userSession, setUserSession] = createSignal<Session | null>(null)
const [selectedMelodyIds, setSelectedMelodyIds] = createSignal<string[]>([])

export function setActiveUserSession(session: Session | null): void {
  setUserSession(session)
  setSelectedMelodyIds([])
}

export function getUserSession(): Session | null {
  return userSession()
}

export function getSelectedMelodyIds(): string[] {
  return selectedMelodyIds()
}

export function toggleMelodySelection(melodyId: string): void {
  setSelectedMelodyIds((prev) =>
    prev.includes(melodyId)
      ? prev.filter((id) => id !== melodyId)
      : [...prev, melodyId],
  )
}

export function selectAllMelodies(): void {
  const session = userSession()
  if (session && session.items.length > 0) {
    // Extract melody IDs from session items
    const melodyIds = session.items
      .filter((item) => item.melodyId !== null)
      .map((item) => item.melodyId!)
    setSelectedMelodyIds(melodyIds)
  }
}

export function clearMelodySelection(): void {
  setSelectedMelodyIds([])
}

let recursionDepth = 0
const MAX_RECURSION = 10

/** Build MelodyItems for a single session item (for sequential playback) */
export function buildSessionItemMelody(item: SessionItem): MelodyItem[] {
  const fallbackNote: MelodyNote = { midi: 60, name: 'C', octave: 4, freq: 261.63 }

  if (item.type === 'scale') {
    const scaleType = item.scaleType ?? 'major'
    const beats = item.beats ?? 8
    const numOctaves = beats > 12 ? 2 : 1
    const currentOctave = melodyStore.getCurrentOctave()
    const scale = buildMultiOctaveScale(keyName(), currentOctave, numOctaves, scaleType)

    if (scale.length > 0) {
      const numNotes = Math.min(scale.length, beats)
      return scale.slice(0, numNotes).map((note, i) => ({
        id: melodyStore.generateId(),
        note: {
          midi: note.midi,
          name: note.name as NoteName,
          octave: note.octave,
          freq: note.freq,
        },
        startBeat: i,
        duration: 1,
      }))
    }
    return [
      {
        id: melodyStore.generateId(),
        startBeat: item.startBeat ?? 0,
        duration: beats,
        note: fallbackNote,
      },
    ]
  }

  if (item.type === 'melody' || item.type === 'preset') {
    const melodyId = item.melodyId
    // If items are directly embedded, use them
    if (item.items && item.items.length > 0) {
      return item.items
    }
    // Otherwise look up in library
    if (melodyId !== undefined && melodyId !== null && melodyId.length > 0) {
      const library = getMelodyLibrary()
      const melodyData = library.melodies[melodyId]
      const melodyItems = melodyData?.items
      if (Array.isArray(melodyItems) && melodyItems.length > 0) {
        return melodyItems.map((libItem) => ({
          id: libItem.id,
          note: libItem.note,
          startBeat: (item.startBeat ?? 0) + libItem.startBeat,
          duration: libItem.duration,
        }))
      }
    }
  }

  return [
    {
      id: melodyStore.generateId(),
      startBeat: item.startBeat ?? 0,
      duration: 8,
      note: fallbackNote,
    },
  ]
}

export function startPracticeSession(
  session: PracticeSession | SessionTemplate,
): void {
  recursionDepth++
  if (recursionDepth > MAX_RECURSION) {
    console.error(
      '[CRASH] Too many recursion calls detected! Aborting:',
      recursionDepth,
    )
    recursionDepth = 0
    return
  }
  console.log('[startPracticeSession] called, recursionDepth:', recursionDepth)

  // Convert SessionTemplate to PracticeSession if needed
  const practiceSession: PracticeSession =
    'mode' in session
      ? (session as PracticeSession)
      : {
          ...session,
          mode: 'practice',
          cycles: 1,
          scale: {
            name: 'major',
            degrees: [0, 2, 4, 5, 7, 9, 11],
            description: '',
          },
          currentCycle: 1,
          beatsPerMeasure: 4,
          isRecording: false,
          noteResults: [],
          score: 0,
          duration: 0,
          completedAt: 0,
          itemsCompleted: 0,
        }

  setPracticeSession(practiceSession)
  setSessionItemIndex(0)
  setSessionItemRepeat(0)
  setSessionActive(true)
  console.log('[startPracticeSession] setSessionActive(true)')
  setSessionMode(true)
  console.log(
    '[startPracticeSession] setSessionMode(true), recursionDepth:',
    recursionDepth,
  )
  setSessionResults([])

  // Initialize melody for playback — only load the FIRST item (sequential mode)
  const firstItem = practiceSession.items[0]
  if (firstItem !== undefined && firstItem.type !== 'rest') {
    const activeMelody = buildSessionItemMelody(firstItem)
    melodyStore.setMelody(activeMelody)
  }
  melodyStore.setCurrentNoteIndex(-1)

  recursionDepth = 0
}

export function loadAndPlayMelody(key: string): void {
  console.log('[loadAndPlayMelody] loading melody with key:', key)
  // Load melody from library
  const melody = melodyStore.loadMelody(key)
  if (melody === null) {
    console.log('[loadAndPlayMelody] melody not found, key:', key)
    return
  }
  console.log('[loadAndPlayMelody] melody loaded:', melody.name)
  // Set app store values from melody data
  const clampedBpm = Math.max(40, Math.min(280, melody.bpm))
  _bpmValue = clampedBpm
  setBpmSignal(clampedBpm)
  saveBpmToStorage(clampedBpm)
  setKeyName(melody.key)
  setScaleType(melody.scaleType)
  if (melody.octave !== undefined) {
    // Set octave in appStore if there's a setter
    const octaveSetters = Object.keys(appStore).filter((k) =>
      k.toLowerCase().includes('octave'),
    )
    octaveSetters.forEach((k) => {
      const setter = (appStore as any)[k]
      if (typeof setter === 'function') setter(melody.octave)
    })
  }
  // Signal app to auto-play after load
  console.log('[loadAndPlayMelody] setting window.__autoPlayMelody:', key)
  if (typeof window !== 'undefined') {
    ;(window as unknown as { __autoPlayMelody?: string }).__autoPlayMelody = key
  }
}

export function isInSessionMode(): boolean {
  return sessionMode()
}

export function getSessionHistoryEntries(): SessionResult[] {
  return loadSessionResults()
}

// ── Session History ──────────────────────────────────────────

export interface SessionHistoryEntry {
  id: number
  timestamp: number
  score: number
  avgCents: number
  noteCount: number
  noteResults: Array<{ midi: number; avgCents: number; rating: string }>
}

const SESSION_HISTORY_KEY = 'pitchperfect_session_history'
const MAX_HISTORY_ENTRIES = 50

const [sessionHistory, setSessionHistory] = createSignal<SessionHistoryEntry[]>(
  [],
)

function loadSessionHistory(): SessionHistoryEntry[] {
  try {
    const raw = localStorage.getItem(SESSION_HISTORY_KEY)
    if (raw !== null && raw !== '') {
      return JSON.parse(raw)
    }
  } catch {
    // Return empty array if parsing fails
  }
  return []
}

function saveSessionHistoryToStorage(data: SessionHistoryEntry[]): void {
  try {
    localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('Failed to save session history:', e)
  }
}

export function saveSession(
  entry: Omit<SessionHistoryEntry, 'id' | 'timestamp'>,
): void {
  const id = Date.now()
  const newEntry: SessionHistoryEntry = { ...entry, id, timestamp: Date.now() }
  const prev = sessionHistory()
  const prevLimit = Math.max(0, MAX_HISTORY_ENTRIES - 1)
  const updated = [newEntry, ...prev.slice(0, prevLimit)]
  setSessionHistory(updated)
  saveSessionHistoryToStorage(updated)
}

export function clearSessionHistory(): void {
  setSessionHistory([])
  localStorage.removeItem(SESSION_HISTORY_KEY)
}

export function getSessionHistory(): SessionHistoryEntry[] {
  return sessionHistory()
}

// Compute per-note accuracy map from session history (midi -> avg score %)
export function getNoteAccuracyMap(): Map<number, number> {
  const accMap = new Map<number, number[]>()
  for (const entry of sessionHistory()) {
    for (const nr of entry.noteResults) {
      if (!accMap.has(nr.midi)) accMap.set(nr.midi, [])
      accMap
        .get(nr.midi)!
        .push(
          nr.avgCents >= -5
            ? 100
            : Math.max(0, 100 - Math.abs(nr.avgCents) * 5),
        )
    }
  }
  const result = new Map<number, number>()
  for (const [midi, scores] of accMap) {
    result.set(
      midi,
      Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    )
  }
  return result
}

// ============================================================
// User Session Library Bridge
// ============================================================

export function loadSession(session: SavedUserSession): void {
  console.log('[appStore] loadSession called with session:', session.id)
  if (session.items.length === 0) {
    appStore.showNotification('Session has no items', 'warning')
    return
  }

  // Reset session state
  setSessionActive(false)
  console.log('[appStore] setSessionActive(false), current:', sessionActive())
  setSessionMode(false)
  console.log('[appStore] setSessionMode(false), current:', sessionMode())

  // Load first item and set as current session
  console.log('[appStore] calling startPracticeSession')
  startPracticeSession({
    id: session.id,
    name: session.name,
    difficulty: session.difficulty ?? 'beginner',
    category: session.category ?? 'custom',
    items: session.items,
  })

  // Also set the user session so sidebar shows session melodies
  const userSessionData: SavedUserSession = {
    id: session.id,
    name: session.name,
    description: session.description ?? '',
    items: session.items,
    deletable: session.deletable ?? true,
    created: session.created ?? Date.now(),
  }
  setActiveUserSession(userSessionData)
  console.info(
    '[appStore] set userSession:',
    session.id,
    'sessionMode:',
    sessionMode(),
  )
}

// ── PresetData Presets Bridge (legacy support - functions are no-ops) ───────

function setCurrentPresetName(name: string | null): void {
  // Legacy preset name is no longer used - set currentMelody.name instead
  if (name !== null) {
    // Try to set the current melody's name via melodyStore
    const currentMelody = melodyStore.getCurrentMelody()
    if (currentMelody !== null) {
      melodyStore.updateMelody(currentMelody.id, { name })
    }
  }
}

export const appStore = {
  // Key / scale
  keyName,
  setKeyName,
  scaleType,
  setScaleType,
  currentSessionItemIndex,
  currentSessionItemRepeat,
  setSessionItemIndex,
  setSessionItemRepeat,

  // Instrument
  instrument,
  setInstrument,

  // Recording
  isRecording,
  setIsRecording,

  // Mic
  micActive,
  setMicActive,
  micWaveVisible,
  setMicWaveVisible,
  toggleMicWaveVisible,
  micError,
  setMicError,

  // Practice
  practiceCount,
  setPracticeCount,
  lastScore,
  setLastScore,

  // Count-in
  countIn,
  setCountIn,

  // Navigation
  activeTab,
  setActiveTab,

  // Library Modals
  isLibraryModalOpen,
  showLibrary,
  hideLibrary,
  isSessionLibraryModalOpen,
  showSessionLibrary,
  hideSessionLibrary,
  isPresetsModalOpen,
  showPresetsLibrary,
  hidePresetsLibrary,

  // Focus Mode
  focusMode,
  enterFocusMode,
  exitFocusMode,

  // Welcome Screen
  showWelcome,
  dismissWelcome,

  // Grid
  gridLinesVisible,
  toggleGridLines,
  setGridLines,

  // Notifications
  notifications,
  showNotification,

  // Session History
  sessionHistory,
  initSessionHistory,
  saveSession,
  clearSessionHistory,
  getSessionHistory,
  getNoteAccuracyMap,

  // Presets (bridge for backward compatibility)
  // Note: Legacy presets signal is kept for compatibility with existing code
  presets: () => ({}) as any, // Return empty object - legacy support only
  currentPresetName: () => null,
  setCurrentPresetName,
  initPresets: () => {}, // No-op - presets now handled by melodyStore
  savePreset: () => {}, // No-op - presets now handled by melodyStore
  loadPreset: () => null, // No-op - presets now handled by melodyStore
  getPresetNames: () => [], // No-op - presets now handled by melodyStore
  deletePreset: () => {}, // No-op - presets now handled by melodyStore
  _resetPresets: () => {}, // No-op - presets now handled by melodyStore

  // User Session Library
  loadSession,
  setTempo: setBpm,
  setOctave: melodyStore.setOctave,
  loadAndPlayMelody,

  // Settings
  settings,
  initSettings,
  setDetectionThreshold,
  setSensitivity,
  setMinConfidence,
  setMinAmplitude,
  setTonicAnchor,
  setBand,
  getBandRating,

  // Sensitivity Presets
  SENSITIVITY_PRESETS,
  applySensitivityPreset,
  sensitivityPreset,

  // BPM
  bpm,
  setBpm,
  initBpm,

  // Theme
  theme,
  setTheme,
  toggleTheme,
  initTheme,

  // ADSR Envelope
  adsr,
  initADSR,
  setAttack,
  setDecay,
  setSustain,
  setRelease,

  // Reverb / Effects
  reverb: reverbConfig,
  initReverb,
  setReverbWetness,
  setReverbType,

  // Playback Speed
  playbackSpeed,
  initPlaybackSpeed,
  setPlaybackSpeed,

  // Session Results
  sessionResults,

  // Session state (signals)
  sessionActive,
  setSessionActive,
  sessionItemIndex,
  getCurrentSessionItemIndex,
  getSessionItems,
  practiceSession,
  sessionMode,
  getCurrentSessionItem,
  startPracticeSession,
  advanceSessionItem,
  recordSessionItemResult,
  endPracticeSession,
  buildSessionItemMelody,
  isInSessionMode,

  // User Session
  userSession,
  setActiveUserSession,
  getUserSession,
  getSelectedMelodyIds,
  toggleMelodySelection,
  selectAllMelodies,
  clearMelodySelection,

  // Walkthrough (GH #140, #199)
  walkthroughActive,
  walkthroughStep,
  tourSteps,
  startWalkthrough,
  nextWalkthroughStep,
  prevWalkthroughStep,
  skipSection,
  endWalkthrough,
  isWalkthroughActive,
  getWalkthroughStep,
  hasRemainingWalkthroughs,
  getCompletedWalkthroughCount,
  isGuideSectionCompleted,
  getIncompleteGuideSections,

  // Melody (for LibraryModal)
  createPlaylist: melodyStore.createPlaylist,
  deletePlaylist: melodyStore.deletePlaylist,
  createNewMelody: melodyStore.createNewMelody,
}
