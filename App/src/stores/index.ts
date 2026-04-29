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

export const isInSessionMode = () => false
export const initPresets = () => {}
export const presets = () => []

export const SessionHistoryEntry = {}

// TODO:Replace all appStore.<something> calls with proper calls!
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

  // TODO: Cleanup -> Stubs for removed methods that are now pure functions or context-bound
  // getNoteAccuracyMap: () => ({}),
  // saveSession: () => {},
  // clearSessionHistory: () => {},
  // getSessionHistory: () => [],
  // sessionHistory: () => [],
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
  initPresets: () => {},
  presets: () => [],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walkthroughStep: (walkthroughStore as any).getWalkthroughStep ?? (() => 0),

  walkthroughActive:
    (walkthroughStore as any).isWalkthroughActive ?? (() => false),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  startWalkthrough: (walkthroughStore as any).startWalkthrough ?? (() => {}),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  endWalkthrough: (walkthroughStore as any).endWalkthrough ?? (() => {}),

  nextWalkthroughStep:
    (walkthroughStore as any).nextWalkthroughStep ?? (() => {}),

  prevWalkthroughStep:
    (walkthroughStore as any).prevWalkthroughStep ?? (() => {}),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  WALKTHROUGH_STEPS: (walkthroughStore as any).WALKTHROUGH_STEPS ?? [],
}
