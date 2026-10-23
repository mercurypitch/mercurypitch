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

/** `event`, stamped `ms` on the page's clock, as the browser stamps it. */
function stamped<E extends Event>(event: E, ms: number): E {
  Object.defineProperty(event, 'timeStamp', { value: ms })
  return event
}

const key = (type: 'keydown' | 'keyup', name: string, ms: number): Event =>
  stamped(new KeyboardEvent(type, { key: name }), ms)
const click = (ms: number): Event => stamped(new MouseEvent('click'), ms)

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
    el.dispatchEvent(new MouseEvent('click'))
    expect(taps).toEqual([])
  })

  it('takes a click that no pointer or key made, as a screen reader or a switch sends it', () => {
    const { el, taps } = pad()
    const click = new MouseEvent('click')
    el.dispatchEvent(click)
    expect(taps).toEqual([click.timeStamp])
  })

  it('takes no second tap from the click a pointer or a key makes of itself', () => {
    const { el, taps } = pad()
    el.dispatchEvent(pointerDown(0))
    el.dispatchEvent(new MouseEvent('pointerup'))
    el.dispatchEvent(new MouseEvent('click'))
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    el.dispatchEvent(new MouseEvent('click'))
    expect(taps).toHaveLength(2)
  })

  it('takes a click 50 ms after a Control keydown as a tap, and not one 50 ms after a Space keyup', () => {
    const { el, taps } = pad()
    // VoiceOver's Control, then its click
    el.dispatchEvent(key('keydown', 'Control', 1000))
    el.dispatchEvent(click(1050))
    // Space taps on its keydown, and its keyup's click is the echo
    el.dispatchEvent(key('keydown', ' ', 2000))
    el.dispatchEvent(key('keyup', ' ', 2000))
    el.dispatchEvent(click(2050))
    expect(taps).toEqual([1050, 2000])
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
