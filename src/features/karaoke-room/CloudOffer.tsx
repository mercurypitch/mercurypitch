// ============================================================
// CloudOffer — paywall B v2, "The path" (plan S7b §4)
// ============================================================
//
// The one place the app offers Mercury Pitch Cloud (owner, S7 D2). Opened by
// the import gate, by Settings' "See the plan" and later by the onboarding,
// through cloud-offer-store.ts, and drawn once by the native shell.
//
// LAYOUT (§4.1). A labelled "Not now" at the top right, there and tappable
// from the first frame. The two-lights art across the top, the kicker and
// the title, the three numbered steps (pick, split, sing: a real sequence,
// so the numbers stay), the plan row with the store's own price in the
// largest price type, one full-width Subscribe, the renewal terms, and
// Restore purchase, Terms and Privacy. Nothing says what else stays free:
// the owner removed that line (§1).
//
// THE PRICE'S OWN SLOT (§4.3). The price, a placeholder while the store is
// asked, or Retry when it could not say. The store's other answers (none to
// sell, pending, failed, restored) are today's sentences, unchanged, on a
// line reserved under the plan row. The block they sit in is held at the
// foot of the sheet, so whatever is said there, Subscribe never moves.
// Subscribe can be tapped only with the price in view (App Store 3.1.2).
//
// WHO IS ASKED WHAT (§4.3). Without an account, a text button under
// Subscribe offers the free song an account brings; it hands over to the
// account sheet the shell names (`onAccount`). A signed-in singer whose free
// song is used is told when the next one comes, above the plan; one the
// server gives none a month (`monthly` false) is never told that, and is
// asked to confirm their email only when /api/auth/me says it is not
// confirmed yet, which is what the server's rule asks (getsFreeSong). After a
// purchase on a phone without an account, Sign in opens the sign-in sheet
// the shell names (`onSignIn`): the singer has paid, so it is no offer.
//
// SUBSCRIBE WHEN THE STORE HAS IT (TestFlight build 919). A purchase this
// phone made signed out goes to the account signed in now, and the sheet
// says what follows a yes (`moved`). One filed under another account stays
// there, and the status line says so and names Restore purchase.
//
// MOTION (§4.4). About 1.2 s: the sheet rises, the art opens, the words and
// the steps arrive in turn while the line between the steps draws, then the
// plan, then Subscribe, and one light sweeps across it once. Transform and
// opacity only. Reduced motion: everything present, one 150 ms fade.
//
// MERC, SMALL BY THE ART, on the offer the onboarding opens (S7b beat 9):
// its one Merc, handed over through cloud-offer-store.ts (cloudOfferGuest),
// stands beside the two lights once the art has opened. Decorative, as he
// is everywhere: the hero is hidden from a screen reader.
//
// A NIGHT SURFACE IN EVERY THEME. The art is a dark stage and its fade ends
// on Obsidian, so the sheet keeps its own dark palette in the light theme
// as well (cloud-offer.module.css).

import type { Accessor, JSX } from 'solid-js'
import { createEffect, createResource, createSignal, For, Match, on, onCleanup, onMount, Show, Switch, } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import { readMe } from '@/db/services/auth-me-service'
import { accountHeld } from '@/db/services/auth-service'
import { trackEvent } from '@/lib/analytics'
import { deviceNoun, thisDeviceLower, yourDevice } from '@/lib/device-noun'
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal-links'
import type { KaraokeOffer } from '@/stores/native-shell-store'
import { nativeShellApi } from '@/stores/native-shell-store'
import heroArt from './assets/paywall-two-lights.webp'
import { PURCHASE_EVENT } from './cloud-measure'
import styles from './cloud-offer.module.css'
import { closeCloudOffer, cloudOffer, cloudOfferGuest, showCloudSubscribed, } from './cloud-offer-store'
import { awaitSubscription, CLOUD_NAME, CONFIRM_FOR_FREE_SONG_LINE, confirmEmailForFreeSong, freeSongUsed, freeSongWithheld, KARAOKE_PLAN, karaokeSongs, nextFreeSongLine, refreshKaraokeSongs, restoreNote, songsOnTheWay, } from './karaoke-songs'

/** The sheet's name, and its title: what the singer gets (E3). */
export const CLOUD_OFFER_TITLE = 'Sing your own songs'

/**
 * The line under Subscribe for a singer without an account (§4.3). It names
 * the confirmed email because the server does: the month's free song goes
 * only to an account with its email confirmed (getsFreeSong, db-worker
 * songs-allowance.ts; owner, 16 Oct). Apple, Google and an emailed code
 * confirm it as the account is made; a password account made on the web
 * waits for its confirm link.
 */
export const FREE_ACCOUNT_LINE =
  'Sign up and confirm your email for 1 free song a month'

