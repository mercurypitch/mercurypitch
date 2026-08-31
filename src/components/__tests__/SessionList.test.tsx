import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionList } from '@/components/account/SessionList'

const fetchSessions = vi.fn()
const revokeSession = vi.fn()

vi.mock('@/db/services/auth-sessions-service', () => ({
  fetchSessions: (...args: unknown[]) => fetchSessions(...args),
  revokeSession: (...args: unknown[]) => revokeSession(...args),
  revokeAllSessions: vi.fn(),
}))

vi.mock('@/stores/notifications-store', () => ({
  showNotification: vi.fn(),
}))

const TODAY = new Date().toISOString().replace('T', ' ').slice(0, 19)

function session(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: 'session-1',
    provider: 'password',
    label: 'Chrome on Mac',
    ip: null,
    createdAt: TODAY,
    lastSeenAt: TODAY,
    current: false,
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SessionList', () => {
  beforeEach(() => {
    revokeSession.mockResolvedValue(undefined)
  })

  it('lists every device and marks the one asking', async () => {
    fetchSessions.mockResolvedValue([
      session({ id: 'a', label: 'Chrome on Mac', current: true }),
      session({ id: 'b', label: 'Safari on iPhone' }),
    ])
    render(() => <SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Chrome on Mac')).toBeTruthy()
    })
    expect(screen.getByText('Safari on iPhone')).toBeTruthy()
    expect(screen.getAllByText('This device')).toHaveLength(1)
  })

  it('offers no sign-out button for the current device', async () => {
    // The ordinary Sign out button already ends it. A second control for the
    // same act is one more thing to misclick, on the row where a misclick
    // costs the most.
    fetchSessions.mockResolvedValue([
      session({ id: 'a', label: 'Chrome on Mac', current: true }),
      session({ id: 'b', label: 'Safari on iPhone' }),
    ])
    render(() => <SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Safari on iPhone')).toBeTruthy()
    })
    expect(screen.getAllByRole('button', { name: 'Sign out' })).toHaveLength(1)
  })

  it('ends the named device and reloads the list', async () => {
    fetchSessions
      .mockResolvedValueOnce([
        session({ id: 'a', label: 'Chrome on Mac', current: true }),
        session({ id: 'b', label: 'Safari on iPhone' }),
      ])
      .mockResolvedValueOnce([
        session({ id: 'a', label: 'Chrome on Mac', current: true }),
      ])
    render(() => <SessionList />)

    await waitFor(() => {
      expect(screen.getByText('Safari on iPhone')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(revokeSession).toHaveBeenCalledWith('b')
    })
    await waitFor(() => {
      expect(screen.queryByText('Safari on iPhone')).toBeNull()
    })
  })

  it('says the list could not load rather than showing an empty one', async () => {
    // "You are signed in nowhere" is the one reading that would make someone
    // panic, and it is exactly what a silent failure looks like.
    fetchSessions.mockRejectedValue(new Error('Could not load your devices'))
    render(() => <SessionList />)

    await waitFor(() => {
      expect(screen.getByTestId('session-list-error').textContent).toBe(
        'Could not load your devices',
      )
    })
  })
})
