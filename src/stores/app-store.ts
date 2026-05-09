import { createSignal } from 'solid-js'
import { TAB_COMPOSE, TAB_SETTINGS, TAB_SINGING, } from '@/features/tabs/constants'
import { AudioEngine } from '@/lib/audio-engine'
import { IS_DEV } from '@/lib/defaults'
import { getCompletedCount, getRemainingWalkthroughs, } from '@/stores/walkthrough-store'
import type { ActiveTab } from './ui-store'

// ── Key / Scale / Presets ──────────────────────────────────

export const [keyName, setKeyName] = createSignal<string>('C')
export const [scaleType, setScaleType] = createSignal<string>('major')
export const [instrument, setInstrument] = createSignal<InstrumentType>('sine')

export type InstrumentType = 'sine' | 'piano' | 'organ' | 'strings' | 'synth'

// ── UVR (Vocal Separation) ─────────────────────────────────────

export type UvrMode = 'separate' | 'instrumental' | 'vocal' | 'duo'

export interface UvrSettings {
  mode: UvrMode
  vocalIntensity: number // 0-100%
  instrumentalIntensity: number // 0-100%
  smoothing: number // 0-1
}

const DEFAULT_UVR_SETTINGS: UvrSettings = {
  mode: 'separate',
  vocalIntensity: 70,
  instrumentalIntensity: 70,
  smoothing: 0.3,
}

export function getUvrSettings(): UvrSettings {
  const saved = localStorage.getItem('pitchperfect_uvr-settings')
  if (saved !== null) {
    try {
      return { ...DEFAULT_UVR_SETTINGS, ...JSON.parse(saved) }
    } catch {
      // Return defaults on parse error
    }
  }
  return DEFAULT_UVR_SETTINGS
}

export function setUvrSettings(settings: Partial<UvrSettings>): void {
  const current = getUvrSettings()
  const newSettings: UvrSettings = {
    ...current,
    ...settings,
  }
  localStorage.setItem('pitchperfect_uvr-settings', JSON.stringify(newSettings))
}

export const [uvrMode, setUvrMode] = createSignal<UvrMode>('separate')
export const [uvrVocalIntensity, _setUvrVocalIntensity] = createSignal(70)
export const [uvrInstrumentalIntensity, _setUvrInstrumentalIntensity] =
  createSignal(70)
export const [uvrSmoothing, _setUvrSmoothing] = createSignal(0.3)

// Export for direct usage in components (internal setters that also persist)
export const setUvrVocalIntensity = (intensity: number): void => {
  _setUvrVocalIntensity(intensity)
  setUvrSettings({ vocalIntensity: intensity })
}

export const setUvrInstrumentalIntensity = (intensity: number): void => {
  _setUvrInstrumentalIntensity(intensity)
  setUvrSettings({ instrumentalIntensity: intensity })
}

export const setUvrSmoothing = (value: number): void => {
  _setUvrSmoothing(value)
  setUvrSettings({ smoothing: value })
}

// Getters for UVR settings
export const getUvrMode = (): UvrMode => uvrMode()
export const getUvrVocalIntensity = (): number => uvrVocalIntensity()
export const getUvrInstrumentalIntensity = (): number =>
  uvrInstrumentalIntensity()
export const getUvrSmoothing = (): number => uvrSmoothing()

// ── UVR Session Management (Full Workflow) ─────────────────────────

/** UVR processing status */
export type UvrStatus =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'error'
  | 'cancelled'

/** UVR session interface */
export interface UvrSession {
  sessionId: string
  apiSessionId?: string
  status: UvrStatus
  progress: number
  indeterminate?: boolean
  processingTime?: number
  error?: string
  originalFile?: {
    name: string
    size: number
    mimeType: string
  }
  outputs?: {
    vocal?: string
    instrumental?: string
    vocalMidi?: string
    instrumentalMidi?: string
  }
  stemMeta?: Record<string, { duration?: number; size?: number }>
  createdAt: number
}

/** Current UVR session state */
export const [currentUvrSession, setCurrentUvrSession] =
  createSignal<UvrSession | null>(null)

/** Reactive version counter — bumped on every session mutation */
const [sessionsVersion, setSessionsVersion] = createSignal(0)

function bumpSessions() {
  setSessionsVersion((v) => v + 1)
}

/** Get all sessions (reactive — reads sessionsVersion to track dependency) */
export function getAllUvrSessionsReactive(): UvrSession[] {
  sessionsVersion() // track signal dependency
  return getAllUvrSessions()
}

