// ============================================================
// BlockedSingersScreen — whom this account blocked, and the way back
// ============================================================
//
// Pushed from the Account screen's Blocked singers row, for a registered
// singer signed in. The block sheet (src/components/moderation) says a
// block is undone in "Settings, Blocked singers": this is that place. Each
// singer can be unblocked here, one at a time; a list that cannot be read
// says so and offers to try again, rather than showing nobody blocked.
// Signed out here (a session refused, a sign-out elsewhere), it asks for a
// sign-in, and reads the list again for whoever signs in, as the Leagues
// screen reads its league; a suspended account is pointed to the contact
// form instead (blocked-list-flow.ts).
//
// DevicesScreen's pattern, with one thing it lacks: the button the focus
// is on stays put while its read or unblock is out (aria-disabled, as the
// Leagues screen's Try again is), and when the button goes with what it
// did, the focus goes to what took its place, the Sign in included. Ships
// in every build: the boards it undoes blocks from are in the store build
// too.

import type { JSX } from 'solid-js'
import { For, Match, Show, Switch } from 'solid-js'
import { BLOCKED_ABOUT, BLOCKED_EMPTY, BLOCKED_LOADING, blockedWhen, listFailedWords, suspendedContactUrl, unblockFailedWords, } from '@/components/moderation/blocked-list-copy'
import { createBlockedList } from '@/components/moderation/blocked-list-flow'
import type { BlockedSinger } from '@/db/services/moderation-service'
import { focusLost } from '@/lib/focus-lost'
import { WarnIcon } from '../icons'
import { SettingsGroup } from './SettingsList'
import { openSignIn } from './sign-in-state'

export function BlockedSingersScreen(): JSX.Element {
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
    <div class="mp-set" data-testid="blocked-singers-screen" ref={root}>
      <p class="mp-set__caption">{BLOCKED_ABOUT}</p>

      <Show when={list.stop()}>
        {(stop) => (
          <>
            <div
              class="mp-set-note mp-set-note--warn"
              role="status"
              data-testid="blocked-failed"
            >
              <WarnIcon size={20} />
              <p>
                <strong>{listFailedWords(stop()).title}</strong>{' '}
                {listFailedWords(stop()).body}
              </p>
            </div>
            <Switch>
              <Match when={listFailedWords(stop()).next === 'retry'}>
                {/* Not `disabled` while the read is out: a disabled button
                    drops the focus it has. */}
                <button
                  type="button"
                  class="mp-set-button mp-set-button--secondary"
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
                  class="mp-set-button"
                  data-testid="blocked-sign-in"
                  onClick={() => openSignIn()}
                >
                  Sign in
                </button>
              </Match>
              <Match when={listFailedWords(stop()).next === 'contact'}>
                <a
                  class="mp-set-button mp-set-button--secondary"
                  href={suspendedContactUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="blocked-contact"
                >
                  Contact us
                </a>
              </Match>
            </Switch>
          </>
        )}
      </Show>

      <Show when={list.singers() === null && list.reading() && !list.stop()}>
        <p class="mp-set__caption" role="status" data-testid="blocked-loading">
          {BLOCKED_LOADING}
        </p>
      </Show>

      <Show when={list.singers()}>
        {(singers) => (
          <Show
            when={singers().length > 0}
            fallback={
              <p
                class="mp-set__caption"
                data-testid="blocked-empty"
                data-blocked-empty=""
                tabindex="-1"
              >
                {BLOCKED_EMPTY}
              </p>
            }
          >
            <SettingsGroup title="Blocked">
              <For each={singers()}>
                {(singer, index) => (
                  <div class="mp-set-row" data-blocked={singer.userId}>
                    <span class="mp-set-row__label">
                      {singer.displayName}
                      <span class="mp-set-row__sub">
                        {blockedWhen(singer.createdAt)}
                      </span>
                    </span>
                    <button
                      type="button"
                      class="mp-set-button mp-set-button--secondary mp-set-button--small"
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
                  </div>
                )}
              </For>
            </SettingsGroup>
          </Show>
        )}
      </Show>

      <Show when={list.unblockFailed()}>
        {(failure) => (
          <p class="mp-set__error" role="alert" data-testid="unblock-failed">
            {unblockFailedWords(failure().problem, failure().name)}
          </p>
        )}
      </Show>
    </div>
  )
}
