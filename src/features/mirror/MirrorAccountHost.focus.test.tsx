// ============================================================
// Voice Mirror: the account dialog's focus trap on its first open
// ============================================================
//
// The host mounts the real AuthModal and opens it in the same breath. The
// dialog's focus trap installs only when its element exists as the dialog
// opens, so an open in the mounting pass left focus on the page behind it:
// Tab walked out of the dialog and Escape did nothing. For most visitors the
// first open is the only one, so this renders the real dialog, not a stub.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as AuthService from '@/db/services/auth-service'

const harness = vi.hoisted(() => ({ ceremony: null as string | null }))

vi.mock('@/db/services/auth-passkey-service', () => ({
  passkeysAvailable: async () => false,
  signInWithPasskey: vi.fn(() => new Promise(() => {})),
}))
vi.mock('@/lib/webauthn', () => ({
  platformAuthenticatorAvailable: async () => false,
  conditionalMediationAvailable: async () => false,
  describeWebAuthnError: () => '',
}))
vi.mock('@/db/services/auth-service', async (importOriginal) => {
  const real = await importOriginal<typeof AuthService>()
  return {
    ...real,
    takeGoogleRedirectResult: () => null,
    googleTwofaPending: () => harness.ceremony !== null,
    takeGoogleTwofaChallenge: () => {
      const taken = harness.ceremony
      harness.ceremony = null
      return taken
    },
  }
})

import { authModalMode, closeAuthModal } from '@/stores/ui-store'
import { askForAccount, resetAccountAskForTests, takeGoogleLanding, } from './account-ask'
import MirrorAccountHost from './MirrorAccountHost'

afterEach(() => {
  closeAuthModal()
  cleanup()
  resetAccountAskForTests()
  harness.ceremony = null
  document.body.innerHTML = ''
})

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

/** Focus something on the page, as the ask button is, then mount the host. */
async function mountWithFocusOnThePage(): Promise<HTMLElement> {
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
  const onThePage = document.createElement('button')
  document.body.append(onThePage)
  onThePage.focus()
  render(() => <MirrorAccountHost />)
  await settle()
  await settle()
  const opened = dialog()
  if (opened === null) throw new Error('the dialog did not open')
  return opened
}

describe('the first open of the account dialog', () => {
  it('moves focus into the sign-up form and closes on Escape', async () => {
    askForAccount()

    const dialog = await mountWithFocusOnThePage()

    expect(authModalMode()).toBe('register')
    expect(dialog.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
    await settle()
    expect(authModalMode()).toBeNull()
  })

  it('opens on the code pane for a Google return owing a second factor, with focus inside', async () => {
    harness.ceremony = 'ceremony-e2e'
    takeGoogleLanding()

    const dialog = await mountWithFocusOnThePage()

    expect(authModalMode()).toBe('login')
    expect(dialog.querySelector('h2')?.textContent).toBe('Enter your code')
    expect(dialog.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
    await settle()
    expect(authModalMode()).toBeNull()
  })
})
