// ============================================================
// The Developer screen's switches for the no-streaming path
// ============================================================
//
// Every iPhone before iOS 26 plays the Karaoke room without AudioDecoder.
// "Force the no-streaming path" puts a newer phone on that same path, and
// "Allow full decode past the guard" is the crash test past the refusal
// (owner, 28 Sep). Both persist, and a store build never reads either.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as NativeBuild from '@/lib/native-build'

const build = vi.hoisted(() => ({ native: true }))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get IS_NATIVE_BUILD() {
    return build.native
  },
}))

import { canStreamStems } from './stem-stream-source'
import { DECODE_PAST_GUARD_KEY, decodePastGuard, FORCE_NO_STREAM_KEY, noStreamForced, reloadStreamSwitchesForTests, setDecodePastGuard, setNoStreamForced, } from './stream-switches'

/** Any AudioDecoder at all: canStreamStems() asks only whether there is one. */
class AudioDecoderStub {
  readonly configure = vi.fn()
}

beforeEach(() => {
  build.native = true
  localStorage.clear()
  reloadStreamSwitchesForTests()
  vi.stubEnv('VITE_PORTABLE_CONSOLE', 'true')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  localStorage.clear()
  reloadStreamSwitchesForTests()
})

describe('the switches', () => {
  it('are off until a tester turns them on', () => {
    expect(noStreamForced()).toBe(false)
    expect(decodePastGuard()).toBe(false)
  })

  it('persist on the phone, and come off again', () => {
    setNoStreamForced(true)
    setDecodePastGuard(true)
    expect(localStorage.getItem(FORCE_NO_STREAM_KEY)).toBe('1')
    expect(localStorage.getItem(DECODE_PAST_GUARD_KEY)).toBe('1')

    // A later launch reads them back.
    reloadStreamSwitchesForTests()
    expect(noStreamForced()).toBe(true)
    expect(decodePastGuard()).toBe(true)

    setNoStreamForced(false)
    setDecodePastGuard(false)
    expect(localStorage.getItem(FORCE_NO_STREAM_KEY)).toBeNull()
    expect(localStorage.getItem(DECODE_PAST_GUARD_KEY)).toBeNull()
    expect(noStreamForced()).toBe(false)
    expect(decodePastGuard()).toBe(false)
  })

  it('are never on in a store build, whatever a TestFlight build left', () => {
    localStorage.setItem(FORCE_NO_STREAM_KEY, '1')
    localStorage.setItem(DECODE_PAST_GUARD_KEY, '1')
    reloadStreamSwitchesForTests()
    vi.stubEnv('VITE_PORTABLE_CONSOLE', '')

    expect(noStreamForced()).toBe(false)
    expect(decodePastGuard()).toBe(false)
  })
})

describe('a phone with AudioDecoder', () => {
  it('streams, until the switch says it has none', () => {
    vi.stubGlobal('AudioDecoder', AudioDecoderStub)
    expect(canStreamStems()).toBe(true)

    setNoStreamForced(true)
    expect(canStreamStems()).toBe(false)

    setNoStreamForced(false)
    expect(canStreamStems()).toBe(true)
  })

  it('streams in a store build even with the switch left on', () => {
    vi.stubGlobal('AudioDecoder', AudioDecoderStub)
    setNoStreamForced(true)
    vi.stubEnv('VITE_PORTABLE_CONSOLE', '')

    expect(canStreamStems()).toBe(true)
  })

  it('streams on the web, which has no Developer screen to flip it', () => {
    vi.stubGlobal('AudioDecoder', AudioDecoderStub)
    setNoStreamForced(true)
    build.native = false

    expect(canStreamStems()).toBe(true)
  })
})

describe('a phone without AudioDecoder', () => {
  it('never streams, whatever the switch says', () => {
    // jsdom has no AudioDecoder, as a WKWebView before iOS 26 has none.
    expect(typeof AudioDecoder).toBe('undefined')
    expect(canStreamStems()).toBe(false)
    setNoStreamForced(true)
    expect(canStreamStems()).toBe(false)
  })
})
