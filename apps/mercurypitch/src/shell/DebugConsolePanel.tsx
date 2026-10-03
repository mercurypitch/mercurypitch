// ============================================================
// Debug console — whether the console is drawn over the app
// ============================================================
//
// A test build draws the portable console over every screen, and minimised it
// still leaves its dot. That dot is in the shot when the screen is recorded
// for a store: the picture-in-picture window and the background playback the
// Play Console asks to see (owner, 3 Oct). This switch takes the console off
// the screen entirely. The capture goes on underneath, so turning it back on
// brings the panel back with everything it saw meanwhile.
//
// Off is never a trap: this screen is the way back, and every test build has
// it (DeveloperScreen.tsx).
//
// Registered by the native entry alone, behind VITE_PORTABLE_CONSOLE and
// through a dynamic import (main.tsx), so a store build carries none of it.

import type { Component } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import { onPortableConsole, portableConsoleOnScreen, setPortableConsoleOnScreen, } from '@/lib/portable-console'
import { SettingsGroup, SettingsRow } from './settings/SettingsList'
import { SettingsSwitch } from './settings/SettingsSwitch'

export const DebugConsolePanel: Component = () => {
  const [on, setOn] = createSignal(portableConsoleOnScreen())
  onCleanup(onPortableConsole(() => setOn(portableConsoleOnScreen())))

  return (
    <SettingsGroup>
      <SettingsRow
        id="debug-console-on-screen"
        label="Show the debug console"
        sub="Turn it off to record the screen without the console or its dot. It keeps logging while it is off, and comes back with everything when you turn it on."
        accessory={
          <SettingsSwitch
            checked={on()}
            label="Show the debug console"
            testId="dev-debug-console-on-screen"
            onChange={setPortableConsoleOnScreen}
          />
        }
      />
    </SettingsGroup>
  )
}
