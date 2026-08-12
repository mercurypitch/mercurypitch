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
    expect(notification).toHaveTextContent('Playlist ZIP is ready.')
    // No severity-derived heading: the icon and the border carry the type.
    expect(notification.querySelector('strong')).toBeNull()
    expect(
      screen.getByRole('region', { name: 'Notifications' }),
    ).toContainElement(notification)
  })

  it('announces errors assertively and keeps explicit dismissal available', () => {
    setNotifications([
      { id: 2, message: 'The archive could not be saved.', type: 'error' },
    ])

    render(() => <Notifications />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The archive could not be saved.',
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss notification' }),
    )
    expect(notifications()).toHaveLength(0)
  })

  // A title is opt-in and renders as a coloured prefix on the message, not as
  // a heading above it. It used to be derived from the type, which put the word
  // "Update" on every ordinary `info` toast.
  it('renders a caller title as a prefix on the message', () => {
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
    expect(notification.querySelector('strong')?.textContent).toBe('Update')
    expect(notification).toHaveTextContent(
      'A new version of MercuryPitch is ready.',
    )
  })

  it('shows no title at all when the caller gives none', () => {
    setNotifications([{ id: 5, message: 'Display name updated', type: 'info' }])

    render(() => <Notifications />)

    const notification = screen.getByRole('status')
    expect(notification).toHaveTextContent('Display name updated')
    expect(notification.querySelector('strong')).toBeNull()
    // The regression that started this: no toast invents the word "Update".
    expect(notification).not.toHaveTextContent('Update')
  })

  it('treats an explicit null title the same as none', () => {
    setNotifications([
      { id: 6, message: 'Recording saved.', type: 'success', title: null },
    ])

    render(() => <Notifications />)

    expect(screen.getByRole('status').querySelector('strong')).toBeNull()
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
