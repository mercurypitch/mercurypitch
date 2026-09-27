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
import { onMount } from 'solid-js'
import { theme, themeSource } from '@/stores/theme-store'
import { ContrastIcon, LockIcon } from '../icons'
import { ACCOUNT_ROW } from './account-copy'
import { accountDisplayName, accountProviderLine, accountReach, accountSignedIn, refreshAccount, } from './account-state'
import { appearanceLabel } from './AppearanceScreen'
import { AccountAvatar, SettingsGroup, SettingsRow } from './SettingsList'

/** The screens a Settings row pushes. */
export type SettingsSubScreen = 'account' | 'appearance'

export interface SettingsScreenProps {
  onPush: (screen: SettingsSubScreen) => void
}

export function SettingsScreen(props: SettingsScreenProps): JSX.Element {
  // The row names the account from the card the phone kept; one read per
  // session keeps it current without asking the server on every visit. The
  // Account screen reads again whenever it opens.
  onMount(() => {
    if (accountSignedIn() && accountReach() === 'idle') void refreshAccount()
  })

  return (
    <div class="mp-set" data-testid="settings-screen">
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
          </SettingsGroup>
          <SettingsGroup title="This phone">
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
        <div class="mp-set__col" />
      </div>
      <p class="mp-set__privacy">
        <LockIcon size={14} /> Only you can hear you.
      </p>
    </div>
  )
}
