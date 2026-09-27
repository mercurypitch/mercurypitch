// ============================================================
// The Devices screen: where this account is signed in
// ============================================================
//
// Pushed from the Account screen's Devices row (S6 step 4). This phone
// first, named as this phone; every other device with a way to sign it out.
// This phone signs out with the Account screen's own Sign out, which asks
// first, so it has no button here. A list that cannot be read says so and
// offers to try again rather than showing an empty account.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthSession } from '@/db/services/auth-sessions-service'
import { fetchSessions, revokeSession, } from '@/db/services/auth-sessions-service'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { DevicesScreen } from './DevicesScreen'

vi.mock('@/db/services/auth-sessions-service', () => ({
  fetchSessions: vi.fn(),
  revokeSession: vi.fn(),
}))

const fetchMock = vi.mocked(fetchSessions)
const revokeMock = vi.mocked(revokeSession)

function session(id: string, label: string, current: boolean): AuthSession {
  return {
    id,
    provider: 'google',
    label,
    ip: null,
    createdAt: '2026-09-01T10:00:00Z',
    lastSeenAt: '2026-09-20T10:00:00Z',
    current,
  }
}

let view: RenderedShell | null = null

function devices(): HTMLElement[] {
  return [
    ...(view?.container.querySelectorAll<HTMLElement>('[data-device]') ?? []),
  ]
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  revokeMock.mockReset()
})

afterEach(() => {
  view?.unmount()
  view = null
})

describe('the Devices screen', () => {
  it('puts this phone first, named as this phone, with no button of its own', async () => {
    fetchMock.mockResolvedValue([
      session('s-2', 'Chrome on Mac', false),
      session('s-1', 'Safari on iPhone', true),
    ])

    view = renderShell(() => <DevicesScreen />)
    await settle()

    const [first, second] = devices()
    expect(first?.dataset.device).toBe('s-1')
    expect(first?.textContent).toContain('This phone')
    expect(first?.querySelector('button')).toBeNull()
    expect(second?.textContent).toContain('Chrome on Mac')
  })

  it('signs another device out, and drops it from the list', async () => {
    fetchMock.mockResolvedValueOnce([
      session('s-1', 'Safari on iPhone', true),
      session('s-2', 'Chrome on Mac', false),
    ])
    fetchMock.mockResolvedValueOnce([session('s-1', 'Safari on iPhone', true)])
    revokeMock.mockResolvedValue(undefined)
    view = renderShell(() => <DevicesScreen />)
    await settle()

    devices()[1]?.querySelector('button')?.click()
    await settle()

    expect(revokeMock).toHaveBeenCalledWith('s-2')
    expect(devices().map((d) => d.dataset.device)).toEqual(['s-1'])
  })

  it('says the list could not be read, and reads it again on Try again', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    fetchMock.mockResolvedValueOnce([session('s-1', 'Safari on iPhone', true)])
    view = renderShell(() => <DevicesScreen />)
    await settle()
    const said = view.container.textContent

    view.container
      .querySelector<HTMLButtonElement>('[data-testid="devices-retry"]')
      ?.click()
    await settle()

    expect(said).toContain('Could not load your devices.')
    expect(devices()).toHaveLength(1)
  })
})
