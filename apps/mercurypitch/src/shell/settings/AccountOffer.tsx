// ============================================================
// The account offer, drawn: a sheet after a Keep, a card in Settings
// ============================================================
//
// 2a and 2b of the S6 mock. The same title, the same three promises and the
// same honest limit, all from account-copy.ts, and the same two answers:
// Sign in and Later, the same size side by side (REQ-NAM-012). The sheet has
// no close button, so its two answers are the only ways out; Back, the
// backdrop and a swipe answer Later. When and whether either one shows is
// account-offer.ts.

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import './settings.css'
import { Sheet } from '@/components/mobile/Sheet'
import { ACCOUNT_OFFER, takesStayHere } from './account-copy'
import { acceptOffer, declineOffer, offerIsFirstTake, offerOpen, } from './account-offer'
import { AccountPromises } from './AccountPromises'

/** Sign in and Later: one control each, the same size, side by side. */
function Answers(props: { small?: boolean }): JSX.Element {
  const size = (): string =>
    props.small === true ? ' mp-set-button--small' : ''
  return (
    <div class="mp-offer__answers">
      <button
        type="button"
        class={`mp-set-button${size()}`}
        data-testid="offer-sign-in"
        onClick={() => {
          acceptOffer()
        }}
      >
        {ACCOUNT_OFFER.accept}
      </button>
      <button
        type="button"
        class={`mp-set-button mp-set-button--secondary${size()}`}
        data-testid="offer-later"
        onClick={() => {
          declineOffer()
        }}
      >
        {ACCOUNT_OFFER.decline}
      </button>
    </div>
  )
}

/** 2a: once, a beat after a take is kept in the Sing room. */
export function AccountOfferSheet(): JSX.Element {
  return (
    <Sheet
      isOpen={offerOpen()}
      close={declineOffer}
      ariaLabel={ACCOUNT_OFFER.title}
      class="mp-offer-sheet"
    >
      <div class="mp-offer mp-offer--sheet" data-testid="account-offer">
        <div class="mp-offer__head">
          <Show when={offerIsFirstTake()}>
            <span class="mp-offer__label">{ACCOUNT_OFFER.firstTake}</span>
          </Show>
          <h2 class="mp-offer__title">{ACCOUNT_OFFER.title}</h2>
        </div>
        <AccountPromises bare />
        <p class="mp-set__caption">{takesStayHere()}</p>
        <Answers />
      </div>
    </Sheet>
  )
}

/** 2b: at the top of Settings, in the Account row's place, until Later. */
export function AccountOfferCard(): JSX.Element {
  return (
    <section
      class="mp-set-card mp-offer mp-offer--card"
      aria-label={ACCOUNT_OFFER.title}
      data-testid="offer-card"
    >
      <h2 class="mp-offer__title">{ACCOUNT_OFFER.title}</h2>
      <AccountPromises bare />
      <p class="mp-set__caption">{takesStayHere()}</p>
      <Answers small />
    </section>
  )
}