/** The renewal terms, as both stores ask (§4.2). */
export const CLOUD_TERMS =
  'Renews every month until you cancel. Cancel any time in Settings.'

/**
 * Subscribe found the store account already paying for the subscription,
 * filed under another account. It never moves by itself, since a phone can
 * be shared (owner rule D2): Restore purchase, in this sheet's footer, is
 * the way to move it.
 */
export const HELD_ELSEWHERE_LINE =
  "You're already subscribed, on another account. Tap Restore purchase to move it here."

/** One step of the path: what happens, then the detail it needs. */
export interface CloudStep {
  readonly title: string
  readonly detail: string
}

/**
 * The three steps (§4.2), naming the device in hand. Android has no Files
 * app to name, so its first step says where the song comes from instead.
 */
export function cloudSteps(platform?: string): readonly CloudStep[] {
  return [
    {
      title:
        platform === 'android'
          ? `Pick a song from ${yourDevice()}`
          : 'Pick a song from Files',
      detail: 'MP3, M4A, WAV or FLAC, up to 12 minutes',
    },
    {
      title: 'Our servers take the voice out',
      detail: 'Keep it as a quiet guide, or switch it off',
    },
    {
      title: `Sing it on ${thisDeviceLower()}`,
      detail: 'Saved here. Plays offline.',
    },
  ]
}

/** The store's price for the offer, asked for when it opens. */
type Price =
  | { readonly kind: 'asking' }
  | { readonly kind: 'priced'; readonly offer: KaraokeOffer }
  /** No store here, or none with a plan to sell yet. */
  | { readonly kind: 'unavailable' }
  /** The store could not say: Retry asks again. */
  | { readonly kind: 'failed' }

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** The phone's reduced-motion setting, kept current while mounted. */
function reducedMotion(): Accessor<boolean> {
  const [reduced, setReduced] = createSignal(false)
  onMount(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    setReduced(query.matches)
    const onChange = (event: MediaQueryListEvent): void => {
      setReduced(event.matches)
    }
    query.addEventListener('change', onChange)
    onCleanup(() => {
      query.removeEventListener('change', onChange)
    })
  })
  return reduced
}

const CloseGlyph = (): JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </svg>
)

/**
 * The song from step 1 to step 2: the voice and the music braided (the
 * colours are the stem mixer's, Vocal amber and Instrumental blue).
 */
const SongStrand = (): JSX.Element => (
  <svg
    class={styles.strand}
    viewBox="0 0 16 24"
    preserveAspectRatio="none"
    fill="none"
    stroke-width="2"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path
      d="M8 0C11 2.5 11 5.5 8 8C5 10.5 5 13.5 8 16C11 18.5 11 21.5 8 24"
      stroke="#3b82f6"
      vector-effect="non-scaling-stroke"
    />
    <path
      d="M8 0C5 2.5 5 5.5 8 8C11 10.5 11 13.5 8 16C5 18.5 5 21.5 8 24"
      stroke="#f59e0b"
      vector-effect="non-scaling-stroke"
    />
  </svg>
)

/** From step 2 to step 3: the voice leaves, the music goes on alone. */
const MusicStrand = (): JSX.Element => (
  <svg
    class={styles.strand}
    viewBox="0 0 16 24"
    preserveAspectRatio="none"
    fill="none"
    stroke-width="2"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="cloud-voice-leaves" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f59e0b" />
        <stop offset="1" stop-color="#f59e0b" stop-opacity="0.05" />
      </linearGradient>
    </defs>
    <path
      d="M8 0C9 6 13 10 16 18"
      stroke="url(#cloud-voice-leaves)"
      vector-effect="non-scaling-stroke"
    />
    <path d="M8 0V24" stroke="#3b82f6" vector-effect="non-scaling-stroke" />
  </svg>
)

export interface CloudOfferProps {
  /** The platform the app runs on ('ios', 'android'); Files is iOS's word. */
  readonly platform?: string
  /**
   * Open the account sheet for the free account under Subscribe. The shell
   * names it; without one, the sign-in sheet every in-app "Sign in" opens.
   */
  readonly onAccount?: () => void
  /**
   * Sign in, once a purchase is made on a phone without an account. The
   * shell names it; without one, the same sign-in sheet.
   */
  readonly onSignIn?: () => void
}

