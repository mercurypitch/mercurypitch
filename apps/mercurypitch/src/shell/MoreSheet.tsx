// ============================================================
// MoreSheet — the fifth rail item
// ============================================================
//
// The kit's medium-detent sheet: the three rooms that are not on the rail,
// then the account and Settings, with Settings last and tinted
// (`.itile--settings`). A test build also gets the in-app console, because a
// TestFlight build has no devtools and a switch only a keyboard can reach is
// a switch the tester does not have.
//
// THE ROOMS ARE TABS HERE, NOT DOORS. The web bar sends Karaoke, Piano and
// Guitar to `/karaoke`, `/piano-night` and `/guitar-night` — standalone HTML
// entries. This bundle has exactly one document (vite.config.ts forbids more),
// so those URLs are a 404 inside the WebView. The native sheet navigates to
// the in-app tabs instead.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import { TAB_GUITAR, TAB_KARAOKE, TAB_PIANO } from '@/features/tabs/constants'
import { setSettingsSection } from '@/stores/ui-store'
import { AccountIcon, ConsoleIcon, GearIcon, GuitarIcon, KaraokeIcon, PianoIcon, } from './icons'
import { goToTab } from './shell-navigation'

export interface MoreSheetProps {
  open: () => boolean
  onClose: () => void
  onPushSettings: () => void
}

const DEV_CONSOLE_AVAILABLE = import.meta.env.VITE_PORTABLE_CONSOLE === 'true'

export const MoreSheet: Component<MoreSheetProps> = (props) => {
  const leaveTo = (run: () => void): void => {
    props.onClose()
    run()
  }

  const openSettings = (section?: 'account'): void => {
    if (section !== undefined) setSettingsSection(section)
    props.onClose()
    props.onPushSettings()
  }

  return (
    <Sheet isOpen={props.open()} close={props.onClose} ariaLabel="More">
      <div class="mp-sheet-group">
        <div class="mp-sheet-group__title">Rooms</div>
        <div class="mp-itile-grid">
          <button
            type="button"
            class="mp-itile"
            data-more-item="karaoke"
            onClick={() => leaveTo(() => goToTab(TAB_KARAOKE))}
          >
            <KaraokeIcon />
            Karaoke
          </button>
          <button
            type="button"
            class="mp-itile"
            data-more-item="piano"
            onClick={() => leaveTo(() => goToTab(TAB_PIANO))}
          >
            <PianoIcon />
            Piano
          </button>
          <button
            type="button"
            class="mp-itile"
            data-more-item="guitar"
            onClick={() => leaveTo(() => goToTab(TAB_GUITAR))}
          >
            <GuitarIcon />
            Guitar
          </button>
        </div>
      </div>

      <div class="mp-sheet-group">
        <div class="mp-sheet-group__title">You</div>
        <div class="mp-itile-grid">
          <button
            type="button"
            class="mp-itile"
            data-more-item="account"
            onClick={() => openSettings('account')}
          >
            <AccountIcon />
            Account
          </button>
          <Show when={DEV_CONSOLE_AVAILABLE}>
            <button
              type="button"
              class="mp-itile"
              data-more-item="console"
              onClick={() => {
                props.onClose()
                void import('@/components/ConsoleLog').then((module) => {
                  module.setupDeveloperConsole()
                })
              }}
            >
              <ConsoleIcon />
              Console
            </button>
          </Show>
          <button
            type="button"
            class="mp-itile mp-itile--settings"
            data-more-item="settings"
            onClick={() => openSettings()}
          >
            <GearIcon />
            Settings
          </button>
        </div>
      </div>
    </Sheet>
  )
}
