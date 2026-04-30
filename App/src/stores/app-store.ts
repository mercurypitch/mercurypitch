import { createSignal } from 'solid-js'
import { AudioEngine } from '@/lib/audio-engine'
import { getCompletedCount, getRemainingWalkthroughs, } from '@/stores/walkthrough-store'
import type { ActiveTab } from './ui-store'

// ── Key / Scale / Presets ──────────────────────────────────

export const [keyName, setKeyName] = createSignal<string>('C')
export const [scaleType, setScaleType] = createSignal<string>('major')
export const [instrument, setInstrument] = createSignal<InstrumentType>('sine')

export type InstrumentType = 'sine' | 'piano' | 'organ' | 'strings' | 'synth'

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
    title: 'Choose your character!',
    targetSelector: '#character-icons',
    description:
      "Connect with your inner singer by choosing what suites you best!",
    placement: 'right',
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
      'Spaced plays a single cycle with modifiable rests between the notes',
    placement: 'bottom',
    section: 'toolbar',
    requiredTab: 'practice',
  },
  {
    title: 'Play Modes',
    targetSelector: '#btn-repeat',
    description:
      'Repeat loops through set number of cycles',
    placement: 'bottom',
    section: 'toolbar',
    requiredTab: 'practice',
  },
  {
    title: 'Play Modes',
    targetSelector: '#btn-session',
    description:
      'Practice runs your session in sequence.',
    placement: 'bottom',
    section: 'toolbar',
    requiredTab: 'practice',
  },
  // {
  //   title: 'Count-In & Cycles',
  //   targetSelector: '#countin-display',
  //   description:
  //     'Set how many beats of count-in you want before playback starts, and how many cycles to run in Practice mode.',
  //   placement: 'bottom',
  //   section: 'toolbar',
  //   requiredTab: 'practice',
  // },

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
export const [showSelection, setShowSelection] = createSignal(false)
export const [selectedWalkthrough, setSelectedWalkthrough] = createSignal<
  string | null
>(null)
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
