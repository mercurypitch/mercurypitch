import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notifications, setNotifications } from '@/stores/notifications-store'
import { Notifications } from '../Notifications'

describe('Notifications', () => {
  beforeEach(() => {
    setNotifications([])
  })

  it('renders clear status hierarchy for ordinary notifications', () => {
    setNotifications([
      { id: 1, message: 'Playlist ZIP is ready.', type: 'success' },
    ])

    render(() => <Notifications />)

    const notification = screen.getByRole('status')
    expect(notification).toHaveTextContent('Done')
    expect(notification).toHaveTextContent('Playlist ZIP is ready.')
    expect(
      screen.getByRole('region', { name: 'Notifications' }),
    ).toContainElement(notification)
  })

  it('announces errors assertively and keeps explicit dismissal available', () => {
    setNotifications([
      { id: 2, message: 'The archive could not be saved.', type: 'error' },
    ])

    render(() => <Notifications />)

    expect(screen.getByRole('alert')).toHaveTextContent('Problem')
    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss notification' }),
    )
    expect(notifications()).toHaveLength(0)
  })

  // The fallback title can only describe severity. It read "Update" on every
  // `info` toast, so a saved display name announced itself exactly like a
  // pending app update — these three pin the way out of that.
  it('prefers a title the caller gave over the one for its type', () => {
    setNotifications([
      {
        id: 4,
        message: 'A new version of MercuryPitch is ready.',
        type: 'info',
        title: 'Update',
      },
    ])

    render(() => <Notifications />)

    const notification = screen.getByRole('status')
    expect(notification).toHaveTextContent('Update')
    expect(notification).not.toHaveTextContent('Note')
  })

  it('shows no title at all when the caller passes null', () => {
    setNotifications([
      {
        id: 5,
        message: 'Recording saved to your takes.',
        type: 'success',
        title: null,
      },
    ])

    render(() => <Notifications />)

    const notification = screen.getByRole('status')
    expect(notification).toHaveTextContent('Recording saved to your takes.')
    expect(notification).not.toHaveTextContent('Done')
    expect(notification.querySelector('strong')).toBeNull()
  })

  it('never calls an ordinary message an Update', () => {
    setNotifications([{ id: 6, message: 'Display name updated', type: 'info' }])

    render(() => <Notifications />)

    const notification = screen.getByRole('status')
    expect(notification).toHaveTextContent('Note')
    // The regression itself: the word must not come from the type fallback.
    expect(notification.querySelector('strong')?.textContent).not.toBe('Update')
  })

  it('runs an action once and dismisses its notification', () => {
    const onClick = vi.fn()
    setNotifications([
      {
        id: 3,
        message: 'A tour is available.',
        type: 'info',
        action: { label: 'Start tour', onClick },
      },
    ])

    render(() => <Notifications />)
    fireEvent.click(screen.getByRole('button', { name: 'Start tour' }))

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(notifications()).toHaveLength(0)
  })
})
