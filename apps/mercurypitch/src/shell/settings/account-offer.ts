// ============================================================
// The account offer — when it is asked, and when it is not
// ============================================================
//
// S6 decision 02, both halves (owner, 27 Sep): a sheet once, a beat after a
// take is kept in the Sing room, and a card at the top of Settings until the
// singer says Later.
//
// The sheet is the one ask after value (REQ-NAM-009, 010). It never comes
// before a kept take, and it comes once on this phone: the flag that says it
// came is kept, so a restart does not bring it back. It waits a beat, so the
// take's own card has closed and handed focus back before it rises, and it
// rises only in the Sing room, between runs, with nothing of the shell's
// over the room. A take kept on the way out of the room leaves it for the
// next Keep in there.
//
// Later is quiet (REQ-NAM-014): from the sheet or the card, it folds the
// card into the Account row and holds the sheet back until the app next
// starts. Back, the backdrop and a swipe answer the sheet the same way.
// Sign in is the sign-in sheet itself, the same ways in as the Account
// screen's button (REQ-NAM-015).
//
// A phone that signed out of an account is not offered one: it has one, and
// the Account screen already says how to come back (REQ-NAM-054).

import { createEffect, createRoot, createSignal, onCleanup, untrack, } from 'solid-js'
import { needsSignIn } from '@/db/services/auth-service'
import { authVersion } from '@/db/services/user-service'
import { TAB_SINGING } from '@/features/tabs/constants'
import type { SingTake } from '@/stores/sing-takes-store'
import { singTakes } from '@/stores/sing-takes-store'
import { countingIn, currentTab, runState, shellCovered, } from '../run-shell-store'
import { accountSignedIn } from './account-state'
import { settingsAlertOpen } from './settings-alert'
import { openSignIn, signInOpen } from './sign-in-state'

/** How long after a Keep the sheet rises: the take's card has gone by then. */
export const OFFER_BEAT_MS = 400

const SHOWN_KEY = 'mp:account-offer-shown'

const [sheetOpen, setSheetOpen] = createSignal(false)
const [firstTake, setFirstTake] = createSignal(false)
const [declined, setDeclined] = createSignal(false)

/** Where storage is blocked, the session still remembers. */
let shownThisSession = false

/** Whether the offer's sheet is up. Reactive. */
export const offerOpen = sheetOpen

/** Whether the take the sheet follows is the phone's first. Reactive. */
export const offerIsFirstTake = firstTake

/** No account on this phone yet: none signed in, and none signed out of. */
function noAccountYet(): boolean {
  // The signed-out flag lives in storage; the version makes it as current
  // as the token it goes with.
  authVersion()
  return !accountSignedIn() && !needsSignIn()
}

function shownBefore(): boolean {
  if (shownThisSession) return true
  try {
    return localStorage.getItem(SHOWN_KEY) !== null
  } catch {
    return false
  }
}

function markShown(): void {
  shownThisSession = true
  try {
    localStorage.setItem(SHOWN_KEY, '1')
  } catch {
    // Blocked storage: this session remembers, and a restart may ask again.
  }
}

/** The card at the top of Settings: no account yet, and no Later since launch. Reactive. */
export function offerCardShown(): boolean {
  return noAccountYet() && !declined()
}

/** Later, from the sheet or the card; and Back, the backdrop or a swipe on the sheet. */
export function declineOffer(): void {
  setSheetOpen(false)
  setDeclined(true)
}

/** Sign in, from the sheet or the card: the sign-in sheet, in its place. */
export function acceptOffer(): void {
  setSheetOpen(false)
  openSignIn()
}

/**
 * The Sing room, between runs, with nothing of the shell's over it. A run
 * that has ended still reads as `ended` after the Keep (the shell lets go of
 * it when the singer leaves the tab), so between runs is anything but a run
 * going or paused.
 */
function roomClear(): boolean {
  const run = runState()
  return (
    currentTab() === TAB_SINGING &&
    run !== 'active' &&
    run !== 'paused' &&
    !countingIn() &&
    !shellCovered() &&
    !signInOpen() &&
    !settingsAlertOpen()
  )
}

function due(): boolean {
  return noAccountYet() && !declined() && !shownBefore()
}

/**
 * A take kept, rather than one removed or all of them cleared: the list now
 * ends on a take it did not end on before, and none went. At the cap it
 * stays the same length while its newest changes.
 */
export function keptOne(
  before: readonly SingTake[],
  after: readonly SingTake[],
): boolean {
  const newest = after.at(-1)
  return (
    newest !== undefined &&
    after.length >= before.length &&
    newest.id !== before.at(-1)?.id
  )
}

/**
 * Watch the kept takes, and raise the sheet a beat after one is kept. The
 * shell installs it once; it returns its own uninstall.
 */
export function installAccountOffer(): () => void {
  return createRoot((dispose) => {
    let before = untrack(singTakes)
    let beat: ReturnType<typeof setTimeout> | undefined

    createEffect(() => {
      const after = singTakes()
      const kept = keptOne(before, after)
      before = after
      if (!kept || !untrack(due)) return
      const first = after.length === 1
      clearTimeout(beat)
      beat = setTimeout(() => {
        beat = undefined
        if (!due() || !roomClear()) return
        markShown()
        setFirstTake(first)
        setSheetOpen(true)
      }, OFFER_BEAT_MS)
    })

    onCleanup(() => {
      clearTimeout(beat)
    })
    return dispose
  })
}

/** What a launch starts from, and tests: nothing open, nothing declined. */
export function resetAccountOffer(): void {
  setSheetOpen(false)
  setFirstTake(false)
  setDeclined(false)
  shownThisSession = false
}

/** Tests: as if this phone had never been offered an account. */
export function forgetAccountOffer(): void {
  resetAccountOffer()
  try {
    localStorage.removeItem(SHOWN_KEY)
  } catch {
    // Nothing was kept.
  }
}
