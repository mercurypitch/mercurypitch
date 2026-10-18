// ============================================================
// The app leaving a premium room while the page still shows
// ============================================================
//
// Every room and demo listening hears each leaving once, and nobody who has
// stopped listening hears it, not even mid-announcement: a room ending can
// take its demo's listener with it.

import { describe, expect, it, vi } from 'vitest'
import { announceAppLeave, announceAppReturn, onAppLeave, onAppReturn, } from './app-leave'

describe('onAppLeave', () => {
  it('tells every room listening, each time the app leaves', () => {
    const room = vi.fn()
    const demo = vi.fn()
    const stopRoom = onAppLeave(room)
    const stopDemo = onAppLeave(demo)
    announceAppLeave()
    announceAppLeave()
    expect(room).toHaveBeenCalledTimes(2)
    expect(demo).toHaveBeenCalledTimes(2)
    stopRoom()
    stopDemo()
  })

  it('tells nobody who has stopped listening, even mid-announcement', () => {
    const demo = vi.fn()
    let stopDemo = (): void => undefined
    const stopRoom = onAppLeave(() => stopDemo())
    stopDemo = onAppLeave(demo)
    announceAppLeave()
    expect(demo).not.toHaveBeenCalled()
    stopRoom()
    announceAppLeave()
    expect(demo).not.toHaveBeenCalled()
  })
})

describe('onAppReturn', () => {
  it('tells every room listening each time the app is in front again, and nobody after', () => {
    const demo = vi.fn()
    const left = vi.fn()
    const stopDemo = onAppReturn(demo)
    const stopLeft = onAppLeave(left)
    announceAppReturn()
    announceAppReturn()
    stopDemo()
    announceAppReturn()
    stopLeft()
    expect(demo).toHaveBeenCalledTimes(2)
    // The way back is its own word: no leave is heard.
    expect(left).not.toHaveBeenCalled()
  })
})
