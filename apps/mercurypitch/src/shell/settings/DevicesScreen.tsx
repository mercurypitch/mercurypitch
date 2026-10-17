// ============================================================
// DevicesScreen — where this account is signed in
// ============================================================
//
// Pushed from the Account screen's Devices row (S6 step 4). This phone
// comes first and is named as this phone; every other device can be signed
// out from here, one at a time, and only that device's session ends. This
// phone has no button of its own: it signs out with the Account screen's
// Sign out, which asks first. A list that cannot be read says so and offers
// to try again, rather than showing an account signed in nowhere.

import type { JSX } from 'solid-js'
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import type { AuthSession } from '@/db/services/auth-sessions-service'
import { fetchSessions, revokeSession, } from '@/db/services/auth-sessions-service'
import { thisDevice } from '@/lib/device-noun'
import { showNotification } from '@/stores/notifications-store'
import { ComputerIcon, PhoneIcon, WarnIcon } from '../icons'
import { SettingsGroup } from './SettingsList'

/** "today", "yesterday", "3 days ago": precision nobody needs is noise. */
export function lastUsed(stamp: string, now = Date.now()): string {
  // The worker writes SQLite's "YYYY-MM-DD HH:MM:SS", in UTC, unmarked.
  const iso = stamp.includes('T') ? stamp : stamp.replace(' ', 'T')
  const seen = Date.parse(/(?:Z|[+-]\d\d:?\d\d)$/u.test(iso) ? iso : `${iso}Z`)
  if (Number.isNaN(seen)) return 'recently'
  const days = Math.floor((now - seen) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.round(days / 30)
  return months === 1 ? 'a month ago' : `${months} months ago`
}

/**
 * A session the server named for a computer. The worker's `deviceLabel`
 * ends every label with its platform ("Chrome on Mac", or "Linux" alone),
 * and it tests Android before Linux, so an Android phone never reads as a
 * computer here. Everything else (iPhone, iPad, Android, an unknown device)
 * keeps the phone.
 */
export function onComputer(label: string): boolean {
  return /(?:^|\son\s)(?:Mac|Windows|ChromeOS|Linux)$/u.test(label)
}

/** This phone first, then the rest in the server's order (most recent). */
function thisPhoneFirst(sessions: readonly AuthSession[]): AuthSession[] {
  return [
    ...sessions.filter((session) => session.current),
    ...sessions.filter((session) => !session.current),
  ]
}

export function DevicesScreen(): JSX.Element {
  const [sessions, setSessions] = createSignal<AuthSession[] | null>(null)
  const [failed, setFailed] = createSignal(false)
  const [ending, setEnding] = createSignal<string | null>(null)
  let live = true
  onCleanup(() => {
    live = false
  })

  async function load(): Promise<void> {
    setFailed(false)
    try {
      const list = await fetchSessions()
      if (live) setSessions(thisPhoneFirst(list))
    } catch {
      if (live) setFailed(true)
    }
  }

  onMount(() => {
    void load()
  })

  async function signOutDevice(session: AuthSession): Promise<void> {
    if (ending() !== null) return
    setEnding(session.id)
    try {
      await revokeSession(session.id)
      showNotification(`Signed out ${session.label}.`, 'success')
      await load()
    } catch (err) {
      showNotification(
        err instanceof Error ? err.message : String(err),
        'error',
      )
    } finally {
      if (live) setEnding(null)
    }
  }

  return (
    <div class="mp-set" data-testid="devices-screen">
      <Show when={failed()}>
        <div class="mp-set-note mp-set-note--warn" role="status">
          <WarnIcon size={20} />
          <p>
            <strong>Could not load your devices.</strong> Check the connection
            and try again.
          </p>
        </div>
        <button
          type="button"
          class="mp-set-button mp-set-button--secondary"
          data-testid="devices-retry"
          onClick={() => {
            void load()
          }}
        >
          Try again
        </button>
      </Show>
      <Show when={sessions()}>
        {(list) => (
          <SettingsGroup title="Signed in on">
            <For each={list()}>
              {(session) => (
                <div class="mp-set-row" data-device={session.id}>
                  <span
                    class="mp-set-row__icon"
                    data-device-icon={
                      onComputer(session.label) ? 'computer' : 'phone'
                    }
                  >
                    <Show
                      when={onComputer(session.label)}
                      fallback={<PhoneIcon />}
                    >
                      <ComputerIcon />
                    </Show>
                  </span>
                  <span class="mp-set-row__label">
                    {session.current ? thisDevice() : session.label}
                    <span class="mp-set-row__sub">
                      {session.current
                        ? `${session.label}, in use now`
                        : `Last used ${lastUsed(session.lastSeenAt)}`}
                    </span>
                  </span>
                  <Show when={!session.current}>
                    <button
                      type="button"
                      class="mp-set-button mp-set-button--secondary mp-set-button--small"
                      disabled={ending() !== null}
                      onClick={() => void signOutDevice(session)}
                    >
                      {ending() === session.id ? 'Signing out…' : 'Sign out'}
                    </button>
                  </Show>
                </div>
              )}
            </For>
          </SettingsGroup>
        )}
      </Show>
    </div>
  )
}