/** Get session by ID */
export function getUvrSession(sessionId: string): UvrSession | undefined {
  const sessions = getAllUvrSessions()
  return sessions.find((s) => s.sessionId === sessionId)
}

/** Get all sessions */
export function getAllUvrSessions(): UvrSession[] {
  const saved = localStorage.getItem('pitchperfect_uvr_sessions')
  if (saved !== null) {
    try {
      return JSON.parse(saved)
    } catch {
      return []
    }
  }
  return []
}

/** Save all sessions */
export function saveAllUvrSessions(sessions: UvrSession[]): void {
  localStorage.setItem('pitchperfect_uvr_sessions', JSON.stringify(sessions))
}

/** Start a new UVR session */
export function startUvrSession(
  fileName: string,
  fileSize: number,
  mimeType: string,
  _mode: UvrMode = 'separate',
): string {
  const sessionId = `uvr-session-${Date.now()}`
  const now = Date.now()

  const newSession: UvrSession = {
    sessionId,
    status: 'idle',
    progress: 0,
    originalFile: { name: fileName, size: fileSize, mimeType },
    createdAt: now,
  }

  const sessions = getAllUvrSessions()
  sessions.push(newSession)
  saveAllUvrSessions(sessions)
  bumpSessions()

  setCurrentUvrSession(newSession)
  return sessionId
}

/** Update UVR session progress */
export function updateUvrSessionProgress(
  sessionId: string,
  progress: number,
  processingTime?: number,
  indeterminate?: boolean,
): void {
  const sessions = getAllUvrSessions()
  const session = sessions.find((s) => s.sessionId === sessionId)
  if (session) {
    session.progress = progress
    session.indeterminate = indeterminate ?? false
    if (processingTime !== undefined) {
      session.processingTime = processingTime
    }
    saveAllUvrSessions(sessions)
    bumpSessions()
    setCurrentUvrSession({ ...session })
  }
}

/** Set the API session ID on a local session */
export function setUvrSessionApiId(
  sessionId: string,
  apiSessionId: string,
): void {
  const sessions = getAllUvrSessions()
  const session = sessions.find((s) => s.sessionId === sessionId)
  if (session) {
    session.apiSessionId = apiSessionId
    saveAllUvrSessions(sessions)
    bumpSessions()
    setCurrentUvrSession({ ...session })
  }
}

/** Complete UVR session with results */
export function completeUvrSession(
  sessionId: string,
  outputs: UvrSession['outputs'],
  stemMeta?: UvrSession['stemMeta'],
): void {
  const sessions = getAllUvrSessions()
  const session = sessions.find((s) => s.sessionId === sessionId)
  if (session) {
    session.status = 'completed'
    session.outputs = outputs
    session.stemMeta = stemMeta
    session.progress = 100
    session.processingTime = Date.now() - session.createdAt
    saveAllUvrSessions(sessions)
    bumpSessions()
    setCurrentUvrSession({ ...session })
  }
}

/** Set UVR session error */
export function setErrorUvrSession(sessionId: string, error: string): void {
  const sessions = getAllUvrSessions()
  const session = sessions.find((s) => s.sessionId === sessionId)
  if (session) {
    session.status = 'error'
    session.error = error
    saveAllUvrSessions(sessions)
    bumpSessions()
    setCurrentUvrSession({ ...session })
  }
}

/** Cancel UVR session */
export function cancelUvrSession(sessionId: string): void {
  const sessions = getAllUvrSessions()
  const session = sessions.find((s) => s.sessionId === sessionId)
  if (session) {
    session.status = 'cancelled'
    saveAllUvrSessions(sessions)
    bumpSessions()
    setCurrentUvrSession({ ...session })
  }
}

/** Delete UVR session */
export function deleteUvrSession(sessionId: string): void {
  const sessions = getAllUvrSessions().filter((s) => s.sessionId !== sessionId)
  saveAllUvrSessions(sessions)
  bumpSessions()
  if (currentUvrSession()?.sessionId === sessionId) {
    setCurrentUvrSession(null)
  }
}

/** Delete all UVR sessions */
export function deleteAllUvrSessions(): void {
  saveAllUvrSessions([])
  bumpSessions()
  setCurrentUvrSession(null)
}

