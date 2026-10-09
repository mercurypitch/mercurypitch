// ============================================================
// LaunchOfferProgress — "Launch credits, 2 of 5 used"
// ============================================================
//
// The launch offer's progress (launch offer plan, design B): how many launch
// credits are used, one amber coin each, a used one drawn as its ring, and
// the line that says what using them all earns, and by when. Once earned,
// it says what the next pack brings, with "See the packs" where the packs
// are a page away.
//
// Karaoke Night's song card and Settings › Credits show the full block; the
// Karaoke tab's options sheet shows it `compact`, and its desk header
// `inline`, one row under the credit balance with the line kept for hover
// and for screen readers. It renders nothing while there is nothing to say:
// no offer, or one used or lapsed.

import type { Component } from 'solid-js'
import { createEffect, For, Show } from 'solid-js'
import type { LaunchOffer } from '@/db/services/billing-service'
import { trackEvent } from '@/lib/analytics'
import { askForPacks, countProgressView, offerProgressLine, offerRewardLine, offerToShow, } from '@/lib/launch-offer'
import { CreditCoin } from './CreditCoin'
import styles from './LaunchOfferProgress.module.css'

/** More coins than this would be a row, not a count: the words carry it. */
const MAX_COINS = 10

export interface LaunchOfferProgressProps {
  offer: LaunchOffer | null | undefined
  /** The Karaoke tab's options sheet: smaller coins, tighter type. */
  compact?: boolean
  /** The Karaoke tab's desk header: one row, the line on hover. */
  inline?: boolean
  /** Shows "See the packs" once the reward is earned. */
  onSeePacks?: () => void
  /** The states to show. Default: counting and unlocked. */
  states?: ReadonlyArray<LaunchOffer['state']>
}

export const LaunchOfferProgress: Component<LaunchOfferProgressProps> = (
  props,
) => {
  const shown = (): LaunchOffer | null => {
    const offer = offerToShow(props.offer)
    if (offer === null) return null
    return props.states === undefined || props.states.includes(offer.state)
      ? offer
      : null
  }

  createEffect(() => {
    if (shown() !== null) countProgressView()
  })

  const seePacks = (): void => {
    trackEvent('offer_packs_tap')
    askForPacks()
    props.onSeePacks?.()
  }

  const line = (offer: LaunchOffer): string =>
    offer.state === 'unlocked'
      ? offerRewardLine(offer)
      : offerProgressLine(offer)

  const coins = (offer: LaunchOffer, size: number) => (
    <Show when={offer.goal <= MAX_COINS}>
      <span class={styles.coins} aria-hidden="true">
        <For each={Array.from({ length: offer.goal }, (_, i) => i)}>
          {(i) => <CreditCoin size={size} spent={i < offer.used} />}
        </For>
      </span>
    </Show>
  )

  const packsButton = (offer: LaunchOffer, className: string) => (
    <Show when={offer.state === 'unlocked' && props.onSeePacks}>
      <button type="button" class={className} onClick={seePacks}>
        See the packs
      </button>
    </Show>
  )

  return (
    <Show when={shown()}>
      {(offer) => (
        <Show
          when={props.inline === true}
          fallback={
            <div
              class={styles.progress}
              classList={{ [styles.compact]: props.compact === true }}
              data-testid="launch-offer-progress"
              data-state={offer().state}
            >
              <div class={styles.head}>
                <span class={styles.label}>Launch credits</span>
                <span class={styles.count}>
                  {offer().state === 'unlocked'
                    ? `All ${offer().goal} used`
                    : `${offer().used} of ${offer().goal} used`}
                </span>
              </div>
              {coins(offer(), props.compact === true ? 14 : 22)}
              <p class={styles.line}>
                {line(offer())}
                <Show when={offer().state === 'unlocked' && props.onSeePacks}>
                  {' '}
                </Show>
                {packsButton(offer(), styles.packs)}
              </p>
            </div>
          }
        >
          <div
            class={styles.inline}
            data-testid="launch-offer-progress"
            data-state={offer().state}
            title={line(offer())}
          >
            <Show
              when={offer().state === 'unlocked'}
              fallback={
                <>
                  <span class={styles.label}>Launch credits</span>
                  {coins(offer(), 10)}
                  <span class={styles.count} aria-hidden="true">
                    {offer().used} of {offer().goal} used
                  </span>
                  <span class={styles.srOnly}>
                    {offer().used} of {offer().goal} used. {line(offer())}
                  </span>
                </>
              }
            >
              <CreditCoin size={14} />
              <span>
                {offer().bonusCredits} extra credits on your next pack
              </span>
              {packsButton(offer(), styles.inlinePacks)}
            </Show>
          </div>
        </Show>
      )}
    </Show>
  )
}
