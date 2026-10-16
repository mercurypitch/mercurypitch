// ============================================================
// The native launch gift, as Keep offers it (S7b E6)
// ============================================================
//
// An account made in the app while the launch promo runs gets songs the app
// can spend (db-worker launch-offer.ts). Whether it runs, how many songs and
// until when are the server's answer (GET /api/billing/promo/featured,
// `appGift`), never the app's: Keep shows the row only while that answer
// says the gift is live, so the app never offers what an account would not
// get. The answer is asked again each time Keep opens, and a gift whose end
// has passed since stops showing without another ask.
//
// Only a build that splits songs asks: the gift is songs, and a build
// without Import has nothing to spend them on.

import { createSignal } from 'solid-js'
import type { AppGift } from '@/db/services/billing-service'
import { fetchAppGift } from '@/db/services/billing-service'
import { KARAOKE_IMPORT } from '@/lib/native-build'

const [gift, setGift] = createSignal<AppGift | null>(null)
let asking: Promise<void> | null = null

/** Ask the server whether the gift runs. One ask at a time; never rejects
 *  (fetchAppGift answers null on any failure). */
export function loadAppGift(): Promise<void> {
  if (!KARAOKE_IMPORT) return Promise.resolve()
  asking ??= fetchAppGift()
    .then((answer) => {
      setGift(answer)
    })
    .finally(() => {
      asking = null
    })
  return asking
}

/** The gift while it runs: the server said so, and its end has not passed.
 *  Reactive: reads the store's signal. */
export function liveAppGift(now: number = Date.now()): AppGift | null {
  const current = gift()
  if (current === null) return null
  if (current.endsAt !== null && now > Date.parse(current.endsAt)) return null
  return current
}

/** Tests: what the server last said, or nothing asked yet. */
export function resetAppGift(next: AppGift | null = null): void {
  setGift(next)
  asking = null
}
