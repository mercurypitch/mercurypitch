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
  openAuthModal: vi.fn(),
}))
vi.mock('@/db/services/auth-service', () => mocks)
// Mocked so the component doesn't pull the full ui-store import chain
// (which reads more of @/lib/defaults than the stub above provides).
vi.mock('@/stores/ui-store', () => ({ openAuthModal: mocks.openAuthModal }))

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

  it('opens the sign-in modal from the signed-out pill', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: { authProvider: 'anonymous', email: null },
      profile: { displayName: 'Singer-1' },
    })
    render(() => <HeaderAccount />)

    fireEvent.click(await screen.findByTestId('header-signin'))
    expect(mocks.openAuthModal).toHaveBeenCalledWith('login')
  })
})
