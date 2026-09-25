import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_PROGRESS, TAB_SINGING } from '@/features/tabs/constants'
import type { RenderedShell } from '../shell/render-for-test'
import { renderShell } from '../shell/render-for-test'
import type * as RunShell from '../shell/run-shell-store'
import type * as ShellNavigation from '../shell/shell-navigation'
import type * as AlleyAudio from './alley-audio'
import type * as AlleyGeometry from './alley-geometry'

// The alley's state, its ambient, the welcome flag and the arrival hold all
// live at module level, so every case imports a fresh copy of each.

vi.mock('@irchiinnuss/mobile-runtime/platform', () => ({
  hapticTap: vi.fn(async () => undefined),
}))

vi.mock('../shell/shell-navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof ShellNavigation>()),
  goToTab: vi.fn(),
}))

// The real ambient, with its stop() watched: jsdom has no AudioContext, so
// whether the door's sound was told to fade is the thing a case can see.
vi.mock('./alley-audio', async (importOriginal) => {
  const real = await importOriginal<typeof AlleyAudio>()
  return {
    ...real,
    createAlleyAmbient: vi.fn((deps: AlleyAudio.AmbientDeps) => {
      const ambient = real.createAlleyAmbient(deps)
      return {
        ...ambient,
        stop: vi.fn(ambient.stop),
        recover: vi.fn(ambient.recover),
        dispose: vi.fn(ambient.dispose),
      }
    }),
  }
})

// The real geometry, with layoutDoors watched: each call is the door layout
// recomputed after a measured value was written.
vi.mock('./alley-geometry', async (importOriginal) => {
  const real = await importOriginal<typeof AlleyGeometry>()
  return { ...real, layoutDoors: vi.fn(real.layoutDoors) }
})

