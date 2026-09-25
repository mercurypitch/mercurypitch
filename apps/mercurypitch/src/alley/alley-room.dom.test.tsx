import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RenderedShell } from '../shell/render-for-test'
import type * as ShellNavigation from '../shell/shell-navigation'

// The room's picture is decoded when its door is picked, from the room's own
// background controller, and held until the open that grows it is over. The
// controller, the alley and the held room are module state: every case
// imports a fresh copy of each.

vi.mock('@irchiinnuss/mobile-runtime/platform', () => ({
  hapticTap: vi.fn(async () => undefined),
}))

vi.mock('../shell/shell-navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof ShellNavigation>()),
  goToTab: vi.fn(),
}))

/** The rooms' files jsdom is asked for, at their real sizes. */
const SIZES: Record<string, readonly [number, number]> = {
  '/ear-lab/regulator-room-portrait.webp': [1440, 2560],
  '/ear-lab/regulator-room-landscape.webp': [2048, 1152],
  '/sing/retro-analog-studio-portrait.webp': [1440, 2560],
}

// jsdom decodes nothing and sizes nothing. Here each image decodes when the
// case says so, and has its natural size only once it has.
interface Decode {
  readonly src: string
  readonly image: HTMLImageElement
  readonly succeed: () => void
  readonly fail: () => void
}
let decodes: Decode[] = []
const decoded = new WeakSet<HTMLImageElement>()
const NATIVE = ['decode', 'naturalWidth', 'naturalHeight'].map(
  (name) =>
    [
      name,
      Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, name),
    ] as const,
)

function fakeDecoding(): void {
  decodes = []
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value(this: HTMLImageElement) {
      return new Promise<void>((resolve, reject) => {
        decodes.push({
          src: this.getAttribute('src') ?? '',
          image: this,
          succeed: () => {
            decoded.add(this)
            resolve()
          },
          fail: () => reject(new Error('EncodingError')),
        })
      })
    },
  })
  for (const [axis, name] of ['naturalWidth', 'naturalHeight'].entries()) {
    Object.defineProperty(HTMLImageElement.prototype, name, {
      configurable: true,
      get(this: HTMLImageElement) {
        const size = SIZES[this.getAttribute('src') ?? '']
        return decoded.has(this) && size !== undefined ? size[axis] : 0
      },
    })
  }
}

class FakeResizeObserver {
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

// Every preload a case starts is released after it. A controller still
// retained keeps its resize listener on the window, and the next case's
// rotation would decode for it too.
const cleanups: Array<() => void> = []

/** The room module, and the controller behind a surface with its retain watched. */
async function rooms(surface: 'ear' | 'sing' = 'ear') {
  const room = await import('./alley-room')
  cleanups.push(room.dropRoom)
  const preloadRoom: typeof room.preloadRoom = (spec) => {
    const preload = room.preloadRoom(spec)
    if (preload !== null) cleanups.push(preload.release)
    return preload
  }
  const plate = await import('./alley-plate')
  const surfaces = await import('@/lib/backgrounds/background-surface')
  const controller = surfaces.backgroundSurfaceController(surface)
  const real = controller.retain
  const letGo = vi.fn()
  const retain = vi
    .spyOn(controller, 'retain')
    .mockImplementation((options) => {
      const release = real(options)
      return () => {
        letGo()
        release()
      }
    })
  return { room: { ...room, preloadRoom }, plate, controller, retain, letGo }
}

const settle = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0)
}

let view: RenderedShell | null = null

beforeEach(() => {
  vi.resetModules()
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
  fakeDecoding()
})

afterEach(() => {
  view?.unmount()
  view = null
  for (const cleanup of cleanups.splice(0)) cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  for (const [name, descriptor] of NATIVE) {
    if (descriptor === undefined) {
      delete (HTMLImageElement.prototype as unknown as Record<string, unknown>)[
        name
      ]
    } else {
      Object.defineProperty(HTMLImageElement.prototype, name, descriptor)
    }
  }
  document.body.innerHTML = ''
})

