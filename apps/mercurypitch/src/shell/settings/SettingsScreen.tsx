// ============================================================
// SettingsScreen — the native Settings: a short grouped list
// ============================================================
//
// What replaced the web SettingsPanel inside the shell's pushed screen (S6,
// decision D1 A). The web panel is a long page of twenty-odd sections built
// for a browser: links out to /mirror and /glass, install hints, a PeerPush
// badge, an admin link and a second "Settings" title under the bar's (audit
// D3 to D8). None of it comes along. This is what is true of the app, the
// phone and the account; a room's own options stay behind the room's gear.
//
// Every row that leads somewhere pushes a screen of its own onto the shell's
// stack (`run-shell-store.ts`), so Back walks down it one level at a time.
// The groups sit in one column upright and two on a phone on its side.

import type { JSX } from 'solid-js'
import { onCleanup, onMount, Show } from 'solid-js'
import { theme, themeSource } from '@/stores/theme-store'
import { ContrastIcon, InfoIcon, LockIcon, MicIcon, PhoneIcon, StorageIcon, TrashIcon, WarnIcon, } from '../icons'
import { ACCOUNT_ROW } from './account-copy'
import { accountDeletedNote, dismissAccountDeletedNote, } from './account-deletion'
import { accountDisplayName, accountProviderLine, accountReach, accountSignedIn, refreshAccount, } from './account-state'
import { appearanceLabel } from './AppearanceScreen'
import { deviceFacts, loadDeviceFacts } from './device-facts'
import { knownInput } from './level-check'
import { AccountAvatar, SettingsGroup, SettingsRow } from './SettingsList'
import { formatBytes, loadStorageFacts, storageTotal } from './storage-facts'

/** The screens a Settings row pushes. */
export type SettingsSubScreen =
  | 'account'
  | 'delete-account'
  | 'microphone'
  | 'storage'
  | 'this-phone'
  | 'appearance'
  | 'about'

/** The Microphone row's answer: the input once heard, Off once refused. */
function microphoneValue(): string | undefined {
  const heard = knownInput()
  if (heard === null) return undefined
  return heard === 'denied' ? 'Off' : heard.label
}

export interface SettingsScreenProps {
  onPush: (screen: SettingsSubScreen) => void
}

export function SettingsScreen(props: SettingsScreenProps): JSX.Element {
  // The row names the account from the card the phone kept; one read per
  // session keeps it current without asking the server on every visit. The
  // Account screen reads again whenever it opens.
  onMount(() => {
    if (accountSignedIn() && accountReach() === 'idle') void refreshAccount()
    // The Storage row's size, read on every visit: a take kept since the
    // last one changed it.
    void loadStorageFacts()
    void loadDeviceFacts()
  })
  // The line after a deletion is said once: leaving Settings retires it.
  onCleanup(dismissAccountDeletedNote)

  return (
    <div class="mp-set" data-testid="settings-screen">
      <Show when={accountDeletedNote()}>
        {(line) => (
          <div class="mp-set-note" role="status" data-testid="account-deleted">
            <WarnIcon size={20} />
            <p>{line()}</p>
          </div>
        )}
      </Show>
      <div class="mp-set__cols">
        <div class="mp-set__col">
          <SettingsGroup>
            <SettingsRow
              id="account"
              icon={<AccountAvatar />}
              label={
                accountSignedIn() ? accountDisplayName() : ACCOUNT_ROW.label
              }
              sub={
                accountSignedIn()
                  ? accountProviderLine()
                  : ACCOUNT_ROW.signedOutSub
              }
              value={accountSignedIn() ? undefined : ACCOUNT_ROW.signedOutValue}
              onPress={() => {
                props.onPush('account')
              }}
            />
            {/* One tap from Settings, and only while there is an account to
                delete (REQ-NAM-055). */}
            <Show when={accountSignedIn()}>
              <SettingsRow
                id="delete-account"
                icon={<TrashIcon />}
                label="Delete account"
                tone="danger"
                onPress={() => {
                  props.onPush('delete-account')
                }}
              />
            </Show>
          </SettingsGroup>
          <SettingsGroup title="This phone">
            <SettingsRow
              id="microphone"
              icon={<MicIcon />}
              label="Microphone"
              value={microphoneValue()}
              onPress={() => {
                props.onPush('microphone')
              }}
            />
            <SettingsRow
              id="storage"
              icon={<StorageIcon />}
              label="Storage"
              value={
                storageTotal() === null
                  ? undefined
                  : formatBytes(storageTotal() ?? 0)
              }
              onPress={() => {
                props.onPush('storage')
              }}
            />
            <SettingsRow
              id="this-phone"
              icon={<PhoneIcon />}
              label="This phone"
              value={deviceFacts()?.model ?? undefined}
              onPress={() => {
                props.onPush('this-phone')
              }}
            />
            <SettingsRow
              id="appearance"
              icon={<ContrastIcon />}
              label="Appearance"
              value={appearanceLabel(themeSource(), theme())}
              onPress={() => {
                props.onPush('appearance')
              }}
            />
          </SettingsGroup>
        </div>
        <div class="mp-set__col">
          <SettingsGroup title="About">
            <SettingsRow
              id="about"
              icon={<InfoIcon />}
              label="About MercuryPitch"
              value={deviceFacts()?.version ?? undefined}
              onPress={() => {
                props.onPush('about')
              }}
            />
          </SettingsGroup>
        </div>
      </div>
      <p class="mp-set__privacy">
        <LockIcon size={14} /> Only you can hear you.
      </p>
    </div>
  )
}
