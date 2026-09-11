// ============================================================
// Native sign-in — the developer screen, not a product surface
// ============================================================
//
// This exists so the owner can prove the Phase 0 plumbing works on a
// TestFlight build BEFORE any of it has a designed home. The account moment —
// what a singer actually sees, and when — is a later phase (program plan,
// Phase 6). Nothing here is meant to be discovered by a user: it lives inside
// the developer console, behind a Settings toggle that defaults to off, and
// it is registered only by the native entry point so the web bundle never
// carries it.
//
// It answers the four questions a device can answer and a laptop cannot:
//
//   Does the Apple sheet come back with an identity token this worker
//   accepts? Does Google? Does a thirty-day session still refresh? And — the
//   one that is a day-one blocker rather than a curiosity — WHAT DOES THIS
//   SHELL CALL ITSELF? Turnstile fails closed wherever a secret is set, which
//   is both dev and prod, so email sign-up stays dead in the shell until the
//   widget's allowed-hostname list contains whatever Cloudflare's siteverify
//   reports. That value comes back in the error body, and the result box
//   below prints the body whole rather than only the sentence.
//
// The storage readout is masked. It is the device credential: a screenshot of
// a debug panel is a thing that gets pasted into an issue, and three
// characters at each end is enough to tell two ids apart without handing one
// over.
//
// Apple is offered by the SAME predicate the product surfaces use,
// `appleSignInOffered()`, rather than by always drawing the button. A
// developer screen that offers a provider this platform does not have is not
// a harmless convenience: the point of the screen is to answer "does this
// work on this device", and an Android tap that fails because Apple is
// iOS-only reads exactly like an Android tap that fails because the
// configuration is wrong.

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { authErrorDetails, isTwofaChallenge, refreshSession, } from '@/db/services/auth-service'
import { getUserId } from '@/db/services/user-service'
import { flushStoragePort, storageDurable, storagePortSnapshot, } from '@/lib/storage-port'
import { NativeSignInError, signInWithApple, signInWithGoogle, } from './native-sign-in'
import styles from './NativeSignInPanel.module.css'
import { appleSignInOffered } from './sign-in-methods'

/** Enough to tell two credentials apart, not enough to use one. */
function mask(value: string | null): string {
  if (value === null) return '(absent)'
  if (value.length <= 8) return `(${String(value.length)} chars)`
  return `${value.slice(0, 3)}…${value.slice(-3)} (${String(value.length)})`
}

type Action = 'apple' | 'google' | 'refresh' | 'storage'

const LABELS: Record<Action, string> = {
  apple: 'Sign in with Apple',
  google: 'Sign in with Google',
  refresh: 'Refresh session',
  storage: 'Show storage port',
}

const ORDER: Action[] = ['apple', 'google', 'refresh', 'storage']

/** The buttons this platform has something behind. Apple is iOS-only. */
function offeredActions(): Action[] {
  return ORDER.filter((action) => action !== 'apple' || appleSignInOffered())
}

export const NativeSignInPanel: Component = () => {
  const [busy, setBusy] = createSignal<Action | null>(null)
  const [result, setResult] = createSignal('')

  const show = (value: unknown): void => {
    setResult(JSON.stringify(value, null, 2))
  }

  /** Everything a failure carried, including the worker's own body. */
  const describe = (action: Action, error: unknown): void => {
    const native = error instanceof NativeSignInError ? error : null
    show({
      action,
      ok: false,
      kind: native?.kind ?? 'unknown',
      message: error instanceof Error ? error.message : String(error),
      // `hostname` lands here when Turnstile refused the request — it is the
      // string the owner pastes into the widget's allowed-hostname list.
      server:
        authErrorDetails(native?.cause ?? error) ?? '(no worker response)',
    })
  }

  async function run(action: Action): Promise<void> {
    if (busy() !== null) return
    setBusy(action)
    try {
      if (action === 'storage') {
        await flushStoragePort()
        const snapshot = storagePortSnapshot()
        show({
          action,
          ok: true,
          durable: storageDurable(),
          userId: mask(snapshot['mp:userId']),
          deviceSecret: mask(snapshot['mp:deviceSecret']),
          authToken: mask(snapshot['mp:authToken']),
          // The id in use, which is the JWT subject once signed in and the
          // device id before that — the two differ on an account created
          // somewhere else, and that difference is worth seeing.
          effectiveUserId: mask(getUserId()),
        })
        return
      }
      if (action === 'refresh') {
        const refreshed = await refreshSession()
        show({
          action,
          ok: refreshed !== null,
          expiresAt: refreshed?.expiresAt ?? null,
          token: mask(refreshed?.token ?? null),
        })
        return
      }
      if (action === 'apple' && !appleSignInOffered()) {
        // The button is not drawn here, so this is a keyboard, a stale
        // render, or someone calling run() from a console. Say which of the
        // two failures it is, because the whole point of the screen is to
        // tell a configuration fault apart from a platform that has no
        // Apple sheet to begin with.
        show({
          action,
          ok: false,
          kind: 'unavailable',
          message: 'Sign in with Apple is not offered on this platform.',
        })
        return
      }
      const outcome =
        action === 'apple' ? await signInWithApple() : await signInWithGoogle()
      if (isTwofaChallenge(outcome)) {
        show({ action, ok: true, twofaRequired: true })
        return
      }
      show({
        action,
        ok: true,
        userId: mask(outcome.userId),
        isNew: outcome.isNew,
        provider: outcome.user.authProvider,
        email: outcome.user.email,
        token: mask(outcome.token),
      })
    } catch (error) {
      describe(action, error)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div class={styles.panel}>
      <div class={styles.actions}>
        <For each={offeredActions()}>
          {(action) => (
            <button
              type="button"
              class={styles.button}
              disabled={busy() !== null}
              onClick={() => void run(action)}
              data-testid={`native-signin-${action}`}
            >
              {busy() === action ? 'Working…' : LABELS[action]}
            </button>
          )}
        </For>
      </div>
      <Show
        when={result() !== ''}
        fallback={
          <p class={styles.empty}>
            Press one. The answer, including anything the worker sent back,
            appears here.
          </p>
        }
      >
        <textarea
          class={styles.output}
          readOnly
          rows={10}
          value={result()}
          data-testid="native-signin-result"
        />
      </Show>
    </div>
  )
}
