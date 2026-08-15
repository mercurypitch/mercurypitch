// ============================================================
// FriendRequests Tests — answering an ask, and saying what yes means
// ============================================================
//
// The panel is the only place an incoming request exists on screen: the row
// belongs to the sender, so it is on no board and in no list of the
// recipient's until they answer it. What is asserted here is therefore about
// reachability and consequence, not decoration —
//
//   - a pending request is visible and answerable at all
//   - the singer is told what accepting shares before they press it
//   - a second click while the first is in flight does not double-answer

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { FriendRequests } from '@/components/friends/FriendRequests'
import type { FriendRequest } from '@/db/services/follow-service'

function request(userId: string, displayName: string): FriendRequest {
  return {
    userId,
    displayName,
    avatarUrl: null,
    createdAt: '2026-08-09T12:00:00.000Z',
  }
}

const noop = async (): Promise<void> => {}

describe('FriendRequests', () => {
  it('renders nothing at all when nobody has asked', () => {
    render(() => (
      <FriendRequests requests={[]} onAccept={noop} onDecline={noop} />
    ))

    expect(screen.queryByTestId('friend-requests')).toBeNull()
  })

  it('says what accepting shares, next to the button that does it', () => {
    render(() => (
      <FriendRequests
        requests={[request('u1', 'Ada')]}
        onAccept={noop}
        onDecline={noop}
      />
    ))

    // Accepting is a privacy decision — it opens streaks and scores both
    // ways. A bare "Accept" would not tell the singer that.
    const panel = screen.getByTestId('friend-requests')
    expect(panel.textContent).toContain(
      'Accepting shares your streak and scores with them, and theirs with you.',
    )
    expect(panel.textContent).toContain('One singer wants to be friends')
    expect(panel.textContent).toContain('Ada')
  })

  it('counts more than one asker in the heading', () => {
    render(() => (
      <FriendRequests
        requests={[request('u1', 'Ada'), request('u2', 'Grace')]}
        onAccept={noop}
        onDecline={noop}
      />
    ))

    const panel = screen.getByTestId('friend-requests')
    expect(panel.textContent).toContain('2 singers want to be friends')
    expect(
      screen
        .getAllByRole('button', { name: /^Accept / })
        .map((b) => b.ariaLabel),
    ).toEqual(['Accept Ada', 'Accept Grace'])
  })

  it('answers for the singer whose button was pressed', async () => {
    const onAccept = vi.fn(async () => {})
    const onDecline = vi.fn(async () => {})
    render(() => (
      <FriendRequests
        requests={[request('u1', 'Ada'), request('u2', 'Grace')]}
        onAccept={onAccept}
        onDecline={onDecline}
      />
    ))

    fireEvent.click(screen.getByLabelText('Accept Grace'))
    await waitFor(() => expect(onAccept).toHaveBeenCalledWith('u2'))
    expect(onDecline).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('Decline Ada'))
    await waitFor(() => expect(onDecline).toHaveBeenCalledWith('u1'))
  })

  it('does not answer twice while the first answer is in flight', async () => {
    let release = (): void => {}
    const onAccept = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    render(() => (
      <FriendRequests
        requests={[request('u1', 'Ada')]}
        onAccept={onAccept}
        onDecline={noop}
      />
    ))

    const accept = screen.getByLabelText('Accept Ada') as HTMLButtonElement
    fireEvent.click(accept)
    await waitFor(() => expect(accept.disabled).toBe(true))
    // Declining after accepting would send a remove that undoes the accept.
    expect(
      (screen.getByLabelText('Decline Ada') as HTMLButtonElement).disabled,
    ).toBe(true)

    fireEvent.click(accept)
    release()
    await waitFor(() => expect(accept.disabled).toBe(false))
    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  it('frees the row again when the answer throws', async () => {
    // A failed accept must leave the request answerable — otherwise one
    // network blip strands it on screen with two dead buttons — and it must
    // not escape as an unhandled rejection on the way.
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onAccept = vi.fn(async () => {
      throw new Error('offline')
    })
    render(() => (
      <FriendRequests
        requests={[request('u1', 'Ada')]}
        onAccept={onAccept}
        onDecline={noop}
      />
    ))

    const accept = screen.getByLabelText('Accept Ada') as HTMLButtonElement
    fireEvent.click(accept)
    await waitFor(() => expect(onAccept).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(accept.disabled).toBe(false))
    expect(logged).toHaveBeenCalledWith(
      '[friends] answering a request failed',
      expect.any(Error),
    )
    logged.mockRestore()
  })

  it('leaves the other asker answerable while one is in flight', async () => {
    let release = (): void => {}
    const onAccept = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    render(() => (
      <FriendRequests
        requests={[request('u1', 'Ada'), request('u2', 'Grace')]}
        onAccept={onAccept}
        onDecline={noop}
      />
    ))

    fireEvent.click(screen.getByLabelText('Accept Ada'))
    await waitFor(() =>
      expect(
        (screen.getByLabelText('Accept Ada') as HTMLButtonElement).disabled,
      ).toBe(true),
    )
    // Two requests are independent; a shared busy flag would queue the second
    // behind the first for no reason.
    expect(
      (screen.getByLabelText('Accept Grace') as HTMLButtonElement).disabled,
    ).toBe(false)

    fireEvent.click(screen.getByLabelText('Accept Grace'))
    await waitFor(() => expect(onAccept).toHaveBeenCalledTimes(2))
    release()
  })
})
