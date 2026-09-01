import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { notifications, setNotifications, showActionNotification, showDecisionNotification, showNotification, } from '@/stores/notifications-store'

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

  it('keeps both explicit choices on a decision notification', () => {
    const keep = vi.fn()
    const neverAsk = vi.fn()
    showDecisionNotification(
      'Your guitar replay is ready.',
      'info',
      { label: 'Keep take', onClick: keep },
      { label: 'Don’t ask again', onClick: neverAsk },
    )

    expect(notifications()[0]?.action).toEqual({
      label: 'Keep take',
      onClick: keep,
    })
    expect(notifications()[0]?.secondaryAction).toEqual({
      label: 'Don’t ask again',
      onClick: neverAsk,
    })
  })
})