describe("a door's room picture", () => {
  it("is the one the room will draw, from the room's own controller", async () => {
    const { room, plate, controller, retain } = await rooms('ear')
    const preload = room.preloadRoom(plate.doorSpec('ear'))

    expect(retain).toHaveBeenCalledTimes(1)
    // No premium catalogue request of its own on a door tap.
    expect(retain).toHaveBeenCalledWith({ premiumCatalog: false })
    expect(decodes.map((d) => d.src)).toEqual([controller.resolved().url])
    expect(controller.resolved().url).toBe(
      '/ear-lab/regulator-room-portrait.webp',
    )
    // Nothing is offered before it has decoded.
    expect(preload?.source().now).toBeNull()

    decodes[0].succeed()
    await settle()
    expect(preload?.source().now).toEqual({
      image: decodes[0].image,
      src: '/ear-lab/regulator-room-portrait.webp',
      width: 1440,
      height: 2560,
      focus: [0.5, 0.42],
      scale: 1.012,
    })
    await expect(preload?.source().later).resolves.toBe(preload?.source().now)
  })

  it("follows the room's choice: turned on its side, the other file", async () => {
    const { room, plate } = await rooms('ear')
    const preload = room.preloadRoom(plate.doorSpec('ear'))
    decodes[0].succeed()
    await settle()

    vi.stubGlobal('innerWidth', 852)
    vi.stubGlobal('innerHeight', 393)
    window.dispatchEvent(new Event('resize'))

    expect(decodes.map((d) => d.src)).toEqual([
      '/ear-lab/regulator-room-portrait.webp',
      '/ear-lab/regulator-room-landscape.webp',
    ])
    // The portrait file is not what the room will draw any more.
    expect(preload?.source().now).toBeNull()
    decodes[1].succeed()
    await settle()
    expect(preload?.source().now?.src).toBe(
      '/ear-lab/regulator-room-landscape.webp',
    )
    expect(preload?.source().now?.width).toBe(2048)
  })

  it('never offers a picture that would not decode', async () => {
    const { room, plate } = await rooms('ear')
    const preload = room.preloadRoom(plate.doorSpec('ear'))
    decodes[0].fail()
    await settle()
    expect(preload?.source().now).toBeNull()
    await expect(preload?.source().later).resolves.toBeNull()
  })

  it('holds the controller until released, and lets it go once', async () => {
    const { room, plate, letGo } = await rooms('ear')
    const preload = room.preloadRoom(plate.doorSpec('ear'))
    expect(letGo).not.toHaveBeenCalled()
    preload?.release()
    preload?.release()
    expect(letGo).toHaveBeenCalledTimes(1)
    // Released, it stops following the room: a rotation decodes nothing.
    vi.stubGlobal('innerWidth', 852)
    vi.stubGlobal('innerHeight', 393)
    window.dispatchEvent(new Event('resize'))
    expect(decodes).toHaveLength(1)
  })

  it('is nothing for a door with no room behind it yet', async () => {
    const { room, plate, retain } = await rooms('ear')
    expect(room.preloadRoom(plate.doorSpec('karaoke'))).toBeNull()
    expect(retain).not.toHaveBeenCalled()
    expect(decodes).toHaveLength(0)
  })
})

describe('the picked door, and the open that takes its room over', () => {
  it('picks once per door, and a second door lets the first go', async () => {
    const ear = await rooms('ear')
    const surfaces = await import('@/lib/backgrounds/background-surface')
    const sing = surfaces.backgroundSurfaceController('sing')
    const singRetain = vi.spyOn(sing, 'retain')

    ear.room.pickRoom(ear.plate.doorSpec('ear'))
    ear.room.pickRoom(ear.plate.doorSpec('ear'))
    expect(ear.retain).toHaveBeenCalledTimes(1)
    expect(decodes).toHaveLength(1)

    ear.room.pickRoom(ear.plate.doorSpec('sing'))
    expect(ear.letGo).toHaveBeenCalledTimes(1)
    expect(singRetain).toHaveBeenCalledTimes(1)
    expect(decodes.map((d) => d.src)).toEqual([
      '/ear-lab/regulator-room-portrait.webp',
      '/sing/retro-analog-studio-portrait.webp',
    ])
    expect(ear.room.heldRoom()).toBe('sing')
  })

  it('hands the picked room to the open, and dropping the door after that lets nothing go', async () => {
    const { room, plate, retain, letGo } = await rooms('ear')
    room.pickRoom(plate.doorSpec('ear'))
    const taken = room.takeRoom(plate.doorSpec('ear'))
    expect(retain).toHaveBeenCalledTimes(1)
    expect(taken?.key).toBe('ear')
    expect(room.heldRoom()).toBeNull()

    room.dropRoom()
    expect(letGo).not.toHaveBeenCalled()
    taken?.release()
    expect(letGo).toHaveBeenCalledTimes(1)
  })

  it('starts the picture on Enter for a door that was never picked', async () => {
    const { room, plate, retain } = await rooms('ear')
    const taken = room.takeRoom(plate.doorSpec('ear'))
    expect(retain).toHaveBeenCalledTimes(1)
    expect(taken?.source().now).toBeNull()
    expect(decodes.map((d) => d.src)).toEqual([
      '/ear-lab/regulator-room-portrait.webp',
    ])
  })
})

