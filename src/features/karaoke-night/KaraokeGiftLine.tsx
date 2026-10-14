// ============================================================
// Karaoke Night — the signed-out line under "Add a song"
// ============================================================
//
// Signed out, the card used to say studio separation is "a paid option".
// While the launch gift is on offer (promo-store), that is no longer true for
// a new account's first songs, so the line says what is: splitting on this
// device costs nothing, and a free account brings song separations for the
// studio split: named by what they buy, since a visitor here has not met a
// credit yet (as First Light's gift names them). The button opens the
// account chip's form on "Create your account"; a sign-up from this page
// already carries `signupSource: 'karaoke'`, which gives its first mail the
// Karaoke Night picture. Under it, while the server states the launch
// offer, what using the credits earns (launch-gift-copy `giftOfferLine`):
// the same terms the rail's progress block counts once they are claimed.
//
// Its own file so KaraokeRailPanels stays under the size ratchet.

import { onMount, Show } from 'solid-js'
import { giftCount, giftOfferLine } from '@/lib/launch-gift-copy'
import { rememberGiftOffered } from '@/stores/launch-gift-store'
import { loadFeaturedPromo, offeredPromo } from '@/stores/promo-store'
import { trackKaraoke } from './funnel'
import { askForSignUp } from './sign-up-ask'

export function KaraokeGiftLine() {
  onMount(() => {
    void loadFeaturedPromo()
  })

  return (
    <Show
      when={offeredPromo()}
      fallback={
        <p class="kn-card-sub">
          All data stays on your device. Higher-quality separation is available
          as a paid option. Sign in to use it.
        </p>
      }
    >
      {(promo) => (
        <div class="kn-gift" data-testid="kn-launch-gift">
          <p class="kn-card-sub">
            Splitting on this device is free. For studio quality, get{' '}
            <span class="kn-gift-credits">{giftCount(promo().credits)}</span>{' '}
            with a free account.
          </p>
          <Show when={giftOfferLine(promo())}>
            {(line) => (
              <p
                class="kn-card-sub kn-gift-offer"
                data-testid="gift-offer-line"
              >
                {line()}
              </p>
            )}
          </Show>
          <button
            type="button"
            class="kn-btn kn-btn--primary kn-gift-btn"
            onClick={() => {
              trackKaraoke('karaoke_gift_signup_tap')
              rememberGiftOffered(promo())
              askForSignUp()
            }}
          >
            Create my free account
          </button>
        </div>
      )}
    </Show>
  )
}
