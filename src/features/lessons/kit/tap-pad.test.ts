// The tap pad: the Ear Lab's tap rule on a plain button, and the taps' tempo.

import { describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { bindTapPad, createTapTempo } from './tap-pad'

function pad(): { el: HTMLButtonElement; taps: number[] } {
  const el = document.createElement('button')
  document.body.append(el)
  const taps: number[] = []
  bindTapPad(el, (at) => taps.push(at))
  return { el, taps }
}

/** A pointer down as jsdom can make one: the button and the time stamped on it. */
function pointerDown(button: number): Event {
  const e = new MouseEvent('pointerdown', { button, cancelable: true })
  return e
}

describe('bindTapPad', () => {
  it("takes a primary pointer down at the event's own time, and flashes for 110 ms", () => {
    vi.useFakeTimers()
    const { el, taps } = pad()
    const e = pointerDown(0)
    el.dispatchEvent(e)
    expect(taps).toEqual([e.timeStamp])
    expect(e.defaultPrevented).toBe(true)
    expect(el.classList.contains('is-hit')).toBe(true)
    vi.advanceTimersByTime(110)
    expect(el.classList.contains('is-hit')).toBe(false)
    vi.useRealTimers()
  })

  it("takes Space and Enter, never a held key's repeat or a secondary button", () => {
    const { el, taps } = pad()
    el.dispatchEvent(pointerDown(2))
    el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true }))
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(taps).toHaveLength(2)
  })

  it('takes nothing while it is aria-disabled', () => {
    const { el, taps } = pad()
    el.setAttribute('aria-disabled', 'true')
    el.dispatchEvent(pointerDown(0))
    el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    expect(taps).toEqual([])
  })
})

describe('createTapTempo', () => {
  it('reads nothing until the fourth tap, then 60,000 over the middle of the gaps', () => {
    const t = createTapTempo()
    const readings = [0, 667, 1334, 2000, 2667].map((ms) => t.tap(ms).bpm)
    expect(readings).toEqual([null, null, null, 90, 90])
  })

  it('takes the middle of the last eight gaps, so one stray gap moves nothing', () => {
    const t = createTapTempo()
    const gaps = [645, 690, 667, 900, 660, 670, 667, 680, 650]
    let at = 0
    t.tap(at)
    let bpm: number | null = null
    for (const g of gaps) {
      at += g
      bpm = t.tap(at).bpm
    }
    // the last eight: 690 667 900 660 670 667 680 650; their middle is 668.5
    expect(bpm).toBe(90)
  })

  it('starts a new run after a gap over 2 s, and drops a bounce under 0.15 s', () => {
    const t = createTapTempo()
    for (const ms of [0, 500, 1000, 1500]) t.tap(ms)
    expect(t.tap(1600)).toEqual({ bpm: 120, taps: 4, newRun: false })
    const fresh = t.tap(4000)
    expect(fresh).toEqual({ bpm: null, taps: 1, newRun: true })
    t.reset()
    expect(t.tap(10)).toEqual({ bpm: null, taps: 1, newRun: true })
  })
})
