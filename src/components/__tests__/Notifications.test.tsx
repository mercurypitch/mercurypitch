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
    expect(notification).toHaveTextContent('Complete')
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

    expect(screen.getByRole('alert')).toHaveTextContent('Action needed')
    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss notification' }),
    )
    expect(notifications()).toHaveLength(0)
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
