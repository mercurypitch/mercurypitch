// ============================================================
// HeaderAccount component tests
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/defaults', () => ({ API_BASE_URL: 'http://api.test' }))

const mocks = vi.hoisted(() => ({
  ensureAuth: vi.fn(async () => true),
  fetchMe: vi.fn(),
  logout: vi.fn(),
}))
vi.mock('@/db/services/auth-service', () => mocks)

import { HeaderAccount } from '../account/HeaderAccount'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('HeaderAccount', () => {
  it('shows the username and a sign-out control when signed in', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: { authProvider: 'password', email: 'a@b.com' },
      profile: { displayName: 'Maff' },
    })
    render(() => <HeaderAccount />)

    expect(await screen.findByText('Maff')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('header-logout'))
    expect(mocks.logout).toHaveBeenCalledOnce()
  })

  it('shows a Sign in pill for anonymous users', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: { authProvider: 'anonymous', email: null },
      profile: { displayName: 'Singer-1' },
    })
    render(() => <HeaderAccount />)

    expect(await screen.findByTestId('header-signin')).toBeInTheDocument()
    expect(screen.queryByTestId('header-account')).not.toBeInTheDocument()
  })
})
