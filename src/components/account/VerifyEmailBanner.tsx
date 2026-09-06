// ============================================================
// VerifyEmailBanner — soft email-verification nudge (floating pill)
// ============================================================
//
// Shown to signed-in password accounts whose email is unconfirmed, with a
// Resend button; dismissing hides it for the session. Self-contained (checks
// /me itself, re-checks on every auth transition via authStamp) so any shell
// — the studio app or the standalone Karaoke Night page — can mount it
// without threading account state. Also surfaces the outcome of the emailed
// confirm link (#everified fragment consumed at boot) as a toast.
//
// Placement: the desktop pill floats bottom-centre. On a phone that corner is
// where the tab bar, the toasts and every bottom sheet already are, and the
// pill sat on top of all of them; there it is a strip at the top of the page
// flow instead (Settings is a tab in that same flow, so it is covered too).
// The studio app mounts one of each and CSS shows the one that fits the
// viewport; the answer and the dismissal are shared between mounts.

import type { Component } from 'solid-js'
import { createEffect, createSignal, onMount, Show } from 'solid-js'
import { authStamp, fetchMe, hasValidToken, resendVerificationEmail, takeEmailVerifyResult, } from '@/db/services/auth-service'
import { showNotification } from '@/stores/notifications-store'
import styles from './VerifyEmailBanner.module.css'

const DISMISS_KEY = 'mp:verifyBannerDismissed'

function loadDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

const [email, setEmail] = createSignal<string | null>(null)
const [dismissed, setDismissed] = createSignal(loadDismissed())
let inFlight: { stamp: unknown; done: Promise<void> } | null = null
let latestStamp: unknown = Symbol('none')

// Two mounts waking on the same auth change share one /me request, and an
// answer that lands after the auth changed again is thrown away: it would
// re-show the nudge to someone who just signed out.
function refresh(stamp: unknown): Promise<void> {
  latestStamp = stamp
  if (inFlight !== null && inFlight.stamp === stamp) return inFlight.done
  const done = (async () => {
    if (!hasValidToken()) {
      setEmail(null)
      return
    }
    const me = await fetchMe()
    if (stamp !== latestStamp) return
    const user = me?.user
    setEmail(
      user != null &&
        user.authProvider === 'password' &&
        user.email != null &&
        !user.emailVerified
        ? user.email
        : null,
    )
  })().finally(() => {
    if (inFlight?.done === done) inFlight = null
  })
  inFlight = { stamp, done }
  return done
}

export interface VerifyEmailBannerProps {
  /**
   * `floating`: the desktop pill, hidden on phones. `inline`: a strip in the
   * page flow, shown on phones only. Omitted: the pill at every width, for a
   * shell that mounts it once.
   */
  placement?: 'floating' | 'inline'
}

export const VerifyEmailBanner: Component<VerifyEmailBannerProps> = (props) => {
  const [sendState, setSendState] = createSignal<'idle' | 'sending' | 'sent'>(
    'idle',
  )

  // Re-check whenever auth changes (register, login, logout, redirects) so
  // the nudge appears right after an in-session signup — no reload needed.
  createEffect(() => {
    void refresh(authStamp())
  })

  onMount(() => {
    const result = takeEmailVerifyResult()
    if (result === null) return
    if (result.ok) {
      showNotification('Email confirmed — your account is all set', 'info')
    } else if (result.error === 'expired') {
      showNotification(
        'That confirmation link has expired — use Resend to get a fresh one',
        'error',
      )
    } else {
      showNotification('That confirmation link is no longer valid', 'error')
    }
  })

  const resend = async (): Promise<void> => {
    if (sendState() !== 'idle') return
    setSendState('sending')
    try {
      await resendVerificationEmail()
      setSendState('sent')
    } catch (err) {
      setSendState('idle')
      showNotification(
        err instanceof Error ? err.message : 'Could not resend the email',
        'error',
      )
    }
  }

  const dismiss = (): void => {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* sessionStorage unavailable */
    }
  }

  return (
    <Show when={email() !== null && !dismissed()}>
      <div
        classList={{
          [styles.inline]: props.placement === 'inline',
          [styles.banner]: props.placement !== 'inline',
          [styles.floatingOnly]: props.placement === 'floating',
        }}
        role="status"
        data-testid="verify-email-banner"
        data-placement={props.placement ?? 'any'}
      >
        <svg
          class={styles.icon}
          viewBox="0 0 24 24"
          width="16"
          height="16"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M22 7l-10 6L2 7" />
        </svg>
        <p class={styles.text}>
          Confirm your email — we sent a link to <strong>{email()}</strong>
        </p>
        <Show
          when={sendState() !== 'sent'}
          fallback={<span class={styles.sent}>Sent — check your inbox</span>}
        >
          <button
            class={styles.resend}
            onClick={() => void resend()}
            disabled={sendState() === 'sending'}
          >
            {sendState() === 'sending' ? 'Sending…' : 'Resend'}
          </button>
        </Show>
        <button
          class={styles.close}
          onClick={dismiss}
          aria-label="Dismiss"
          title="Dismiss for this session"
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </Show>
  )
}
