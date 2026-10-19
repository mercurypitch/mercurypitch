// ============================================================
// Keep v2 — the account offer, drawn (S7b §3.5)
// ============================================================
//
// Top to bottom:
//   - "Not now" at the top right, a labelled text button, there from the
//     first frame;
//   - the singer's voiceprint card, small, when this phone holds one an
//     account made here would adopt (keep-voiceprint.ts). Straight after a
//     reveal (the onboarding's beat 7, or the range Keep ran) it flies in;
//   - "Keep your voiceprint" over a measured range, else "Save your
//     progress";
//   - one icon and one line a row, each only where it is true: the
//     voiceprint saved (with one); "Find your range first" (without one,
//     while a range finder is registered); progress everywhere; the free
//     song, with the one sentence that says it needs a confirmed email, and
//     the launch gift (a build that splits songs, for a singer without the
//     subscription; the gift only while the server says it runs,
//     keep-gift.ts);
//   - the one fact line, the whole of the loss framing;
//   - Apple first on iOS in Apple's own style, Google first on Android,
//     then Use email, which hands over to the sign-in sheet's email pane.
//
// No "Are you sure?" on Not now (S7b §3.5): it closes, and so do Back, the
// backdrop and a swipe. The ceremonies are the sign-in sheet's own
// (sign-in-flow.ts), drawn here, and a second factor owed is finished on the
// sign-in sheet's code pane. When and whether Keep opens is
// account-offer.ts; every word is account-copy.ts.

import type { JSX } from 'solid-js'
import { createMemo, onCleanup, Show } from 'solid-js'
import './settings.css'
import { AppleMark } from '@/components/account/AppleMark'
import { GoogleMark } from '@/components/account/GoogleMark'
import { Sheet } from '@/components/mobile/Sheet'
import { needsSignIn, parkNativeTwofaChallenge, } from '@/db/services/auth-service'
import { authVersion } from '@/db/services/user-service'
import { buildVoiceprintHint } from '@/db/services/voiceprint-service'
import { appleSignInOffered, nativeGoogleSignInOffered, } from '@/features/account/sign-in-methods'
import { karaokeSongs } from '@/features/karaoke-room/karaoke-songs'
import { offerDay } from '@/lib/launch-gift-copy'
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal-links'
import { KARAOKE_IMPORT } from '@/lib/native-build'
import { ChevronIcon, GiftIcon, KaraokeIcon, MailIcon, MicIcon, ProgressIcon, WaveIcon, } from '../icons'
import { KEEP, keepFact, keepGiftLine } from './account-copy'
import { closeOffer, declineOffer, keepArrival, keepChose, offerOpen, rangeFinder, } from './account-offer'
import { liveAppGift } from './keep-gift'
import type { KeepableVoiceprint } from './keep-voiceprint'
import { keepableVoiceprint, keepRange } from './keep-voiceprint'
import type { SignInProvider } from './sign-in-flow'
import { createSignInFlow } from './sign-in-flow'
import { afterSignIn } from './sign-in-landing'
import { openSignIn, openSignInByEmail } from './sign-in-state'
import { FailureLine } from './SignInSheet'

/** The free song and the gift are songs: a build that splits them, for a
 *  singer without the subscription, which has its 20 (S7b §2). */
function songsOffered(): boolean {
  return KARAOKE_IMPORT && !karaokeSongs().subscribed
}

/**
 * The gift's row, while the server says it runs. Not on a phone signed out
 * of an account: signing back in to it is no new account, and only a new
 * one gets the gift (db-worker launch-offer.ts).
 */
function giftLine(): string | null {
  if (!songsOffered()) return null
  authVersion()
  if (needsSignIn()) return null
  const gift = liveAppGift()
  if (gift === null) return null
  const until = gift.endsAt === null ? null : offerDay(gift.endsAt)
  return keepGiftLine(gift.songs, until)
}

/** The singer's voiceprint, small: the range, and the twin when there is
 *  one. Keep draws it, and so does the voiceprint ask (VoiceprintAsk.tsx). */
export function VoiceprintCard(props: {
  print: KeepableVoiceprint
}): JSX.Element {
  return (
    <div class="mp-keep__print" data-testid="keep-voiceprint">
      <WaveIcon size={22} />
      <div class="mp-keep__print-text">
        <span class="mp-keep__print-label">{KEEP.voiceprintLabel}</span>
        <strong class="mp-keep__print-range">{keepRange(props.print)}</strong>
        <Show when={props.print.twin}>
          {(twin) => (
            <span class="mp-keep__print-twin">
              You share a range with {twin()}.
            </span>
          )}
        </Show>
      </div>
    </div>
  )
}

