// ============================================================
// FriendCodePanel — share your code, redeem someone else's
// ============================================================
//
// Adding a friend used to mean finding them on the public leaderboard. That
// board is now opt-in and threshold-gated, so it is no longer a discovery
// surface: friends need their own way in. A short code covers how people
// actually share — read it out, paste it into a chat, or send the link that
// carries it.
//
// Registered accounts only. An anonymous identity disappears with a cleared
// browser, and a dead entry in someone else's friend list is worse than no
// entry at all.

import type { Component } from 'solid-js'
import { createSignal, onMount, Show } from 'solid-js'
import { Copy, UserPlus } from '@/components/icons'
import { formatFriendCode, friendInviteUrl, getMyFriendCode, redeemFriendCode, } from '@/db/services/follow-service'
import { takePendingFriendCode } from '@/lib/pending-friend-code'
import { showNotification } from '@/stores/notifications-store'
import styles from './FriendCodePanel.module.css'

interface FriendCodePanelProps {
  /** Called after a successful redeem so the caller can refresh its list. */
  onFriendAdded?: () => void
}

/**
 * Pull `?add=CODE` out of the hash route (`#/leaderboard?add=K7QM2X4B`).
 * Invite links land here, so the code is prefilled rather than retyped.
 */
function codeFromHash(): string {
  const hash = window.location.hash
  const q = hash.indexOf('?')
  if (q === -1) return ''
  return new URLSearchParams(hash.slice(q + 1)).get('add') ?? ''
}

export const FriendCodePanel: Component<FriendCodePanelProps> = (props) => {
  const [myCode, setMyCode] = createSignal<string | null>(null)
  const [entry, setEntry] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')

  onMount(() => {
    void (async () => {
      setMyCode(await getMyFriendCode())
      // Invite links arrive two ways: the raw hash query (when this panel
      // mounts before the router canonicalises it away) and the stash that
      // parseHash fills for exactly that erasure. Check both.
      const invited = codeFromHash() || (takePendingFriendCode() ?? '')
      if (invited !== '') {
        // Prefill rather than auto-redeem: following someone is a real
        // action, and a link shouldn't perform it just by being opened.
        setEntry(formatFriendCode(invited))
      }
    })()
  })

  async function copy(text: string, what: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      showNotification(`${what} copied`, 'info')
    } catch {
      // Clipboard is permission-gated and blocked outright in some contexts;
      // the code is selectable, so say so instead of failing silently.
      showNotification(
        `Couldn't copy — select the ${what.toLowerCase()}`,
        'warning',
      )
    }
  }

  async function add(): Promise<void> {
    const code = entry().trim()
    if (code === '' || busy()) return
    setBusy(true)
    setError('')
    try {
      const result = await redeemFriendCode(code)
      if (!result.ok) {
        setError(result.error ?? 'Could not add friend')
        return
      }
      setEntry('')
      showNotification(
        result.displayName != null && result.displayName !== ''
          ? `${result.displayName} added`
          : 'Friend added',
        'success',
      )
      props.onFriendAdded?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class={styles.panel} data-testid="friend-code-panel">
      <Show
        when={myCode() != null}
        fallback={
          <p class={styles.hint} data-testid="friend-code-signin">
            Create an account to add friends — codes need somewhere permanent to
            live, and an anonymous profile disappears if this browser is
            cleared.
          </p>
        }
      >
        <div class={styles.row}>
          <span class={styles.label}>Your friend code</span>
          <div class={styles.controls}>
            <span class={styles.code} data-testid="my-friend-code">
              {formatFriendCode(myCode() ?? '')}
            </span>
            <button
              class={styles.button}
              onClick={() =>
                void copy(formatFriendCode(myCode() ?? ''), 'Code')
              }
              data-testid="copy-code"
            >
              <Copy /> Copy code
            </button>
            <button
              class={styles.button}
              onClick={() =>
                void copy(friendInviteUrl(myCode() ?? ''), 'Invite link')
              }
              data-testid="copy-invite"
            >
              <Copy /> Copy invite link
            </button>
          </div>
        </div>

        <div class={styles.row}>
          <span class={styles.label}>Add a friend</span>
          <div class={styles.controls}>
            <input
              class={styles.input}
              type="text"
              placeholder="XXXX-XXXX"
              aria-label="Friend code"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck={false}
              maxLength={9}
              value={entry()}
              disabled={busy()}
              data-testid="friend-code-input"
              onInput={(e) => setEntry(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void add()
              }}
            />
            <button
              class={styles.primary}
              onClick={() => void add()}
              disabled={busy() || entry().trim() === ''}
              data-testid="add-friend"
            >
              <UserPlus /> Add
            </button>
          </div>
          <Show when={error() !== ''}>
            <p class={styles.error} data-testid="friend-code-error">
              {error()}
            </p>
          </Show>
        </div>
      </Show>
    </div>
  )
}
