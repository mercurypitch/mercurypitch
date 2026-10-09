// ============================================================
// Karaoke Night — the signed-out line under "Add a song"
// ============================================================
//
// Signed out, the card used to say studio separation is "a paid option".
// While the launch gift is on offer (promo-store), that is no longer true for
// a new account's first songs, so the line says what is: splitting on this
// device costs nothing, and a free account brings credits for the studio
// split. The button opens the account chip's form on "Create your account";
// a sign-up from this page already carries `signupSource: 'karaoke'`, which
// gives its first mail the Karaoke Night picture.
//
// Its own file so KaraokeRailPanels stays under the size ratchet.

import { onMount, Show } from 'solid-js'
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
          as a paid option — sign in to use it.
        </p>
      }
    >
      {(promo) => (
        <div class="kn-gift" data-testid="kn-launch-gift">
          <p class="kn-card-sub">
            Splitting on this device is free. For studio quality, get{' '}
            <span class="kn-gift-credits">{promo().credits} free credits</span>{' '}
            with a free account.
          </p>
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
