import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { notifications, removeNotification, resetNotifications, setNotifications, showActionNotification, showDecisionNotification, showNotification, } from '@/stores/notifications-store'

// The store asks the app's viewport module one question. A real signal
// stands in for it so a phone can widen mid-test.
const viewport = vi.hoisted(() => ({
  setNarrow: (_narrow: boolean): void => undefined,
}))
vi.mock('@/lib/use-viewport', async () => {
  const { createSignal } = await import('solid-js')
  const [narrow, setNarrow] = createSignal(false)
  viewport.setNarrow = setNarrow
  return { isNarrow: narrow }
})

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
    viewport.setNarrow(true)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    resetNotifications()
    viewport.setNarrow(false)
  })

  it('admits everything waiting when the window widens past a phone', () => {
    showNotification('One', 'info')
    showNotification('Two', 'info')
    showNotification('Three', 'info')
    expect(notifications().map((item) => item.message)).toEqual(['One', 'Two'])

    viewport.setNarrow(false)
    expect(notifications().map((item) => item.message)).toEqual([
      'One',
      'Two',
      'Three',
    ])
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

// ============================================================
// The cap has to survive a rotation
// ============================================================
//
// Reported from a device retest: "tried on mobile and then turned the phone
// other direction and more than two can be visible". A phone crossing the
// breakpoint fires the viewport change twice, and only one direction was
// handled -- widening admitted everything that was waiting, narrowing did
// nothing at all, so whatever landscape had put on screen was still there
// in portrait. The cap was enforced when a toast ARRIVED, never when the
// viewport changed under the toasts already up.

describe('notifications store across a rotation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetNotifications()
    viewport.setNarrow(true)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    resetNotifications()
    viewport.setNarrow(false)
  })

  it('takes the extra slots back when the viewport narrows again', () => {
    showNotification('One', 'info')
    showNotification('Two', 'info')
    showNotification('Three', 'info')
    showNotification('Four', 'info')

    viewport.setNarrow(false)
    expect(notifications().map((item) => item.message)).toEqual([
      'One',
      'Two',
      'Three',
      'Four',
    ])

    viewport.setNarrow(true)
    expect(notifications().map((item) => item.message)).toEqual(['One', 'Two'])
  })

  it('re-queues the overflow instead of dropping it, still in order', () => {
    showNotification('One', 'info')
    showNotification('Two', 'info')
    showNotification('Three', 'info')
    showNotification('Four', 'info')

    viewport.setNarrow(false)
    viewport.setNarrow(true)

    removeNotification(notifications()[0]!.id)
    expect(notifications().map((item) => item.message)).toEqual([
      'Two',
      'Three',
    ])
    removeNotification(notifications()[0]!.id)
    expect(notifications().map((item) => item.message)).toEqual([
      'Three',
      'Four',
    ])
  })

  // Time already spent on screen is time spent. A toast sent back to the
  // queue returns with what was left of its window, not a whole new one --
  // otherwise rotating the phone would be a way to keep a toast up.
  it('gives a re-queued toast the time it had left, not a fresh window', () => {
    showNotification('One', 'info')
    showNotification('Two', 'info')
    showNotification('Three', 'info')

    viewport.setNarrow(false)
    vi.advanceTimersByTime(4000)
    viewport.setNarrow(true)
    expect(notifications().map((item) => item.message)).toEqual(['One', 'Two'])

    // One and Two run out at six seconds, which frees a slot for Three.
    vi.advanceTimersByTime(2000)
    expect(notifications().map((item) => item.message)).toEqual(['Three'])

    // Two of its six seconds were left, so the floor gives it 2.5 -- not
    // another six.
    vi.advanceTimersByTime(2499)
    expect(notifications()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(notifications()).toHaveLength(0)
  })

  // The other direction still works: widening has room for everything.
  it('leaves a widened window alone', () => {
    showNotification('One', 'info')
    showNotification('Two', 'info')
    showNotification('Three', 'info')

    viewport.setNarrow(false)
    expect(notifications()).toHaveLength(3)

    viewport.setNarrow(false)
    expect(notifications()).toHaveLength(3)
  })
})
