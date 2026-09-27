// ============================================================
// The Name screen: the one field an account's card is named by
// ============================================================
//
// Pushed from the Account screen's Name row (S6 step 4). The name is the
// profile's display name, the one leaderboards and shared content show, so
// an empty one cannot be saved, a failed save keeps what was typed, and a
// saved one goes back to Account with the card already renamed.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { pushed, pushScreen, pushSettingsScreen, resetRunShell, } from '../run-shell-store'
import { AccountNameScreen } from './AccountNameScreen'

const stand = vi.hoisted(() => ({
  save: vi.fn(),
  name: 'Alex',
}))

vi.mock('./account-actions', () => ({
  saveAccountName: stand.save,
}))
vi.mock('./account-state', () => ({
  accountCard: () => ({
    id: 'user-1',
    name: stand.name,
    email: 'singer@example.test',
    provider: 'google',
    newsletter: false,
  }),
}))

let view: RenderedShell | null = null

function q(testId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
}

function type(value: string): void {
  const input = q('account-name-input') as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

beforeEach(() => {
  stand.save.mockReset()
  stand.name = 'Alex'
  resetRunShell()
  pushSettingsScreen('account')
  pushScreen('account-name')
  view = renderShell(() => <AccountNameScreen />)
})

afterEach(() => {
  view?.unmount()
  view = null
  resetRunShell()
})

describe('the Name screen', () => {
  it('starts from the name the account has', () => {
    expect((q('account-name-input') as HTMLInputElement).value).toBe('Alex')
  })

  it('saves a new name, trimmed, and goes back to Account', async () => {
    stand.save.mockResolvedValue(undefined)
    type('  Alexandra  ')

    q('account-name-save')?.click()
    await settle()

    expect(stand.save).toHaveBeenCalledWith('Alexandra')
    expect(pushed()).toBe('account')
  })

  it('cannot save an empty name, and says so', () => {
    type('   ')

    expect((q('account-name-save') as HTMLButtonElement).disabled).toBe(true)
    expect(q('account-name-hint')?.textContent).toBe('A name cannot be empty.')
  })

  it('keeps what was typed when the save fails', async () => {
    stand.save.mockRejectedValue(new Error('Could not save your name'))
    type('Alexandra')

    q('account-name-save')?.click()
    await settle()

    expect(q('account-error')?.textContent).toBe('Could not save your name')
    expect((q('account-name-input') as HTMLInputElement).value).toBe(
      'Alexandra',
    )
    expect(pushed()).toBe('account-name')
  })
})
