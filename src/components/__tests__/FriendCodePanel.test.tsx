// ============================================================
// FriendCodePanel Tests — sharing a code, redeeming one, invite links
// ============================================================

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as FollowService from '@/db/services/follow-service'
import type * as Defaults from '@/lib/defaults'

const mocks = vi.hoisted(() => ({
  getMyFriendCode: vi.fn(async (): Promise<string | null> => 'K7QM2X4B'),
  redeemFriendCode: vi.fn(async () => ({ ok: true, displayName: 'Alice' })),
  showNotification: vi.fn(),
}))

vi.mock('@/db/services/follow-service', async () => {
  // Keep the real formatters — their behaviour is part of what's asserted here.
  const actual = await vi.importActual<typeof FollowService>(
    '@/db/services/follow-service',
  )
  return {
    formatFriendCode: actual.formatFriendCode,
    friendInviteUrl: actual.friendInviteUrl,
    getMyFriendCode: mocks.getMyFriendCode,
    redeemFriendCode: mocks.redeemFriendCode,
  }
})

vi.mock('@/stores/notifications-store', () => ({
  showNotification: mocks.showNotification,
}))

// Spread the real module rather than replacing it — same trap AccountSection
// documents: the panel's sign-in CTA reaches ui-store, which reads IS_TEST at
// import time, and a bare object fails the whole suite at collection.
vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<typeof Defaults>()),
  API_BASE_URL: 'http://api.test',
}))

import { FriendCodePanel } from '@/components/friends/FriendCodePanel'

describe('FriendCodePanel', () => {
  beforeEach(() => {
    // Call counts leak between tests otherwise, and the "opening a link must
    // not redeem" assertion is precisely a call-count assertion.
    vi.clearAllMocks()
    mocks.getMyFriendCode.mockResolvedValue('K7QM2X4B')
    mocks.redeemFriendCode.mockResolvedValue({ ok: true, displayName: 'Alice' })
    window.location.hash = ''
  })

  it('shows the account’s code grouped for reading aloud', async () => {
    render(() => <FriendCodePanel />)
    await waitFor(() =>
      expect(screen.getByTestId('my-friend-code').textContent).toBe(
        'K7QM-2X4B',
      ),
    )
  })

  it('asks anonymous visitors to create an account instead of showing a code', async () => {
    mocks.getMyFriendCode.mockResolvedValueOnce(null)
    render(() => <FriendCodePanel />)
    await waitFor(() =>
      expect(screen.getByTestId('friend-code-signin')).toBeTruthy(),
    )
    expect(screen.queryByTestId('my-friend-code')).toBeNull()
  })

  it('redeems a typed code and reports who was added', async () => {
    const onFriendAdded = vi.fn()
    render(() => <FriendCodePanel onFriendAdded={onFriendAdded} />)
    await waitFor(() => screen.getByTestId('friend-code-input'))

    fireEvent.input(screen.getByTestId('friend-code-input'), {
      target: { value: 'ABCD-1234' },
    })
    fireEvent.click(screen.getByTestId('add-friend'))

    await waitFor(() =>
      expect(mocks.redeemFriendCode).toHaveBeenCalledWith('ABCD-1234'),
    )
    expect(onFriendAdded).toHaveBeenCalled()
    expect(mocks.showNotification).toHaveBeenCalledWith(
      'Alice added',
      'success',
    )
  })

  it('surfaces the server’s reason instead of failing silently', async () => {
    mocks.redeemFriendCode.mockResolvedValueOnce({
      ok: false,
      error: 'No one found for that code',
    } as never)
    render(() => <FriendCodePanel />)
    await waitFor(() => screen.getByTestId('friend-code-input'))

    fireEvent.input(screen.getByTestId('friend-code-input'), {
      target: { value: 'ZZZZZZZZ' },
    })
    fireEvent.click(screen.getByTestId('add-friend'))

    await waitFor(() =>
      expect(screen.getByTestId('friend-code-error').textContent).toBe(
        'No one found for that code',
      ),
    )
  })

  it('keeps Add disabled until something is typed', async () => {
    render(() => <FriendCodePanel />)
    await waitFor(() => screen.getByTestId('add-friend'))
    expect(screen.getByTestId('add-friend')).toBeDisabled()

    fireEvent.input(screen.getByTestId('friend-code-input'), {
      target: { value: '  ' },
    })
    expect(screen.getByTestId('add-friend')).toBeDisabled()
  })

  it('prefills a code from an invite link without redeeming it', async () => {
    window.location.hash = '#/leaderboard?add=WXYZ7788'
    render(() => <FriendCodePanel />)

    await waitFor(() =>
      expect(
        (screen.getByTestId('friend-code-input') as HTMLInputElement).value,
      ).toBe('WXYZ-7788'),
    )
    // Opening a link must not follow anyone — that's the user's call.
    expect(mocks.redeemFriendCode).not.toHaveBeenCalled()
    window.location.hash = ''
  })
})