describe('through the alley', () => {
  async function mountAlley() {
    const watched = await rooms('ear')
    const alley = await import('./RoomsAlley')
    const { renderShell } = await import('../shell/render-for-test')
    const nav = await import('../shell/shell-navigation')
    const Alley = alley.RoomsAlley
    view = renderShell(() => <Alley />)
    const el = (testid: string): HTMLElement => {
      const found = document.querySelector<HTMLElement>(
        `[data-testid="${testid}"]`,
      )
      if (found === null) throw new Error(`${testid}?`)
      return found
    }
    const clone = (): HTMLElement | null =>
      document.querySelector('[data-testid="alley-morph"]')
    return { ...watched, el, nav, clone }
  }

  it('picking the Ear Lab starts decoding its room, and Enter grows that picture', async () => {
    const { el, clone } = await mountAlley()
    el('alley-door-ear').click()
    expect(decodes.map((d) => d.src)).toEqual([
      '/ear-lab/regulator-room-portrait.webp',
    ])
    decodes[0].succeed()
    await settle()

    el('alley-enter').click()
    const morph = clone()
    expect(morph?.dataset.room).toBe('in')
    expect(morph?.querySelector('[data-testid="alley-morph-room"]')).toBe(
      decodes[0].image,
    )
  })

  it('a door entered before its picture decoded grows the plate, and waits for it', async () => {
    const { el, clone } = await mountAlley()
    el('alley-door-ear').click()
    el('alley-enter').click()
    expect(clone()?.dataset.room).toBe('waiting')
    expect(
      clone()?.querySelector('[data-testid="alley-morph-room"]'),
    ).toBeNull()

    decodes[0].succeed()
    await settle()
    expect(clone()?.querySelector('[data-testid="alley-morph-room"]')).toBe(
      decodes[0].image,
    )
  })

  it('a locked door holds no room', async () => {
    const { el, retain } = await mountAlley()
    el('alley-door-karaoke').click()
    expect(retain).not.toHaveBeenCalled()
    expect(decodes).toHaveLength(0)
  })

  it('a door put back lets its room go', async () => {
    const { el, letGo } = await mountAlley()
    el('alley-door-ear').click()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(el('rooms-alley').dataset.phase).toBe('rest')
    expect(letGo).toHaveBeenCalledTimes(1)
  })

  it('the room is held through the whole open, and let go once the clone is gone', async () => {
    const { el, letGo, nav, clone } = await mountAlley()
    el('alley-door-ear').click()
    decodes[0].succeed()
    await settle()
    el('alley-enter').click()

    await vi.advanceTimersByTimeAsync(700)
    expect(nav.goToTab).toHaveBeenCalled()
    expect(clone()?.dataset.phase).toBe('covered')
    expect(letGo).not.toHaveBeenCalled()

    // No room mounts here: the clone waits out the room's background, fades,
    // and only then is the room's controller let go.
    await vi.advanceTimersByTimeAsync(2500)
    expect(clone()).toBeNull()
    expect(letGo).toHaveBeenCalledTimes(1)
  })

  it('an open called off lets its room go', async () => {
    const { el, letGo, nav } = await mountAlley()
    el('alley-door-ear').click()
    el('alley-enter').click()
    await vi.advanceTimersByTimeAsync(150)
    expect(nav.cancelDoorOpen()).toBe(true)
    await settle()
    expect(letGo).toHaveBeenCalledTimes(1)
  })

  it('the alley leaving with a door picked lets its room go', async () => {
    const { el, letGo } = await mountAlley()
    el('alley-door-ear').click()
    view?.unmount()
    view = null
    expect(letGo).toHaveBeenCalledTimes(1)
  })
})