/** Get UVR session stats */
export function getUvrSessionStats(): {
  totalSessions: number
  completedSessions: number
  failedSessions: number
  totalProcessingTime: number
} {
  const sessions = getAllUvrSessions()
  return {
    totalSessions: sessions.length,
    completedSessions: sessions.filter((s) => s.status === 'completed').length,
    failedSessions: sessions.filter((s) => s.status === 'error').length,
    totalProcessingTime: sessions
      .filter((s) => s.processingTime !== undefined)
      .reduce((sum, s) => sum + (s.processingTime ?? 0), 0),
  }
}

/** Refresh session output files from API data */
export function updateUvrSessionOutputs(
  sessionId: string,
  files: { stem: string; path: string; duration?: number; size?: number }[],
): void {
  const sessions = getAllUvrSessions()
  const session = sessions.find((s) => s.sessionId === sessionId)
  if (!session) return

  const outputs: UvrSession['outputs'] = {
    vocal: session.outputs?.vocal ?? '',
    instrumental: session.outputs?.instrumental ?? '',
    vocalMidi: session.outputs?.vocalMidi ?? '',
  }
  const meta: Record<string, { duration?: number; size?: number }> = {}

  for (const f of files) {
    if (f.stem === 'vocal') {
      outputs.vocal = f.path
      meta.vocal = { duration: f.duration, size: f.size }
    } else if (f.stem === 'instrumental') {
      outputs.instrumental = f.path
      meta.instrumental = { duration: f.duration, size: f.size }
    }
  }

  session.outputs = outputs
  session.stemMeta = meta
  saveAllUvrSessions(sessions)
  bumpSessions()
  if (currentUvrSession()?.sessionId === sessionId) {
    setCurrentUvrSession({ ...session })
  }
}

// ── Audio Engine (single instance) ─────────────────────────────

let _audioEngineInstance: AudioEngine | null = null

export async function initAudioEngine(): Promise<AudioEngine> {
  if (_audioEngineInstance !== null && _audioEngineInstance !== undefined) {
    return _audioEngineInstance
  }

  _audioEngineInstance = new AudioEngine()
  return _audioEngineInstance
}

