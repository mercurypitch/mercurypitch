// ============================================================
// BlockedSingersList — the web's Blocked singers, in account settings
// ============================================================
//
// The phone has a screen of its own for this (the native shell's
// BlockedSingersScreen); a singer who blocked someone on the web undoes it
// here, in the account settings, under the same name the block sheet gives
// it: "Settings, Blocked singers". Same reading and unblocking as the phone
// (blocked-list-flow.ts), same words (blocked-list-copy.ts). A button whose
// read or unblock is out stays where it is (aria-disabled), and keeps its
// focus; when it goes with what it did, the focus goes to what took its
// place. Its states carry no live role, as the device list's beside it do
// not (SessionList.tsx): the settings page is read, not watched.

import type { JSX } from 'solid-js'
import { For, onMount, Show } from 'solid-js'
import type { BlockedSinger } from '@/db/services/moderation-service'
import { openAuthModal } from '@/stores/ui-store'
import { BLOCKED_ABOUT, BLOCKED_EMPTY, BLOCKED_LOADING, blockedWhen, listFailedWords, unblockFailedWords, } from './blocked-list-copy'
import { createBlockedList } from './blocked-list-flow'
import styles from './BlockedSingersList.module.css'

export function BlockedSingersList(): JSX.Element {
  const list = createBlockedList()
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

  onMount(() => {
    void list.load()
  })

  const retry = (): void => {
    if (list.reading()) return
    void list.load().then(() => {
      if (list.failed() === null) focusAt(0)
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

      <Show when={list.failed()}>
        {(problem) => (
          <div class={styles.failed} data-testid="blocked-failed">
            <p class={styles.error}>
              {listFailedWords(problem()).title}{' '}
              {listFailedWords(problem()).body}
            </p>
            <Show
              when={listFailedWords(problem()).signIn}
              fallback={
                <button
                  type="button"
                  class={styles.action}
                  data-testid="blocked-retry"
                  aria-disabled={list.reading() ? 'true' : undefined}
                  onClick={retry}
                >
                  Try again
                </button>
              }
            >
              <button
                type="button"
                class={styles.action}
                onClick={() => openAuthModal('login')}
              >
                Sign in
              </button>
            </Show>
          </div>
        )}
      </Show>

      <Show when={list.singers() === null && list.reading() && !list.failed()}>
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
