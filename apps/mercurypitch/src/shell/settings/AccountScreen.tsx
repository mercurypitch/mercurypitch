// ============================================================
// AccountScreen — what an account adds, or who is signed in
// ============================================================
//
// Pushed from Settings' first row (and from More's Account tile, which
// lands here with Settings under it). Signed out, it says what an account
// is for and what stays on the phone either way. Signed in, it shows who,
// and how they sign in.
//
// Signed in is the TOKEN's answer (account-state.ts), never the server's:
// with no network this screen says the account could not be reached, keeps
// the card the phone already had, and offers to try again. It never says
// "signed out" for a phone that is not (S6 audit D1, REQ-NAM-049).

import type { JSX } from 'solid-js'
import { onMount, Show } from 'solid-js'
import { AccountIcon, WarnIcon } from '../icons'
import { ACCOUNT_ADDS_TITLE, ACCOUNT_OFFLINE, ACCOUNT_SIGNED_OUT, TAKES_STAY_ON_PHONE, } from './account-copy'
import { accountCard, accountDisplayName, accountProviderLine, accountReach, accountSignedIn, refreshAccount, } from './account-state'
import { AccountPromises } from './AccountPromises'
import { AccountAvatar } from './SettingsList'

function NoAccount(): JSX.Element {
  return (
    <>
      <div class="mp-set-card" data-account-card="none">
        <div class="mp-set-card__row">
          <span class="mp-set-avatar">
            <AccountIcon size={22} />
          </span>
          <div class="mp-set-card__text">
            <strong>{ACCOUNT_SIGNED_OUT.title}</strong>
            <span>{ACCOUNT_SIGNED_OUT.body}</span>
          </div>
        </div>
      </div>
      <AccountPromises title={ACCOUNT_ADDS_TITLE} />
      <p class="mp-set__caption">{TAKES_STAY_ON_PHONE}</p>
    </>
  )
}

function IdentityCard(): JSX.Element {
  return (
    <div class="mp-set-card" data-account-card="held">
      <div class="mp-set-card__row">
        <AccountAvatar large />
        <div class="mp-set-card__text">
          <strong>{accountDisplayName()}</strong>
          <Show when={accountCard()?.email}>
            {(email) => <span>{email()}</span>}
          </Show>
          <span class="mp-set-card__provider">{accountProviderLine()}</span>
        </div>
      </div>
    </div>
  )
}

export function AccountScreen(): JSX.Element {
  onMount(() => {
    if (accountSignedIn()) void refreshAccount()
  })

  const unreachable = (): boolean => accountReach() === 'unreachable'

  return (
    <div class="mp-set" data-testid="account-screen">
      <Show when={accountSignedIn()} fallback={<NoAccount />}>
        <Show when={unreachable()}>
          <div
            class="mp-set-note mp-set-note--warn"
            role="status"
            data-testid="account-offline"
          >
            <WarnIcon size={20} />
            <p>
              <strong>{ACCOUNT_OFFLINE.title}</strong> {ACCOUNT_OFFLINE.body}
            </p>
          </div>
        </Show>
        <IdentityCard />
        <Show when={unreachable()}>
          <button
            type="button"
            class="mp-set-button mp-set-button--secondary"
            data-testid="account-retry"
            onClick={() => {
              void refreshAccount()
            }}
          >
            Try again
          </button>
        </Show>
      </Show>
    </div>
  )
}
