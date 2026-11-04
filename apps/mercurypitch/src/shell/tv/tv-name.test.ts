// ============================================================
// Which TV it is: the name from the sound's route, waited for briefly
// ============================================================
//
// A TV is named by the port of the sound's route on AirPlay or HDMI, and by
// nothing else. The route settles a moment after the screen connects, and
// the route as the screen comes may still be the one before it (an AirPlay
// speaker), so the name is the first move of the route that names a TV;
// with none by TV_NAME_WAIT_MS, what the route names then, or null. A name
// that comes after the bound is not taken. The real route store is driven
// as the phone drives it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import { TV_NAME_WAIT_MS, tvNameOf, waitForTvName } from './tv-name'

const LG = 'LG webOS TV OLED48C24LA'
const HOMEPOD = 'Kitchen HomePod'

/** What the wait has said so far: a name, null, or nothing yet. */
function follow(wait: { name: Promise<string | null> }): {
  readonly heard: () => string | null | undefined
} {
  let heard: string | null | undefined
  void wait.name.then((name) => {
    heard = name
  })
  return { heard: () => heard }
}

beforeEach(() => {
  vi.useFakeTimers()
  setAudioRouteForTests('speaker', 'Speaker')
})

afterEach(() => {
  setAudioRouteForTests(null)
  vi.useRealTimers()
})

describe('the TV’s name', () => {
  it('is the port’s on AirPlay and HDMI, trimmed', () => {
    expect(tvNameOf('airplay', ` ${LG} `)).toBe(LG)
    expect(tvNameOf('hdmi', 'HDMI')).toBe('HDMI')
  })

  it.each([
    ['the speaker', 'speaker', 'Speaker'],
    ['Bluetooth', 'bluetooth', 'AirPods Pro'],
    ['headphones', 'headphones', 'Headphones'],
    ['no route yet', null, null],
    ['an AirPlay port with no name', 'airplay', '  '],
  ] as const)('is none on %s', (_what, route, port) => {
    expect(tvNameOf(route, port)).toBeNull()
  })
})

describe('the wait for the TV’s name', () => {
  it('takes the first move of the route that names a TV, at once', async () => {
    const wait = follow(waitForTvName())
    await vi.advanceTimersByTimeAsync(TV_NAME_WAIT_MS / 4)
    const before = wait.heard()

    setAudioRouteForTests('airplay', LG)
    await vi.advanceTimersByTimeAsync(0)

    expect(before).toBeUndefined()
    expect(wait.heard()).toBe(LG)
  })

  it('takes the TV the sound moves to over the AirPlay speaker it was on', async () => {
    setAudioRouteForTests('airplay', HOMEPOD)
    const wait = follow(waitForTvName())
    await vi.advanceTimersByTimeAsync(TV_NAME_WAIT_MS / 4)
    const before = wait.heard()

    setAudioRouteForTests('airplay', LG)
    await vi.advanceTimersByTimeAsync(0)

    expect(before).toBeUndefined()
    expect(wait.heard()).toBe(LG)
  })

  it('takes the TV the sound was on already, once the route has had its time to move', async () => {
    setAudioRouteForTests('airplay', LG)

    const wait = follow(waitForTvName())
    await vi.advanceTimersByTimeAsync(TV_NAME_WAIT_MS - 1)
    const justBefore = wait.heard()
    await vi.advanceTimersByTimeAsync(1)

    expect(justBefore).toBeUndefined()
    expect(wait.heard()).toBe(LG)
  })

  it('is brief: the question comes within two seconds of the screen, as the device test says', () => {
    expect(TV_NAME_WAIT_MS).toBeGreaterThan(0)
    expect(TV_NAME_WAIT_MS).toBeLessThanOrEqual(2000)
  })

  it('waits no longer than the bound, then goes without a name', async () => {
    const wait = follow(waitForTvName())
    await vi.advanceTimersByTimeAsync(TV_NAME_WAIT_MS - 1)
    const justBefore = wait.heard()

    await vi.advanceTimersByTimeAsync(1)

    expect(justBefore).toBeUndefined()
    expect(wait.heard()).toBeNull()
  })

  it('does not take a name that comes after the bound', async () => {
    const wait = follow(waitForTvName({ waitMs: 500 }))
    await vi.advanceTimersByTimeAsync(500)

    setAudioRouteForTests('airplay', LG)
    await vi.advanceTimersByTimeAsync(0)

    expect(wait.heard()).toBeNull()
  })

  it('does not take a move to a port that names no TV', async () => {
    const wait = follow(waitForTvName())

    setAudioRouteForTests('bluetooth', 'AirPods Pro')
    await vi.advanceTimersByTimeAsync(TV_NAME_WAIT_MS)

    expect(wait.heard()).toBeNull()
  })

  it('ends with no name when called off', async () => {
    const waiting = waitForTvName()
    const wait = follow(waiting)

    waiting.cancel()
    setAudioRouteForTests('airplay', LG)
    await vi.advanceTimersByTimeAsync(0)

    expect(wait.heard()).toBeNull()
  })
})
