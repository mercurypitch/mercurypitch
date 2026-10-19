// ============================================================
// Keep, the account offer — when it is asked, and when it is not
// ============================================================
//
// S6 decision 02, and the sheet S7b §3.5 calls Keep: once on this phone, a
// beat after a take is kept in the Sing room, and whenever the singer asks
// for it, from the Save your progress row in Settings or the Cloud offer's
// free account line (S7b §5, FREE_ACCOUNT_LINE).
//
// The sheet is the one unprompted ask after value (REQ-NAM-009, 010). It
// never comes before a kept take, and it comes once on this phone: the flag
// that says it came is kept, so a restart does not bring it back, and an ask
// the singer opened counts as that one ask. It waits a beat, so the take's
// own card has closed and handed focus back before it rises, and it rises
// only in the Sing room, between runs, with nothing of the shell's over the
// room. A take kept on the way out of the room leaves it for the next Keep
// in there.
//
// Not now is quiet (REQ-NAM-014): it closes the sheet, asks nothing and
// opens nothing. Back, the backdrop and a swipe answer the sheet the same
// way. The sheet's own ways in are the sign-in sheet's ceremonies
// (AccountOffer.tsx).
//
// A phone that signed out of an account is not asked unprompted: it has
// one, and the Account screen already says how to come back (REQ-NAM-054).
// It can still open Keep from Settings.
//
// The range finder: with no range measured, Keep's first row is "Find your
// range first", which runs the range and comes back to this sheet (S7b
// §3.2). A build with the native onboarding registers its range
// (onboarding-layer.ts); a build without one registers none, and the row is
// not drawn: no build offers what it lacks.
//
// The onboarding's beat 7 is Keep too (S7b §3.1), opened over its layer
// after the reveal, or after a skipped range, on a phone with no account
// yet (`noAccountYet`). After the reveal the card flies in, small
// (`openKeepFromReveal`, S7b §3.5).
//
// The anonymous identity (S7b E11): the first offer to open mints it, and
// Keep is the first offer a new install meets (singer-identity.ts). Only in
// a build with the offer screens: the store build keeps today's behaviour
// until the V1 release brings them (owner, 16 Oct: nothing ships early).

import type { Accessor } from 'solid-js'
import { createEffect, createRoot, createSignal, onCleanup, untrack, } from 'solid-js'
import { needsSignIn } from '@/db/services/auth-service'
import { ensureSingerIdentity } from '@/db/services/singer-identity'
import { authVersion } from '@/db/services/user-service'
import { TAB_SINGING } from '@/features/tabs/constants'
import { KARAOKE_IMPORT } from '@/lib/native-build'
import type { SingTake } from '@/stores/sing-takes-store'
import { singTakes } from '@/stores/sing-takes-store'
import { countingIn, currentTab, runState, shellCovered, } from '../run-shell-store'
import { accountSignedIn } from './account-state'
import { loadAppGift } from './keep-gift'
import { settingsAlertOpen } from './settings-alert'
import { signInOpen } from './sign-in-state'

/** How long after a Keep the sheet rises: the take's card has gone by then. */
export const OFFER_BEAT_MS = 400

const SHOWN_KEY = 'mp:account-offer-shown'

/** How Keep came up: after a reveal, its card flies in; else it is there. */
export type KeepArrival = 'reveal' | 'plain'

const [sheetOpen, setSheetOpen] = createSignal(false)
const [arrival, setArrival] = createSignal<KeepArrival>('plain')
const [finder, setFinder] = createSignal<(() => void) | null>(null)

/** Where storage is blocked, the session still remembers. */
let shownThisSession = false

/** Whether Keep is up. Reactive. */
export const offerOpen = sheetOpen

/** How Keep came up this time. Reactive. */
export const keepArrival = arrival

/**
 * No account on this phone yet: none signed in, and none signed out of.
 * Only then is Keep raised unprompted, here and in the onboarding.
 */
export function noAccountYet(): boolean {
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

function open(how: KeepArrival): void {
  markShown()
  void loadAppGift()
  // Never awaited: Keep is up at once, and the identity is made behind it
  // (one request however many ask, singer-identity.ts).
  if (KARAOKE_IMPORT) void ensureSingerIdentity()
  setArrival(how)
  setSheetOpen(true)
}

/**
 * Open Keep: the Save your progress row, the Cloud offer's free account,
 * the sheet's own rise after a Keep, and the onboarding after a skipped
 * range. The same `() => void` shape as openSignIn, so either can be handed
 * to a button.
 */
export function openKeep(): void {
  open('plain')
}

/** Open Keep straight after a reveal: the voiceprint card flies in, small. */
export function openKeepFromReveal(): void {
  open('reveal')
}

/** What a singer chose on Keep: a way in, Find your range first, Not now. */
export type KeepChoice = 'apple' | 'google' | 'email' | 'find-range' | 'not-now'

let heard: ((choice: KeepChoice) => void) | null = null

/**
 * Hear each choice made on Keep while registered: the onboarding counts
 * them on its beat 7 (S7b §7). One listener at a time; registration
 * returns its own unregister.
 */
export function onKeepChoice(
  listener: (choice: KeepChoice) => void,
): () => void {
  heard = listener
  return () => {
    if (heard === listener) heard = null
  }
}

/** Keep's sheet: the singer chose. */
export function keepChose(choice: KeepChoice): void {
  heard?.(choice)
}

/** Not now; and Back, the backdrop or a swipe on the sheet. */
export function declineOffer(): void {
  if (untrack(sheetOpen)) keepChose('not-now')
  setSheetOpen(false)
}

/** Keep has done its part: signed in, or handed over to the sign-in sheet. */
export function closeOffer(): void {
  setSheetOpen(false)
}

/**
 * Register what "Find your range first" runs. It runs the range, then opens
 * Keep again (S7b §3.2). Registration returns its own unregister.
 */
export function registerRangeFinder(run: () => void): () => void {
  setFinder(() => run)
  return () => {
    if (untrack(finder) === run) setFinder(null)
  }
}

/** The registered range finder, or null while there is none. Reactive. */
export const rangeFinder: Accessor<(() => void) | null> = finder

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
  return noAccountYet() && !shownBefore()
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
      // Asked now, so the gift's row is there when the sheet rises rather
      // than arriving under the singer's thumb.
      void loadAppGift()
      clearTimeout(beat)
      beat = setTimeout(() => {
        beat = undefined
        if (!due() || !roomClear()) return
        openKeep()
      }, OFFER_BEAT_MS)
    })

    onCleanup(() => {
      clearTimeout(beat)
    })
    return dispose
  })
}

/** Tests: nothing open, no range finder, nothing remembered this session. */
export function resetAccountOffer(): void {
  setSheetOpen(false)
  setArrival('plain')
  setFinder(null)
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
