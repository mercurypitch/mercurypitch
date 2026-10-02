// ============================================================
// Deleting the account: the loss named first, one question, a line after
// ============================================================
//
// S6 step 6 (5a, 5b, 5d; REQ-NAM-055 to 060). The screen says what goes and
// what stays before anything happens, with the Apple line only for an Apple
// account, and names a way to do it without the app. The button asks once
// (decision 03 A). A deletion that fails says so and changes nothing here;
// one that lands restarts the app on Settings, where one line says what
// happened and what did not.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthService from '@/db/services/auth-service'
import { deleteAccount } from '@/db/services/auth-service'
import { actAsIpad } from '@/tests/helpers/ipad-navigator'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { pushed, resetRunShell } from '../run-shell-store'
import { accountDeleted, DELETE_ACCOUNT, DELETE_QUESTION } from './account-copy'
import { accountDeletedNote, dismissAccountDeletedNote, resumeAfterDeletion, takeAccountDeleted, } from './account-deletion'
import { restartApp } from './app-restart'
import { DeleteAccountScreen } from './DeleteAccountScreen'
import { confirmSettingsAlert, resetSettingsAlert } from './settings-alert'
import { SettingsAlert } from './SettingsAlert'

const stand = vi.hoisted(() => ({
  provider: 'google',
  forgetCard: vi.fn(),
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthService>()),
  deleteAccount: vi.fn(),
}))
vi.mock('./app-restart', () => ({ restartApp: vi.fn() }))
vi.mock('./account-state', () => ({
  accountCard: () => ({
    id: 'user-1',
    name: 'Alex',
    email: 'singer@example.test',
    provider: stand.provider,
    newsletter: false,
  }),
  accountProviderLine: () => 'Signed in with Google',
  forgetAccountCard: stand.forgetCard,
}))

const deleteMock = vi.mocked(deleteAccount)
const restartMock = vi.mocked(restartApp)

let view: RenderedShell | null = null

function text(): string {
  return view?.container.textContent ?? ''
}

function press(testId: string): void {
  document
    .querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)
    ?.click()
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

function open(): void {
  view = renderShell(() => (
    <>
      <DeleteAccountScreen />
      <SettingsAlert />
    </>
  ))
}

beforeEach(() => {
  stand.provider = 'google'
  stand.forgetCard.mockReset()
  deleteMock.mockReset()
  restartMock.mockReset()
  resetSettingsAlert()
  resetRunShell()
  sessionStorage.clear()
  dismissAccountDeletedNote()
})

afterEach(() => {
  view?.unmount()
  view = null
  resetSettingsAlert()
  resetRunShell()
  sessionStorage.clear()
})

describe('the Delete account screen', () => {
  it('names what goes and what stays before anything happens (5a)', () => {
    open()

    expect(text()).toContain(DELETE_ACCOUNT.lead)
    for (const loss of DELETE_ACCOUNT.goes) expect(text()).toContain(loss)
    expect(text()).toContain(DELETE_ACCOUNT.stays.label)
    expect(text()).toContain(DELETE_ACCOUNT.stays.sub)
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('adds the Apple line for an Apple account only', () => {
    open()
    const google = text()
    view?.unmount()
    stand.provider = 'apple'

    open()

    expect(google).not.toContain(DELETE_ACCOUNT.apple.label)
    expect(text()).toContain(DELETE_ACCOUNT.apple.label)
    expect(text()).toContain(DELETE_ACCOUNT.apple.sub)
  })

  it('names a way to delete it without the app (REQ-NAM-060)', () => {
    open()

    expect(text()).toContain(DELETE_ACCOUNT.elsewhere)
  })

  it('asks once, with the answer in red (decision 03 A)', () => {
    open()

    press('delete-account-start')

    const alert = document.querySelector('[role="alertdialog"]')
    expect(alert?.textContent).toContain(DELETE_QUESTION.title)
    expect(alert?.textContent).toContain(DELETE_QUESTION.text)
    expect(
      document
        .querySelector('[data-testid="settings-alert-confirm"]')
        ?.classList.contains('mp-alert__danger'),
    ).toBe(true)
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('deletes on the answer, then restarts the app with the line after waiting', async () => {
    deleteMock.mockResolvedValue(undefined)
    open()
    press('delete-account-start')

    confirmSettingsAlert()
    await settle()

    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(stand.forgetCard).toHaveBeenCalledTimes(1)
    expect(restartMock).toHaveBeenCalledTimes(1)
    expect(takeAccountDeleted()).toBe(true)
  })

  it('says a failed deletion out loud, and changes nothing here', async () => {
    deleteMock.mockRejectedValue(new Error('Could not delete account (503)'))
    open()
    press('delete-account-start')

    confirmSettingsAlert()
    await settle()

    expect(
      document.querySelector('[data-testid="delete-account-error"]')
        ?.textContent,
    ).toBe('Could not delete account (503)')
    expect(stand.forgetCard).not.toHaveBeenCalled()
    expect(restartMock).not.toHaveBeenCalled()
  })
})

describe('after the restart', () => {
  it('opens Settings with the line that says what happened (5d)', () => {
    sessionStorage.setItem('mp:account-deleted', '1')

    resumeAfterDeletion()

    expect(pushed()).toBe('settings')
    expect(accountDeletedNote()).toBe(accountDeleted())
    expect(takeAccountDeleted()).toBe(false)
  })

  it('opens nothing on an ordinary start', () => {
    resumeAfterDeletion()

    expect(pushed()).toBeNull()
    expect(accountDeletedNote()).toBeNull()
  })
})

describe('on an iPad', () => {
  it('says what stays on this iPad, before and after', () => {
    const restore = actAsIpad()
    try {
      open()
      sessionStorage.setItem('mp:account-deleted', '1')
      resumeAfterDeletion()

      expect(text()).toContain('What stays on this iPad')
      expect(text()).toContain('They stay, under a new identity for this iPad.')
      expect(text()).not.toMatch(/\bphones?\b/iu)
      expect(accountDeletedNote()).toBe(
        'Your account is deleted. Practice on this iPad stays here.',
      )
    } finally {
      restore()
    }
  })
})
