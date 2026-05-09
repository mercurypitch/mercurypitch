// ============================================================
// Stores barrel export
// ============================================================

import { buildSessionItemMelody } from '@/lib/session-builder'
import type { PlaybackSession } from '@/types'
import {
  WALKTHROUGH_STEPS,
  walkthroughActive,
  walkthroughStep,
} from './app-store'
import * as appStoreCore from './app-store'
import * as micStore from './mic-store'
import * as notifStore from './notifications-store'
import * as playbackStateStore from './playback-state-store'
import {
  sessionMode as _sessionMode,
  setPracticeResults as _setPracticeResults,
  setPracticeSession as _setPracticeSession,
  setSessionActive as _setSessionActive,
  setSessionItemIndex as _setSessionItemIndex,
  setSessionItemRepeat as _setSessionItemRepeat,
  setSessionMode as _setSessionMode,
} from './practice-session-store'
import * as practiceStore from './practice-session-store'
import * as settingsStore from './settings-store'
import * as themeStore from './theme-store'
import * as transportStore from './transport-store'
import * as uiStore from './ui-store'
import * as userSessionStore from './user-session-store'
import * as walkthroughStore from './walkthrough-store'
import { getSessionHistory, sessionResults } from './practice-session-store'

export * from './app-store'
export * from './mic-store'
export * from './notifications-store'
export * from './practice-session-store'
export * from './settings-store'
export * from './theme-store'
export * from './transport-store'
export * from './ui-store'
export * from './user-session-store'
export * from './walkthrough-store'
export * from './playback-state-store'
export * from './session-store'
export { getSessionHistory, sessionResults } from './practice-session-store'

export { playback } from './playback-store'
export { melodyStore } from './melody-store'

// Session-mode state lives in practice-session-store.sessionMode().
export const isInSessionMode = () => _sessionMode()

// No-op kept for backward compat (was a presets-store init).
export const initPresets = (): void => {}

// Session presets library stubs removed — real implementations in ui-store.ts

// Composer for starting a practice session — sets practice store fields together.
export const startPracticeSession = (session: PlaybackSession): void => {
  _setPracticeSession(session)
  _setSessionMode(true)
  _setSessionActive(true)
  _setPracticeResults([])
  _setSessionItemIndex(0)
  _setSessionItemRepeat(0)
}

// appStore bundles all stores for backward-compatible access.
// TODO: Replace all appStore.<something> calls with proper calls!
// To ease the migration and avoid breaking the rest of the application
// right away, we expose a monolithic "appStore" namespace that bundles
// all the signals and setters from the individual stores.
export const appStore = {
  ...appStoreCore,
  ...micStore,
  ...notifStore,
  ...practiceStore,
  ...settingsStore,
  ...themeStore,
  ...transportStore,
  ...uiStore,
  ...userSessionStore,
  ...walkthroughStore,
  ...playbackStateStore,

  // Re-map loadSession correctly since it was in userSessionStore but was expected in appStore
  loadSession: userSessionStore.loadSession,

  startPracticeSession: (session: PlaybackSession) => {
    practiceStore.setPracticeSession(session)
    practiceStore.setSessionMode(true)
    practiceStore.setSessionActive(true)
    practiceStore.setPracticeResults([])
    practiceStore.setSessionItemIndex(0)
    practiceStore.setSessionItemRepeat(0)
  },
  // Audio settings wrappers needed by the app
  reverb: settingsStore.reverbConfig,

  // NOTE: Add missing stub as required for tests, etc.
  buildSessionItemMelody,
  walkthroughStep,
  walkthroughActive,
  WALKTHROUGH_STEPS,

  // Session history for vocal analysis
  getSessionHistory,
  sessionResults,
}
