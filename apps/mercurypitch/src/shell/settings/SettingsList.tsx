// ============================================================
// SettingsList — the grouped rows every Settings screen is built from
// ============================================================
//
// One set of primitives for the whole stack (Settings and every screen its
// rows push), so the screens cannot drift apart in the details a thumb
// notices: a row is at least 48 px tall, a row that pushes carries a
// chevron, a row with a control of its own is not itself a button (a button
// inside a button is two targets that answer as one).

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import './settings.css'
import { AccountIcon, CheckIcon, ChevronIcon, ExternalIcon } from '../icons'
import { accountCard, accountSignedIn } from './account-state'

export interface SettingsGroupProps {
  /** The small caps title over the group; a group of one may go without. */
  title?: string
  children: JSX.Element
}

export function SettingsGroup(props: SettingsGroupProps): JSX.Element {
  return (
    <section class="mp-set-group" aria-label={props.title}>
      <Show when={props.title}>
        {(title) => <h2 class="mp-set-group__title">{title()}</h2>}
      </Show>
      <div class="mp-set-list">{props.children}</div>
    </section>
  )
}

export interface SettingsRowProps {
  /** Stable name for tests and the probe: `data-settings-row`. */
  id: string
  icon?: JSX.Element
  label: JSX.Element
  /** The smaller line under the label. */
  sub?: JSX.Element
  /** Right-aligned, in the secondary colour: the row's current answer. */
  value?: JSX.Element
  /** A row that does something is a button, with a chevron if it pushes. */
  onPress?: () => void
  /** A control of the row's own (a toggle, a small capsule), in place of
   *  the chevron. The row is then NOT a button. */
  accessory?: JSX.Element
  tone?: 'danger'
}

export function SettingsRow(props: SettingsRowProps): JSX.Element {
  const classes = (button: boolean): string =>
    [
      'mp-set-row',
      button ? 'mp-set-row--button' : '',
      props.tone === 'danger' ? 'mp-set-row--danger' : '',
    ]
      .filter((name) => name !== '')
      .join(' ')

  const body = (chevron: boolean): JSX.Element => (
    <>
      <Show when={props.icon}>
        {(icon) => <span class="mp-set-row__icon">{icon()}</span>}
      </Show>
      <span class="mp-set-row__label">
        {props.label}
        <Show when={props.sub}>
          {(sub) => <span class="mp-set-row__sub">{sub()}</span>}
        </Show>
      </span>
      <Show when={props.value}>
        {(value) => <span class="mp-set-row__value">{value()}</span>}
      </Show>
      {props.accessory}
      <Show when={chevron}>
        <ChevronIcon class="mp-set-row__chev" size={18} />
      </Show>
    </>
  )

  return (
    <Show
      when={props.onPress !== undefined && props.accessory === undefined}
      fallback={
        <div class={classes(false)} data-settings-row={props.id}>
          {body(false)}
        </div>
      }
    >
      <button
        type="button"
        class={classes(true)}
        data-settings-row={props.id}
        onClick={() => props.onPress?.()}
      >
        {body(true)}
      </button>
    </Show>
  )
}

export interface SettingsLinkRowProps {
  /** Stable name for tests and the probe: `data-settings-row`. */
  id: string
  icon?: JSX.Element
  label: JSX.Element
  /** A page on the web, which opens outside the app. */
  href: string
}

/**
 * A row that leaves the app for a page on the web: an anchor, never a
 * button, with the external mark where a pushing row has its chevron.
 */
export function SettingsLinkRow(props: SettingsLinkRowProps): JSX.Element {
  return (
    <a
      class="mp-set-row mp-set-row--button mp-set-row--link"
      data-settings-row={props.id}
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Show when={props.icon}>
        {(icon) => <span class="mp-set-row__icon">{icon()}</span>}
      </Show>
      <span class="mp-set-row__label">{props.label}</span>
      <ExternalIcon class="mp-set-row__chev" size={18} />
    </a>
  )
}

export interface SettingsChoiceProps {
  /** Stable name for tests: `data-choice`. */
  id: string
  label: string
  sub?: string
  checked: boolean
  onChoose: () => void
}

/** One answer in a `role="radiogroup"` list: the chosen one carries a check. */
export function SettingsChoice(props: SettingsChoiceProps): JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.checked ? 'true' : 'false'}
      class="mp-set-row mp-set-row--button"
      data-choice={props.id}
      onClick={() => props.onChoose()}
    >
      <span class="mp-set-row__label">
        {props.label}
        <Show when={props.sub}>
          {(sub) => <span class="mp-set-row__sub">{sub()}</span>}
        </Show>
      </span>
      <Show when={props.checked}>
        <CheckIcon class="mp-set-row__check" size={20} />
      </Show>
    </button>
  )
}

export interface AccountAvatarProps {
  /** The identity card's larger disc. */
  large?: boolean
}

/**
 * The account's disc: the first letter of its name once the phone knows it,
 * the person glyph before that and whenever nothing is signed in.
 */
export function AccountAvatar(props: AccountAvatarProps): JSX.Element {
  const initial = (): string => {
    if (!accountSignedIn()) return ''
    const name = accountCard()?.name ?? ''
    return name === '' ? '' : name.slice(0, 1).toLocaleUpperCase()
  }
  return (
    <span
      class={
        props.large === true
          ? 'mp-set-avatar mp-set-avatar--lg'
          : 'mp-set-avatar'
      }
      aria-hidden="true"
    >
      <Show when={initial()} fallback={<AccountIcon size={22} />}>
        {initial()}
      </Show>
    </span>
  )
}
