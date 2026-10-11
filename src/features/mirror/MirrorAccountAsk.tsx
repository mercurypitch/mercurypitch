// ============================================================
// Voice Mirror — "Keep your voiceprints", under the results
// ============================================================
//
// The last thing on the results, for a browser that has never met an
// account (account-ask.ts has the rule). It says what an account does for
// the voiceprint just made, names the launch gift while the server features
// one, and opens the shared account dialog on its sign-up pane. Nothing is
// held back to make the case: without an account the voiceprint stays saved
// in this browser, and creating one moves it in (REQ-VPR-014).
//
// Cheap on purpose. The Mirror is an ad landing page with a first-paint
// budget, so this file holds the words and the button: the promo store
// loads when the ask first shows, and the dialog only when it is needed
// (MirrorAccountHostSlot below).

import type { Component } from 'solid-js'
import { createSignal, createUniqueId, ErrorBoundary, lazy, onMount, Show, Suspense, } from 'solid-js'
import type { FeaturedPromo } from '@/db/services/billing-service'
import { GIFT_ARRIVES, GIFT_BODY, giftTitle } from '@/lib/launch-gift-copy'
import type * as PromoStoreModule from '@/stores/promo-store'
import { askForAccount, asksForAccount, hostDidNotLoad, hostFailed, hostWanted, signUpAsked, } from './account-ask'
import { trackFunnel } from './funnel'

type PromoStore = typeof PromoStoreModule

const MirrorAccountHost = lazy(() => import('./MirrorAccountHost'))

/** "1 January": the day the offer ends, in UTC, where the server ends it. */
export function offerEndDay(expiresAt: string | null): string | null {
  if (expiresAt === null) return null
  const at = Date.parse(expiresAt)
  if (!Number.isFinite(at)) return null
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(at)
}

/** The ask, when this browser has no account. Renders nothing otherwise. */
export const MirrorAccountAsk: Component = () => (
  <Show when={asksForAccount()}>
    <AccountAsk />
  </Show>
)

const AccountAsk: Component = () => {
  const titleId = createUniqueId()
  const [promoStore, setPromoStore] = createSignal<PromoStore | null>(null)

  onMount(() => {
    // Asked only once the ask is on screen, and never in the first paint.
    // Shared with the dialog, which reads the same answer for its sign-up
    // toast. A failure means no gift line; the ask stands without one.
    import('@/stores/promo-store')
      .then((store) => {
        setPromoStore(() => store)
        return store.loadFeaturedPromo()
      })
      .catch(() => undefined)
  })

  const gift = (): FeaturedPromo | null => promoStore()?.offeredPromo() ?? null

  return (
    <section
      class="mirror-keep"
      aria-labelledby={titleId}
      data-testid="mirror-account-ask"
    >
      <h2 class="mirror-keep-title" id={titleId}>
        Keep your voiceprints
      </h2>
      <p class="mirror-keep-line">
        A free account keeps every one you make, this one included, on any
        device you sign in on.
      </p>
      <Show when={gift()}>{(promo) => <GiftLine promo={promo()} />}</Show>
      {/* aria-disabled, not disabled: a disabled button drops focus to the
          page, and the dialog hands focus back to whatever held it as it
          opened. The guard keeps a double tap to one count. */}
      <button
        type="button"
        class="mirror-cta mirror-keep-button"
        aria-disabled={signUpAsked() ? 'true' : undefined}
        onClick={() => {
          if (signUpAsked()) return
          trackFunnel('cta_account_click')
          askForAccount()
        }}
      >
        {signUpAsked() ? 'Opening…' : 'Create my free account'}
      </button>
      <Show when={hostFailed()}>
        <p class="mirror-keep-fine mirror-error" role="status">
          The sign-up form didn't load. Check your connection and reload the
          page; your voiceprint stays saved here.
        </p>
      </Show>
      <Show when={gift() !== null && !hostFailed()}>
        <p class="mirror-keep-fine">{GIFT_ARRIVES}</p>
      </Show>
    </section>
  )
}

/** The launch gift, in the words onboarding's Keep uses for it
 *  (src/lib/launch-gift-copy.ts). */
const GiftLine: Component<{ promo: FeaturedPromo }> = (props) => {
  const until = () => offerEndDay(props.promo.expiresAt)
  return (
    <div class="mirror-keep-gift" data-testid="mirror-account-gift">
      <p class="mirror-keep-gift-tag">
        Launch gift
        <Show when={until()}>{(day) => <span> · until {day()}</span>}</Show>
      </p>
      <p class="mirror-keep-gift-line">{giftTitle(props.promo.credits)}</p>
      <p class="mirror-keep-gift-body">{GIFT_BODY}</p>
    </div>
  )
}

/**
 * The account dialog and its toasts, mounted once something needs them.
 * Beside MirrorApp rather than inside the results, so a sign-in that outlives
 * the results screen (Start over with the form open) keeps its dialog.
 */
export const MirrorAccountHostSlot: Component = () => (
  <Show when={hostWanted()}>
    <ErrorBoundary fallback={() => <HostDidNotLoad />}>
      <Suspense>
        <MirrorAccountHost />
      </Suspense>
    </ErrorBoundary>
  </Show>
)

function HostDidNotLoad() {
  onMount(hostDidNotLoad)
  return null
}
