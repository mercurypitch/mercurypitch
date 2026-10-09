// ============================================================
// The confirm link's toast says when the launch gift arrived
// ============================================================
//
// Confirming an email claims the featured promo code on the server
// (workers/db-worker/src/launch-offer.ts). The toast the confirm link lands
// on is where the singer hears about it: "Email confirmed. 5 credits added."
// Without a claim to report it is the toast it always was.

import { render, waitFor } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  showNotification: vi.fn(),
  confirmedGiftMessage: vi.fn<() => Promise<string | null>>(),
}))

vi.mock('@/db/services/auth-service', async () => {
  const { createSignal } = await import('solid-js')
  const [authStamp] = createSignal(0)
  return {
    authStamp,
    hasValidToken: () => false,
    fetchMe: vi.fn(async () => null),
    resendVerificationEmail: vi.fn(async () => undefined),
    takeEmailVerifyResult: () => ({ ok: true }),
  }
})
vi.mock('@/stores/notifications-store', () => ({
  showNotification: mocks.showNotification,
}))
vi.mock('@/stores/launch-gift-store', () => ({
  confirmedGiftMessage: mocks.confirmedGiftMessage,
}))

import { VerifyEmailBanner } from '@/components/account/VerifyEmailBanner'

describe('the confirm link toast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('says the credits arrived when confirming claimed them', async () => {
    mocks.confirmedGiftMessage.mockResolvedValue(
      'Email confirmed. 5 credits added.',
    )
    render(() => <VerifyEmailBanner />)

    await waitFor(() =>
      expect(mocks.showNotification).toHaveBeenCalledWith(
        'Email confirmed. 5 credits added.',
        'success',
      ),
    )
    expect(mocks.showNotification).toHaveBeenCalledTimes(1)
  })

  it('says what it always said when there is no gift to report', async () => {
    mocks.confirmedGiftMessage.mockResolvedValue(null)
    render(() => <VerifyEmailBanner />)

    await waitFor(() =>
      expect(mocks.showNotification).toHaveBeenCalledWith(
        'Email confirmed — your account is all set',
        'info',
      ),
    )
    expect(mocks.showNotification).toHaveBeenCalledTimes(1)
  })
})
