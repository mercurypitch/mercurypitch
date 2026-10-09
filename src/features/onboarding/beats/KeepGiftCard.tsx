// ============================================================
// Keep — the launch gift card
// ============================================================
//
// Beside the account ask while the server features a promo code
// (promo-store): five credits, drawn as five amber tokens with Merc, and
// what they are for in one line. On a desktop it is the right-hand column,
// the art across its top; on a phone it sits under the rows, the tokens in a
// row with Merc beside them, and the copy shortens to fit.
//
// It renders only while a code is on offer, and promo-store already drops a
// code that has ended or filled, so nothing here needs a release when the
// offer closes.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { CreditCoin } from '@/components/billing/CreditCoin'
import { Mascot } from '@/components/Mascot'
import type { FeaturedPromo } from '@/db/services/billing-service'
import keep from '../keep.module.css'

/** "1 January": the day the offer ends, in UTC, where the server ends it. */
export function giftEndDay(expiresAt: string | null): string | null {
  if (expiresAt === null) return null
  const at = Date.parse(expiresAt)
  if (!Number.isFinite(at)) return null
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(at)
}

export const KeepGiftCard: Component<{ gift: FeaturedPromo }> = (props) => {
  const until = () => giftEndDay(props.gift.expiresAt)
  return (
    <div class={keep.giftCard} data-testid="keep-gift">
      <div class={keep.giftArt} aria-hidden="true">
        <span class={keep.giftCoins}>
          {/* Five, whatever the code grants: the art says "credits", the
              copy says how many. Each coin's place in the desktop arc is
              its position in this row (launch-gift.module.css). */}
          <For each={[0, 1, 2, 3, 4]}>
            {() => <CreditCoin class={keep.giftCoin} size={48} />}
          </For>
        </span>
        <span class={keep.giftMerc}>
          <Mascot state="idle" size={112} title="" />
        </span>
      </div>

      <div class={keep.giftCopy}>
        <p class={keep.giftEyebrow}>Launch gift</p>
        <p class={keep.giftTitle}>
          {props.gift.credits} free Karaoke Night credits
        </p>
        <p class={keep.giftBody}>
          Take the voice out of up to {props.gift.credits} songs
          <span class={keep.wideOnly}> and sing with the band</span>.
        </p>
        <Show
          when={until()}
          fallback={<p class={keep.giftFine}>With a free account.</p>}
        >
          {(day) => (
            // The phone's is the short one: the button under the card
            // already says the account is free.
            <p class={keep.giftFine}>
              <span class={keep.wideOnly} data-copy="wide">
                With a free account, until {day()}.
              </span>
              <span class={keep.narrowOnly} data-copy="narrow">
                Until {day()}
              </span>
            </p>
          )}
        </Show>
      </div>
    </div>
  )
}

export default KeepGiftCard
