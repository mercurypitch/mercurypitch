import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { notifications, setNotifications, showActionNotification, showNotification, } from '@/stores/notifications-store'

describe('notifications store visibility windows', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setNotifications([])
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    setNotifications([])
  })

  it('keeps ordinary success feedback visible for six seconds', () => {
    showNotification('Export ready', 'success')
    vi.advanceTimersByTime(5999)
    expect(notifications()).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(notifications()).toHaveLength(0)
  })

  it('gives warnings and errors longer reading windows', () => {
    showNotification('Check the archive', 'warning')
    showNotification('Export failed', 'error')

    vi.advanceTimersByTime(8999)
    expect(notifications().map((item) => item.type)).toEqual([
      'warning',
      'error',
    ])

    vi.advanceTimersByTime(1)
    expect(notifications().map((item) => item.type)).toEqual(['error'])

    vi.advanceTimersByTime(1000)
    expect(notifications()).toHaveLength(0)
  })

  it('honors custom action-notification durations', () => {
    showActionNotification(
      'Tour available',
      'info',
      { label: 'Start', onClick: vi.fn() },
      { durationMs: 12_000 },
    )

    vi.advanceTimersByTime(11_999)
    expect(notifications()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(notifications()).toHaveLength(0)
  })
})
