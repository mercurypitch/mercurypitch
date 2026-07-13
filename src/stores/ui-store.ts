import { createSignal, untrack } from 'solid-js'
import type { ExerciseType } from '@/features/exercises/types'
import type { ActiveTab } from '@/features/tabs/constants'
import { DEFAULT_TAB, TAB_EXERCISES, TAB_SETTINGS, } from '@/features/tabs/constants'
import { APP_VERSION } from '@/lib/defaults'
import { createPersistedSignal } from '@/lib/storage'
import { exposeForE2E } from '@/lib/test-utils'

export type { ActiveTab } from '@/features/tabs/constants'

// ── Active tab ───────────────────────────────────────────────

const [activeTabSignal, setActiveTabSignal] =
  createSignal<ActiveTab>(DEFAULT_TAB)

export const activeTab = activeTabSignal

/**
 * Tab-leave cleanup, invoked synchronously on every real tab change with
 * (prev, next) — BEFORE the signal updates. AppShell registers it (it owns
 * the engines/controllers cleanup needs).
 *
 * This used to be a `createEffect(on(activeTab, ...))` reading `on`'s
 * prevInput — but that effect's initial execution can be deferred until the
 * first tab CHANGE (transition/suspense scheduling in production builds), so
 * prevInput was undefined exactly then and the first switch after load
 * escaped cleanup entirely (e.g. singing playback kept sounding under the
 * piano tab). A synchronous listener at the single setter choke point cannot
 * miss a transition.
 */
type TabTransitionListener = (prev: ActiveTab, next: ActiveTab) => void
let tabTransitionListener: TabTransitionListener | null = null

export function onTabTransition(listener: TabTransitionListener): void {
  tabTransitionListener = listener
}

export const setActiveTab = (tab: ActiveTab): ActiveTab => {
  const prev = untrack(activeTabSignal)
  if (prev !== tab && tabTransitionListener !== null) {
    try {
      tabTransitionListener(prev, tab)
    } catch (err) {
      console.error('[ui-store] tab transition cleanup failed:', err)
    }
  }
  return setActiveTabSignal(tab)
}

// ── Settings sub-tab ─────────────────────────────────────────
// Store-backed (not SettingsPanel-local) so deep links (#/settings/account)
// and in-app actions ("Get credits" toasts) can open a specific section.

export type SettingsSection = 'account' | 'singing' | 'display' | 'credits'

export const [settingsSection, setSettingsSection] =
  createSignal<SettingsSection>('account')

/** Jump to Settings with a specific sub-tab open. */
export function openSettingsSection(section: SettingsSection): void {
  setSettingsSection(section)
  setActiveTab(TAB_SETTINGS)
}

// Mobile sidebar drawer open state. Store-backed (not AppShell-local) so the
// spotlight tour engine can open it to reach sidebar-anchored steps on mobile.
export const [sidebarOpen, setSidebarOpen] = createSignal(false)

// Desktop sidebar collapse (thin rail; its content is display:none). Store-
// backed for the same reason: the tour must expand it for sidebar-anchored
// steps and restore it afterwards. Persisted under the key (and 'true'/'false'
// format) App.tsx historically used, so existing user prefs carry over.
export const [sidebarCollapsed, setSidebarCollapsed] =
  createPersistedSignal<boolean>('pitchperfect_sidebar_collapsed', false)

// Editor view within the Editor tab
export type EditorView = 'piano-roll' | 'sheet-music' | 'session-editor'
export const [editorView, setEditorView] =
  createSignal<EditorView>('piano-roll')

// ── Library Modal ───────────────────────────────────────────

export const [isLibraryModalOpen, setShowLibraryModal] =
  createSignal<boolean>(false)
export const [isSessionLibraryModalOpen, setShowSessionLibraryModal] =
  createSignal<boolean>(false)
export const [showSessionBrowser, setShowSessionBrowser] =
  createSignal<boolean>(false)

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
export function showSessionPresetsLibrary(): void {
  setShowSessionBrowser(true)
}
export function hideSessionPresetsLibrary(): void {
  setShowSessionBrowser(false)
}

// ── Focus Mode ─────────────────────────────────────────────────

export const [focusMode, _setFocusMode] = createSignal<boolean>(false)

export function setFocusMode(val: boolean): void {
  _setFocusMode(val)
}

export function enterFocusMode(): void {
  setFocusMode(true)
}

export function exitFocusMode(): void {
  setFocusMode(false)
}
exposeForE2E('__exitFocusMode', exitFocusMode)

// ── Karaoke Focus Mode (StemMixer fullscreen) ────────────────────

export const [karaokeFocus, setKaraokeFocus] = createSignal<boolean>(false)
exposeForE2E('__exitKaraokeFocus', () => setKaraokeFocus(false))

// ── Welcome Screen (GH #131) ────────────────────────────────────
const PITCH_PERFECT_WELCOME_VERSION_KEY = 'pitchperfect_welcome_version'

// The value stored is the version string. We want to show welcome if the stored string doesn't match APP_VERSION.
// A simpler way: store a boolean 'true' if they have seen this specific version.
export const [welcomeSeen, setWelcomeSeen] = createPersistedSignal<string>(
  PITCH_PERFECT_WELCOME_VERSION_KEY,
  '',
)

export const [showWelcome, setShowWelcome] = createSignal(
  welcomeSeen() !== APP_VERSION,
)

export function dismissWelcome(): void {
  setShowWelcome(false)
  setWelcomeSeen(APP_VERSION)
}

// ── Onboarding survey (GH #97) ──────────────────────────────────
// Shown once on real deployments after the welcome screen. A non-empty
// stored value means the user has already seen (submitted or skipped) it,
// so it never re-prompts — same dismiss pattern as the welcome screen.
const PITCH_PERFECT_SURVEY_SEEN_KEY = 'pitchperfect_survey_seen'

export const [surveySeen, setSurveySeen] = createPersistedSignal<string>(
  PITCH_PERFECT_SURVEY_SEEN_KEY,
  '',
)

export function dismissSurvey(): void {
  setSurveySeen('1')
}

// ── User Profile ────────────────────

export function userProfile(): { name: string; email?: string } {
  return {
    name: 'User',
  }
}

// ── Practice Drill Launch ──────────────────────────────────

export interface PendingDrill {
  exercise: ExerciseType
  notes: string[]
  challengeName: string
  /** Step-pattern for pattern-driven exercises (warmup blocks). */
  pattern?: string
}

export const [pendingDrill, setPendingDrill] =
  createSignal<PendingDrill | null>(null)

export function launchDrill(drill: PendingDrill): void {
  setPendingDrill(drill)
  setActiveTab(TAB_EXERCISES)
}

/** Launch an exercise directly (used by daily routine Start buttons) */
export function startExercise(
  exercise: ExerciseType,
  opts?: { notes?: string[]; challengeName?: string; pattern?: string },
): void {
  setPendingDrill({
    exercise,
    notes: opts?.notes ?? [],
    challengeName: opts?.challengeName ?? '',
    pattern: opts?.pattern,
  })
  setActiveTab(TAB_EXERCISES)
}

// ── Session Celebration ──────────────────────────────────────

export interface CelebrationData {
  score: number
  exerciseType: string
  metrics: Record<string, number>
  bestWindow?: { startMs: number; endMs: number; score: number }
}

export const [celebrationData, setCelebrationData] =
  createSignal<CelebrationData | null>(null)

export function showCelebration(data: CelebrationData): void {
  setCelebrationData(data)
}

export function dismissCelebration(): void {
  setCelebrationData(null)
}
