// ============================================================
// UI Store — active tab, modal/library visibility, focus mode, first-run flags
// ============================================================
//
// `setActiveTab` is the app's navigation primitive; `onTabTransition` lets
// features clean up (release the mic, stop playback) when the user leaves.
// Register listeners rather than polling the tab signal.
//
// Also owns the first-run gates -- welcome and survey dismissal, keyed by
// APP_VERSION. Headless preview runs must set those localStorage keys and
// reload, or the welcome overlay covers the page under test.

import { createSignal, untrack } from 'solid-js'
import type { ExerciseType } from '@/features/exercises/types'
import type { ActiveTab } from '@/features/tabs/constants'
import { DEFAULT_TAB, TAB_EXERCISES, TAB_SETTINGS, } from '@/features/tabs/constants'
import type { ZenExerciseDefinition } from '@/features/zen/types'
import { createPersistedSignal } from '@/lib/storage'
import { exposeForE2E } from '@/lib/test-utils'
import type { MelodyItem } from '@/types'
import { removeNotificationsByChannel, TOUR_OFFER_CHANNEL, } from './notifications-store'

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

// Editor view within the Editor tab. 'split' shows the piano roll and a live
// sheet-music strip together.
export type EditorView =
  | 'piano-roll'
  | 'sheet-music'
  | 'split'
  | 'session-editor'
export const [editorView, setEditorView] =
  createSignal<EditorView>('piano-roll')

// Whether Singing / Piano show the sheet-music view in place of their canvas.
export const [singingSheetView, setSingingSheetView] =
  createSignal<boolean>(false)
export const [pianoSheetView, setPianoSheetView] = createSignal<boolean>(false)

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
  if (val) {
    setSingingZenLaunch(null)
    setChallengeStageLaunch(null)
  }
  _setFocusMode(val)
}

export function enterFocusMode(): void {
  setFocusMode(true)
}

export function exitFocusMode(): void {
  setFocusMode(false)
}
exposeForE2E('__exitFocusMode', exitFocusMode)

// ── Singing Zen pitch stage ─────────────────────────────────────

export type SingingZenSource = 'singing' | 'exercises' | 'path'

export interface SingingZenLaunch {
  launchId: number
  mode: 'monitor' | 'exercise'
  exerciseId?: string
  exerciseVersion?: number
  /** A launch-scoped exercise not yet present in the shared catalogue. */
  exerciseDefinition?: ZenExerciseDefinition
  source: SingingZenSource
}

export const [singingZenLaunch, setSingingZenLaunch] =
  createSignal<SingingZenLaunch | null>(null)

export function openSingingZen(
  input:
    | { mode: 'monitor'; source: SingingZenSource }
    | {
        mode: 'exercise'
        exerciseId: string
        exerciseVersion?: number
        source: SingingZenSource
      }
    | {
        mode: 'exercise'
        exerciseDefinition: ZenExerciseDefinition
        source: SingingZenSource
      },
): void {
  _setFocusMode(false)
  setChallengeStageLaunch(null)
  removeNotificationsByChannel(TOUR_OFFER_CHANNEL)
  setSingingZenLaunch({
    ...input,
    launchId: Date.now(),
  })
}

export function closeSingingZen(): void {
  setSingingZenLaunch(null)
}

exposeForE2E('__exitSingingZen', closeSingingZen)

// ── Challenge performance stage (weekly Legend) ─────────────────
// The "Sing it" surface: the armed weekly challenge performs on the zen
// canvas instead of the plain exercises engine. Exactly one full-screen
// stage may be open — opening this closes focus mode and the zen stage,
// and vice versa.

export interface ChallengeStageLaunch {
  launchId: number
  challengeId: string
  title: string
  targetScore: number
  targetItems: MelodyItem[]
  /** Ranked weekly take, or an unranked replay from the archive. */
  mode: 'ranked' | 'practice'
}

export const [challengeStageLaunch, setChallengeStageLaunch] =
  createSignal<ChallengeStageLaunch | null>(null)

export function openChallengeStage(
  input: Omit<ChallengeStageLaunch, 'launchId'>,
): void {
  _setFocusMode(false)
  setSingingZenLaunch(null)
  removeNotificationsByChannel(TOUR_OFFER_CHANNEL)
  setChallengeStageLaunch({ ...input, launchId: Date.now() })
}

export function closeChallengeStage(): void {
  setChallengeStageLaunch(null)
}

exposeForE2E('__exitChallengeStage', closeChallengeStage)

// ── Karaoke Focus Mode (StemMixer fullscreen) ────────────────────

export const [karaokeFocus, setKaraokeFocus] = createSignal<boolean>(false)
exposeForE2E('__exitKaraokeFocus', () => setKaraokeFocus(false))