export function CloudOffer(props: CloudOfferProps): JSX.Element {
  const [price, setPrice] = createSignal<Price>({ kind: 'asking' })
  const [note, setNote] = createSignal<string | null>(null)
  const [buying, setBuying] = createSignal(false)
  const reduced = reducedMotion()

  const view = () => cloudOffer()?.view ?? null
  const offering = (): boolean => view() === 'offer'

  // A signed-in singer the server gives no free song a month is asked to
  // confirm their email only when that is what stands in the way: the
  // account is read each time the offer opens for one. An account that
  // cannot be read is told nothing.
  const [askToConfirm] = createResource(
    () => offering() && freeSongWithheld(karaokeSongs(), accountHeld()),
    async (): Promise<boolean> => {
      const read = await readMe()
      return read.status === 'ok' && confirmEmailForFreeSong(read.me.user)
    },
  )

  const openAccount = (): void => {
    closeCloudOffer('done')
    if (props.onAccount === undefined) nativeShellApi()?.openSignIn?.()
    else props.onAccount()
  }

  const signInAfterPurchase = (): void => {
    closeCloudOffer('done')
    if (props.onSignIn === undefined) nativeShellApi()?.openSignIn?.()
    else props.onSignIn()
  }

  // The latest ask for the price is the one that stands.
  let asks = 0
  const askPrice = (): void => {
    const ask = nativeShellApi()?.karaokeSubscription?.offer
    if (ask === undefined) {
      setPrice({ kind: 'unavailable' })
      return
    }
    asks += 1
    const mine = asks
    setPrice({ kind: 'asking' })
    void ask().then(
      (found) => {
        if (mine !== asks) return
        setPrice(
          found === null
            ? { kind: 'unavailable' }
            : { kind: 'priced', offer: found },
        )
      },
      () => {
        if (mine === asks) setPrice({ kind: 'failed' })
      },
    )
  }

  createEffect(
    on(offering, (now) => {
      if (!now) return
      setNote(null)
      if (price().kind !== 'priced') askPrice()
    }),
  )

  const priced = (): KaraokeOffer | null => {
    const now = price()
    return now.kind === 'priced' ? now.offer : null
  }

  /** What the price's slot says beside it: today's sentences, unchanged. */
  const said = (): string => {
    const told = note()
    if (told !== null) return told
    switch (price().kind) {
      case 'unavailable':
        return 'Subscriptions are not available yet.'
      case 'failed':
        return 'The price could not be loaded. Check the connection and try again.'
      default:
        return ''
    }
  }

  const subscribe = async (): Promise<void> => {
    const api = nativeShellApi()?.karaokeSubscription
    setNote(null)
    setBuying(true)
    trackEvent('cloud_subscribe_tap')
    const outcome =
      api === undefined
        ? 'unavailable'
        : await api.subscribe().catch(() => 'failed' as const)
    setBuying(false)
    trackEvent(PURCHASE_EVENT[outcome])
    switch (outcome) {
      case 'purchased':
      case 'moved':
        showCloudSubscribed()
        return
      case 'held-elsewhere':
        setNote(HELD_ELSEWHERE_LINE)
        return
      case 'pending':
        setNote(
          'The purchase is waiting for approval. The songs arrive once it is approved.',
        )
        return
      case 'cancelled':
        return
      case 'unavailable':
        setNote('Subscriptions are not available yet.')
        return
      case 'failed':
        setNote(
          'The store could not complete the purchase. Try again in a moment.',
        )
    }
  }

  const restore = async (): Promise<void> => {
    const api = nativeShellApi()?.karaokeSubscription
    setNote(null)
    const outcome =
      api === undefined
        ? 'unavailable'
        : await api.restore().catch(() => 'failed' as const)
    setNote(restoreNote(outcome))
    if (outcome !== 'restored') return
    const songs = await awaitSubscription(async () =>
      refreshKaraokeSongs({ identify: true }),
    )
    // The singer may have closed the offer meanwhile; nothing opens by itself.
    if (!offering()) return
    if (songs.subscribed) closeCloudOffer('done')
    else showCloudSubscribed(false)
  }

  /** What the subscribed sheet says of the songs: here, or coming. */
  const songsArrival = (): string => {
    if (karaokeSongs().subscribed) {
      return `${karaokeSongs().perPeriod} songs a month are yours.`
    }
    return songsOnTheWay()
      ? 'Your songs are on their way. They arrive in a moment.'
      : 'Your songs arrive within a few minutes.'
  }

  const panelClass = (): string =>
    offering()
      ? `${styles.night} ${styles.panel} ${reduced() ? styles.still : styles.moving}`
      : styles.night

  return (
    <Sheet
      isOpen={view() !== null}
      close={() => {
        closeCloudOffer(offering() ? 'not-now' : 'done')
      }}
      ariaLabel={offering() ? CLOUD_OFFER_TITLE : "You're subscribed"}
      snap={offering() ? 'tall' : 'content'}
      class={panelClass()}
      backdropClass={styles.scrim}
    >
      <Switch>
        <Match when={offering()}>
          <div class={styles.offer} data-testid="cloud-offer">
            <button
              type="button"
              class={styles.notNow}
              onClick={() => {
                closeCloudOffer('not-now')
              }}
            >
              Not now
            </button>
            <div class={styles.hero} aria-hidden="true">
              <div class={styles.heroBloom}>
                <img class={styles.heroArt} src={heroArt} alt="" />
              </div>
              <Show when={cloudOfferGuest()}>
                {(guest) => (
                  <div class={styles.heroGuest} data-testid="cloud-offer-guest">
                    {guest()}
                  </div>
                )}
              </Show>
            </div>
            <div class={styles.head}>
              <p class={styles.kicker}>{CLOUD_NAME}</p>
              <h2 class={styles.title}>{CLOUD_OFFER_TITLE}</h2>
            </div>
            <ol class={styles.path}>
              <For each={cloudSteps(props.platform)}>
                {(step, index) => (
                  <li class={styles.step}>
                    <span class={styles.stepMark} aria-hidden="true">
                      {index() + 1}
                    </span>{' '}
                    <span class={styles.stepText}>
                      <span class={styles.stepTitle}>{step.title}</span>{' '}
                      <span class={styles.stepDetail}>{step.detail}</span>
                    </span>
                    {index() === 0 ? <SongStrand /> : null}
                    {index() === 1 ? <MusicStrand /> : null}
                  </li>
                )}
              </For>
            </ol>
            <div class={styles.deal}>
              <Show when={freeSongUsed(karaokeSongs(), accountHeld())}>
                <p class={styles.freeLine}>{nextFreeSongLine()}</p>
              </Show>
              <Show
                when={
                  freeSongWithheld(karaokeSongs(), accountHeld()) &&
                  askToConfirm() === true
                }
              >
                <p class={styles.freeLine}>{CONFIRM_FOR_FREE_SONG_LINE}</p>
              </Show>
              <div class={styles.plan}>
                <p class={styles.planText}>
                  <span class={styles.planTitle}>
                    {`${karaokeSongs().perPeriod} songs a month`}
                  </span>{' '}
                  <span class={styles.planDetail}>
                    {`Unused songs carry over, up to ${karaokeSongs().cap ?? KARAOKE_PLAN.carryOverCap}`}
                  </span>
                </p>
                <div class={styles.priceSlot} data-testid="cloud-price">
                  <Switch>
                    <Match when={priced()}>
                      {(offer) => (
                        <>
                          <span class={styles.amount}>{offer().priceText}</span>{' '}
                          <span class={styles.per}>a month</span>
                        </>
                      )}
                    </Match>
                    <Match when={price().kind === 'asking'}>
                      <span class={styles.asking}>
                        <span class={styles.srOnly}>
                          Asking the store for the price
                        </span>
                      </span>
                    </Match>
                    <Match when={price().kind === 'failed'}>
                      <button
                        type="button"
                        class={styles.retry}
                        onClick={askPrice}
                      >
                        Retry
                      </button>
                    </Match>
                  </Switch>
                </div>
              </div>
              <p class={styles.status} role="status">
                {said()}
              </p>
              <button
                type="button"
                class={styles.subscribe}
                disabled={priced() === null || buying()}
                aria-busy={buying() ? 'true' : undefined}
                onClick={() => void subscribe()}
              >
                Subscribe
              </button>
              <Show when={!accountHeld()}>
                <button
                  type="button"
                  class={styles.freeAccount}
                  onClick={openAccount}
                >
                  {FREE_ACCOUNT_LINE}
                </button>
              </Show>
            </div>
            <div class={styles.fine}>
              <p class={styles.terms}>{CLOUD_TERMS}</p>
              <p class={styles.footer}>
                <button type="button" onClick={() => void restore()}>
                  Restore purchase
                </button>
                <span aria-hidden="true">·</span>
                <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
                  Terms
                </a>
                <span aria-hidden="true">·</span>
                <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
                  Privacy
                </a>
              </p>
            </div>
          </div>
        </Match>
        <Match when={view() === 'subscribed'}>
          <div class={styles.done} data-testid="cloud-subscribed">
            <div class={styles.doneHead}>
              <h2 class={styles.doneTitle}>You're subscribed</h2>
              <button
                type="button"
                class={styles.doneClose}
                aria-label="Close"
                onClick={() => {
                  closeCloudOffer('done')
                }}
              >
                <CloseGlyph />
              </button>
            </div>
            <p class={styles.doneText}>
              {`${songsArrival()}${accountHeld() ? '' : ` Keep them with an account, so your subscription and your songs follow you to a new ${deviceNoun()}.`}`}
            </p>
            <div class={styles.doneActions}>
              <Show when={!accountHeld()}>
                <button
                  type="button"
                  class={styles.subscribe}
                  onClick={signInAfterPurchase}
                >
                  Sign in
                </button>
              </Show>
              <button
                type="button"
                class={styles.doneSecondary}
                onClick={() => {
                  closeCloudOffer('done')
                }}
              >
                {accountHeld() ? 'Done' : 'Later'}
              </button>
            </div>
          </div>
        </Match>
      </Switch>
    </Sheet>
  )
}