/** Apply current UVR settings to the audio engine */
export async function applyUvrSettings(): Promise<void> {
  const engine = _audioEngineInstance
  if (!engine) return

  const mode = getUvrMode()
  const vocalIntensity = getUvrVocalIntensity()
  const instrumentalIntensity = getUvrInstrumentalIntensity()
  const smoothing = getUvrSmoothing()

  engine.setUvrSettings({
    mode,
    vocalIntensity,
    instrumentalIntensity,
    smoothing,
  })

  // Enable UVR processing
  engine.enableUvr()
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
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Choose your character!',
    targetSelector: '#character-icons',
    description:
      'Connect with your inner singer by choosing what suites you best!',
    placement: 'right',
    section: 'practice',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Scale & Key',
    targetSelector: '#scale-info',
    description:
      'Choose your musical key and scale type here. The piano roll updates to match your selection automatically.',
    placement: 'right',
    section: 'practice',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Load a Melody',
    targetSelector: '.library-tab',
    description:
      'Load a preset melody from the library, import a MIDI file, or record your own. Presets give you a great head start.',
    placement: 'right',
    section: 'practice',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Mic Button',
    targetSelector: '#btn-mic',
    description:
      'Tap to activate your microphone. The app detects your pitch in real time as you sing.',
    placement: 'bottom',
    section: 'practice',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Play / Pause / Stop',
    targetSelector: '.essential-controls',
    description:
      'Play starts the backing track, Pause halts it temporarily, and Stop returns to the beginning.',
    placement: 'bottom',
    section: 'practice',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Practice Mode',
    targetSelector: '#practice-panel',
    description:
      'In Practice mode, play a melody and sing along. The app detects your pitch in real time and scores your accuracy.',
    placement: 'right',
    section: 'practice',
    requiredTab: TAB_SINGING,
  },

  // ── Toolbar Section ──
  {
    title: 'BPM Control',
    targetSelector: '#bpm-input',
    description:
      'Adjust the tempo with the number input or slider. Faster or slower practice speeds suit different comfort levels.',
    placement: 'bottom',
    section: 'toolbar',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Volume & Speed',
    targetSelector: '#volume',
    description:
      'Control the backing track volume and playback speed. Slower speeds help with difficult passages.',
    placement: 'bottom',
    section: 'toolbar',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Play Modes',
    targetSelector: '#btn-once',
    description:
      'Spaced plays a single cycle with modifiable rests between the notes',
    placement: 'bottom',
    section: 'toolbar',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Play Modes',
    targetSelector: '#btn-repeat',
    description: 'Repeat loops through set number of cycles',
    placement: 'bottom',
    section: 'toolbar',
    requiredTab: TAB_SINGING,
  },
  {
    title: 'Play Modes',
    targetSelector: '#btn-session',
    description: 'Practice runs your session in sequence.',
    placement: 'bottom',
    section: 'toolbar',
    requiredTab: TAB_SINGING,
  },
  // {
  //   title: 'Count-In & Cycles',
  //   targetSelector: '#countin-display',
  //   description:
  //     'Set how many beats of count-in you want before playback starts, and how many cycles to run in Practice mode.',
  //   placement: 'bottom',
  //   section: 'toolbar',
  //   requiredTab: TAB_SINGING,
  // },

  // ── Editor Section ──
  {
    title: 'Editor Tab',
    targetSelector: '#editor-panel',
    description:
      'The Editor tab lets you build and modify melodies. Click to switch here to explore.',
    placement: 'bottom',
    section: 'editor',
    requiredTab: TAB_COMPOSE,
  },
  {
    title: 'Piano Roll',
    targetSelector: '.piano-roll-container',
    description:
      'Click on the grid to add notes. Drag them to adjust pitch or timing. Right-click a note to delete it.',
    placement: 'bottom',
    section: 'editor',
    requiredTab: TAB_COMPOSE,
  },
  {
    title: 'Record to Piano Roll',
    targetSelector: '#record-btn',
    description:
      'Hit Record, sing into your mic, and your pitch gets captured as notes on the piano roll.',
    placement: 'bottom',
    section: 'editor',
    requiredTab: TAB_COMPOSE,
  },
  {
    title: 'Save Melody',
    targetSelector: '#save-melody-btn',
    description:
      'Save your melody to the library so you can load it later in Practice mode.',
    placement: 'bottom',
    section: 'editor',
    requiredTab: TAB_COMPOSE,
  },
  {
    title: 'Editor Toolbar',
    targetSelector: '#key-select',
    description:
      'Change key, scale, BPM, and sensitivity directly from the editor toolbar before recording or editing.',
    placement: 'bottom',
    section: 'editor',
    requiredTab: TAB_COMPOSE,
  },

  // ── Settings Section ──
  {
    title: 'Settings Tab',
    targetSelector: '#settings-panel',
    description:
      'Fine-tune pitch detection, accuracy scoring, and the app appearance. Click to switch to Settings.',
    placement: 'bottom',
    section: 'settings',
    requiredTab: TAB_SETTINGS,
  },
  {
    title: 'Pitch Detection',
    targetSelector: '#set-sensitivity',
    description:
      'Adjust sensitivity, threshold, and confidence to match your voice and environment. Lower sensitivity reduces false triggers.',
    placement: 'left',
    section: 'settings',
    requiredTab: TAB_SETTINGS,
  },
  {
    title: 'Practice Aids',
    targetSelector: '#set-tonic-anchor',
    description:
      'Tonic anchor gives a reference tone before singing, helping you stay in key.',
    placement: 'left',
    section: 'settings',
    requiredTab: TAB_SETTINGS,
  },
  {
    title: 'Accuracy Bands',
    targetSelector: '#band-perfect',
    description:
      'Customize the cent-threshold for each accuracy band. Tighter bands are more challenging.',
    placement: 'left',
    section: 'settings',
    requiredTab: TAB_SETTINGS,
  },
  {
    title: 'Theme & Appearance',
    targetSelector: '#vis-theme',
    description:
      'Switch between light and dark themes, toggle grid lines, and adjust the visual style.',
    placement: 'left',
    section: 'settings',
    requiredTab: TAB_SETTINGS,
  },
  {
    title: 'Reverb & ADSR',
    targetSelector: '#reverb-type',
    description:
      'Add reverb for a richer sound, or tweak ADSR envelope for more natural-sounding notes.',
    placement: 'left',
    section: 'settings',
    requiredTab: TAB_SETTINGS,
  },
]

const WALKTHROUGH_KEY = 'pitchperfect_walkthrough_done'
const GUIDE_SECTIONS_KEY = 'pitchperfect_guide_sections'
export const [showSelection, setShowSelection] = createSignal(false)
export const [selectedWalkthrough, setSelectedWalkthrough] = createSignal<
  string | null
>(null)

/** Whether the WalkthroughModal (reading a specific chapter) is open */
export const [walkthroughModalOpen, setWalkthroughModalOpen] =
  createSignal(false)

/** Close the walkthrough chapter modal */
export function closeWalkthroughChapter(): void {
  setWalkthroughModalOpen(false)
  setSelectedWalkthrough(null)
}