class FakeResizeObserver {
  static last: FakeResizeObserver | null = null
  readonly observed: Element[] = []
  constructor(readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.last = this
  }
  observe(target: Element): void {
    this.observed.push(target)
  }
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
  const shell = await import('../shell/run-shell-store')
  const audio = await import('./alley-audio')
  const Alley = alley.RoomsAlley
  view = renderShell(() => <Alley />)
  const el = <T extends Element = HTMLElement>(testid: string): T => {
    const found = view?.container.querySelector<T>(`[data-testid="${testid}"]`)
    if (found === null || found === undefined) throw new Error(`${testid}?`)
    return found
  }
  /** The ambient, once a door tap has created it. */
  const ambientMade = (): AlleyAudio.AlleyAmbient => {
    const made = vi.mocked(audio.createAlleyAmbient).mock.results.at(-1)
    if (made === undefined) throw new Error('no ambient yet')
    return made.value as AlleyAudio.AlleyAmbient
  }
  const ambientStop = () => vi.mocked(ambientMade().stop)
  return { el, welcome, store, nav, shell, ambientStop, ambientMade }
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

describe('an open that throws', () => {
  it('goes back to rest, lets the hold go and takes taps again', async () => {
    // Left in 'opening' with no clone and nothing registered, the alley
    // dropped every tap, Escape and Back until a tab change remounted it.
    const { el, store } = await mountAlley()
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    el('alley-door-sing').click()
    const clip = el<HTMLVideoElement>('alley-clip')
    Object.defineProperty(clip, 'paused', { value: false })
    vi.spyOn(clip.classList, 'add').mockImplementation(() => {
      throw new Error('the clip would not move')
    })

    el('alley-enter').click()

    expect(el('rooms-alley').dataset.phase).toBe('rest')
    expect(store.roomArrivalHeld()).toBe(false)
    expect(document.querySelector('[data-testid="alley-morph"]')).toBeNull()
    expect(clip.closest('.mp-alley__art')).not.toBeNull()
    expect(error).toHaveBeenCalled()

    el('alley-door-sing').click()
    expect(el('rooms-alley').dataset.phase).toBe('alive')
  })
})

describe('somewhere else, after the clone has covered', () => {
  // The open cannot be called off once covered, and the clone waited up to
  // 1.7 s on a room the user had already left: a rail tab, More, the pill
  // or Back changed the surface under an opaque clone.
  it('a rail tab: the clone is gone within 120 ms', async () => {
    const { el, shell } = await mountAlley()
    const ui = await import('@/stores/ui-store')
    el('alley-door-sing').click()
    el('alley-enter').click()
    await vi.advanceTimersByTimeAsync(700)
    expect(document.querySelector('[data-testid="alley-morph"]')).not.toBeNull()

    // What goToTab(TAB_PROGRESS) and the router do.
    window.location.hash = '#/progress'
    ui.setActiveTab(TAB_PROGRESS)
    expect(shell.currentTab()).toBe(TAB_PROGRESS)
    await vi.advanceTimersByTimeAsync(120)
    expect(document.querySelector('[data-testid="alley-morph"]')).toBeNull()
  })

  it('More over the room: the clone is gone within 120 ms', async () => {
    const { el, shell } = await mountAlley()
    el('alley-door-sing').click()
    el('alley-enter').click()
    await vi.advanceTimersByTimeAsync(700)
    expect(document.querySelector('[data-testid="alley-morph"]')).not.toBeNull()

    shell.openMore()
    await vi.advanceTimersByTimeAsync(120)
    expect(document.querySelector('[data-testid="alley-morph"]')).toBeNull()
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

describe('the dock', () => {
  it('is watched, and its top is the floor of the band on a screen on its side', async () => {
    vi.stubGlobal('innerWidth', 852)
    vi.stubGlobal('innerHeight', 393)
    let dockTop = 321
    const dock = document.createElement('nav')
    dock.className = 'mp-dock'
    dock.getBoundingClientRect = () =>
      ({ top: dockTop, bottom: 393, left: 0, right: 852 }) as DOMRect
    document.body.appendChild(dock)

    const { el } = await mountAlley()
    const observer = FakeResizeObserver.last
    if (observer === null) throw new Error('no ResizeObserver')
    expect(observer.observed).toContain(dock)
    const bottom = (): number => {
      const key = el('alley-door-guitar')
      return (
        Number.parseFloat(key.style.top) + Number.parseFloat(key.style.height)
      )
    }
    expect(bottom()).toBeLessThanOrEqual(321)

    // The accessory slot grows: the dock's top rises, and the doors with it.
    dockTop = 250
    observer.callback([], observer as unknown as ResizeObserver)
    expect(bottom()).toBeLessThanOrEqual(250)
  })
})

describe('a measure', () => {
  it('writes once for a delivery, and not at all for one that moved nothing', async () => {
    let dockTop = 780
    const dock = document.createElement('nav')
    dock.className = 'mp-dock'
    dock.getBoundingClientRect = () =>
      ({ top: dockTop, bottom: 852, left: 0, right: 393 }) as DOMRect
    document.body.appendChild(dock)
    const { el } = await mountAlley()
    const geometry = await import('./alley-geometry')
    const layouts = vi.mocked(geometry.layoutDoors)
    const observer = FakeResizeObserver.last
    if (observer === null) throw new Error('no ResizeObserver')

    // A rotation-sized change: the root, the headline block and the dock
    // all moved in the one delivery.
    const root = el('rooms-alley')
    Object.defineProperty(root, 'clientWidth', {
      value: 412,
      configurable: true,
    })
    Object.defineProperty(root, 'clientHeight', {
      value: 915,
      configurable: true,
    })
    const block = el('alley-top')
    Object.defineProperty(block, 'offsetHeight', {
      value: 240,
      configurable: true,
    })
    dockTop = 840
    layouts.mockClear()
    observer.callback([], observer as unknown as ResizeObserver)
    expect(layouts).toHaveBeenCalledTimes(1)

    // The same values again (a dock a third of a pixel off rounds to them).
    dockTop = 840.3
    layouts.mockClear()
    observer.callback([], observer as unknown as ResizeObserver)
    expect(layouts).not.toHaveBeenCalled()
  })
})

describe("the Ear Lab's drift", () => {
  it.each([
    [393, 852],
    [852, 393],
  ])('pivots on the door centre at %i x %i', async (w, h) => {
    vi.stubGlobal('innerWidth', w)
    vi.stubGlobal('innerHeight', h)
    const { el } = await mountAlley()
    const ear = el('rooms-alley').querySelector<HTMLElement>(
      '.mp-alley__door[data-door="ear"]',
    )
    const img = ear?.querySelector<HTMLImageElement>('.mp-alley__paint img')
    if (ear === null || ear === undefined || img === null || img === undefined)
      throw new Error('no Ear Lab paint')
    const px = (name: string): number =>
      Number.parseFloat(ear.style.getPropertyValue(name))
    // The origin, taken back to the screen through the img's own offset, is
    // the door's centre.
    expect(Number.parseFloat(img.style.left) + px('--px')).toBeCloseTo(
      px('--cx'),
      1,
    )
    expect(Number.parseFloat(img.style.top) + px('--py')).toBeCloseTo(
      px('--cy'),
      1,
    )
  })
})

describe('each door is its own box', () => {
  it.each([
    [393, 852],
    [852, 393],
  ])(
    'draws every door, rim and spill where the screen quad is, at %i x %i',
    async (w, h) => {
      vi.stubGlobal('innerWidth', w)
      vi.stubGlobal('innerHeight', h)
      const { el } = await mountAlley()
      const alley = el('rooms-alley')
      const plate = el('alley-plate')
      const num = (v: string): number => Number.parseFloat(v)
      const doors = alley.querySelectorAll<HTMLElement>('.mp-alley__door')
      expect(doors).toHaveLength(6)
      for (const door of doors) {
        const key = door.dataset.door ?? ''
        const bx = num(door.style.left)
        const by = num(door.style.top)
        const bw = num(door.style.width)
        const bh = num(door.style.height)
        // The quad's screen bounds, from the door's key button.
        const hit = el(`alley-door-${key}`)
        const x0 = num(hit.style.left)
        const y0 = num(hit.style.top)
        const x1 = x0 + num(hit.style.width)
        const y1 = y0 + num(hit.style.height)
        // A door, not the screen: a lifted door is composited at this size,
        // so the box is the quad, its rim and its spill, and no more.
        const sw0 = num(door.style.getPropertyValue('--sw'))
        expect(bw, key).toBeLessThanOrEqual(Math.max(x1 - x0, sw0) + 10)
        expect(bh, key).toBeLessThanOrEqual(y1 - y0 + 72 + 10)
        expect(bw * bh, key).toBeLessThan((w * h) / 2)
        // The rim, in the box's own coordinates, is back on the quad.
        const rim = door.querySelector('.mp-alley__rim')
        expect(rim?.getAttribute('viewBox'), key).toBe(`0 0 ${bw} ${bh}`)
        const points = (
          rim?.querySelector('.mp-alley__rim-line')?.getAttribute('points') ??
          ''
        )
          .split(' ')
          .map((pair) => pair.split(',').map(Number))
        expect(points, key).toHaveLength(4)
        const xs = points.map((p) => p[0] + bx)
        const ys = points.map((p) => p[1] + by)
        expect(Math.min(...xs), key).toBeCloseTo(x0, 0)
        expect(Math.max(...xs), key).toBeCloseTo(x1, 0)
        expect(Math.min(...ys), key).toBeCloseTo(y0, 0)
        expect(Math.max(...ys), key).toBeCloseTo(y1, 0)
        // The rim's halo fits inside the box.
        expect(Math.min(...points.map((p) => p[0])), key).toBeGreaterThan(2)
        expect(Math.min(...points.map((p) => p[1])), key).toBeGreaterThan(2)
        expect(Math.max(...points.map((p) => p[0])), key).toBeLessThan(bw - 2)
        expect(Math.max(...points.map((p) => p[1])), key).toBeLessThan(bh - 2)
        // The paint's clip is the same local quad.
        expect(
          door.querySelector<HTMLElement>('.mp-alley__paint')?.style.clipPath,
          key,
        ).toBe(
          `polygon(${points.map((p) => `${p[0]}px ${p[1]}px`).join(', ')})`,
        )
        // The paint's plate copy lands on the plate.
        const img = door.querySelector<HTMLImageElement>('.mp-alley__paint img')
        expect(num(img?.style.left ?? '') + bx, key).toBeCloseTo(
          num(plate.style.left),
          1,
        )
        expect(num(img?.style.top ?? '') + by, key).toBeCloseTo(
          num(plate.style.top),
          1,
        )
        // The spill sits on the quad's bottom edge and inside the box.
        const sx = num(door.style.getPropertyValue('--sx'))
        const sy = num(door.style.getPropertyValue('--sy'))
        const sw = num(door.style.getPropertyValue('--sw'))
        expect(sx + bx, key).toBeGreaterThanOrEqual(x0 - 1)
        expect(sx + bx, key).toBeLessThanOrEqual(x1 + 1)
        expect(sy + by, key).toBeGreaterThan((y0 + y1) / 2)
        expect(sy + by, key).toBeLessThanOrEqual(y1 + 1)
        expect(sx - sw / 2, key).toBeGreaterThanOrEqual(0)
        expect(sx + sw / 2, key).toBeLessThanOrEqual(bw)
        expect(sy + 72 * 0.74, key).toBeLessThanOrEqual(bh)
        // The lift turns about the door's centre on screen.
        const cx = num(door.style.getPropertyValue('--cx')) + bx
        const cy = num(door.style.getPropertyValue('--cy')) + by
        expect(cx, key).toBeGreaterThan(x0)
        expect(cx, key).toBeLessThan(x1)
        expect(cy, key).toBeGreaterThan(y0)
        expect(cy, key).toBeLessThan(y1)
      }
    },
  )
})

describe('the plate file', () => {
  it('is the 1x on a DPR 3 screen on its side, where the band draws it small', async () => {
    vi.stubGlobal('innerWidth', 852)
    vi.stubGlobal('innerHeight', 393)
    vi.stubGlobal('devicePixelRatio', 3)
    const { el } = await mountAlley()
    const plateModule = await import('./alley-plate')
    expect(el('alley-plate').getAttribute('src')).toBe(
      plateModule.ALLEY_PLATE.src,
    )
  })
})

describe('the right safe-area inset', () => {
  it('keeps the doors and the tap band clear of it on a screen on its side', async () => {
    vi.stubGlobal('innerWidth', 852)
    vi.stubGlobal('innerHeight', 393)
    const { el } = await mountAlley()
    const root = el('rooms-alley')
    // What mobile-kit.css resolves env(safe-area-inset-right) to. Wide, so
    // the doors' own fit would cross it without the bound.
    root.style.setProperty('--safe-right', '400px')
    const observer = FakeResizeObserver.last
    if (observer === null) throw new Error('no ResizeObserver')
    observer.callback([], observer as unknown as ResizeObserver)

    const right = (key: HTMLElement): number =>
      Number.parseFloat(key.style.left) + Number.parseFloat(key.style.width)
    const keys = [...root.querySelectorAll<HTMLElement>('.mp-alley__key')]
    expect(Math.max(...keys.map(right))).toBeLessThanOrEqual(852 - 400)
    const band = el('alley-hit')
    expect(right(band)).toBeLessThanOrEqual(852 - 400)
  })
})

describe('the Sing door clip', () => {
  it('has a source only while Sing is picked', async () => {
    // A src'd <video>, even paused, is a media pipeline and a metadata read
    // on every visit to the tab. The loop is loaded in the tap that wants it.
    const { el } = await mountAlley()
    const clip = el<HTMLVideoElement>('alley-clip')
    const load = vi.mocked(HTMLMediaElement.prototype.load)
    expect(clip.getAttribute('src')).toBeNull()

    el('alley-door-sing').click()
    expect(clip.getAttribute('src')).toMatch(/\.mp4$/u)
    load.mockClear()
    el('alley-door-karaoke').click()
    expect(clip.getAttribute('src')).toBeNull()
    expect(load.mock.contexts).toContain(clip)

    el('alley-door-sing').click()
    expect(clip.getAttribute('src')).not.toBeNull()
    el('alley-plate').click()
    expect(el('rooms-alley').dataset.phase).toBe('rest')
    expect(clip.getAttribute('src')).toBeNull()
  })

  it('lets go of its source when an open is called off', async () => {
    const { el, nav } = await mountAlley()
    el('alley-door-sing').click()
    const clip = el<HTMLVideoElement>('alley-clip')
    Object.defineProperty(clip, 'paused', { value: false })
    el('alley-enter').click()
    await vi.advanceTimersByTimeAsync(150)

    expect(nav.cancelDoorOpen()).toBe(true)
    expect(clip.closest('[data-testid="alley-morph"]')).toBeNull()
    expect(clip.getAttribute('src')).toBeNull()
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

describe('a door picked, then covered by the shell', () => {
  // The alley stays mounted under the More sheet and a pushed screen: only a
  // tab change unmounts it. The door's ambient and clip played on under
  // Settings for as long as it was up.
  const covers = [
    ['the More sheet', (shell: typeof RunShell) => shell.openMore()],
    [
      'a pushed screen',
      (shell: typeof RunShell) => shell.pushScreen('settings'),
    ],
  ] as const

  for (const [name, cover] of covers) {
    it(`goes back to rest, silent, under ${name}`, async () => {
      const { el, shell, ambientStop } = await mountAlley()
      el('alley-door-sing').click()
      expect(el('rooms-alley').dataset.phase).toBe('alive')
      const clip = el<HTMLVideoElement>('alley-clip')
      const pause = vi.mocked(HTMLMediaElement.prototype.pause)
      pause.mockClear()
      ambientStop().mockClear()

      cover(shell)

      expect(el('rooms-alley').dataset.phase).toBe('rest')
      expect(ambientStop()).toHaveBeenCalledTimes(1)
      expect(pause.mock.contexts).toContain(clip)
      expect(clip.getAttribute('src')).toBeNull()
      expect(el('alley-panel').classList.contains('is-shown')).toBe(false)
    })
  }

  it('reads every overlay the shell draws over a tab as covered', async () => {
    const { shell } = await mountAlley()
    expect(shell.shellCovered()).toBe(false)
    shell.openMore()
    expect(shell.shellCovered()).toBe(true)
    shell.closeMore()
    shell.pushScreen('settings')
    expect(shell.shellCovered()).toBe(true)
    shell.popScreen()
    expect(shell.shellCovered()).toBe(false)
  })
})

describe("the ambient's context", () => {
  it('is let go when the alley unmounts', async () => {
    const { el, ambientMade } = await mountAlley()
    el('alley-door-sing').click()
    const ambient = ambientMade()

    view?.unmount()
    view = null

    expect(ambient.dispose).toHaveBeenCalledTimes(1)
  })

  it('is suspect once the page comes back from the background', async () => {
    const { el, ambientMade } = await mountAlley()
    el('alley-door-sing').click()
    const ambient = ambientMade()
    const visibility = vi.spyOn(document, 'visibilityState', 'get')

    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(ambient.recover).not.toHaveBeenCalled()
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(ambient.recover).toHaveBeenCalledTimes(1)
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
    // Not <body>: the door the card was for.
    expect(document.activeElement).toBe(el('alley-door-sing'))
  })

  it('Back puts a picked door back, as Escape does, and never leaves', async () => {
    const { el, nav } = await mountAlley()
    el('alley-door-sing').click()
    expect(el('rooms-alley').dataset.phase).toBe('alive')
    const back = { canGoBack: true, back: vi.fn(), minimize: vi.fn() }

    expect(nav.performBack(back)).toBe('door-cleared')

    expect(el('rooms-alley').dataset.phase).toBe('rest')
    expect(back.back).not.toHaveBeenCalled()
    expect(back.minimize).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(el('alley-door-sing'))
  })

  it('Escape mid-open calls the open off, as Back does', async () => {
    const { el, store, nav } = await mountAlley()
    el('alley-door-sing').click()
    el('alley-enter').click()
    await vi.advanceTimersByTimeAsync(150)

    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true,
    })
    window.dispatchEvent(escape)

    expect(escape.defaultPrevented).toBe(true)
    expect(el('rooms-alley').dataset.phase).toBe('rest')
    expect(document.querySelector('[data-testid="alley-morph"]')).toBeNull()
    // Enter went with the card at the start of the open: focus goes back to
    // the door that was opening, not left on <body>.
    await vi.advanceTimersByTimeAsync(0)
    expect(document.activeElement).toBe(el('alley-door-sing'))
    expect(store.roomArrivalHeld()).toBe(false)
    await vi.advanceTimersByTimeAsync(2000)
    expect(nav.goToTab).not.toHaveBeenCalled()
  })

  it('Back mid-open gives focus back to the door, as Escape does', async () => {
    const { el, nav } = await mountAlley()
    el('alley-door-sing').click()
    el('alley-enter').click()
    await vi.advanceTimersByTimeAsync(150)
    expect(document.activeElement).toBe(document.body)

    const back = { canGoBack: true, back: vi.fn(), minimize: vi.fn() }
    expect(nav.performBack(back)).toBe('door-open')
    await vi.advanceTimersByTimeAsync(0)
    expect(document.activeElement).toBe(el('alley-door-sing'))
  })

  it('a rail tab calling the open off keeps its own focus', async () => {
    const { el, nav } = await mountAlley()
    el('alley-door-sing').click()
    el('alley-enter').click()
    await vi.advanceTimersByTimeAsync(150)
    const tab = document.createElement('button')
    document.body.appendChild(tab)
    tab.focus()

    // What goToTab does: call the open off, then move the hash.
    nav.cancelDoorOpen()
    window.location.hash = '#/progress'
    await vi.advanceTimersByTimeAsync(0)
    expect(document.activeElement).toBe(tab)
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
