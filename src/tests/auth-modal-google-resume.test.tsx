// ============================================================
// The Google button remembers the onboarding flow it leaves
// ============================================================
//
// Companion to onboarding-auth-resume.test.ts: that file pins the store's
// resume mechanics; this one pins that the actual button arms them. The
// arm is a no-op on every other surface (Settings, Karaoke) — those come
// back through the auth return-hash instead.

import { fireEvent, render } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/google-sign-in', () => ({
  startGoogleSignIn: vi.fn(async () => null),
}))
vi.mock('@/db/services/auth-service', () => ({
  loginWithPassword: vi.fn(),
  registerWithPassword: vi.fn(),
  requestPasswordReset: vi.fn(),
}))
vi.mock('@/db/services/voiceprint-service', () => ({
  adoptDeviceVoiceprints: vi.fn(async () => 0),
}))

import { AuthModal } from '@/components/account/AuthModal'
import { startGoogleSignIn } from '@/lib/google-sign-in'
import { closeOnboarding, openBeat, resetOnboarding, } from '@/stores/onboarding-store'
import { closeAuthModal, openAuthModal } from '@/stores/ui-store'

const RESUME_KEY = 'pitchperfect_onboarding_resume'

beforeEach(() => {
  localStorage.clear()
  resetOnboarding()
  closeAuthModal()
  vi.clearAllMocks()
})

describe('AuthModal Google sign-in', () => {
  it('arms the onboarding resume when the flow is open', async () => {
    openBeat('map')
    openAuthModal('register')
    const { getByTestId } = render(() => <AuthModal />)

    fireEvent.click(getByTestId('auth-google'))
    await Promise.resolve()

    expect(localStorage.getItem(RESUME_KEY)).toBe('map')
    expect(startGoogleSignIn).toHaveBeenCalledTimes(1)
  })

  it('arms nothing on a surface outside the flow', async () => {
    closeOnboarding()
    openAuthModal('login')
    const { getByTestId } = render(() => <AuthModal />)

    fireEvent.click(getByTestId('auth-google'))
    await Promise.resolve()

    expect(localStorage.getItem(RESUME_KEY) ?? '').toBe('')
    expect(startGoogleSignIn).toHaveBeenCalledTimes(1)
  })
})
