import { createSignal } from 'solid-js'
import { APP_VERSION } from '@/lib/defaults'
import { createPersistedSignal } from '@/lib/storage'
import { exposeForE2E } from '@/lib/test-utils'

// ── Active tab ───────────────────────────────────────────────

export type ActiveTab = 'practice' | 'editor' | 'settings'
export const [activeTab, setActiveTab] = createSignal<ActiveTab>('practice')

// Editor view within the Editor tab
export type EditorView = 'piano-roll' | 'session-editor'
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

// ── User Profile ────────────────────

export function userProfile(): { name: string; email?: string } {
  return {
    name: 'User',
  }
}
