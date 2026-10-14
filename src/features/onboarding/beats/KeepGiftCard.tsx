// ============================================================
// Keep — the launch gift card
// ============================================================
//
// Beside the account ask while the server features a promo code
// (promo-store): five credits, drawn as five amber tokens with Merc, and
// what they buy in one line. On a desktop it is the right-hand column,
// the art across its top; on a phone it sits under the rows, the tokens in a
// row with Merc beside them, and the fine print shortens to fit.
//
// Named by what the credits buy (owner testing, 11 Oct 2026): a credit
// splits one song of up to 12 minutes into voice and band, and a longer
// song or a full band split costs more, so the title says "up to". The
// lines live in ../copy.ts.
//
// It renders only while a code is on offer, and promo-store already drops a
// code that has ended or filled, so nothing here needs a release when the
// offer closes. Last in the card, while the server states the launch offer,
// what using the credits earns (giftOfferLine).

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { CreditCoin } from '@/components/billing/CreditCoin'
import { Mascot } from '@/components/Mascot'
import type { FeaturedPromo } from '@/db/services/billing-service'
import { giftOfferLine } from '@/lib/launch-gift-copy'
import { GIFT_BODY, giftTitle } from '../copy'
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
              its position in this row (keep.module.css). */}
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
        <p class={keep.giftTitle}>{giftTitle(props.gift.credits)}</p>
        <p class={keep.giftBody}>{GIFT_BODY}</p>
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
        {/* After the gift's own end, so "Until 1 January" stays with the
            gift and the offer's day reads as the offer's. */}
        <Show when={giftOfferLine(props.gift)}>
          {(line) => (
            <p class={keep.giftOffer} data-testid="gift-offer-line">
              {line()}
            </p>
          )}
        </Show>
      </div>
    </div>
  )
}