// Desktop opt-in to the zen karaoke stage — the clean, lyrics-forward
// presentation phones get automatically. Session-scoped (like karaokeFocus)
// so it never traps a returning visitor; a desktop toggle turns it on and the
// stage's Back turns it off. On phones the stage is always shown regardless.
export const [karaokeZen, setKaraokeZen] = createSignal<boolean>(false)
exposeForE2E('__exitKaraokeZen', () => setKaraokeZen(false))

// ── Welcome Screen (GH #131) ────────────────────────────────────
const PITCH_PERFECT_WELCOME_VERSION_KEY = 'pitchperfect_welcome_version'

// A seen flag is a seen flag. This used to store APP_VERSION and show the
// welcome whenever the stored string didn't match — which meant every
// release re-imposed the first-run overlay on people who had been using
// the app for months. Version news belongs in the changelog modal.
//
// The key and its type are unchanged so existing installs still read as
// "seen": anything non-empty (a stored version string, or the '1' we
// write now) suppresses it.
export const [welcomeSeen, setWelcomeSeen] = createPersistedSignal<string>(
  PITCH_PERFECT_WELCOME_VERSION_KEY,
  '',
)

export const [showWelcome, setShowWelcome] = createSignal(welcomeSeen() === '')

export function dismissWelcome(): void {
  setShowWelcome(false)
  setWelcomeSeen('1')
}

// ── Owner-only Content Studio (#/admin/*) ───────────────────────
export type AdminSection = 'exercises' | 'ascent' | 'weekly'
export type AdminContentLeaveIntent =
  | { type: 'section'; section: AdminSection }
  | { type: 'close' }

export const [adminContentSection, setAdminContentSection] =
  createSignal<AdminSection>('exercises')
export const [showAdminContentStudio, setShowAdminContentStudio] =
  createSignal(false)

let adminContentCloseGuard:
  | ((intent: AdminContentLeaveIntent) => boolean)
  | null = null

/**
 * Registers the currently mounted Content Studio's synchronous leave guard.
 * The store owns routing state, so browser history, the close button, and
 * section navigation all consult the same guard before discarding an editor.
 */
export function registerAdminContentCloseGuard(
  guard: (intent: AdminContentLeaveIntent) => boolean,
): () => void {
  adminContentCloseGuard = guard
  return () => {
    if (adminContentCloseGuard === guard) adminContentCloseGuard = null
  }
}

export function requestAdminContentSection(section: AdminSection): boolean {
  if (
    showAdminContentStudio() &&
    section !== adminContentSection() &&
    adminContentCloseGuard?.({ type: 'section', section }) === false
  ) {
    return false
  }
  setAdminContentSection(section)
  setShowAdminContentStudio(true)
  return true
}

export function requestCloseAdminContentStudio(): boolean {
  if (
    showAdminContentStudio() &&
    adminContentCloseGuard?.({ type: 'close' }) === false
  ) {
    return false
  }
  setShowAdminContentStudio(false)
  return true
}

// ── Auth modal (sign in / create account / forgot password) ─────
// One shared dialog, opened from the header pill, the Settings account
// section, or anywhere else that wants a sign-in. The value picks the
// pane it opens on; null = closed.
export type AuthModalMode = 'login' | 'register'

export const [authModalMode, setAuthModalMode] =
  createSignal<AuthModalMode | null>(null)

export function openAuthModal(mode: AuthModalMode = 'login'): void {
  setAuthModalMode(mode)
}

export function closeAuthModal(): void {
  setAuthModalMode(null)
}

// ── Password-reset page (#/reset-password[?token=…]) ────────────
// Full-screen overlay reached from the emailed reset link. token = the
// link's token, null for the bare request-a-link form; the object is
// null while the page is closed.
export const [resetPasswordView, setResetPasswordView] = createSignal<{
  token: string | null
} | null>(null)

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

/**
 * User-initiated feedback survey (Settings → Account).
 *
 * Deliberately NOT gated on surveySeen: the automatic prompt fires once, but
 * this is the standing "I have an idea" channel, so it can be reopened and
 * submitted as often as someone has something to say. It stays anonymous —
 * no account or email is revealed by sending one.
 */
export const [feedbackSurveyOpen, setFeedbackSurveyOpen] = createSignal(false)

export function openFeedbackSurvey(): void {
  setFeedbackSurveyOpen(true)
}

export function closeFeedbackSurvey(): void {
  setFeedbackSurveyOpen(false)
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

// ── UI Target Focus Animation ──────────────────────────────────
export const [targetFocusEvent, setTargetFocusEvent] = createSignal<{
  ids: string[]
  timestamp: number
} | null>(null)

export function triggerTargetFocus(id: string | string[]): void {
  const ids = Array.isArray(id) ? id : [id]
  setTargetFocusEvent({ ids, timestamp: Date.now() })
}
