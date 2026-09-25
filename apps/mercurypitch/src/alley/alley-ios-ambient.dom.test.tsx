// The Sing door's ambient, fetched the way each platform answers it.
//
// Android's local server (and the dev server) answer a packaged .m4a with a
// 200. Capacitor's iOS scheme handler answers the same non-Range GET with a
// bare URLResponse, so WebKit hands the page `ok: false, status: 0` and the
// whole file. Before the loader read through the shared rule
// (@irchiinnuss/mobile-runtime/asset-fetch) it threw on `!response.ok`, and
// TestFlight 0.5.0 (336) on an iPhone 13 Pro played no ambient at all.
//
// This renders the real RoomsAlley with a fake AudioContext and taps the Sing
// door, so the loader under test is the one the app wires in, not a copy.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RenderedShell } from '../shell/render-for-test'
import { renderShell } from '../shell/render-for-test'
import type * as ShellNavigation from '../shell/shell-navigation'

vi.mock('@irchiinnuss/mobile-runtime/platform', () => ({
  hapticTap: vi.fn(async () => undefined),
}))

vi.mock('../shell/shell-navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof ShellNavigation>()),
  goToTab: vi.fn(),
}))

/** The shipped Sing ambient's size, so the body is recognisably the file. */
const SING_BYTES = 266_161

class FakeResizeObserver {
  constructor(readonly callback: ResizeObserverCallback) {}
  observe(): void {}
  disconnect(): void {}
}

/** A storage of our own: which one a runner provides differs by Node version. */
function memoryStorage(): Storage {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  }
}

let starts: number[] = []
let decoded: number[] = []

/** Enough of an AudioContext for one door tap: resume, decode, a source. */
class FakeAudioContext {
  state = 'suspended'
  currentTime = 0
  sampleRate = 48_000
  destination = {}
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  suspend = vi.fn(async () => {
    this.state = 'suspended'
  })
  close = vi.fn(async () => {
    this.state = 'closed'
  })
  addEventListener(): void {}
  decodeAudioData = vi.fn(async (bytes: ArrayBuffer) => {
    decoded.push(bytes.byteLength)
    return { duration: 13.1, numberOfChannels: 2, sampleRate: 48_000 }
  })
  createGain() {
    const gain = {
      value: 1,
      cancelScheduledValues() {},
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
      setTargetAtTime() {},
    }
    return { gain, connect() {}, disconnect() {} }
  }
  createBufferSource() {
    return {
      buffer: null,
      loop: false,
      connect() {},
      disconnect() {},
      start: (at: number) => void starts.push(at),
      stop() {},
    }
  }
}

let view: RenderedShell | null = null

/** Answer every fetch with `response` and the whole file, then tap Sing. */
async function tapSingWith(response: { ok: boolean; status: number }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ...response,
      arrayBuffer: async () => new ArrayBuffer(SING_BYTES),
    })),
  )
  const { RoomsAlley } = await import('./RoomsAlley')
  view = renderShell(() => <RoomsAlley />)
  const door = view.container.querySelector<HTMLButtonElement>(
    '[data-testid="alley-door-sing"]',
  )
  if (door === null) throw new Error('no Sing door')
  door.click()
  for (let i = 0; i < 50; i++) await Promise.resolve()
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  starts = []
  decoded = []
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  )
  vi.stubGlobal('innerWidth', 393)
  vi.stubGlobal('innerHeight', 852)
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
    () => undefined,
  )
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
    () => undefined,
  )
})

afterEach(() => {
  view?.unmount()
  view = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('the Sing door ambient', () => {
  it('control: a 200 (Android, the dev server) decodes and starts one looping source', async () => {
    await tapSingWith({ ok: true, status: 200 })
    expect(decoded).toEqual([SING_BYTES])
    expect(starts).toHaveLength(1)
  })

  it('iOS: a packaged m4a served with status 0 and the whole body still plays', async () => {
    await tapSingWith({ ok: false, status: 0 })
    expect(decoded).toEqual([SING_BYTES])
    expect(starts).toHaveLength(1)
  })
})
