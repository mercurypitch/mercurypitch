// ============================================================
// The launch offer in the app: its words, and what this browser remembers
// ============================================================
//
// GET /api/billing/me says where the account stands (LaunchOffer,
// workers/db-worker/src/offer-rules.ts): use all of the launch credits by a
// day, and the next pack comes with extra credits. Earned, the reward does
// not expire, so no line here names an end for it (owner decision D4).
//
// The progress block (LaunchOfferProgress) and the reward sheet
// (LaunchOfferRewardSheet) share these words. The sheet opens once per
// account in this browser; the progress counts as seen once a page session.
// "See the packs" asks Settings › Credits to open at the packs.

import { createSignal } from 'solid-js'
import { currentAccountId } from '@/db/services/auth-service'
import type { LaunchOffer } from '@/db/services/billing-service'
import { trackEvent } from '@/lib/analytics'

const DAY = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

/** "23 October": the window's last day, in UTC like the window itself. */
export function offerDay(deadline: string): string {
  return DAY.format(new Date(deadline))
}

/** While the window is open: what to do, by when, and what it earns. */
export function offerProgressLine(offer: LaunchOffer): string {
  return `Use all ${offer.goal} by ${offerDay(offer.deadline)} and your next pack comes with ${offer.bonusCredits} extra credits.`
}

/** Once it is earned. */
export function offerRewardLine(offer: LaunchOffer): string {
  return `Your next pack comes with ${offer.bonusCredits} extra credits.`
}

/** The offer when there is something to show of it: counting, or earned and
 *  waiting for a pack. Used and lapsed offers say nothing. */
export function offerToShow(
  offer: LaunchOffer | null | undefined,
): LaunchOffer | null {
  return offer?.state === 'counting' || offer?.state === 'unlocked'
    ? offer
    : null
}

let progressCounted = false

/** Count the progress block as seen, once a page session. */
export function countProgressView(): void {
  if (progressCounted) return
  progressCounted = true
  trackEvent('offer_progress_view')
}

const SEEN_KEY = 'mp.launchOffer.rewardSeen.v1'

function seenAccounts(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as unknown
    return Array.isArray(raw)
      ? raw.filter((id): id is string => typeof id === 'string')
      : []
  } catch {
    return []
  }
}

/** Whether the account signed in here has had its reward sheet. */
export function rewardSheetSeen(): boolean {
  const account = currentAccountId()
  return account !== null && seenAccounts().includes(account)
}

/** The sheet opened for the account signed in here: never again. */
export function markRewardSheetSeen(): void {
  const account = currentAccountId()
  if (account === null) return
  try {
    const seen = seenAccounts().filter((id) => id !== account)
    localStorage.setItem(
      SEEN_KEY,
      JSON.stringify([...seen, account].slice(-20)),
    )
  } catch {
    // Storage blocked: the sheet may open again next visit. Nothing breaks.
  }
}

const PACKS_KEY = 'mp.launchOffer.showPacks.v1'

function storedPacksAsk(): boolean {
  try {
    return sessionStorage.getItem(PACKS_KEY) === '1'
  } catch {
    return false
  }
}

// Kept in this tab's session storage as well, because Karaoke Night hands
// the singer to another page: the app reads the ask when it loads.
const [packsAsked, setPacksAsked] = createSignal(storedPacksAsk())

/** Whether "See the packs" is waiting for Settings › Credits to show them. */
export { packsAsked }

/** "See the packs": Settings › Credits opens at the packs, not at its top,
 *  where the claim card and the processing cards come first. */
export function askForPacks(): void {
  setPacksAsked(true)
  try {
    sessionStorage.setItem(PACKS_KEY, '1')
  } catch {
    // Storage blocked: a page that stays put still opens at the packs.
  }
}

/** The packs are on screen: the ask is answered. */
export function packsShown(): void {
  setPacksAsked(false)
  try {
    sessionStorage.removeItem(PACKS_KEY)
  } catch {
    // Nothing to clear.
  }
}
