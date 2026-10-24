// ============================================================
// Microphone holder tests — the listener loaded on demand, the device held
// ============================================================
//
// The listener module is a double, registered afresh for each test with
// `vi.doMock` so its factory counts every load (MISTAKES.md, "Count module
// loads with a per-test vi.doMock"): the holder must not load it until a
// take opens. Its listener holds the device until it is let go, and records
// who asked for the device and how it was let go.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Listener } from './listen'

const device = {
  loads: 0,
  refuse: false,
  asked: [] as string[],
  released: [] as ('linger' | 'now')[],
}

function fakeListener(): Listener {
  let holding = true
  return {
    get holding() {
      return holding
    },
    latest: () => null,
    release: () => {
      holding = false
      device.released.push('linger')
    },
    releaseNow: () => {
      holding = false
      device.released.push('now')
    },
  }
}

const context = {} as AudioContext

beforeEach(() => {
  vi.resetModules()
  Object.assign(device, { loads: 0, refuse: false, asked: [], released: [] })
  vi.doMock('./listen', () => {
    device.loads += 1
    return {
      listen: (id: string) => {
        device.asked.push(id)
        return device.refuse
          ? Promise.reject(new Error('NotAllowedError'))
          : Promise.resolve(fakeListener())
      },
    }
  })
})

describe('MicHold', () => {
  it('loads the listener only when a take opens, and holds the device under its own id', async () => {
    const { MicHold } = await import('./mic-hold')
    const mic = new MicHold('lesson-09')
    const loadedBefore = device.loads

    const ok = await mic.open(context)

    expect([loadedBefore, device.loads]).toEqual([0, 1])
    expect(ok).toBe(true)
    expect(device.asked).toEqual(['lesson-09'])
    expect(mic.listener?.holding).toBe(true)
  })

  it('asks for nothing without an AudioContext', async () => {
    const { MicHold } = await import('./mic-hold')
    const mic = new MicHold('lesson-07')

    const ok = await mic.open(null)

    expect(ok).toBe(false)
    expect([device.loads, device.asked.length]).toEqual([0, 0])
  })

  it('answers false and holds nothing when the microphone is refused', async () => {
    const { MicHold } = await import('./mic-hold')
    const mic = new MicHold('lesson-07')
    device.refuse = true

    const ok = await mic.open(context)

    expect(ok).toBe(false)
    expect(mic.listener).toBeNull()
  })

  it('keeps a hold it still has, and asks again once the listener has let go', async () => {
    // the listener lets go by itself too: the mic sentinel, a hidden tab
    const { MicHold } = await import('./mic-hold')
    const mic = new MicHold('lesson-07')
    await mic.open(context)
    await mic.open(context)
    mic.listener?.releaseNow()

    await mic.open(context)

    expect(device.asked).toEqual(['lesson-07', 'lesson-07'])
    expect(device.loads).toBe(1)
  })

  it('lets go after the linger by default, and forgets the listener', async () => {
    const { MicHold } = await import('./mic-hold')
    const mic = new MicHold('lesson-07')
    await mic.open(context)

    mic.release()

    expect(device.released).toEqual(['linger'])
    expect(mic.listener).toBeNull()
  })

  it('lets go at once when asked, and forgets the listener', async () => {
    // a hidden tab, or a page going away
    const { MicHold } = await import('./mic-hold')
    const mic = new MicHold('lesson-07')
    await mic.open(context)

    mic.release(true)

    expect(device.released).toEqual(['now'])
    expect(mic.listener).toBeNull()
  })
})
