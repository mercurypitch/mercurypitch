// ============================================================
// Where the rail goes, and what Back means
// ============================================================
//
// Two things the shell has to answer and no component should answer twice:
// which five destinations the rail offers, and what happens when somebody
// presses Back — the header's, or Android's, which are the same press.
//
// THE RAIL IS FIXED ON PURPOSE. `mobileBarTabs()` / `isTabVisible()` are the
// web bar's policy and can hide the Ear Lab under a practice scope. The
// native rail is composition C from the gate-1 answers (Rooms · Sing · Ear
// Lab · Progress · More) and does not consult them: a destination that
// appears and disappears is not a rail, it is a menu.
//
// NAVIGATION IS THE HASH ROUTER. `navigateTo` is the app's own primitive; the
// shell adds no router and keeps no route state of its own. Nothing here
// fires a haptic: that belongs to the control that was pressed, so a
// programmatic move (the pill, a back press) does not buzz.

import type { ActiveTab, PracticeScope } from '@/features/tabs/constants'
import { TAB_EAR_LAB, TAB_GUITAR, TAB_HOME, TAB_PIANO, TAB_PROGRESS, TAB_SINGING, } from '@/features/tabs/constants'
import { navigateTo } from '@/lib/hash-router'
import { canGoBack } from './history-depth'
import { closeColumn, closeMore, columnOpen, currentTab, dismissKeepAlert, keepAlertOpen, moreOpen, parkRun, popScreen, pushed, runOwner, runState, } from './run-shell-store'

export type RailItemId = 'rooms' | 'stage' | 'ear' | 'progress' | 'more'

export interface RailItem {
  readonly id: RailItemId
  readonly label: string
  /** The destination, or null for More — which opens the sheet instead. */
  readonly tab: ActiveTab | null
}

/** Slot two is the scope's instrument (kit contract §9). */
export function stageTabFor(scope: PracticeScope): ActiveTab {
  if (scope === 'guitar') return TAB_GUITAR
  if (scope === 'piano') return TAB_PIANO
  return TAB_SINGING
}

export function stageLabelFor(scope: PracticeScope): string {
  if (scope === 'guitar') return 'Guitar'
  if (scope === 'piano') return 'Piano'
  return 'Sing'
}

export function railItems(scope: PracticeScope): RailItem[] {
  return [
    { id: 'rooms', label: 'Rooms', tab: TAB_HOME },
    { id: 'stage', label: stageLabelFor(scope), tab: stageTabFor(scope) },
    { id: 'ear', label: 'Ear Lab', tab: TAB_EAR_LAB },
    { id: 'progress', label: 'Progress', tab: TAB_PROGRESS },
    { id: 'more', label: 'More', tab: null },
  ]
}

/**
 * Which item wears the selected mark. Everything that is not one of the four
 * destinations lives behind More, so More is where the mark goes for it.
 */
export function selectedRailItem(
  tab: ActiveTab,
  scope: PracticeScope,
): RailItemId {
  const match = railItems(scope).find((item) => item.tab === tab)
  return match?.id ?? 'more'
}

/**
 * Go to a tab, parking a run on the way out if this is the room it belongs
 * to. Sound stops and the microphone is released on the same frame, with
 * nothing asked (REQ-NHR-017).
 */
export function goToTab(tab: ActiveTab): void {
  closeColumn()
  closeMore()
  // A pushed screen covers the whole viewport. Leaving it up while the hash
  // and the rail's mark both moved is a tab change nobody can see.
  popScreen()
  const state = runState()
  const owner = runOwner()
  if ((state === 'active' || state === 'paused') && owner === currentTab()) {
    parkRun()
  }
  navigateTo({ type: 'tab', tab })
}

/** The one control on the session pill: back to the room, still paused. */
export function returnToRun(): void {
  const owner = runOwner()
  if (owner === null) return
  closeColumn()
  closeMore()
  popScreen()
  navigateTo({ type: 'tab', tab: owner })
}

export type BackOutcome =
  | 'column'
  | 'sheet'
  | 'alert'
  | 'pushed'
  | 'history'
  | 'minimize'

/**
 * The order, top to bottom, for every Back there is — the room header's, the
 * keyboard's, and Android's hardware button.
 *
 * The pushed screen sits under the sheet because a sheet opens OVER one
 * (More is reachable while Settings is up); the alert is above both because
 * a modal question has to be answerable.
 */
export function resolveBack(hasSomewhereToGo: boolean): BackOutcome {
  if (columnOpen()) return 'column'
  if (keepAlertOpen()) return 'alert'
  if (moreOpen()) return 'sheet'
  if (pushed() !== null) return 'pushed'
  if (hasSomewhereToGo) return 'history'
  return 'minimize'
}

export interface BackHost {
  /** Whether an entry of this app's own is behind us — never `history.length`. */
  readonly canGoBack: boolean
  back: () => void
  minimize: () => void
}

/**
 * The real host: what every Back in the app is answered against. Exported so
 * a test drives the same thing production does rather than a number it made
 * up — the bug this replaced was invisible to a suite that injected depths.
 */
export function shellBackHost(): BackHost {
  return {
    canGoBack: canGoBack(),
    back: () => {
      window.history.back()
    },
    minimize: () => {
      // Nothing to minimize to in a browser. `infrastructure/native-shell.ts`
      // owns that half: a press this declines becomes `minimizeApp()` there.
    },
  }
}

/** Performs `resolveBack`'s answer and reports which one it was. */
export function performBack(host: BackHost): BackOutcome {
  const outcome = resolveBack(host.canGoBack)
  switch (outcome) {
    case 'column':
      closeColumn()
      break
    case 'alert':
      dismissKeepAlert()
      break
    case 'sheet':
      closeMore()
      break
    case 'pushed':
      popScreen()
      break
    case 'history':
      // Leaving a room mid-run parks it, exactly as a tab tap does.
      if (runOwner() === currentTab()) parkRun()
      host.back()
      break
    case 'minimize':
      host.minimize()
      break
  }
  return outcome
}
