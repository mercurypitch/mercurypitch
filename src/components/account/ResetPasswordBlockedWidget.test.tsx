// ============================================================
// Requesting a reset link when the CAPTCHA widget never loads
// ============================================================
//
// The companion to ResetPasswordPage.test.tsx, which covers the
// unconfigured build. Somebody following an expired reset link is already
// locked out of their account; a "Send reset link" button that is disabled
// with no explanation is the worst place in the app to strand them.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(async () => undefined),
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  requestPasswordReset: mocks.requestPasswordReset,
}))

vi.mock('@/stores/ui-store', () => ({ openAuthModal: vi.fn() }))

/** Whether the stand-in widget claims it could not load. */
let blocked = false

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  blocked = false
  vi.doMock('@/components/shared/Turnstile', () => ({
    default: (props: { onToken: (token: string) => void }) => (
      <button
        type="button"
        data-testid="fake-turnstile"
        onClick={() => props.onToken('a-fresh-token')}
      >
        solve
      </button>
    ),
    turnstileEnabled: true,
    turnstileUnavailable: () => blocked,
    resetTurnstile: vi.fn(),
  }))
})

afterEach(() => {
  vi.doUnmock('@/components/shared/Turnstile')
})

async function openRequestForm(): Promise<void> {
  const { ResetPasswordPage } = await import('./ResetPasswordPage')
  render(() => <ResetPasswordPage token={null} onClose={vi.fn()} />)
  fireEvent.input(screen.getByTestId('reset-email-input'), {
    target: { value: 'singer@example.com' },
  })
}

describe('requesting a reset link with the CAPTCHA armed', () => {
  it('waits for a token while the widget is working', async () => {
    await openRequestForm()

    expect(screen.getByTestId('reset-request-submit')).toBeDisabled()
    fireEvent.click(screen.getByTestId('fake-turnstile'))
    expect(screen.getByTestId('reset-request-submit')).toBeEnabled()
  })

  it('sends the request when the widget could not load', async () => {
    blocked = true
    await openRequestForm()

    expect(screen.getByTestId('reset-request-submit')).toBeEnabled()
    fireEvent.click(screen.getByTestId('reset-request-submit'))

    await waitFor(() =>
      expect(mocks.requestPasswordReset).toHaveBeenCalledWith(
        'singer@example.com',
        '',
      ),
    )
  })
})
