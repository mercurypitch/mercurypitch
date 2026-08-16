// ============================================================
// HeaderAccount component tests
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/defaults', () => ({ API_BASE_URL: 'http://api.test' }))

const mocks = vi.hoisted(() => ({
  restoreAuth: vi.fn(async () => true),
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
    expect(screen.getByTestId('header-logout')).toBeInTheDocument()
  })

  // Sign-out sits a thumb's width from the button people press to check who
  // they are signed in as, and it drops them out of a session mid-practice.
  it('asks before it signs anyone out', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: { authProvider: 'password', email: 'a@b.com' },
      profile: { displayName: 'Maff' },
    })
    render(() => <HeaderAccount />)

    fireEvent.click(await screen.findByTestId('header-logout'))
    expect(mocks.logout).not.toHaveBeenCalled()
    expect(screen.getByText('Sign out?')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('confirm-delete'))
    expect(mocks.logout).toHaveBeenCalledOnce()
    expect(screen.queryByText('Sign out?')).not.toBeInTheDocument()
  })

  it('keeps them signed in when they back out of the confirmation', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: { authProvider: 'password', email: 'a@b.com' },
      profile: { displayName: 'Maff' },
    })
    render(() => <HeaderAccount />)

    fireEvent.click(await screen.findByTestId('header-logout'))
    fireEvent.click(screen.getByTestId('confirm-cancel'))

    expect(mocks.logout).not.toHaveBeenCalled()
    expect(screen.queryByText('Sign out?')).not.toBeInTheDocument()
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
