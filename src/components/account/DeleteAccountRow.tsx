// ============================================================
// DeleteAccountRow — server-side account erasure, in the Danger Zone
// ============================================================
//
// Lives visually inside SettingsPanel's collapsed Danger Zone card, beside
// the other destructive rows, which is why it deliberately reuses that
// panel's row styles: it must read as one of them. The account state it
// needs is self-contained (restore-only fetch, same pattern as
// AccountSection) so the panel stays a pure layout host.

import type { Component } from 'solid-js'
import { createEffect, createSignal, Show } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { MeResponse } from '@/db/services/auth-service'
import { deleteAccount, fetchMe, restoreAuth } from '@/db/services/auth-service'
import { authVersion } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'
import { showNotification } from '@/stores/notifications-store'
import styles from '../SettingsPanel.module.css'

export const DeleteAccountRow: Component = () => {
  const cloudConfigured = API_BASE_URL != null && API_BASE_URL !== ''

  const [me, setMe] = createSignal<MeResponse | null>(null)
  const [busy, setBusy] = createSignal(false)
  const [confirmDelete, setConfirmDelete] = createSignal(false)

  // Re-fetch on every auth transition, restore-only: opening Settings is not
  // an action worth provisioning an account for.
  createEffect(() => {
    authVersion()
    if (!cloudConfigured) return
    void (async () => {
      await restoreAuth()
      setMe(await fetchMe())
    })()
  })

  async function handleDeleteAccount(): Promise<void> {
    setBusy(true)
    try {
      await deleteAccount()
      setMe(null)
      setConfirmDelete(false)
      showNotification('Account deleted', 'info')
      // Reload rather than carry on in a page still holding the deleted
      // account's state: stores keep its streak/profile in memory, and a
      // debounced settings push landing after the delete would provision a
      // fresh account seconds later. Same full reset as "clear storage".
      // The delay lets the confirmation land before the page goes.
      setTimeout(() => {
        window.location.href = '/'
      }, 900)
    } catch (err) {
      // Close the dialog but surface the failure loudly — silently
      // "succeeding" would tell someone their data is gone when it is
      // still there.
      showNotification(
        err instanceof Error ? err.message : 'Could not delete account',
        'error',
      )
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    // Erasure is offered whenever a server identity exists — anonymous
    // accounts hold streaks, scores and settings too, and GDPR doesn't
    // care whether you ever typed an email.
    <Show when={me() != null}>
      <div class={[styles.settingsRow, styles.dangerRow].join(' ')}>
        <div class={styles.dangerContent}>
          <label class={styles.dangerLabel}>Delete Account</label>
          <small class={styles.dangerDesc}>
            Permanently erase your profile, scores, streaks, badges and settings
            from our servers. Unspent credits are lost. Files on this device are
            not affected.
          </small>
        </div>
        <button
          class={styles.dangerBtn}
          data-testid="delete-account"
          disabled={busy()}
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </button>
      </div>
      <ConfirmDialog
        open={confirmDelete()}
        title="Delete account"
        message={
          <>
            This permanently erases your profile, scores, streaks, badges,
            settings and any unspent credits from our servers.{' '}
            <strong>It cannot be undone.</strong>
          </>
        }
        confirmLabel="Delete forever"
        confirmPhrase="delete"
        busy={busy()}
        onConfirm={() => void handleDeleteAccount()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Show>
  )
}
