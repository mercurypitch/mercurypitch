// ============================================================
// Shared clock log: every state of the app's one clock, in the console
// ============================================================
//
// Plumbing with no document of its own (this package's node project): the
// page's visibility is a stand-in the cases set.

import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logClockStates } from './shared-clock-log'

/** A clock whose state the test moves, as iOS and the broker would. */
class FakeClock extends EventTarget {
  state = 'suspended'
  currentTime = 0

  goes(state: string, at: number): void {
    this.state = state
    this.currentTime = at
    this.dispatchEvent(new Event('statechange'))
  }
}

function setVisibility(state: DocumentVisibilityState): void {
  vi.stubGlobal('document', { visibilityState: state })
}

let log: MockInstance<(...data: unknown[]) => void>
const lines = (): unknown[] => log.mock.calls.map((call) => call[0])

beforeEach(() => {
  log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  setVisibility('visible')
})

afterEach(() => {
  log.mockRestore()
  vi.unstubAllGlobals()
})

describe('logClockStates', () => {
  it('says the state it finds, then every change, iOS’s interruption included', () => {
    const clock = new FakeClock()

    logClockStates(clock as unknown as AudioContext, 'shared')
    clock.goes('running', 0.0213)
    clock.goes('interrupted', 61.5041)
    clock.goes('running', 61.5041)

    expect(lines()).toEqual([
      '[audio clock] shared: suspended, first seen',
      '[audio clock] shared: suspended -> running, at 0.021 s',
      '[audio clock] shared: running -> interrupted, at 61.504 s',
      '[audio clock] shared: interrupted -> running, at 61.504 s',
    ])
  })

  it('marks a change that came while the page was hidden', () => {
    const clock = new FakeClock()
    logClockStates(clock as unknown as AudioContext, 'shared')
    clock.goes('running', 1)

    setVisibility('hidden')
    clock.goes('suspended', 12)

    expect(lines().at(-1)).toBe(
      '[audio clock] shared: running -> suspended, at 12.000 s [hidden]',
    )
  })

  it('watches a clock once, however many leases hand it out', () => {
    const clock = new FakeClock()

    logClockStates(clock as unknown as AudioContext, 'shared')
    logClockStates(clock as unknown as AudioContext, 'shared')
    clock.goes('running', 1)

    expect(lines()).toHaveLength(2)
  })

  it('says nothing for an event that leaves the state as it was', () => {
    const clock = new FakeClock()
    logClockStates(clock as unknown as AudioContext, 'shared')

    clock.goes('suspended', 3)

    expect(lines()).toEqual(['[audio clock] shared: suspended, first seen'])
  })

  it('keeps to the routine level, out of a console that leaves it out', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const clock = new FakeClock()

    logClockStates(clock as unknown as AudioContext, 'shared')
    clock.goes('interrupted', 4)

    expect(lines()).toHaveLength(2)
    expect(info).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
    info.mockRestore()
    warn.mockRestore()
  })
})
