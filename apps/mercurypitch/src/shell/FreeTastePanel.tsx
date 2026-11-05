// ============================================================
// The Developer screen's Free taste section: try the premium rooms' gate
// before the V1 flip turns it on (src/stores/free-taste-store.ts), see
// each room's runs given against its free ones, and make them whole again.
// Registered in main.tsx on a test build with the premium exercises.
// ============================================================

import type { Component } from 'solid-js'
import { For } from 'solid-js'
import { ROOM_NAMES } from '@/lib/free-taste'
import { PREMIUM_GATE } from '@/lib/native-build'
import { freeTasteTrying, resetFreeTaste, tasteSubscribed, tasteTable, tryFreeTaste, } from '@/stores/free-taste-store'
import { SettingsGroup, SettingsRow } from './settings/SettingsList'
import { SettingsSwitch } from './settings/SettingsSwitch'

/** "Leap", "The Warm-up": a row's name starts with a capital. */
function rowName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export const FreeTastePanel: Component = () => (
  <SettingsGroup>
    <SettingsRow
      id="free-taste-try"
      label="Try the free taste"
      sub={
        PREMIUM_GATE
          ? 'The gate is on in this build: each premium room gives its free runs, then the Cloud offer.'
          : 'Off in this build until the V1 flip. Turn it on to play the premium rooms as a singer without the subscription will: their free runs, then the Cloud offer. Runs count only while it is on.'
      }
      accessory={
        <SettingsSwitch
          checked={PREMIUM_GATE || freeTasteTrying()}
          label="Try the free taste"
          testId="dev-free-taste-try"
          onChange={tryFreeTaste}
        />
      }
    />
    <For each={tasteTable()}>
      {(room) => (
        <SettingsRow
          id={`free-taste-${room.id}`}
          label={rowName(ROOM_NAMES[room.id])}
          value={`${Math.min(room.used, room.free)} of ${room.free} used`}
        />
      )}
    </For>
    <SettingsRow
      id="free-taste-subscribed"
      label="Cloud subscription"
      value={tasteSubscribed() ? 'Subscribed: no gate' : 'None'}
    />
    <SettingsRow
      id="free-taste-reset"
      label="Give every room its free runs again"
      onPress={resetFreeTaste}
    />
  </SettingsGroup>
)
