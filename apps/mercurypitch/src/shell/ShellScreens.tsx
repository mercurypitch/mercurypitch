// ============================================================
// ShellScreens — the pushed screen on top of the stack, and only that one
// ============================================================
//
// Settings is the root of a stack (S6, decision D1 A): its rows push screens
// of their own, and those can push again. Only the TOP screen is drawn. A
// screen underneath is not hidden behind the one above but gone, because two
// copies of the same bar would be two Backs under one thumb, two matches for
// every probe that looks for one, and a screen reader walking a page the eye
// cannot see. What a screen needs to come back to lives in a store, not in a
// component that stayed mounted.
//
// Keyed on the id, so moving between levels re-creates the screen rather
// than morphing one into the other.

import type { Component, JSX } from 'solid-js'
import { Show } from 'solid-js'
import { PushedScreen } from './PushedScreen'
import type { PushedScreen as PushedScreenId } from './run-shell-store'
import { popScreen, pushed, pushScreen } from './run-shell-store'
import { AboutScreen } from './settings/AboutScreen'
import { AccountNameScreen } from './settings/AccountNameScreen'
import { AccountScreen } from './settings/AccountScreen'
import { AppearanceScreen } from './settings/AppearanceScreen'
import { DeleteAccountScreen } from './settings/DeleteAccountScreen'
import { DevicesScreen } from './settings/DevicesScreen'
import { MicrophoneScreen } from './settings/MicrophoneScreen'
import { RoomNoiseScreen } from './settings/RoomNoiseScreen'
import { SettingsScreen } from './settings/SettingsScreen'
import { StorageScreen } from './settings/StorageScreen'
import { ThisPhoneScreen } from './settings/ThisPhoneScreen'

export interface ShellScreensProps {
  /**
   * The developer screen, on a build that has one. NativeShell owns the lazy
   * import behind the build constant, so a store build passes nothing and
   * carries no chunk for it.
   */
  developer?: Component
}

const TITLES: Record<PushedScreenId, string> = {
  settings: 'Settings',
  account: 'Account',
  'account-name': 'Name',
  devices: 'Devices',
  'delete-account': 'Delete account',
  microphone: 'Microphone',
  'room-noise': 'Room noise',
  storage: 'Storage',
  'this-phone': 'This phone',
  appearance: 'Appearance',
  about: 'About',
  developer: 'Developer',
}

export function ShellScreens(props: ShellScreensProps): JSX.Element {
  const body = (screen: PushedScreenId): JSX.Element => {
    switch (screen) {
      case 'settings':
        return <SettingsScreen onPush={pushScreen} />
      case 'account':
        return <AccountScreen />
      case 'account-name':
        return <AccountNameScreen />
      case 'devices':
        return <DevicesScreen />
      case 'delete-account':
        return <DeleteAccountScreen />
      case 'microphone':
        return <MicrophoneScreen />
      case 'room-noise':
        return <RoomNoiseScreen />
      case 'storage':
        return <StorageScreen />
      case 'this-phone':
        return <ThisPhoneScreen />
      case 'appearance':
        return <AppearanceScreen />
      case 'about':
        return <AboutScreen />
      case 'developer': {
        const Developer = props.developer
        return Developer === undefined ? null : <Developer />
      }
    }
  }

  return (
    <Show when={pushed()} keyed>
      {(screen) => (
        <PushedScreen title={TITLES[screen]} onBack={popScreen}>
          {body(screen)}
        </PushedScreen>
      )}
    </Show>
  )
}
