// ============================================================
// Coach events: a tour hears what the singer did, and nothing is sent unheard
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { COACH_EVENT, emitCoachEvent, onCoachEvent } from './coach-events'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the coach event bus', () => {
  it('calls a listener for its own event only', () => {
    const heard: string[] = []
    const offPitch = onCoachEvent('pitch-detected', () => heard.push('pitch'))
    const offScore = onCoachEvent('score-closed', () => heard.push('score'))

    emitCoachEvent('pitch-detected')
    emitCoachEvent('song-staged')

    expect(heard).toEqual(['pitch'])
    offPitch()
    offScore()
  })

  it('stops calling after unsubscribe', () => {
    const fn = vi.fn()
    const off = onCoachEvent('song-staged', fn)
    emitCoachEvent('song-staged')

    off()
    emitCoachEvent('song-staged')

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('dispatches nothing while no one listens', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent')
    const off = onCoachEvent('score-closed', () => undefined)
    off()

    emitCoachEvent('pitch-detected')
    emitCoachEvent('score-closed')

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('keeps counting listeners right when one unsubscribes twice', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent')
    const first = onCoachEvent('pitch-detected', () => undefined)
    const second = onCoachEvent('pitch-detected', () => undefined)
    first()
    first()

    emitCoachEvent('pitch-detected')

    expect(dispatch).toHaveBeenCalledTimes(1)
    second()
  })

  it('hears an event sent on the window by name, as a browser check sends one', () => {
    const fn = vi.fn()
    const off = onCoachEvent('pitch-detected', fn)

    window.dispatchEvent(
      new CustomEvent(COACH_EVENT, { detail: 'pitch-detected' }),
    )

    expect(fn).toHaveBeenCalledTimes(1)
    off()
  })
})
