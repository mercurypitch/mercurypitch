// ============================================================
// LaunchOfferRewardSheet — "All 5 used"
// ============================================================
//
// The launch offer's reward, said once (launch offer plan, design B): when
// GET /api/billing/me first reports it earned, a sheet rises over the page
// the singer is on. "See the packs" opens Settings › Credits at the packs,
// where every pack shows the extra credits; "Not now" at the top right
// closes it. Either
// way it does not open again for this account in this browser. The reward
// does not expire, so the sheet names no end for it (owner decision D4).
//
// Mounted where songs are split: Karaoke Night and the app's Karaoke tab.

import type { Component } from 'solid-js'
import { createEffect, createSignal, createUniqueId, on, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { currentAccountId } from '@/db/services/auth-service'
import type { LaunchOffer } from '@/db/services/billing-service'
import { trackEvent } from '@/lib/analytics'
import { askForPacks, markRewardSheetSeen, offerRewardLine, rewardSheetSeen, } from '@/lib/launch-offer'
import { useFocusTrap } from '@/lib/use-focus-trap'
import styles from './LaunchOfferRewardSheet.module.css'

/** The purchase mail's picture: Merc holding up a credit. */
const ART = '/email/hero-08-credits-v1.jpg'

export interface LaunchOfferRewardSheetProps {
  offer: LaunchOffer | null | undefined
  /** Take the singer to the packs. */
  onSeePacks: () => void
}

export const LaunchOfferRewardSheet: Component<LaunchOfferRewardSheetProps> = (
  props,
) => {
  let sheetRef: HTMLElement | undefined
  let titleRef: HTMLHeadingElement | undefined
  const titleId = createUniqueId()
  // Whom this page closed the sheet for: an account, or null for one it
  // cannot name. Kept in memory as well as in storage, so a browser that
  // blocks storage still closes it for the rest of the page.
  const [closed, setClosed] = createSignal<{ account: string | null } | null>(
    null,
  )

  const earned = (): LaunchOffer | null => {
    const offer = props.offer
    if (offer?.state !== 'unlocked') return null
    if (closed()?.account === currentAccountId()) return null
    return rewardSheetSeen() ? null : offer
  }

  createEffect(
    on(
      () => earned() !== null,
      (open) => {
        if (open) trackEvent('offer_unlocked_view')
      },
    ),
  )

  const close = (): void => {
    markRewardSheetSeen()
    setClosed({ account: currentAccountId() })
  }

  const seePacks = (): void => {
    trackEvent('offer_packs_tap')
    close()
    askForPacks()
    props.onSeePacks()
  }

  // Focus starts on the title: a screen reader reads the sheet from the
  // top, and the button does not open wearing a focus ring.
  useFocusTrap(() => sheetRef, {
    isOpen: () => earned() !== null,
    onClose: close,
    initialFocus: () => titleRef,
  })

  return (
    <Show when={earned()}>
      {(offer) => (
        <Portal>
          <div class={styles.backdrop} onClick={close}>
            <section
              ref={sheetRef}
              class={styles.sheet}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              data-testid="launch-offer-reward"
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" class={styles.notNow} onClick={close}>
                Not now
              </button>
              <img
                class={styles.art}
                src={ART}
                alt=""
                width="1200"
                height="800"
                decoding="async"
              />
              <h2
                ref={titleRef}
                id={titleId}
                class={styles.title}
                tabIndex={-1}
              >
                All {offer().goal} used
              </h2>
              <p class={styles.line}>{offerRewardLine(offer())}</p>
              <button type="button" class={styles.primary} onClick={seePacks}>
                See the packs
              </button>
            </section>
          </div>
        </Portal>
      )}
    </Show>
  )
}

export default LaunchOfferRewardSheet
