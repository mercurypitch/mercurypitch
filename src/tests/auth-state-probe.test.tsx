// ============================================================
// Auth surfaces must not claim "signed out" before they know
// ============================================================
//
// Owner report (2026-08-17, slow connection): opening Settings → Account
// always showed "signed out" first and flipped to "signed in" once the
// session fetch landed. `me` is null both while restoring and when truly
// signed out; until the first resolution the honest render is a probe
// spinner, and only then the final state. Same for the header pill, which
// said "Sign in" to signed-in users for the same seconds.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { AccountSection } from '@/components/account/AccountSection'
import { HeaderAccount } from '@/components/account/HeaderAccount'
import type { MeResponse } from '@/db/services/auth-service'

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  API_BASE_URL: 'http://api.test',
}))

vi.mock('@/db/services/auth-service', () => {
  let resolveMe: (me: MeResponse | null) => void = () => {}
  return {
    restoreAuth: () => Promise.resolve(true),
    fetchMe: () =>
      new Promise<MeResponse | null>((resolve) => {
        resolveMe = resolve
      }),
    logout: vi.fn(),
    __resolveMe: (me: MeResponse | null) => resolveMe(me),
  }
})

vi.mock('@/db/services/billing-service', () => ({
  fetchBillingMe: () => Promise.resolve(null),
  supporterEntitlement: () => null,
  supporterPlanId: () => null,
}))

vi.mock('@/lib/use-supporter-features', () => ({
  useSupporterFeatures: () => ({ hasFeature: () => false }),
}))

// Heavy signed-in-only subtree, not under test.
vi.mock('@/components/account/VoiceSection', () => ({
  VoiceSection: () => <div data-testid="stub-voice" />,
}))

async function resolveMe(me: MeResponse | null): Promise<void> {
  const svc = (await import('@/db/services/auth-service')) as unknown as {
    __resolveMe: (me: MeResponse | null) => void
  }
  svc.__resolveMe(me)
}

const GOOGLE_ME = {
  user: { authProvider: 'google', isTestAccount: false },
  profile: { displayName: 'Bruce' },
} as unknown as MeResponse

describe('AccountSection before auth resolves', () => {
  it('shows the probe, never "signed out", then the signed-in card', async () => {
    render(() => <AccountSection />)

    // The fetch is pending: probe only.
    expect(screen.getByRole('status').textContent).toContain(
      'Checking your sign-in status',
    )
    expect(screen.queryByText(/You are signed out/)).toBeNull()
    expect(screen.queryByText(/Signed in with/)).toBeNull()

    await resolveMe(GOOGLE_ME)
    await waitFor(() => {
      expect(screen.getByText('Signed in with Google')).toBeTruthy()
    })
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText(/You are signed out/)).toBeNull()
  })

  it('resolving to no session lands on the signed-out card', async () => {
    render(() => <AccountSection />)
    expect(screen.queryByText(/You are signed out/)).toBeNull()

    await resolveMe(null)
    await waitFor(() => {
      expect(screen.getByText(/You are signed out/)).toBeTruthy()
    })
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('HeaderAccount before auth resolves', () => {
  it('holds a neutral probe pill instead of "Sign in"', async () => {
    render(() => <HeaderAccount />)

    expect(screen.getByTestId('header-auth-probe')).toBeTruthy()
    expect(screen.queryByText('Sign in')).toBeNull()

    await resolveMe(null)
    await waitFor(() => {
      expect(screen.getByTestId('header-signin')).toBeTruthy()
    })
    expect(screen.queryByTestId('header-auth-probe')).toBeNull()
  })

  it('resolves straight to the account pill for a signed-in user', async () => {
    render(() => <HeaderAccount />)
    expect(screen.queryByTestId('header-account')).toBeNull()

    await resolveMe(GOOGLE_ME)
    await waitFor(() => {
      expect(screen.getByTestId('header-account')).toBeTruthy()
    })
    expect(screen.getByText('Bruce')).toBeTruthy()
    expect(screen.queryByTestId('header-auth-probe')).toBeNull()

    // The sign-out flow still asks first.
    fireEvent.click(screen.getByTestId('header-logout'))
    expect(screen.getByText('Sign out?')).toBeTruthy()
  })
})
