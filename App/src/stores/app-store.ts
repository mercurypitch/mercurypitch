import { createSignal } from 'solid-js'
import { AudioEngine } from '@/lib/audio-engine'
import type { WalkthroughStep as BaseWalkthroughStep } from '@/types/walkthrough'
import { completeWalkthrough, getRemainingWalkthroughs } from '@/stores/walkthrough-store'
export { activeTab, setActiveTab } from './ui-store'

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

// ── Guide Tour / Learn modal compatibility (merged from fix branch) ──

export interface WalkthroughSection {
  id: string
  title: string
  description: string
}

export interface WalkthroughStep extends BaseWalkthroughStep {
  section?: string
  target?: string
  targetSelector?: string
  requiredTab?: 'practice' | 'editor' | 'settings' | 'study'
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

export const GUIDE_SECTIONS: WalkthroughSection[] = [
  { id: 'practice', title: 'Practice', description: 'Learn the practice and playback controls.' },
  { id: 'editor', title: 'Editor', description: 'Learn the piano-roll editor and session editor.' },
  { id: 'settings', title: 'Settings', description: 'Learn configuration, audio, and visual settings.' },
]

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    title: 'Practice tab',
    description: 'Start here to practice pitch with real-time feedback.',
    action: 'Open the Practice tab and press Play.',
    section: 'practice',
    target: '#tab-practice',
    targetSelector: '#tab-practice',
    requiredTab: 'practice',
  },
  {
    title: 'Editor tab',
    description: 'Compose and edit melodies in the piano roll.',
    action: 'Open the Editor tab to edit notes.',
    section: 'editor',
    target: '#tab-editor',
    targetSelector: '#tab-editor',
    requiredTab: 'editor',
  },
  {
    title: 'Settings tab',
    description: 'Adjust pitch detection, visuals, and playback options.',
    action: 'Open Settings to customize the app.',
    section: 'settings',
    target: '#tab-settings',
    targetSelector: '#tab-settings',
    requiredTab: 'settings',
  },
]

const GUIDE_SECTIONS_KEY = 'pitchperfect_guide_sections'
const [walkthroughActive, setWalkthroughActive] = createSignal(false)
const [walkthroughStep, setWalkthroughStep] = createSignal(0)
const [tourSteps, setTourSteps] = createSignal<WalkthroughStep[]>(WALKTHROUGH_STEPS)

function loadCompletedGuideSections(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(GUIDE_SECTIONS_KEY)
    if (stored !== null && stored !== '') return JSON.parse(stored) as Record<string, boolean>
  } catch {
    // ignore
  }
  return {}
}

function saveCompletedGuideSections(sections: Record<string, boolean>): void {
  try {
    localStorage.setItem(GUIDE_SECTIONS_KEY, JSON.stringify(sections))
  } catch {
    // ignore
  }
}

export function isGuideSectionCompleted(id: string): boolean {
  return loadCompletedGuideSections()[id] === true
}

export function getIncompleteGuideSections(): WalkthroughSection[] {
  const completed = loadCompletedGuideSections()
  return GUIDE_SECTIONS.filter((s) => completed[s.id] !== true)
}

export function hasRemainingWalkthroughs(): boolean {
  return getRemainingWalkthroughs().length > 0 || getIncompleteGuideSections().length > 0
}

export function getCompletedWalkthroughCount(): number {
  return GUIDE_SECTIONS.length - getIncompleteGuideSections().length
}

function buildStepsFromSections(sectionIds: string[]): WalkthroughStep[] {
  const idSet = new Set(sectionIds)
  return WALKTHROUGH_STEPS.filter((step) => step.section !== undefined && idSet.has(step.section))
}

export function startWalkthrough(sectionIds?: string[]): void {
  const sections = sectionIds ?? GUIDE_SECTIONS.map((s) => s.id)
  const steps = buildStepsFromSections(sections)
  setTourSteps(steps.length > 0 ? steps : WALKTHROUGH_STEPS)
  setWalkthroughStep(0)
  setWalkthroughActive(true)
}

export function nextWalkthroughStep(): void {
  const steps = tourSteps()
  if (walkthroughStep() < steps.length - 1) {
    setWalkthroughStep((s) => s + 1)
  } else {
    endWalkthrough()
  }
}

export function prevWalkthroughStep(): void {
  if (walkthroughStep() > 0) setWalkthroughStep((s) => s - 1)
}

export function endWalkthrough(): void {
  const steps = tourSteps()
  const completed: Record<string, boolean> = loadCompletedGuideSections()
  for (const step of steps) {
    if (step.section !== undefined) completed[step.section] = true
  }
  saveCompletedGuideSections(completed)
  for (const id of Object.keys(completed)) completeWalkthrough(id)
  setWalkthroughActive(false)
  setWalkthroughStep(0)
}

export function isWalkthroughActive(): boolean {
  return walkthroughActive()
}

export function getWalkthroughStep(): number {
  return walkthroughStep()
}

export { walkthroughActive, walkthroughStep, tourSteps }


export function skipSection(): void {
  const steps = tourSteps()
  const current = steps[walkthroughStep()]
  const currentSection = current?.section
  const nextIdx = steps.findIndex((step, index) => index > walkthroughStep() && step.section !== currentSection)
  if (nextIdx >= 0) setWalkthroughStep(nextIdx)
  else endWalkthrough()
}

export const appStore = {
  walkthroughActive,
  walkthroughStep,
  tourSteps,
  startWalkthrough,
  nextWalkthroughStep,
  prevWalkthroughStep,
  endWalkthrough,
  skipSection,
}
