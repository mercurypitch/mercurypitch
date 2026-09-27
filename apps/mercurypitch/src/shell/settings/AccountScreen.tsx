// ============================================================
// AccountScreen — what an account adds, or who is signed in
// ============================================================
//
// Pushed from Settings' first row (and from More's Account tile, which
// lands here with Settings under it). Signed out, it says what an account
// is for and what stays on the phone either way, and opens the sign-in
// sheet. Signed in, it shows who, and how they sign in, then the account's
// own settings: the name, two-step sign-in, the devices, product news, and
// Sign out (S6 step 4).
//
// Signed in is the TOKEN's answer (account-state.ts), never the server's:
// with no network this screen says the account could not be reached, keeps
// the card the phone already had, and offers to try again. It never says
// "signed out" for a phone that is not (S6 audit D1, REQ-NAM-049). What
// needs the server waits for it: those rows appear once the account has
// answered, and not before (4g).

import type { JSX } from 'solid-js'
import { createEffect, createSignal, on, onCleanup, onMount, Show, } from 'solid-js'
import type { TwofaStatus } from '@/db/services/auth-mfa-service'
import { fetchTwofaStatus } from '@/db/services/auth-mfa-service'
import { needsSignIn } from '@/db/services/auth-service'
import type { AuthSession } from '@/db/services/auth-sessions-service'
import { fetchSessions } from '@/db/services/auth-sessions-service'
import { authVersion } from '@/db/services/user-service'
import { showNotification } from '@/stores/notifications-store'
import { isApplePrivateRelayAddress } from '../../../../../workers/db-worker/src/apple-relay'
import { AccountIcon, CopyIcon, MailIcon, PersonIcon, PhoneIcon, ShieldIcon, SignOutIcon, WarnIcon, } from '../icons'
import { pushScreen } from '../run-shell-store'
import { setProductNews, signOutHere } from './account-actions'
import { ACCOUNT_ADDS_TITLE, ACCOUNT_OFFLINE, ACCOUNT_SIGNED_OUT, ACCOUNT_SIGNED_OUT_HERE, RELAY_NOTE, SIGN_OUT_QUESTION, TAKES_STAY_ON_PHONE, TWO_STEP, } from './account-copy'
import { accountCard, accountDisplayName, accountProviderLine, accountReach, accountSignedIn, refreshAccount, } from './account-state'
import { AccountFillNote } from './AccountFillNote'
import { AccountPromises } from './AccountPromises'
import { copyText } from './copy-text'
import { askSettings } from './settings-alert'
import { AccountAvatar, SettingsGroup, SettingsRow } from './SettingsList'
import { SettingsSwitch } from './SettingsSwitch'
import { openSignIn } from './sign-in-state'

function NoAccount(): JSX.Element {
  // An account signed out on this phone gets its own card: the history is
  // not shown rather than gone (REQ-NAM-054). `authVersion` makes the flag,
  // which lives in storage, as current as the token it goes with.
  const card = () => {
    authVersion()
    return needsSignIn() ? ACCOUNT_SIGNED_OUT_HERE : ACCOUNT_SIGNED_OUT
  }
  return (
    <>
      <div class="mp-set-card" data-account-card="none">
        <div class="mp-set-card__row">
          <span class="mp-set-avatar">
            <AccountIcon size={22} />
          </span>
          <div class="mp-set-card__text">
            <strong>{card().title}</strong>
            <span>{card().body}</span>
          </div>
        </div>
      </div>
      <AccountPromises title={ACCOUNT_ADDS_TITLE} />
      <p class="mp-set__caption">{TAKES_STAY_ON_PHONE}</p>
      <button
        type="button"
        class="mp-set-button"
        data-testid="account-sign-in"
        onClick={openSignIn}
      >
        Sign in or create an account
      </button>
    </>
  )
}

function IdentityCard(): JSX.Element {
  const relayAddress = (): string | null => {
    const email = accountCard()?.email ?? ''
    return isApplePrivateRelayAddress(email) ? email : null
  }

  async function copyAddress(address: string): Promise<void> {
    if (await copyText(address)) {
      showNotification('Address copied', 'info')
    } else {
      showNotification(
        'Could not copy it. Press and hold the address to copy it.',
        'warning',
      )
    }
  }

  return (
    <div class="mp-set-card" data-account-card="held">
      <div class="mp-set-card__row">
        <AccountAvatar large />
        <div class="mp-set-card__text">
          <strong>{accountDisplayName()}</strong>
          <Show when={accountCard()?.email}>
            {(email) => <span class="mp-set-card__email">{email()}</span>}
          </Show>
          <span class="mp-set-card__provider">{accountProviderLine()}</span>
        </div>
      </div>
      {/* Apple minted this address and the singer never typed it, yet an
          emailed code to it is the only way in where there is no Apple
          sheet (4c). */}
      <Show when={relayAddress()}>
        {(address) => (
          <>
            <p class="mp-set-card__note" data-testid="account-relay-note">
              {RELAY_NOTE}
            </p>
            <button
              type="button"
              class="mp-set-button mp-set-button--secondary mp-set-button--small mp-set-card__action"
              data-testid="account-copy-address"
              onClick={() => void copyAddress(address())}
            >
              <CopyIcon size={18} />
              Copy address
            </button>
          </>
        )}
      </Show>
    </div>
  )
}

