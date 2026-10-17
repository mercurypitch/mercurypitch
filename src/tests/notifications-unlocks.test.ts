// Unlocks in the notifications store: the pill's queue and merging, a
// room's claim and its release, and the web left exactly as it was.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClaimedUnlock, UnlockItem } from '@/stores/notifications-store'
import { announceUnclaimed, claimUnlocks, notifications, onUnlockShown, removeNotification, resetNotifications, setNotificationPresenter, showActionNotification, showNotification, UNLOCK_MOMENT_MS, unlockShown, } from '@/stores/notifications-store'

const viewport = vi.hoisted(() => ({
  setNarrow: (_narrow: boolean): void => undefined,
}))
vi.mock('@/lib/use-viewport', async () => {
  const { createSignal } = await import('solid-js')
  const [narrow, setNarrow] = createSignal(true)
  viewport.setNarrow = setNarrow
  return { isNarrow: narrow }
})

const STEADY: UnlockItem = { kind: 'badge', name: 'Steady Hold', icon: 'leaf' }
const ECHO: UnlockItem = { kind: 'badge', name: 'Echo Ace', icon: 'star' }
const WEEK: UnlockItem = { kind: 'achievement', name: 'First Week' }

/** What the grant engine does for one unlock. */
function grant(item: UnlockItem): void {
  const word = item.kind === 'badge' ? 'Badge' : 'Achievement'
  showNotification(`${word} unlocked: ${item.name}`, 'success', {
    unlock: item,
  })
}

const messages = (): string[] => notifications().map((n) => n.message)

beforeEach(() => {
  vi.useFakeTimers()
  resetNotifications()
  viewport.setNarrow(true)
})

afterEach(() => {
  resetNotifications()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('unlocks on the web', () => {
  it('raise one toast each, in the words the caller wrote', () => {
    grant(STEADY)
    grant(WEEK)
    expect(messages()).toEqual([
      'Badge unlocked: Steady Hold',
      'Achievement unlocked: First Week',
    ])
    expect(notifications()[0]!.unlocks).toEqual([STEADY])
  })

  it('still show two at a time on a phone', () => {
    grant(STEADY)
    grant(ECHO)
    showNotification('Saved', 'success')
    expect(messages()).toHaveLength(2)
  })
})

describe('the pill', () => {
  beforeEach(() => {
    setNotificationPresenter('pill')
  })

  it('merges unlocks from the same moment into one notice', () => {
    grant(STEADY)
    grant(ECHO)
    grant(WEEK)
    expect(notifications()).toHaveLength(1)
    expect(notifications()[0]!.message).toBe('2 new badges and 1 achievement')
    expect(notifications()[0]!.unlocks).toEqual([STEADY, ECHO, WEEK])
  })

  it('names a single unlock', () => {
    grant(STEADY)
    expect(messages()).toEqual(['New badge: Steady Hold'])
  })

  it('starts a new notice for an unlock from a later moment', () => {
    grant(STEADY)
    vi.advanceTimersByTime(UNLOCK_MOMENT_MS)
    grant(ECHO)
    // The first is still on screen; the second waits its turn.
    expect(messages()).toEqual(['New badge: Steady Hold'])
    removeNotification(notifications()[0]!.id)
    expect(messages()).toEqual(['New badge: Echo Ace'])
  })

  it('shows one notice at a time, whatever the width, and queues the rest', () => {
    viewport.setNarrow(false)
    showNotification('Saved', 'success')
    showNotification('Offline', 'warning')
    showActionNotification('Take a tour', 'info', {
      label: 'Start',
      onClick: () => undefined,
    })
    expect(messages()).toEqual(['Saved'])

    vi.advanceTimersByTime(6000)
    expect(messages()).toEqual(['Offline'])
    vi.advanceTimersByTime(9000)
    expect(messages()).toEqual(['Take a tour'])
  })

  it('merges into a set still waiting behind another notice', () => {
    showNotification('Saved', 'success')
    grant(STEADY)
    grant(ECHO)
    expect(messages()).toEqual(['Saved'])
    vi.advanceTimersByTime(6000)
    expect(messages()).toEqual(['2 new badges'])
  })

  it('keeps its first clock through a merge, not a fresh lifetime', () => {
    grant(STEADY)
    vi.advanceTimersByTime(2900)
    grant(ECHO)
    vi.advanceTimersByTime(3099)
    expect(messages()).toEqual(['2 new badges'])
    vi.advanceTimersByTime(1)
    expect(messages()).toEqual([])
  })

  it('hands the extra notices back to the queue when the pill takes over', () => {
    setNotificationPresenter('toast')
    viewport.setNarrow(false)
    showNotification('One', 'info')
    showNotification('Two', 'info')
    showNotification('Three', 'info')
    expect(messages()).toEqual(['One', 'Two', 'Three'])

    setNotificationPresenter('pill')
    expect(messages()).toEqual(['One'])
    removeNotification(notifications()[0]!.id)
    expect(messages()).toEqual(['Two'])
  })
})

describe('a room claim', () => {
  it('takes every unlock and raises no notice', () => {
    setNotificationPresenter('pill')
    const got: ClaimedUnlock[] = []
    const release = claimUnlocks((claimed) => got.push(claimed))
    grant(STEADY)
    grant(WEEK)
    expect(notifications()).toHaveLength(0)
    expect(got.map((c) => c.unlock)).toEqual([STEADY, WEEK])
    expect(got[0]!.message).toBe('Badge unlocked: Steady Hold')
    release()
  })

  it('leaves every other notice alone', () => {
    const release = claimUnlocks(() => undefined)
    showNotification('Saved', 'success')
    expect(messages()).toEqual(['Saved'])
    release()
  })

  it('released, lets an unlock still in flight fall back to the pill', () => {
    setNotificationPresenter('pill')
    const got: ClaimedUnlock[] = []
    const release = claimUnlocks((claimed) => got.push(claimed))
    release()
    grant(STEADY)
    expect(got).toHaveLength(0)
    expect(messages()).toEqual(['New badge: Steady Hold'])
  })

  it('hands back to the claim before it, latest first', () => {
    const outer: UnlockItem[] = []
    const inner: UnlockItem[] = []
    const releaseOuter = claimUnlocks((c) => outer.push(c.unlock))
    const releaseInner = claimUnlocks((c) => inner.push(c.unlock))
    grant(STEADY)
    releaseInner()
    grant(ECHO)
    expect(inner).toEqual([STEADY])
    expect(outer).toEqual([ECHO])
    releaseOuter()
  })

  it('a held unlock announced unclaimed becomes a pill', () => {
    setNotificationPresenter('pill')
    let held: ClaimedUnlock | undefined
    const release = claimUnlocks((claimed) => {
      held = claimed
    })
    grant(STEADY)
    release()
    announceUnclaimed(held!)
    expect(messages()).toEqual(['New badge: Steady Hold'])
  })
})

describe('unlockShown', () => {
  it('tells every listener, until it unsubscribes', () => {
    const heard = vi.fn()
    const stop = onUnlockShown(heard)
    unlockShown()
    stop()
    unlockShown()
    expect(heard).toHaveBeenCalledTimes(1)
  })
})
