// ============================================================
// HomeCheckupCardMount — how Home reaches its weekly Check-up card
// ============================================================
//
// The card (src/features/check-up/HomeCheckupCard) opens the Voice Mirror, a
// page of its own that the native shell does not carry: its bundle has one
// document. So, as for the plan card (HomePlanCardMount.tsx), the constant
// picks a stand-in that renders nothing before `lazy()` is written, and the
// native build has neither the call nor the chunk. On the web the card is a
// chunk of its own, which keeps its words and reads out of Home's first paint.
//
// It draws inside a Suspense, so Home does not wait for it, and inside an
// ErrorBoundary: a dead chunk (offline, or a deploy swapped the hashed assets)
// costs Home the card and not the page.
//
// Until the card has its chunk and its history, the Suspense keeps a slot
// when this browser's own takes say a Check-up is due, so a card that lands
// after Home's first paint does not push the streak card down (the layout
// shift HomePlanCardMount.tsx measured for the plan card). The guess reads
// the device's takes only; when the account's history says otherwise (a newer
// take from another device) the slot goes and nothing draws. A read that
// throws keeps no slot. The slot takes the card's height from its own width
// (HomeCheckupCardMount.module.css), so it is told the two things that change
// the card's words: whether somebody is signed in, since the card then has no
// account line (accountHeld answers from the stored token, before any fetch),
// and which of its two wordings the card has.

import type { Component, JSX } from 'solid-js'
import { ErrorBoundary, lazy, Show, Suspense } from 'solid-js'
import { accountHeld } from '@/db/services/auth-service'
import { loadLocalVoiceprints } from '@/db/services/voiceprint-service'
import { checkupCardShown, checkupCardWording, newestTakeMs, readCardDismissal, } from '@/lib/check-up/due'
import { IS_NATIVE_BUILD } from '@/lib/native-build'
import styles from './HomeCheckupCardMount.module.css'

const HomeCheckupCard: Component = IS_NATIVE_BUILD
  ? () => null
  : lazy(async () =>
      import('@/features/check-up/HomeCheckupCard').then((m) => ({
        default: m.HomeCheckupCard,
      })),
    )

/** What the slot needs to know to be the card's height. */
interface Slot {
  account: 'signed-in' | 'signed-out'
  words: 'week' | 'day'
}

/** The slot Home keeps the card as it draws, if any: never in the native
 *  build. */
function slotNow(): Slot | null {
  try {
    if (IS_NATIVE_BUILD) return null
    const takes = loadLocalVoiceprints()
    const now = Date.now()
    const newest = newestTakeMs(takes)
    if (newest === null || !checkupCardShown(takes, readCardDismissal(), now))
      return null
    return {
      account: accountHeld() ? 'signed-in' : 'signed-out',
      words: checkupCardWording(newest, now),
    }
  } catch {
    return null
  }
}

/** Home's weekly Check-up card, above the streak card; nothing when none is due. */
export function HomeCheckupCardMount(): JSX.Element {
  const slot = slotNow()
  return (
    <ErrorBoundary
      fallback={(error: unknown) => {
        console.warn('[home] The Check-up card was left out of Home:', error)
        return null
      }}
    >
      <Suspense
        fallback={
          <Show when={slot}>
            {(kept) => (
              <div
                class={styles.slot}
                data-account={kept().account}
                data-words={kept().words}
                data-testid="home-checkup-slot"
                aria-hidden="true"
              >
                <div class={styles.frame} />
              </div>
            )}
          </Show>
        }
      >
        <HomeCheckupCard />
      </Suspense>
    </ErrorBoundary>
  )
}