/** "This phone and 1 other", from the account's sessions. */
export function devicesLine(sessions: readonly AuthSession[]): string {
  const others = sessions.filter((session) => !session.current).length
  if (others === 0) return 'This phone'
  return `This phone and ${others} other${others === 1 ? '' : 's'}`
}

/** The rows that need the server: drawn once the account has answered. */
function AccountSettings(): JSX.Element {
  const [twoStep, setTwoStep] = createSignal<TwofaStatus | null>(null)
  const [sessions, setSessions] = createSignal<AuthSession[] | null>(null)
  // The answer asked for, while the account is being told. Null otherwise,
  // when the switch shows what the account holds.
  const [newsAsked, setNewsAsked] = createSignal<boolean | null>(null)
  const [error, setError] = createSignal('')
  let live = true
  onCleanup(() => {
    live = false
  })

  // Each read on its own: a server without two-step sign-in, or a list that
  // cannot be read, leaves its row out (REQ-NAM-028) and the rest standing.
  onMount(() => {
    void fetchTwofaStatus()
      .then((status) => {
        if (live) setTwoStep(status)
      })
      .catch(() => undefined)
    void fetchSessions()
      .then((list) => {
        if (live) setSessions(list)
      })
      .catch(() => undefined)
  })

  const devicesSub = (): string | undefined => {
    const list = sessions()
    return list === null ? undefined : devicesLine(list)
  }

  const newsOn = (): boolean =>
    newsAsked() ?? accountCard()?.newsletter === true

  async function changeNews(next: boolean): Promise<void> {
    if (newsAsked() !== null) return
    setError('')
    setNewsAsked(next)
    try {
      await setProductNews(next)
      showNotification(
        next
          ? 'You will hear from us when something big ships'
          : 'You are off the product news list',
        'info',
      )
    } catch (err) {
      // The switch goes back to what the account holds: a switch showing an
      // answer the account never took is worse than an error line.
      if (live) setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (live) setNewsAsked(null)
    }
  }

  return (
    <>
      <SettingsGroup>
        <SettingsRow
          id="account-name"
          icon={<PersonIcon />}
          label="Name"
          value={accountCard()?.name ?? ''}
          onPress={() => {
            pushScreen('account-name')
          }}
        />
        <Show when={twoStep()?.available === true ? twoStep() : null}>
          {(status) => (
            <SettingsRow
              id="two-step"
              icon={<ShieldIcon />}
              label={TWO_STEP.label}
              sub={status().enabled ? TWO_STEP.onSub : TWO_STEP.offSub}
              value={status().enabled ? 'On' : 'Off'}
            />
          )}
        </Show>
        <SettingsRow
          id="devices"
          icon={<PhoneIcon />}
          label="Devices"
          sub={devicesSub()}
          onPress={() => {
            pushScreen('devices')
          }}
        />
        <SettingsRow
          id="product-news"
          icon={<MailIcon />}
          label="Product news by email"
          accessory={
            <SettingsSwitch
              checked={newsOn()}
              label="Product news by email"
              disabled={newsAsked() !== null}
              testId="account-news"
              onChange={(next) => void changeNews(next)}
            />
          }
        />
      </SettingsGroup>
      <Show when={error() !== ''}>
        <p class="mp-set__error" role="alert" data-testid="account-error">
          {error()}
        </p>
      </Show>
    </>
  )
}

function SignedIn(): JSX.Element {
  const unreachable = (): boolean => accountReach() === 'unreachable'
  // The server's rows, once the account has answered at least once while
  // this screen is up. A later failed read keeps them: they were real.
  const [answered, setAnswered] = createSignal(false)
  createEffect(
    on(accountReach, (reach) => {
      if (reach === 'ok') setAnswered(true)
    }),
  )

  return (
    <div class="mp-set__cols">
      <div class="mp-set__col">
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
        {/* Once, after a sign-in to an account that already existed (4b):
            what arrived. Not while the account cannot be reached, whose
            own note already says so. */}
        <Show when={!unreachable()}>
          <AccountFillNote />
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
      </div>
      <div class="mp-set__col">
        <Show when={answered() && !unreachable()}>
          <AccountSettings />
        </Show>
        {/* Local, so never waiting on the server: only this phone's session
            ends (REQ-NAM-054). */}
        <button
          type="button"
          class="mp-set-button mp-set-button--secondary"
          data-testid="account-sign-out"
          onClick={() => {
            askSettings({
              title: SIGN_OUT_QUESTION.title,
              text: SIGN_OUT_QUESTION.text,
              confirmLabel: SIGN_OUT_QUESTION.confirm,
              onConfirm: signOutHere,
            })
          }}
        >
          <SignOutIcon size={20} />
          Sign out
        </button>
      </div>
    </div>
  )
}

export function AccountScreen(): JSX.Element {
  onMount(() => {
    if (accountSignedIn()) void refreshAccount()
  })

  return (
    <div class="mp-set" data-testid="account-screen">
      <Show when={accountSignedIn()} fallback={<NoAccount />}>
        <SignedIn />
      </Show>
    </div>
  )
}
