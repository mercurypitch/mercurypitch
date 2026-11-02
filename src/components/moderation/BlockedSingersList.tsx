// ============================================================
// BlockedSingersList — the web's Blocked singers, in account settings
// ============================================================
//
// The phone has a screen of its own for this (the native shell's
// BlockedSingersScreen); a singer who blocked someone on the web undoes it
// here, in the account settings, under the same name the block sheet gives
// it: "Settings, Blocked singers". Same reading and unblocking as the phone
// (blocked-list-flow.ts), same words (blocked-list-copy.ts): signed out, a
// device with no account and a refused session are asked to sign in, a
// suspended account is pointed to the contact form, and a read that failed
// is tried again. A button whose read or unblock is out stays where it is
// (aria-disabled), and keeps its focus; when it goes with what it did, the
// focus goes to what took its place, and after a sign-in from here to the
// list read for that account. Its states carry no live role, as the device
// list's beside it do not (SessionList.tsx): the settings page is read, not
// watched.

import type { JSX } from 'solid-js'
import { For, Match, Show, Switch } from 'solid-js'
import type { BlockedSinger } from '@/db/services/moderation-service'
import { focusLost } from '@/lib/focus-lost'
import { openAuthModal } from '@/stores/ui-store'
import { BLOCKED_ABOUT, BLOCKED_EMPTY, BLOCKED_LOADING, blockedWhen, listFailedWords, suspendedContactUrl, unblockFailedWords, } from './blocked-list-copy'
import { createBlockedList } from './blocked-list-flow'
import styles from './BlockedSingersList.module.css'

export function BlockedSingersList(): JSX.Element {
  let root: HTMLDivElement | undefined

  /** The row at `index` now, or the one above it, or the empty list. */
  const focusAt = (index: number): void => {
    queueMicrotask(() => {
      const buttons = [
        ...(root?.querySelectorAll<HTMLButtonElement>('[data-unblock]') ?? []),
      ]
      const next = buttons[Math.min(index, buttons.length - 1)]
      ;(
        next ?? root?.querySelector<HTMLElement>('[data-blocked-empty]')
      )?.focus()
    })
  }

  const list = createBlockedList({
    // The Sign in pressed here went with the sign-in: on to the list.
    onSignedInRead: () => {
      if (focusLost()) focusAt(0)
    },
  })

  const retry = (): void => {
    if (list.reading()) return
    void list.load().then(() => {
      if (list.stop() === null) focusAt(0)
    })
  }

  const unblock = (singer: BlockedSinger, index: number): void => {
    if (list.unblocking() !== null) return
    void list.unblock(singer).then((lifted) => {
      if (lifted) focusAt(index)
    })
  }

  return (
    <div class={styles.block} data-testid="blocked-singers" ref={root}>
      <span class={styles.label}>Blocked singers</span>
      <p class={styles.hint}>{BLOCKED_ABOUT}</p>

      <Show when={list.stop()}>
        {(stop) => (
          <div class={styles.failed} data-testid="blocked-failed">
            <p class={styles.error}>
              {listFailedWords(stop()).title} {listFailedWords(stop()).body}
            </p>
            <Switch>
              <Match when={listFailedWords(stop()).next === 'retry'}>
                <button
                  type="button"
                  class={styles.action}
                  data-testid="blocked-retry"
                  aria-disabled={list.reading() ? 'true' : undefined}
                  onClick={retry}
                >
                  Try again
                </button>
              </Match>
              <Match when={listFailedWords(stop()).next === 'sign-in'}>
                <button
                  type="button"
                  class={styles.action}
                  data-testid="blocked-sign-in"
                  onClick={() => openAuthModal('login')}
                >
                  Sign in
                </button>
              </Match>
              <Match when={listFailedWords(stop()).next === 'contact'}>
                <a
                  class={styles.action}
                  href={suspendedContactUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="blocked-contact"
                >
                  Contact us
                </a>
              </Match>
            </Switch>
          </div>
        )}
      </Show>

      <Show when={list.singers() === null && list.reading() && !list.stop()}>
        <p class={styles.hint} data-testid="blocked-loading">
          {BLOCKED_LOADING}
        </p>
      </Show>

      <Show when={list.singers()}>
        {(singers) => (
          <Show
            when={singers().length > 0}
            fallback={
              <p
                class={styles.hint}
                data-testid="blocked-empty"
                data-blocked-empty=""
                tabindex="-1"
              >
                {BLOCKED_EMPTY}
              </p>
            }
          >
            <ul class={styles.list}>
              <For each={singers()}>
                {(singer, index) => (
                  <li class={styles.row} data-blocked={singer.userId}>
                    <span class={styles.rowText}>
                      <span class={styles.name}>{singer.displayName}</span>
                      <span class={styles.meta}>
                        {blockedWhen(singer.createdAt)}
                      </span>
                    </span>
                    <button
                      type="button"
                      class={styles.action}
                      data-unblock={singer.userId}
                      aria-label={`Unblock ${singer.displayName}`}
                      aria-disabled={
                        list.unblocking() !== null ? 'true' : undefined
                      }
                      onClick={() => unblock(singer, index())}
                    >
                      {list.unblocking() === singer.userId
                        ? 'Unblocking…'
                        : 'Unblock'}
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        )}
      </Show>

      <Show when={list.unblockFailed()}>
        {(failure) => (
          <p class={styles.error} role="alert" data-testid="unblock-failed">
            {unblockFailedWords(failure().problem, failure().name)}
          </p>
        )}
      </Show>
    </div>
  )
}
