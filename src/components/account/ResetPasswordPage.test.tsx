// ============================================================
// The request-a-reset-link form and the Turnstile gate
// ============================================================
//
// `forgot-password` is one of the three routes the worker's CAPTCHA gate
// guards, and this page is the second place that calls it — the first being
// the settings AuthModal. It was wired for neither when the gate was added,
// so a configured secret would have made "Send reset link" fail permanently
// for anybody following an expired link. This file did not exist before.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(async () => undefined),
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  requestPasswordReset: mocks.requestPasswordReset,
}))

vi.mock('@/stores/ui-store', () => ({ openAuthModal: vi.fn() }))

import { ResetPasswordPage } from './ResetPasswordPage'

beforeEach(() => {
  vi.clearAllMocks()
})

/** The bare request-a-link form, which is what a null token opens. */
function openRequestForm(): void {
  render(() => <ResetPasswordPage token={null} onClose={vi.fn()} />)
}

describe('requesting a reset link with the CAPTCHA unconfigured', () => {
  it('sends exactly as before, with nothing blocking the button', async () => {
    // No VITE_TURNSTILE_SITE_KEY in a test build, so the widget is inert and
    // the form must be indistinguishable from the one that shipped before.
    openRequestForm()
    fireEvent.input(screen.getByTestId('reset-email-input'), {
      target: { value: 'singer@example.com' },
    })

    const submit = screen.getByTestId('reset-request-submit')
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    await waitFor(() =>
      expect(mocks.requestPasswordReset).toHaveBeenCalledWith(
        'singer@example.com',
        '',
      ),
    )
    expect(await screen.findByTestId('reset-request-sent')).toBeInTheDocument()
  })

  it('re-arms after a refused request instead of dying', async () => {
    // Single-use tokens: without the reset in the catch, the second press
    // would replay a token the server has already spent.
    mocks.requestPasswordReset.mockRejectedValueOnce(new Error('Slow down'))
    openRequestForm()
    fireEvent.input(screen.getByTestId('reset-email-input'), {
      target: { value: 'singer@example.com' },
    })

    fireEvent.click(screen.getByTestId('reset-request-submit'))
    expect(await screen.findByTestId('reset-error')).toHaveTextContent(
      'Slow down',
    )

    fireEvent.click(screen.getByTestId('reset-request-submit'))
    await waitFor(() =>
      expect(mocks.requestPasswordReset).toHaveBeenCalledTimes(2),
    )
  })
})
