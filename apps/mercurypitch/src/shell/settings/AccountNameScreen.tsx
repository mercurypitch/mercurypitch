// ============================================================
// AccountNameScreen — the account's name, and nothing else
// ============================================================
//
// Pushed from the Account screen's Name row (S6 step 4, mock 4b). The name
// is the profile's display name: leaderboards and shared content show it,
// which is why an empty one cannot be saved. Saving goes back to Account,
// whose card already carries the new name; a failed save keeps what was
// typed, with the reason under it.

import type { JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { showNotification } from '@/stores/notifications-store'
import { popScreen } from '../run-shell-store'
import { saveAccountName } from './account-actions'
import { accountCard } from './account-state'

/** The profile's own limit, as the web's editor has it. */
const NAME_MAX = 40

export function AccountNameScreen(): JSX.Element {
  const current = (): string => accountCard()?.name ?? ''
  const [draft, setDraft] = createSignal(current())
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')

  const typed = (): string => draft().trim()
  const empty = (): boolean => typed() === ''
  const canSave = (): boolean => !busy() && !empty() && typed() !== current()

  async function save(): Promise<void> {
    if (!canSave()) return
    setBusy(true)
    setError('')
    try {
      await saveAccountName(typed())
      showNotification('Name updated', 'info')
      popScreen()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      class="mp-set"
      data-testid="account-name-screen"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <label class="mp-field">
        <span class="mp-field__label">Name</span>
        <input
          class="mp-field__input"
          type="text"
          autocomplete="nickname"
          maxLength={NAME_MAX}
          value={draft()}
          onInput={(event) => setDraft(event.currentTarget.value)}
          aria-describedby="account-name-hint"
          aria-invalid={empty() ? 'true' : undefined}
          disabled={busy()}
          data-testid="account-name-input"
        />
      </label>
      <p
        id="account-name-hint"
        class={empty() ? 'mp-set__error' : 'mp-set__caption'}
        data-testid="account-name-hint"
      >
        {empty()
          ? 'A name cannot be empty.'
          : 'Shown on leaderboards and shared content.'}
      </p>
      <Show when={error() !== ''}>
        <p class="mp-set__error" role="alert" data-testid="account-error">
          {error()}
        </p>
      </Show>
      <button
        type="submit"
        class="mp-set-button"
        disabled={!canSave()}
        data-testid="account-name-save"
      >
        {busy() ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
