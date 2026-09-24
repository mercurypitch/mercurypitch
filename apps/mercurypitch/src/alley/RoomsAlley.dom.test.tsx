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

describe('an open called off without Back or a rail tab', () => {
  it('stops for a press anywhere outside the alley', async () => {
    const { el, store, nav } = await mountAlley()
    el('alley-door-sing').click()
    el('alley-enter').click()
    await vi.advanceTimersByTimeAsync(150)
    expect(document.querySelector('[data-testid="alley-morph"]')).not.toBeNull()

    // More, or the corner chip: not a rail tab, so goToTab never sees it.
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))

    expect(el('rooms-alley').dataset.phase).toBe('rest')
    expect(document.querySelector('[data-testid="alley-morph"]')).toBeNull()
    expect(store.roomArrivalHeld()).toBe(false)
    await vi.advanceTimersByTimeAsync(2000)
    expect(nav.goToTab).not.toHaveBeenCalled()
  })

  it('ignores a press inside the alley while it grows', async () => {
    const { el } = await mountAlley()
    el('alley-door-sing').click()
    el('alley-enter').click()
    await vi.advanceTimersByTimeAsync(150)
    el('alley-plate').dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(el('rooms-alley').dataset.phase).toBe('opening')
  })

  it('stops when the alley is unmounted under it', async () => {
    const { el, store, nav } = await mountAlley()
    el('alley-door-sing').click()
    el('alley-enter').click()
    await vi.advanceTimersByTimeAsync(150)

    // A hash change, a deep link: the tab went away without the shell's help.
    view?.unmount()
    view = null

    expect(document.querySelector('[data-testid="alley-morph"]')).toBeNull()
    expect(store.roomArrivalHeld()).toBe(false)
    await vi.advanceTimersByTimeAsync(2000)
    expect(nav.goToTab).not.toHaveBeenCalled()
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

describe('the Sing door clip', () => {
  it('loads only its metadata until Sing is picked', async () => {
    const { el } = await mountAlley()
    const clip = el<HTMLVideoElement>('alley-clip')
    expect(clip.getAttribute('preload')).toBe('metadata')

    el('alley-door-sing').click()
    expect(clip.getAttribute('preload')).toBe('auto')
    el('alley-door-karaoke').click()
    expect(clip.getAttribute('preload')).toBe('metadata')
  })

  it('lets go of its source when the alley unmounts', async () => {
    const { el } = await mountAlley()
    el('alley-door-sing').click()
    const clip = el<HTMLVideoElement>('alley-clip')
    expect(clip.getAttribute('src')).not.toBeNull()
    const pause = vi.mocked(HTMLMediaElement.prototype.pause)
    const load = vi.mocked(HTMLMediaElement.prototype.load)
    pause.mockClear()
    load.mockClear()

    view?.unmount()
    view = null

    expect(pause.mock.contexts).toContain(clip)
    expect(clip.getAttribute('src')).toBeNull()
    expect(load.mock.contexts).toContain(clip)
  })

  it('is left to the open once the clone has covered', async () => {
    const { el } = await mountAlley()
    el('alley-door-sing').click()
    const clip = el<HTMLVideoElement>('alley-clip')
    // A clip that is playing is the one the open carries into its clone.
    Object.defineProperty(clip, 'paused', { value: false })
    el('alley-enter').click()
    expect(clip.closest('[data-testid="alley-morph"]')).not.toBeNull()
    // Covered: the room is navigated to and the alley unmounts under it.
    await vi.advanceTimersByTimeAsync(700)
    expect(el('rooms-alley').dataset.phase).toBe('open')

    view?.unmount()
    view = null

    expect(clip.getAttribute('src')).not.toBeNull()
  })
})

describe('the keyboard', () => {
  it('Escape puts a picked door back and fades its sound out', async () => {
    const { el } = await mountAlley()
    el('alley-door-sing').click()
    expect(el('rooms-alley').dataset.phase).toBe('alive')

    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true,
    })
    window.dispatchEvent(escape)

    expect(el('rooms-alley').dataset.phase).toBe('rest')
    expect(escape.defaultPrevented).toBe(true)
  })

  it('Escape at rest is left to whoever else wants it', async () => {
    const { el } = await mountAlley()
    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true,
    })
    window.dispatchEvent(escape)
    expect(escape.defaultPrevented).toBe(false)
    expect(el('rooms-alley').dataset.phase).toBe('rest')
  })

  it('is where the skip link goes while it is mounted', async () => {
    const { el, store } = await mountAlley()
    expect(store.nativeSkipTarget()).toBe(el('rooms-alley'))
    expect(el('rooms-alley').tabIndex).toBe(-1)

    view?.unmount()
    view = null
    expect(store.nativeSkipTarget()).toBeNull()
  })
})
