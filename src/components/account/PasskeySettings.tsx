// ============================================================
// PasskeySettings — the passkeys this account can sign in with
// ============================================================
//
// Renders nothing unless BOTH halves are true: the deployment has a
// relying-party id (PR previews on workers.dev never can), and this browser
// has an authenticator. A passkey button that opens a dialog saying no reads
// as the site being broken, so it is better never shown.
//
// Adding one from a stale session asks for a code first. That is not
// belt-and-braces: a passkey skips the second-factor challenge and survives a
// password reset, so it is a stronger credential than the session that would
// otherwise be creating it.

import type { Component } from 'solid-js'
import { createSignal, For, onMount, Show } from 'solid-js'
import { Key, Trash2 } from '@/components/icons'
import type { Passkey, PasskeyProof } from '@/db/services/auth-passkey-service'
import { addPasskey, fetchPasskeys, PasskeyReauthRequired, passkeysAvailable, removePasskey, } from '@/db/services/auth-passkey-service'
import { describeWebAuthnError, platformAuthenticatorAvailable, } from '@/lib/webauthn'
import { showNotification } from '@/stores/notifications-store'
import styles from './PasskeySettings.module.css'

/** "today", "3 days ago" — same scale as the device list beside it. */
function when(iso: string | null): string {
  if (iso === null) return 'never used'
  const seen = Date.parse(`${iso.replace(' ', 'T')}Z`)
  if (Number.isNaN(seen)) return 'used recently'
  const days = Math.floor((Date.now() - seen) / 86_400_000)
  if (days <= 0) return 'used today'
  if (days === 1) return 'used yesterday'
  if (days < 30) return `used ${days} days ago`
  const months = Math.round(days / 30)
  return months === 1 ? 'used a month ago' : `used ${months} months ago`
}

export const PasskeySettings: Component = () => {
  const [usable, setUsable] = createSignal(false)
  const [passkeys, setPasskeys] = createSignal<Passkey[]>([])
  const [busy, setBusy] = createSignal('')
  const [error, setError] = createSignal('')
  // What the server will accept as a fresh proof, once it has asked for one.
  // Empty array = it asked and this account has nothing to give (a Google
  // identity with no second factor), which is a different screen entirely.
  const [needsProof, setNeedsProof] = createSignal<PasskeyProof[] | null>(null)
  const [proof, setProof] = createSignal('')

  /** A code field, a password field, or neither. */
  const proofKind = (): PasskeyProof | null => {
    const accepts = needsProof()
    if (accepts === null || accepts.length === 0) return null
    // Code first when both are on offer: six digits is less to type than a
    // password, and the account holding one is the security-minded case.
    return accepts.includes('code') ? 'code' : 'password'
  }

  onMount(() => {
    void (async () => {
      const [serverSide, browserSide] = await Promise.all([
        passkeysAvailable(),
        platformAuthenticatorAvailable(),
      ])
      if (!serverSide || !browserSide) return
      setUsable(true)
      try {
        setPasskeys(await fetchPasskeys())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load passkeys')
      }
    })()
  })

  async function add(): Promise<void> {
    setBusy('add')
    setError('')
    try {
      setPasskeys(await addPasskey(proof().trim()))
      setNeedsProof(null)
      setProof('')
      showNotification('Passkey added.', 'success')
    } catch (err) {
      if (err instanceof PasskeyReauthRequired) {
        setNeedsProof(err.accepts)
        setError(err.message)
      } else {
        setError(describeWebAuthnError(err))
      }
    } finally {
      setBusy('')
    }
  }

  async function remove(passkey: Passkey): Promise<void> {
    setBusy(passkey.id)
    setError('')
    try {
      setPasskeys(await removePasskey(passkey.id))
      showNotification(`Removed ${passkey.name}.`, 'success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove it')
    } finally {
      setBusy('')
    }
  }

  return (
    <Show when={usable()}>
      <div class={styles.block} data-testid="passkey-settings">
        <div class={styles.headerRow}>
          <span class={styles.label}>Passkeys</span>
        </div>

        <Show when={error() !== ''}>
          <p class={styles.error} data-testid="passkey-error">
            {error()}
          </p>
        </Show>

        <Show when={passkeys().length > 0}>
          <ul class={styles.list}>
            <For each={passkeys()}>
              {(passkey) => (
                <li class={styles.row}>
                  <span class={styles.rowIcon} aria-hidden="true">
                    <Key />
                  </span>
                  <span class={styles.rowText}>
                    <span class={styles.rowTitle}>{passkey.name}</span>
                    <span class={styles.rowMeta}>
                      {when(passkey.lastUsedAt)}
                      {/* Worth saying plainly: a device-bound key is gone with
                          the device, and somebody choosing their only way in
                          should know which kind they have. */}
                      {passkey.backedUp ? ' · synced' : ' · this device only'}
                    </span>
                  </span>
                  <button
                    type="button"
                    class={styles.rowAction}
                    aria-label={`Remove ${passkey.name}`}
                    disabled={busy() !== ''}
                    onClick={() => void remove(passkey)}
                    data-testid={`passkey-remove-${passkey.id}`}
                  >
                    <Trash2 />
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>

        <Show when={proofKind() !== null}>
          <input
            class={styles.proofInput}
            type={proofKind() === 'password' ? 'password' : 'text'}
            inputmode={proofKind() === 'password' ? 'text' : 'numeric'}
            autocomplete={
              proofKind() === 'password' ? 'current-password' : 'one-time-code'
            }
            placeholder={
              proofKind() === 'password' ? 'Your password' : '123456'
            }
            aria-label={
              proofKind() === 'password'
                ? 'Your password'
                : 'Code from your authenticator app'
            }
            value={proof()}
            disabled={busy() !== ''}
            onInput={(e) => setProof(e.currentTarget.value)}
            data-testid="passkey-proof"
          />
        </Show>

        {/* Nothing to present: no password and no second factor. Signing in
            again is the one thing that does work, so say that instead of
            offering a box nobody can fill. */}
        <Show when={needsProof()?.length === 0}>
          <p class={styles.hint} data-testid="passkey-reauth-only">
            Sign out and back in, then add a passkey within ten minutes.
          </p>
        </Show>

        <button
          type="button"
          class={styles.addButton}
          disabled={
            busy() !== '' ||
            needsProof()?.length === 0 ||
            (proofKind() !== null && proof().trim() === '')
          }
          onClick={() => void add()}
          data-testid="passkey-add"
        >
          <Key />
          {busy() === 'add' ? 'Waiting for your device…' : 'Add a passkey'}
        </button>

        <p class={styles.hint}>
          Sign in with your fingerprint, face or device PIN — no password and no
          code. A passkey never leaves your device, so it cannot be phished or
          read from a breach.
        </p>
      </div>
    </Show>
  )
}