/** The rows, each an icon and one line, only where each is true. */
function Rows(props: { print: KeepableVoiceprint | null }): JSX.Element {
  const finder = (): (() => void) | null =>
    props.print === null ? rangeFinder() : null
  return (
    <ul class="mp-set-promises mp-set-promises--bare mp-keep__rows">
      <Show when={props.print !== null}>
        <li>
          <WaveIcon size={22} />
          <span>{KEEP.voiceprintSaved}</span>
        </li>
      </Show>
      <Show when={finder()}>
        {(run) => (
          <li>
            <button
              type="button"
              class="mp-keep__find"
              data-testid="keep-find-range"
              onClick={() => {
                keepChose('find-range')
                closeOffer()
                run()()
              }}
            >
              <MicIcon size={22} />
              <span>{KEEP.findRange}</span>
              <ChevronIcon size={18} />
            </button>
          </li>
        )}
      </Show>
      <li>
        <ProgressIcon size={22} />
        <span>{KEEP.everywhere}</span>
      </li>
      <Show when={songsOffered()}>
        <li data-testid="keep-free-song">
          <KaraokeIcon size={22} />
          <span class="mp-keep__row-text">
            <span>{KEEP.freeSong}</span>
            <span class="mp-keep__row-sub">{KEEP.freeSongEmail}</span>
          </span>
        </li>
      </Show>
      <Show when={giftLine()}>
        {(line) => (
          <li>
            <GiftIcon size={22} />
            <span>{line()}</span>
          </li>
        )}
      </Show>
    </ul>
  )
}

/** Apple, Google and Use email, and what a failure among them says. */
function Ways(): JSX.Element {
  const flow = createSignInFlow({
    // An account made here adopts the takes this describes, so its first
    // mail may name the twin (spec REQ-VPR-022).
    signup: () => ({ voiceprintHint: buildVoiceprintHint() }),
    onSignedIn: (auth) => {
      closeOffer()
      afterSignIn(auth)
    },
    // Keep has no code field: the sign-in sheet finishes it.
    onSecondFactor: (ceremony) => {
      parkNativeTwofaChallenge(ceremony)
      closeOffer()
      openSignIn()
    },
  })
  // Keep's body is drawn while it is open: a close strands nothing.
  onCleanup(() => {
    flow.abandon()
  })

  const offered = (provider: SignInProvider): boolean =>
    !flow.unavailable().includes(provider) &&
    (provider === 'apple' ? appleSignInOffered() : nativeGoogleSignInOffered())

  return (
    <>
      <FailureLine flow={flow} />
      <div class="mp-signin__ways mp-keep__ways">
        <Show when={offered('apple')}>
          <button
            type="button"
            class="mp-provider mp-provider--apple"
            disabled={flow.busy()}
            onClick={() => {
              keepChose('apple')
              void flow.continueWith('apple')
            }}
            data-testid="keep-apple"
          >
            <AppleMark />
            {KEEP.apple}
          </button>
        </Show>
        <Show when={offered('google')}>
          <button
            type="button"
            class="mp-provider mp-provider--google"
            disabled={flow.busy()}
            onClick={() => {
              keepChose('google')
              void flow.continueWith('google')
            }}
            data-testid="keep-google"
          >
            <GoogleMark />
            {KEEP.google}
          </button>
        </Show>
        <button
          type="button"
          class="mp-provider"
          disabled={flow.busy()}
          onClick={() => {
            keepChose('email')
            closeOffer()
            openSignInByEmail()
          }}
          data-testid="keep-email"
        >
          <MailIcon size={18} />
          {KEEP.email}
        </button>
      </div>
    </>
  )
}

/** Keep, over whatever opened it: the Sing room, Settings, the Cloud offer. */
export function AccountOfferSheet(): JSX.Element {
  // Read as it opens, so the card is the take on this phone right now.
  const print = createMemo(() => (offerOpen() ? keepableVoiceprint() : null))
  const title = (): string =>
    print() === null ? KEEP.titleProgress : KEEP.titleVoiceprint

  return (
    <Sheet
      isOpen={offerOpen()}
      close={declineOffer}
      ariaLabel={title()}
      class="mp-offer-sheet"
    >
      <div
        class="mp-offer mp-offer--sheet mp-keep"
        data-testid="account-offer"
        data-variant={print() === null ? 'progress' : 'voiceprint'}
        data-arrival={keepArrival()}
      >
        <div class="mp-keep__top">
          <button
            type="button"
            class="mp-keep__not-now"
            data-testid="keep-not-now"
            onClick={declineOffer}
          >
            {KEEP.notNow}
          </button>
        </div>
        <Show when={print()}>
          {(current) => <VoiceprintCard print={current()} />}
        </Show>
        <h2 class="mp-offer__title">{title()}</h2>
        <Rows print={print()} />
        <p class="mp-keep__fact">{keepFact()}</p>
        <Ways />
        <p class="mp-signin__fine">
          By continuing you accept the{' '}
          <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
            Terms
          </a>{' '}
          and the{' '}
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
            Privacy policy
          </a>
          .
        </p>
      </div>
    </Sheet>
  )
}
