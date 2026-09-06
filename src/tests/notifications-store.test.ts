import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { notifications, removeNotification, resetNotifications, setNotifications, showActionNotification, showDecisionNotification, showNotification, } from '@/stores/notifications-store'

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

describe('notifications store on a phone', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetNotifications()
    // This file runs without a DOM; the store only asks `window.matchMedia`
    // one question, and here the phone query is the one that answers yes.
    vi.stubGlobal('window', {
      matchMedia: (query: string) => ({
        matches: query === '(max-width: 768px)',
      }),
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    resetNotifications()
    vi.unstubAllGlobals()
  })

  it('shows two toasts and lets the rest wait their turn', () => {
    showNotification('One', 'info')
    showNotification('Two', 'info')
    showNotification('Three', 'info')
    showNotification('Four', 'info')
    expect(notifications().map((item) => item.message)).toEqual(['One', 'Two'])

    // A waiting toast's clock starts when it is shown: dismissing One at
    // three seconds gives Three its full six from now, not three left over.
    vi.advanceTimersByTime(3000)
    removeNotification(notifications()[0]!.id)
    expect(notifications().map((item) => item.message)).toEqual([
      'Two',
      'Three',
    ])

    vi.advanceTimersByTime(3000)
    expect(notifications().map((item) => item.message)).toEqual([
      'Three',
      'Four',
    ])

    vi.advanceTimersByTime(3000)
    expect(notifications().map((item) => item.message)).toEqual(['Four'])
  })

  it('replaces a waiting toast on the same channel instead of queueing both', () => {
    showNotification('One', 'info')
    showNotification('Two', 'info')
    showNotification('Saving', 'info', { channel: 'save' })
    showNotification('Saved', 'success', { channel: 'save' })
    expect(notifications()).toHaveLength(2)

    removeNotification(notifications()[0]!.id)
    expect(notifications().map((item) => item.message)).toEqual([
      'Two',
      'Saved',
    ])
  })

  it('folds a grouped arrival into the toast that is still waiting', () => {
    const group = {
      key: 'joined',
      summarise: (parts: string[]) => `${parts.length} joined`,
    }
    showNotification('One', 'info')
    showNotification('Two', 'info')
    showNotification('Cy', 'info', { group })
    showNotification('Ada', 'info', { group })

    removeNotification(notifications()[0]!.id)
    expect(notifications().map((item) => item.message)).toEqual([
      'Two',
      '2 joined',
    ])
  })
})
