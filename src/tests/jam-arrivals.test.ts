// ── Arrival notices ───────────────────────────────────────────────────
// The words, and the grouping that keeps a busy room from stacking four
// toasts on top of each other. See docs/plans/jam-arrival-notices.md.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ARRIVAL_PHRASES, fillPhrase, joinNames, makePhrasePicker, } from '@/lib/jam/jam-arrivals'
import { noteJamPeerJoined, noteJamPeerLeft } from '@/stores/jam-store'
import { notifications, removeNotification, setNotifications, showNotification, } from '@/stores/notifications-store'

describe('joinNames', () => {
  it('reads like a sentence at every size', () => {
    expect(joinNames(['Ada'])).toBe('Ada')
    expect(joinNames(['Ada', 'Bo'])).toBe('Ada and Bo')
    expect(joinNames(['Ada', 'Bo', 'Cy'])).toBe('Ada, Bo and Cy')
    expect(joinNames(['Ada', 'Bo', 'Cy', 'Di'])).toBe('Ada, Bo and 2 others')
  })

  it('never renders an empty name', () => {
    // A peer can arrive before its display name does.
    expect(joinNames([])).toBe('Someone')
    expect(joinNames([''])).toBe('Someone')
  })
})

describe('makePhrasePicker', () => {
  it('never picks the same phrase twice running', () => {
    // Randomness that repeats itself immediately is exactly when it looks
    // broken -- two people joining to the same sentence reads as a bug.
    const always = makePhrasePicker(ARRIVAL_PHRASES, () => 0.5)
    const first = always()
    const second = always()
    expect(second).not.toBe(first)
  })

  it('copes with a book of one', () => {
    const only = makePhrasePicker(['{names} arrived'])
    expect(only()).toBe('{names} arrived')
    expect(only()).toBe('{names} arrived')
  })
})

describe('grouped notifications', () => {
  beforeEach(() => {
    for (const n of notifications()) removeNotification(n.id)
    setNotifications([])
  })

  const arrive = (name: string, phrase = '{names} plugged in') =>
    showNotification(name, 'info', {
      group: { key: 'test-arrivals', summarise: (n) => fillPhrase(phrase, n) },
    })

  it('folds a burst into one toast', () => {
    arrive('Ada')
    arrive('Bo')
    arrive('Cy')
    expect(notifications()).toHaveLength(1)
    expect(notifications()[0]?.message).toBe('Ada, Bo and Cy plugged in')
  })

  it('keeps the first wording rather than re-rolling it', () => {
    // The summariser of the SECOND call carries a fresh random phrase.
    // Using it would rewrite the toast under somebody mid-read.
    arrive('Ada', '{names} took the stage')
    arrive('Bo', '{names} slipped in through the window')
    expect(notifications()[0]?.message).toBe('Ada and Bo took the stage')
  })

  it('starts a new toast once the last one has gone', () => {
    vi.useFakeTimers()
    try {
      arrive('Ada')
      vi.advanceTimersByTime(10_000)
      expect(notifications()).toHaveLength(0)
      arrive('Bo')
      expect(notifications()).toHaveLength(1)
      expect(notifications()[0]?.message).toBe('Bo plugged in')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not group notifications that asked not to be', () => {
    showNotification('one')
    showNotification('two')
    expect(notifications()).toHaveLength(2)
  })
})

describe('a reconnect is not an arrival', () => {
  beforeEach(() => {
    for (const n of notifications()) removeNotification(n.id)
    setNotifications([])
  })

  it('says nothing at all when the same person comes straight back', () => {
    // Straight from a testing log: `peer left db47e7d0…` then `peer joined
    // 0e8270c1…` seconds later -- the same person with a new id, because a
    // phone changed network. Announcing both is worse than announcing
    // neither.
    vi.useFakeTimers()
    try {
      noteJamPeerLeft('Ada')
      vi.advanceTimersByTime(2000)
      noteJamPeerJoined('Ada')
      vi.advanceTimersByTime(30_000)
      expect(notifications()).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('announces a departure that turns out to be real', () => {
    vi.useFakeTimers()
    try {
      noteJamPeerLeft('Ada')
      expect(notifications()).toHaveLength(0)
      vi.advanceTimersByTime(6500)
      expect(notifications()).toHaveLength(1)
      expect(notifications()[0]?.message).toContain('Ada')
    } finally {
      vi.useRealTimers()
    }
  })
})
