import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_SINGING } from '@/features/tabs/constants'
import type { RenderedShell } from '../shell/render-for-test'
import { renderShell } from '../shell/render-for-test'
import type * as ShellNavigation from '../shell/shell-navigation'

// The alley's state, its ambient, the welcome flag and the arrival hold all
// live at module level, so every case imports a fresh copy of each.

vi.mock('@irchiinnuss/mobile-runtime/platform', () => ({
  hapticTap: vi.fn(async () => undefined),
}))

vi.mock('../shell/shell-navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof ShellNavigation>()),
  goToTab: vi.fn(),
}))

class FakeResizeObserver {
  static last: FakeResizeObserver | null = null
  constructor(readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.last = this
  }
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

let view: RenderedShell | null = null

async function mountAlley() {
  const alley = await import('./RoomsAlley')
  const welcome = await import('./alley-welcome')
  const store = await import('@/stores/native-shell-store')
  const nav = await import('../shell/shell-navigation')
  const Alley = alley.RoomsAlley
  view = renderShell(() => <Alley />)
  const el = <T extends Element = HTMLElement>(testid: string): T => {
    const found = view?.container.querySelector<T>(`[data-testid="${testid}"]`)
    if (found === null || found === undefined) throw new Error(`${testid}?`)
    return found
  }
  return { el, welcome, store, nav }
}

beforeEach(() => {
  vi.resetModules()
  // A mocked module outlives resetModules, and so do its calls.
  vi.clearAllMocks()
  vi.useFakeTimers()
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

describe('entering a room from the alley', () => {
  it('holds the room from Enter, and marks the welcome seen only once a room is reached', async () => {
    const { el, welcome, store, nav } = await mountAlley()
    expect(welcome.welcomeSeen()).toBe(false)

    el('alley-door-sing').click()
    expect(welcome.welcomeSeen()).toBe(false)
    expect(store.roomArrivalHeld()).toBe(false)

    el('alley-enter').click()
    expect(store.roomArrivalHeld()).toBe(true)
    expect(welcome.welcomeSeen()).toBe(false)

    await vi.advanceTimersByTimeAsync(700)
    expect(nav.goToTab).toHaveBeenCalledWith(TAB_SINGING)
    expect(welcome.welcomeSeen()).toBe(true)
    expect(store.roomArrivalHeld()).toBe(true)
  })

  it('leaves the welcome unseen when the open is called off', async () => {
    const { el, welcome, store, nav } = await mountAlley()
    el('alley-door-sing').click()
    el('alley-enter').click()
    await vi.advanceTimersByTimeAsync(150)

    expect(nav.cancelDoorOpen()).toBe(true)
    expect(store.roomArrivalHeld()).toBe(false)
    await vi.advanceTimersByTimeAsync(2000)
    expect(nav.goToTab).not.toHaveBeenCalled()
    expect(welcome.welcomeSeen()).toBe(false)
    expect(el('rooms-alley').dataset.phase).toBe('rest')
  })
})

describe('a resize', () => {
  it('moves the doors and keeps the same <video>', async () => {
    const { el } = await mountAlley()
    el('alley-door-sing').click()
    const clip = el<HTMLVideoElement>('alley-clip')
    const left = el('alley-door-sing').style.left

    const root = el('rooms-alley')
    Object.defineProperty(root, 'clientWidth', { value: 412 })
    Object.defineProperty(root, 'clientHeight', { value: 915 })
    const observer = FakeResizeObserver.last
    if (observer === null) throw new Error('no ResizeObserver')
    observer.callback([], observer as unknown as ResizeObserver)

    expect(el('alley-door-sing').style.left).not.toBe(left)
    expect(el('alley-clip')).toBe(clip)
    expect(clip.isConnected).toBe(true)
    expect(el('rooms-alley').dataset.phase).toBe('alive')
  })
})
