// ============================================================
// Stores barrel export
// ============================================================

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

export { playback } from './playback-store'
export { melodyStore } from './melody-store'

// Kept as no-op stub: still referenced by tests/session-store.test.ts.
// True session-mode state lives in practice-session-store.sessionMode().
export const isInSessionMode = () => false

// No-op kept for backward compat (was a presets-store init).
export const initPresets = (): void => {}

// Composer for starting a practice session — sets practice store fields together.
import type { PlaybackSession as _PlaybackSession } from '@/types'
import { setPracticeSession as _setPracticeSession, setSessionActive as _setSessionActive, setSessionMode as _setSessionMode, } from './practice-session-store'

export const startPracticeSession = (session: _PlaybackSession): void => {
  _setPracticeSession(session)
  _setSessionMode(true)
  _setSessionActive(true)
}

// TODO: Replace all appStore.<something> calls with proper calls!
// To ease the migration and avoid breaking the rest of the application
// right away, we expose a monolithic "appStore" namespace that bundles
// all the signals and setters from the individual stores.
import { buildSessionItemMelody } from '@/lib/session-builder'
import type { PlaybackSession } from '@/types'
import * as appStoreCore from './app-store'
import * as micStore from './mic-store'
import * as notifStore from './notifications-store'
import * as playbackStateStore from './playback-state-store'
import * as practiceStore from './practice-session-store'
import * as settingsStore from './settings-store'
import * as themeStore from './theme-store'
import * as transportStore from './transport-store'
import * as uiStore from './ui-store'
import * as userSessionStore from './user-session-store'
import * as walkthroughStore from './walkthrough-store'

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
  },
  isInSessionMode: () => false,
  sessionMode: practiceStore.sessionMode,
  setSessionMode: practiceStore.setSessionMode,
  sessionActive: practiceStore.sessionActive,
  setSessionActive: practiceStore.setSessionActive,

  // Audio settings wrappers needed by the app
  reverb: settingsStore.reverbConfig,

  // More missing stubs
  buildSessionItemMelody,
  walkthroughStep: appStoreCore.getWalkthroughStep,
  walkthroughActive: appStoreCore.isWalkthroughActive,
  startWalkthrough: appStoreCore.startWalkthrough,
  endWalkthrough: appStoreCore.endWalkthrough,
  nextWalkthroughStep: appStoreCore.nextWalkthroughStep,
  prevWalkthroughStep: appStoreCore.prevWalkthroughStep,
  WALKTHROUGH_STEPS: appStoreCore.WALKTHROUGH_STEPS,
}
