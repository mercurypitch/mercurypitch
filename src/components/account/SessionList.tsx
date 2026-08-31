// ============================================================
// SessionList — where this account is signed in
// ============================================================
//
// Signing out used to revoke every token the account held at once, so there
// was nothing to list and nothing to end selectively. Migration 0038 gives
// each device its own row; this is the half of it a person can see.
//
// Deliberately quiet: no polling, no live "active now" indicator. It loads
// when the settings pane opens and refreshes after an action, because a list
// of devices is something people read on purpose, not something they watch.

import type { Component } from 'solid-js'
import { createSignal, For, onMount, Show } from 'solid-js'
import { DeviceSync, Smartphone } from '@/components/icons'
import type { AuthSession } from '@/db/services/auth-sessions-service'
import { fetchSessions, revokeSession, } from '@/db/services/auth-sessions-service'
import { showNotification } from '@/stores/notifications-store'
import styles from './SessionList.module.css'

/** "today", "yesterday", "3 days ago" — precision nobody needs is noise. */
function lastSeen(iso: string): string {
  const seen = Date.parse(`${iso.replace(' ', 'T')}Z`)
  if (Number.isNaN(seen)) return 'recently'
  const days = Math.floor((Date.now() - seen) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.round(days / 30)
  return months === 1 ? 'a month ago' : `${months} months ago`
}

export const SessionList: Component = () => {
  const [sessions, setSessions] = createSignal<AuthSession[]>([])
  const [busy, setBusy] = createSignal('')
  const [error, setError] = createSignal('')

  async function load(): Promise<void> {
    try {
      setSessions(await fetchSessions())
      setError('')
    } catch (err) {
      // A failure here must not look like "you are signed in nowhere", which
      // is the one reading that would make someone panic.
      setError(err instanceof Error ? err.message : 'Could not load devices')
    }
  }

  onMount(() => {
    void load()
  })

  async function endOne(session: AuthSession): Promise<void> {
    setBusy(session.id)
    try {
      await revokeSession(session.id)
      showNotification(`Signed out ${session.label}.`, 'success')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign that out')
    } finally {
      setBusy('')
    }
  }

  return (
    <div class={styles.block} data-testid="session-list">
      <div class={styles.headerRow}>
        <span class={styles.label}>Signed in on</span>
      </div>

      <Show when={error() !== ''}>
        <p class={styles.error} data-testid="session-list-error">
          {error()}
        </p>
      </Show>

      <Show when={sessions().length > 0}>
        <ul class={styles.list}>
          <For each={sessions()}>
            {(session) => (
              <li class={styles.row}>
                <span class={styles.rowIcon} aria-hidden="true">
                  <Show
                    when={/iPhone|iPad|Android/i.test(session.label)}
                    fallback={<DeviceSync size={16} />}
                  >
                    <Smartphone size={16} />
                  </Show>
                </span>
                <span class={styles.rowText}>
                  <span class={styles.rowTitle}>
                    <span class={styles.deviceName}>{session.label}</span>
                    <Show when={session.current}>
                      <span class={styles.currentPill}>This device</span>
                    </Show>
                  </span>
                  <span class={styles.rowMeta}>
                    Last used {lastSeen(session.lastSeenAt)}
                  </span>
                </span>
                {/* The current device signs out with the ordinary Sign out
                    button, so offering it here as well would be two controls
                    for one act — and the more dangerous one to misclick. */}
                <Show when={!session.current}>
                  <button
                    type="button"
                    class={styles.rowAction}
                    disabled={busy() !== ''}
                    onClick={() => void endOne(session)}
                  >
                    {busy() === session.id ? 'Signing out…' : 'Sign out'}
                  </button>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <p class={styles.hint}>
        Signing out here ends that device only. Anything you don't recognise
        should be signed out, and your password changed.
      </p>
    </div>
  )
}
