// ============================================================
// AccountPromises — what an account adds, in three lines
// ============================================================
//
// The Account screen and the offer sheet say the same three things, in the
// same order, from the same copy module (account-copy.ts): which of them
// come free is undecided, so no screen spells them out on its own.

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { AccountIcon, HistoryIcon, LockIcon, PhoneIcon } from '../icons'
import { accountPromises } from './account-copy'

const ICONS = [HistoryIcon, PhoneIcon, LockIcon] as const

export interface AccountPromisesProps {
  /** The small caps title over them, or none (the offer has its own). */
  title?: string
  /** No card of their own: the offer's sheet and card already frame them. */
  bare?: boolean
}

export function AccountPromises(props: AccountPromisesProps): JSX.Element {
  const list = (): JSX.Element => (
    <ul
      class={
        props.bare === true
          ? 'mp-set-promises mp-set-promises--bare'
          : 'mp-set-card mp-set-promises'
      }
    >
      <For each={accountPromises()}>
        {(promise, index) => (
          <li>
            <Dynamic component={ICONS[index()] ?? AccountIcon} size={22} />
            <span>{promise}</span>
          </li>
        )}
      </For>
    </ul>
  )
  return (
    <Show when={props.title} fallback={list()}>
      {(title) => (
        <section class="mp-set-group" aria-label={title()}>
          <h2 class="mp-set-group__title">{title()}</h2>
          {list()}
        </section>
      )}
    </Show>
  )
}
