import { afterEach, describe, expect, it } from 'vitest'
import { claimMicLock, micLockStatus, micLockTabId, readMicLock, releaseMicLock, resetMicLockForTests, } from './mic-lock'

const STORAGE_KEY = 'mercurypitch_mic_holder'

/** Plant a record as if a different tab wrote it. */
function otherTabHolds(agedMs = 0): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tabId: 'some-other-tab',
      label: 'Singing',
      at: Date.now() - agedMs,
    }),
  )
}

describe('mic-lock', () => {
  afterEach(() => {
    resetMicLockForTests()
  })

  it('grants a free lock and reports it as ours', () => {
    expect(micLockStatus()).toBe('free')
    expect(claimMicLock().outcome).toBe('granted')
    expect(micLockStatus()).toBe('mine')
    expect(readMicLock()?.tabId).toBe(micLockTabId)
  })

  it('refuses a lock another tab is holding, and names the holder', () => {
    otherTabHolds()
    const result = claimMicLock()
    expect(result.outcome).toBe('held-elsewhere')
    if (result.outcome === 'held-elsewhere') {
      expect(result.holder.label).toBe('Singing')
    }
    expect(micLockStatus()).toBe('other')
  })

  // The crashed-tab case: a killed process never runs its release, so the only
  // thing that frees the mic is the record ageing out.
  it('treats a holder that stopped heartbeating as gone', () => {
    otherTabHolds(30_000)
    expect(micLockStatus()).toBe('free')
    expect(readMicLock()).toBeNull()
    expect(claimMicLock().outcome).toBe('granted')
  })

  it('re-claiming our own lock is idempotent', () => {
    expect(claimMicLock().outcome).toBe('granted')
    expect(claimMicLock().outcome).toBe('granted')
    expect(readMicLock()?.tabId).toBe(micLockTabId)
  })

  // What the blocked tab shows the singer is the holder's document title —
  // the label they can actually find in their tab strip.
  it('records the tab title as the holder label', () => {
    document.title = 'MercuryPitch — Bohemian Rhapsody'
    claimMicLock()
    expect(readMicLock()?.label).toBe('MercuryPitch — Bohemian Rhapsody')
  })

  it('releasing frees the lock', () => {
    claimMicLock()
    releaseMicLock()
    expect(micLockStatus()).toBe('free')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  // A tab that never held the mic must not be able to evict the tab that does,
  // or a stray cleanup path would hand the device to two tabs at once.
  it('releasing does not clear another tab record', () => {
    otherTabHolds()
    releaseMicLock()
    expect(micLockStatus()).toBe('other')
    expect(readMicLock()?.tabId).toBe('some-other-tab')
  })

  it('reads a corrupt record as free rather than throwing', () => {
    localStorage.setItem(STORAGE_KEY, 'not json')
    expect(micLockStatus()).toBe('free')
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nope: true }))
    expect(micLockStatus()).toBe('free')
  })
})
