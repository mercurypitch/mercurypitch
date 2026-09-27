// ============================================================
// DeleteAccountScreen — the loss named before anything happens
// ============================================================
//
// Pushed from Settings' Delete account row, which is there only while an
// account is signed in (REQ-NAM-055). What goes, including the Apple grant
// for an account made with Apple; what stays on the phone (REQ-NAM-059);
// and a way to do the same without the app (REQ-NAM-060). The button asks
// once, in red (decision 03 A, REQ-NAM-057). A deletion that fails says so
// out loud and changes nothing here: "silently succeeding" would tell a
// singer their data is gone when it is not.

import type { JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { AppleMark } from '@/components/account/AppleMark'
import { HistoryIcon, PersonIcon, TrashIcon, TrophyIcon, WaveIcon, } from '../icons'
import { DELETE_ACCOUNT, DELETE_QUESTION } from './account-copy'
import { deleteAccountHere } from './account-deletion'
import { accountCard } from './account-state'
import { askSettings } from './settings-alert'
import { SettingsGroup, SettingsRow } from './SettingsList'

const LOSS_ICONS = [PersonIcon, HistoryIcon, TrophyIcon] as const

/** What goes, each with its row's icon. */
const LOSSES = DELETE_ACCOUNT.goes.map((label, index) => ({
  id: `delete-goes-${index}`,
  label,
  icon: LOSS_ICONS[index] ?? TrashIcon,
}))

export function DeleteAccountScreen(): JSX.Element {
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')

  const apple = (): boolean => accountCard()?.provider === 'apple'

  async function erase(): Promise<void> {
    setBusy(true)
    setError('')
    try {
      await deleteAccountHere()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete account')
      setBusy(false)
    }
  }

  return (
    <div class="mp-set" data-testid="delete-account-screen">
      <p class="mp-set__caption">{DELETE_ACCOUNT.lead}</p>
      <SettingsGroup title={DELETE_ACCOUNT.goesTitle}>
        <For each={LOSSES}>
          {(loss) => (
            <SettingsRow
              id={loss.id}
              icon={<Dynamic component={loss.icon} />}
              label={loss.label}
            />
          )}
        </For>
        <Show when={apple()}>
          <SettingsRow
            id="delete-goes-apple"
            icon={<AppleMark />}
            label={DELETE_ACCOUNT.apple.label}
            sub={DELETE_ACCOUNT.apple.sub}
          />
        </Show>
      </SettingsGroup>
      <SettingsGroup title={DELETE_ACCOUNT.staysTitle}>
        <SettingsRow
          id="delete-stays"
          icon={<WaveIcon />}
          label={DELETE_ACCOUNT.stays.label}
          sub={DELETE_ACCOUNT.stays.sub}
        />
      </SettingsGroup>
      <p class="mp-set__caption">{DELETE_ACCOUNT.elsewhere}</p>
      <Show when={error() !== ''}>
        <p
          class="mp-set__error"
          role="alert"
          data-testid="delete-account-error"
        >
          {error()}
        </p>
      </Show>
      <button
        type="button"
        class="mp-set-button mp-set-button--danger"
        disabled={busy()}
        data-testid="delete-account-start"
        onClick={() => {
          askSettings({
            title: DELETE_QUESTION.title,
            text: DELETE_QUESTION.text,
            confirmLabel: DELETE_QUESTION.confirm,
            destructive: true,
            onConfirm: () => void erase(),
          })
        }}
      >
        {busy() ? 'Deleting…' : DELETE_ACCOUNT.button}
      </button>
    </div>
  )
}
