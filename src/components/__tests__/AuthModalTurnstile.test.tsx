// ============================================================
// AuthModal with the CAPTCHA armed
// ============================================================
//
// The rest of the AuthModal suite runs the way every build without a site key
// does: the widget is inert and the form is unchanged. This file is the other
// half — what a reader meets once the key is configured. The site key is read
// at module load, so the module registry is reset and `@/lib/defaults` mocked
// before the component is imported.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loginWithPassword: vi.fn(),
  registerWithPassword: vi.fn(),
  requestPasswordReset: vi.fn(),
  googleSignInUrl: vi.fn(() => 'http://api.test/api/auth/google/start'),
}))

vi.mock('@/db/services/auth-service', () => mocks)

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  // Spread the original: a bare replacement blanks IS_TEST and every other
  // default, which breaks any module that imports one of them.
  vi.doMock('@/lib/defaults', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    TURNSTILE_SITE_KEY: '0xTESTSITEKEY',
  }))
  // The widget itself is covered in Turnstile.test.tsx. Here it stands in for
  // Cloudflare, so a test can decide when a token arrives.
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
    resetTurnstile: vi.fn(),
  }))
})

afterEach(cleanup)

async function openLogin() {
  const { openAuthModal, closeAuthModal } = await import('@/stores/ui-store')
  const { AuthModal } = await import('../account/AuthModal')
  closeAuthModal()
  render(() => <AuthModal />)
  openAuthModal('login')
  return await screen.findByTestId('auth-email')
}

describe('AuthModal with a site key configured', () => {
  it('holds the submit button until the CAPTCHA issues a token', async () => {
    // Without this the form would post an empty token to a gate that fails
    // closed, and the only feedback would be a 400 the reader cannot act on.
    const email = await openLogin()
    fireEvent.input(email, { target: { value: 'maff@example.com' } })
    fireEvent.input(screen.getByTestId('auth-password'), {
      target: { value: 'secret123' },
    })

    expect(screen.getByTestId('auth-submit')).toBeDisabled()

    fireEvent.click(screen.getByTestId('fake-turnstile'))
    expect(screen.getByTestId('auth-submit')).toBeEnabled()
  })

  it('sends the issued token with the sign-in', async () => {
    mocks.loginWithPassword.mockResolvedValue({})
    const email = await openLogin()
    fireEvent.input(email, { target: { value: 'maff@example.com' } })
    fireEvent.input(screen.getByTestId('auth-password'), {
      target: { value: 'secret123' },
    })
    fireEvent.click(screen.getByTestId('fake-turnstile'))
    fireEvent.click(screen.getByTestId('auth-submit'))

    expect(mocks.loginWithPassword).toHaveBeenCalledWith(
      'maff@example.com',
      'secret123',
      'a-fresh-token',
    )
  })
})
