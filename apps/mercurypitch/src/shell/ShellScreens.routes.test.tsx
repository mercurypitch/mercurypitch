// ============================================================
// Every screen on the Settings stack, under its own title
// ============================================================
//
// S6 step 12. Each id the stack can hold draws its own screen, under its
// own title, over Settings, and Back takes it off again. The screens stand
// in as empty markers here: what each one says is its own suite's business,
// and what this pins is only that the stack sends every id to the right one.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_SINGING } from '@/features/tabs/constants'
import { setActiveTab } from '@/stores/ui-store'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'
import type { PushedScreen } from './run-shell-store'
import { pushed, pushScreen, pushSettingsScreen, resetRunShell, } from './run-shell-store'
import { ShellScreens } from './ShellScreens'

/** A screen that says which it is, and nothing else. */
const marker = vi.hoisted(() => (name: string) => () => {
  const node = document.createElement('div')
  node.setAttribute('data-marker', name)
  return node
})

vi.mock('./settings/SettingsScreen', () => ({
  SettingsScreen: marker('settings'),
}))
vi.mock('./settings/AccountScreen', () => ({
  AccountScreen: marker('account'),
}))
vi.mock('./settings/AccountNameScreen', () => ({
  AccountNameScreen: marker('account-name'),
}))
vi.mock('./settings/DevicesScreen', () => ({
  DevicesScreen: marker('devices'),
}))
vi.mock('./settings/DeleteAccountScreen', () => ({
  DeleteAccountScreen: marker('delete-account'),
}))
vi.mock('./settings/MicrophoneScreen', () => ({
  MicrophoneScreen: marker('microphone'),
}))
vi.mock('./settings/RoomNoiseScreen', () => ({
  RoomNoiseScreen: marker('room-noise'),
}))
vi.mock('./settings/StorageScreen', () => ({
  StorageScreen: marker('storage'),
}))
vi.mock('./settings/ThisPhoneScreen', () => ({
  ThisPhoneScreen: marker('this-phone'),
}))
vi.mock('./settings/AppearanceScreen', () => ({
  AppearanceScreen: marker('appearance'),
}))
vi.mock('./settings/AboutScreen', () => ({
  AboutScreen: marker('about'),
}))

/** Every screen on the stack, with the title its bar carries. */
const SCREENS: readonly [PushedScreen, string][] = [
  ['account', 'Account'],
  ['account-name', 'Name'],
  ['devices', 'Devices'],
  ['delete-account', 'Delete account'],
  ['microphone', 'Microphone'],
  ['room-noise', 'Room noise'],
  ['storage', 'Storage'],
  ['this-phone', 'This phone'],
  ['appearance', 'Appearance'],
  ['about', 'About'],
]

let view: RenderedShell | null = null

function drawn(): { title: string | null; marker: string | null }[] {
  return [
    ...(view?.container.querySelectorAll<HTMLElement>(
      '[data-testid="shell-pushed"]',
    ) ?? []),
  ].map((screen) => ({
    title: screen.getAttribute('aria-label'),
    marker:
      screen.querySelector('[data-marker]')?.getAttribute('data-marker') ??
      null,
  }))
}

beforeEach(() => {
  setActiveTab(TAB_SINGING)
  resetRunShell()
  view = renderShell(() => <ShellScreens />)
})

afterEach(() => {
  view?.unmount()
  view = null
  resetRunShell()
})

describe('the Settings stack', () => {
  it('draws Settings itself at its root', () => {
    pushScreen('settings')

    expect(drawn()).toEqual([{ title: 'Settings', marker: 'settings' }])
  })

  for (const [screen, title] of SCREENS) {
    it(`draws ${screen} under "${title}", over Settings, and Back takes it off`, () => {
      pushSettingsScreen()
      pushScreen(screen)
      const top = drawn()

      view?.container
        .querySelector<HTMLButtonElement>('[data-testid="shell-pushed-back"]')
        ?.click()

      expect(top).toEqual([{ title, marker: screen }])
      expect(pushed()).toBe('settings')
      expect(drawn()).toEqual([{ title: 'Settings', marker: 'settings' }])
    })
  }

  it('draws nothing for Developer on a build without one', () => {
    pushScreen('developer')

    expect(drawn()).toEqual([{ title: 'Developer', marker: null }])
  })
})