/** Open a specific walkthrough chapter by ID (for hash-based deep linking) */
export function openWalkthroughChapter(chapterId: string): void {
  setSelectedWalkthrough(chapterId)
  setShowSelection(false)
  setWalkthroughModalOpen(true)
}

export const openLearningWalkthrough = () => {
  setShowSelection(true)
  setSelectedWalkthrough(null)
}
export const [walkthroughActive, setWalkthroughActive] = createSignal(false)
export const [walkthroughStep, setWalkthroughStep] = createSignal(0)

/** Loaded steps for the current tour (may be all or a subset) */
export const [tourSteps, setTourSteps] =
  createSignal<WalkthroughStep[]>(WALKTHROUGH_STEPS)

/** Which sections have been completed */
function loadGuideSections(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(GUIDE_SECTIONS_KEY)
    if (stored !== null) return JSON.parse(stored)
  } catch {
    /* */
  }
  return {}
}

function saveGuideSections(secs: Record<string, boolean>): void {
  try {
    localStorage.setItem(GUIDE_SECTIONS_KEY, JSON.stringify(secs))
  } catch {
    /* */
  }
}

export function isGuideSectionCompleted(sectionId: string): boolean {
  return loadGuideSections()[sectionId] || false
}

export function getIncompleteGuideSections(): WalkthroughSection[] {
  const completed = loadGuideSections()
  return GUIDE_SECTIONS.filter((s) => !completed[s.id])
}

function markGuideSectionCompleted(sectionId: string): void {
  const completed = loadGuideSections()
  completed[sectionId] = true
  saveGuideSections(completed)
}

/** Build step list from given section IDs */
function buildStepsFromSections(sectionIds: string[]): WalkthroughStep[] {
  return WALKTHROUGH_STEPS.filter((step) =>
    sectionIds.includes(step.section ?? ''),
  )
}

/** Start full guide tour or specific sections */
export function startWalkthrough(sectionIds?: string[]): void {
  const sections = sectionIds ?? GUIDE_SECTIONS.map((s) => s.id)
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
  if (
    currentSection === null ||
    currentSection === undefined ||
    currentSection === ''
  ) {
    endWalkthrough()
    return
  }
  markGuideSectionCompleted(currentSection)
  // Find first step in a later section
  const nextIdx = steps.findIndex(
    (s, i) => i > walkthroughStep() && s.section !== currentSection,
  )
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

// ── Feature Flags ───────────────────────────────────────────────────

function loadBooleanFlag(key: string, defaultValue: boolean): boolean {
  try {
    const val = localStorage.getItem(key)
    if (val !== null) return val === 'true'
  } catch {
    /* empty */
  }
  return defaultValue
}

function saveBooleanFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? 'true' : 'false')
  } catch {
    /* empty */
  }
}

const ADVANCED_FEATURES_KEY = 'pitchperfect_advanced_features'
const initialAdvanced = IS_DEV
  ? true
  : loadBooleanFlag(ADVANCED_FEATURES_KEY, false)
const [advancedFeaturesEnabledState, setAdvancedFeaturesEnabledState] =
  createSignal(initialAdvanced)
if (IS_DEV) saveBooleanFlag(ADVANCED_FEATURES_KEY, true)

export const advancedFeaturesEnabled = (): boolean =>
  advancedFeaturesEnabledState()

export const setAdvancedFeaturesEnabled = (enabled: boolean): void => {
  setAdvancedFeaturesEnabledState(enabled)
  saveBooleanFlag(ADVANCED_FEATURES_KEY, enabled)
}

const DEV_FEATURES_KEY = 'pitchperfect_dev_features'
const initialDev = IS_DEV ? true : loadBooleanFlag(DEV_FEATURES_KEY, false)
const [devFeaturesEnabledState, setDevFeaturesEnabledState] =
  createSignal(initialDev)
if (IS_DEV) saveBooleanFlag(DEV_FEATURES_KEY, true)

export const devFeaturesEnabled = (): boolean => devFeaturesEnabledState()

export const setDevFeaturesEnabled = (enabled: boolean): void => {
  setDevFeaturesEnabledState(enabled)
  saveBooleanFlag(DEV_FEATURES_KEY, enabled)
}

// ── App Crash / Error Handling ────────────────────────────────────────
export interface AppError {
  error: Error
  time: number
}

export const [appError, setAppError] = createSignal<AppError | null>(null)

export function setError(err: AppError | null): void {
  setAppError(err)
}
