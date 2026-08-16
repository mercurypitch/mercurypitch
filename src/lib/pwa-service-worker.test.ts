import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as PwaServiceWorker from './pwa-service-worker'
import { BUILD_ID_MESSAGE, SKIP_WAITING_MESSAGE, STALE_BUILD_MESSAGE, UNKNOWN_BUILD_ID, } from './sw-runtime'

// The question this module answers is "does the user see a reload prompt", and
// it used to answer it wrong: it prompted whenever a worker was waiting, even
// when the page was already running that worker's build, so accepting reloaded
// to an identical app. The build-id handshake is what these cases are about.

const PAGE_BUILD = 'abc1234'

/** Registration state is module-level; each case gets its own module. */
async function freshModule(): Promise<typeof PwaServiceWorker> {
  vi.resetModules()
  return import('./pwa-service-worker')
}

class FakeWorker extends EventTarget {
  state: ServiceWorkerState = 'installing'
  readonly received: unknown[] = []

  constructor(private readonly buildId: string | null = null) {
    super()
  }

  postMessage(data: unknown, transfer?: Transferable[]): void {
    this.received.push(data)
    const type =
      typeof data === 'object' && data !== null
        ? (data as { type?: unknown }).type
        : undefined
    if (type !== BUILD_ID_MESSAGE || this.buildId === null) return
    const port = transfer?.[0] as MessagePort | undefined
    port?.postMessage({ type: BUILD_ID_MESSAGE, buildId: this.buildId })
  }

  install(): void {
    this.state = 'installed'
    this.dispatchEvent(new Event('statechange'))
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null
  waiting: FakeWorker | null = null
  readonly update = vi.fn(async () => Promise.resolve(undefined))
  readonly unregister = vi.fn(async () => Promise.resolve(true))

  /** What the browser does when a new worker finishes installing. */
  announceInstalled(worker: FakeWorker): void {
    this.installing = worker
    this.dispatchEvent(new Event('updatefound'))
    this.waiting = worker
    worker.install()
  }
}

class FakeContainer extends EventTarget {
  controller: FakeWorker | null = null
  readonly registration = new FakeRegistration()
  readonly register = vi.fn(async () => Promise.resolve(this.registration))
  readonly getRegistration = vi.fn(
    async (): Promise<FakeRegistration | undefined> =>
      Promise.resolve(this.registration),
  )
}

/** The cast every call site needs; the fakes cover what the module touches. */
function asContainer(container: FakeContainer): ServiceWorkerContainer {
  return container as unknown as ServiceWorkerContainer
}

interface Setup {
  container: FakeContainer
  registration: FakeRegistration
  onUpdateReady: ReturnType<typeof vi.fn>
  reload: ReturnType<typeof vi.fn>
  applyUpdate: () => void
}

async function register(
  options: {
    waiting?: FakeWorker | null
    controlled?: boolean
    buildId?: string
  } = {},
): Promise<Setup & { module: typeof PwaServiceWorker }> {
  const module = await freshModule()
  const container = new FakeContainer()
  if (options.controlled !== false) container.controller = new FakeWorker()
  if (options.waiting !== undefined)
    container.registration.waiting = options.waiting

  const onUpdateReady = vi.fn()
  const reload = vi.fn()
  module.registerServiceWorker({
    enabled: true,
    buildId: options.buildId ?? PAGE_BUILD,
    container: container as unknown as ServiceWorkerContainer,
    reload,
    onUpdateReady,
  })
  // register() resolves on a microtask; nothing is wired up before it does.
  await Promise.resolve()
  await Promise.resolve()

  return {
    module,
    container,
    registration: container.registration,
    onUpdateReady,
    reload,
    applyUpdate: () => {
      const call = onUpdateReady.mock.calls[0]
      ;(call?.[0] as () => void)()
    },
  }
}

/** Let a MessageChannel round-trip and the promise chain behind it settle. */
async function settle(): Promise<void> {
  for (let i = 0; i < 6; i += 1) await new Promise((r) => setTimeout(r, 0))
}

describe('registration', () => {
  it('does nothing under vite dev, where there is no dist/sw.js', async () => {
    const module = await freshModule()
    const container = new FakeContainer()

    module.registerServiceWorker({
      enabled: false,
      container: container as unknown as ServiceWorkerContainer,
    })
    await settle()

    expect(container.register).not.toHaveBeenCalled()
  })

  it('does nothing in a browser with no service worker support', async () => {
    const module = await freshModule()
    expect(() => {
      module.registerServiceWorker({ enabled: true })
    }).not.toThrow()
  })

  it('stays off unless the build says the worker exists', async () => {
    const module = await freshModule()
    const container = new FakeContainer()
    Object.defineProperty(navigator, 'serviceWorker', {
      value: container,
      configurable: true,
    })

    // No `enabled`, so it falls back to `__SW_ENABLED__`, which no test build
    // defines — the same state as `vite dev`.
    module.registerServiceWorker({})
    await settle()

    expect(container.register).not.toHaveBeenCalled()
    Reflect.deleteProperty(navigator, 'serviceWorker')
  })

  it('registers by default in a real build, where the worker exists', async () => {
    const module = await freshModule()
    const container = new FakeContainer()
    Object.defineProperty(navigator, 'serviceWorker', {
      value: container,
      configurable: true,
    })
    // What Vite's define does to every built bundle.
    Object.defineProperty(globalThis, '__SW_ENABLED__', {
      value: true,
      configurable: true,
    })

    module.registerServiceWorker({})
    await settle()

    expect(container.register).toHaveBeenCalledTimes(1)
    Reflect.deleteProperty(globalThis, '__SW_ENABLED__')
    Reflect.deleteProperty(navigator, 'serviceWorker')
  })

  it('uses the browser’s own container when none is passed in', async () => {
    const module = await freshModule()
    const container = new FakeContainer()
    Object.defineProperty(navigator, 'serviceWorker', {
      value: container,
      configurable: true,
    })

    module.registerServiceWorker({ enabled: true })
    await settle()

    expect(container.register).toHaveBeenCalledTimes(1)
    Reflect.deleteProperty(navigator, 'serviceWorker')
  })

  it('reloads the page for real when no reload seam is given', async () => {
    const reload = vi.fn()
    const location = Object.getOwnPropertyDescriptor(window, 'location')
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      configurable: true,
    })
    try {
      const module = await freshModule()
      const container = new FakeContainer()
      container.controller = new FakeWorker()
      container.registration.waiting = new FakeWorker('99f00d1')
      const onUpdateReady = vi.fn()
      module.registerServiceWorker({
        enabled: true,
        buildId: PAGE_BUILD,
        container: container as unknown as ServiceWorkerContainer,
        onUpdateReady,
      })
      await settle()

      // Accept with the worker already gone, which reloads without waiting for
      // a controllerchange that will never come.
      container.registration.waiting = null
      ;(onUpdateReady.mock.calls[0]?.[0] as () => void)()

      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      if (location !== undefined) {
        Object.defineProperty(window, 'location', location)
      }
    }
  })

  it('registers at the origin root and never from the HTTP cache', async () => {
    const { container } = await register()

    expect(container.register).toHaveBeenCalledWith('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    })
  })

  it('waits for load when the document is still parsing', async () => {
    const module = await freshModule()
    const container = new FakeContainer()
    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      configurable: true,
    })

    module.registerServiceWorker({
      enabled: true,
      container: container as unknown as ServiceWorkerContainer,
    })
    expect(container.register).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('load'))
    expect(container.register).toHaveBeenCalledTimes(1)

    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      configurable: true,
    })
  })

  it('keeps the app alive when registration fails', async () => {
    const module = await freshModule()
    const container = new FakeContainer()
    container.register.mockRejectedValueOnce(new Error('insecure context'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    module.registerServiceWorker({
      enabled: true,
      container: container as unknown as ServiceWorkerContainer,
    })
    await settle()

    expect(warn).toHaveBeenCalledWith(
      'pwa-service-worker: registration failed',
      expect.any(Error),
    )
    warn.mockRestore()
  })
})

describe('the update prompt', () => {
  it('says nothing on a first-ever install', async () => {
    const waiting = new FakeWorker('9999999')
    const { onUpdateReady } = await register({
      waiting,
      controlled: false,
    })
    await settle()

    expect(onUpdateReady).not.toHaveBeenCalled()
  })

  it('prompts when the waiting worker carries a different build', async () => {
    const { onUpdateReady } = await register({
      waiting: new FakeWorker('99f00d1'),
    })
    await settle()

    expect(onUpdateReady).toHaveBeenCalledTimes(1)
  })

  it('adopts a worker built from the commit the page is running, silently', async () => {
    const waiting = new FakeWorker(PAGE_BUILD)
    const { onUpdateReady, reload } = await register({ waiting })
    await settle()

    expect(onUpdateReady).not.toHaveBeenCalled()
    expect(waiting.received).toEqual([
      { type: BUILD_ID_MESSAGE },
      { type: SKIP_WAITING_MESSAGE },
    ])
    // Adopting is not reloading — the page is already running this build.
    expect(reload).not.toHaveBeenCalled()
  })

  it('prompts when neither side knows which build it is', async () => {
    const waiting = new FakeWorker(UNKNOWN_BUILD_ID)
    const { onUpdateReady } = await register({
      waiting,
      buildId: UNKNOWN_BUILD_ID,
    })
    await settle()

    expect(onUpdateReady).toHaveBeenCalledTimes(1)
  })

  it('prompts when the waiting worker is too old to answer', async () => {
    vi.useFakeTimers()
    try {
      const waiting = new FakeWorker(null)
      const { onUpdateReady } = await register({ waiting })
      await vi.advanceTimersByTimeAsync(2_000)

      expect(onUpdateReady).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('prompts when a worker installs while the page is open', async () => {
    const { registration, onUpdateReady } = await register()
    expect(onUpdateReady).not.toHaveBeenCalled()

    registration.announceInstalled(new FakeWorker('99f00d1'))
    await settle()

    expect(onUpdateReady).toHaveBeenCalledTimes(1)
  })

  it('asks once per waiting worker, however often the browser fires', async () => {
    const waiting = new FakeWorker('99f00d1')
    const { registration, onUpdateReady } = await register({ waiting })
    await settle()

    registration.announceInstalled(waiting)
    await settle()

    expect(onUpdateReady).toHaveBeenCalledTimes(1)
  })

  it('prompts without a handshake if the worker activated on its own', async () => {
    const { registration, onUpdateReady } = await register()
    const installing = new FakeWorker('99f00d1')
    registration.installing = installing
    registration.dispatchEvent(new Event('updatefound'))
    // Installed, but already gone from `waiting` — another tab accepted first.
    installing.install()
    await settle()

    expect(onUpdateReady).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['an answer with no build in it', { type: BUILD_ID_MESSAGE }],
    ['an answer that is not a message at all', 'pong'],
  ])('prompts on %s', async (_label, answer) => {
    class MuteWorker extends FakeWorker {
      override postMessage(data: unknown, transfer?: Transferable[]): void {
        super.postMessage(data, transfer)
        const port = transfer?.[0] as MessagePort | undefined
        port?.postMessage(answer)
      }
    }
    const { onUpdateReady } = await register({ waiting: new MuteWorker() })
    await settle()

    expect(onUpdateReady).toHaveBeenCalledTimes(1)
  })

  it('prompts when the waiting worker cannot be reached at all', async () => {
    class DeadWorker extends FakeWorker {
      override postMessage(): void {
        throw new DOMException('worker is redundant', 'InvalidStateError')
      }
    }
    const { onUpdateReady } = await register({ waiting: new DeadWorker() })
    await settle()

    expect(onUpdateReady).toHaveBeenCalledTimes(1)
  })

  it('ignores an answer that arrives after it gave up', async () => {
    vi.useFakeTimers()
    try {
      let reply: (() => void) | null = null
      class SlowWorker extends FakeWorker {
        override postMessage(data: unknown, transfer?: Transferable[]): void {
          super.postMessage(data, transfer)
          const port = transfer?.[0] as MessagePort | undefined
          reply = () => {
            port?.postMessage({ type: BUILD_ID_MESSAGE, buildId: PAGE_BUILD })
          }
        }
      }
      const { onUpdateReady } = await register({ waiting: new SlowWorker() })
      await vi.advanceTimersByTimeAsync(2_000)
      expect(onUpdateReady).toHaveBeenCalledTimes(1)

      // The same build id, arriving late, must not now un-prompt or re-prompt.
      ;(reply as (() => void) | null)?.()
      await vi.advanceTimersByTimeAsync(100)

      expect(onUpdateReady).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('waits for the new worker to finish installing before it says anything', async () => {
    const { registration, onUpdateReady } = await register()
    const installing = new FakeWorker('99f00d1')
    registration.installing = installing
    registration.dispatchEvent(new Event('updatefound'))

    // Still downloading: a state change is not the same as being ready.
    installing.dispatchEvent(new Event('statechange'))
    await settle()
    expect(onUpdateReady).not.toHaveBeenCalled()

    registration.waiting = installing
    installing.install()
    await settle()
    expect(onUpdateReady).toHaveBeenCalledTimes(1)
  })

  it('ignores an updatefound with nothing installing behind it', async () => {
    const { registration, onUpdateReady } = await register()

    registration.dispatchEvent(new Event('updatefound'))
    await settle()

    expect(onUpdateReady).not.toHaveBeenCalled()
  })

  it('is never raised when no handler was passed', async () => {
    const module = await freshModule()
    const container = new FakeContainer()
    container.controller = new FakeWorker()
    const waiting = new FakeWorker('99f00d1')
    container.registration.waiting = waiting

    module.registerServiceWorker({
      enabled: true,
      container: container as unknown as ServiceWorkerContainer,
    })
    await settle()

    expect(waiting.received).toEqual([])
  })
})

describe('accepting the update', () => {
  it('adopts the waiting worker and reloads once it has taken over', async () => {
    const waiting = new FakeWorker('99f00d1')
    const { container, applyUpdate, reload } = await register({ waiting })
    await settle()

    applyUpdate()
    // Preceded by the build-id probe that decided to prompt in the first place.
    expect(waiting.received).toEqual([
      { type: BUILD_ID_MESSAGE },
      { type: SKIP_WAITING_MESSAGE },
    ])
    expect(reload).not.toHaveBeenCalled()

    container.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledTimes(1)

    // A second controllerchange must not reload a page that is already going.
    container.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads anyway when another tab took the update first', async () => {
    const { registration, applyUpdate, reload } = await register({
      waiting: new FakeWorker('99f00d1'),
    })
    await settle()

    registration.waiting = null
    applyUpdate()

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload a tab whose user never accepted', async () => {
    const { container, reload } = await register({
      waiting: new FakeWorker('99f00d1'),
    })
    await settle()

    container.dispatchEvent(new Event('controllerchange'))

    expect(reload).not.toHaveBeenCalled()
  })
})

describe('finding out the build is gone', () => {
  function staleNotice(): MessageEvent {
    return new MessageEvent('message', {
      data: { type: STALE_BUILD_MESSAGE, path: '/assets/index-D3adB33f.js' },
    })
  }

  it('checks for an update as soon as the worker reports a stale request', async () => {
    const { container, registration } = await register()
    registration.update.mockClear()

    container.dispatchEvent(staleNotice())

    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('does not hammer the origin when a broken deploy reports a burst', async () => {
    const { container, registration } = await register()
    registration.update.mockClear()

    container.dispatchEvent(staleNotice())
    container.dispatchEvent(staleNotice())
    container.dispatchEvent(staleNotice())

    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('ignores any other message the worker sends', async () => {
    const { container, registration } = await register()
    registration.update.mockClear()

    container.dispatchEvent(
      new MessageEvent('message', { data: { type: 'something-else' } }),
    )
    container.dispatchEvent(new MessageEvent('message', { data: 'hello' }))

    expect(registration.update).not.toHaveBeenCalled()
  })

  it('lets a failure inside the page ask for the same check', async () => {
    const { module, registration } = await register()
    registration.update.mockClear()

    module.requestUpdateCheck()

    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('is a no-op before anything is registered', async () => {
    const module = await freshModule()
    expect(() => {
      module.requestUpdateCheck()
    }).not.toThrow()
  })

  it('survives an update check the browser refuses', async () => {
    const { module, registration } = await register()
    registration.update.mockClear()
    registration.update.mockRejectedValueOnce(new Error('offline'))

    expect(() => {
      module.requestUpdateCheck()
    }).not.toThrow()
    await settle()
  })
})

describe('the foreground re-check', () => {
  const originalVisibility = Object.getOwnPropertyDescriptor(
    Document.prototype,
    'visibilityState',
  )

  function setVisibility(state: DocumentVisibilityState): void {
    Object.defineProperty(document, 'visibilityState', {
      value: state,
      configurable: true,
    })
  }

  beforeEach(() => {
    setVisibility('visible')
  })

  afterEach(() => {
    if (originalVisibility !== undefined) {
      Object.defineProperty(document, 'visibilityState', originalVisibility)
    }
  })

  it('ignores a tab going away', async () => {
    const { registration } = await register()
    registration.update.mockClear()
    setVisibility('hidden')

    document.dispatchEvent(new Event('visibilitychange'))

    expect(registration.update).not.toHaveBeenCalled()
  })

  it('does not re-check a tab that was only away for a moment', async () => {
    const { registration } = await register()
    registration.update.mockClear()

    document.dispatchEvent(new Event('visibilitychange'))

    expect(registration.update).not.toHaveBeenCalled()
  })

  it('re-checks a tab left open across the interval', async () => {
    vi.useFakeTimers()
    try {
      const { registration } = await register()
      registration.update.mockClear()
      await vi.advanceTimersByTimeAsync(16 * 60_000)

      document.dispatchEvent(new Event('visibilitychange'))

      expect(registration.update).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

// The dev incident of 2026-08-16: a stale build's chunks 404 into the SPA
// fallback, the app crashes, and the crash screen's plain location.reload()
// re-serves the very same dead shell from the worker's precache — forever.
// reloadToLatest is the reload that cannot get stuck like that.
describe('reloadToLatest — the reload that escapes the worker cache', () => {
  it('adopts a waiting worker and reloads once it takes control', async () => {
    const module = await freshModule()
    const container = new FakeContainer()
    const waiting = new FakeWorker()
    container.registration.waiting = waiting
    const reload = vi.fn()

    const done = module.reloadToLatest({
      container: asContainer(container),
      reload,
    })
    await settle()

    expect(waiting.received).toContainEqual({ type: SKIP_WAITING_MESSAGE })
    // Not yet: the reload must wait for the matching HTML and chunk map.
    expect(reload).not.toHaveBeenCalled()

    container.dispatchEvent(new Event('controllerchange'))
    await done

    expect(reload).toHaveBeenCalledTimes(1)
    // The graceful path keeps the registration — nothing needed unregistering.
    expect(container.registration.unregister).not.toHaveBeenCalled()
  })

  it('unregisters before reloading when there is nothing newer to adopt', async () => {
    const module = await freshModule()
    const container = new FakeContainer()
    const reload = vi.fn()

    await module.reloadToLatest({
      container: asContainer(container),
      reload,
    })

    // Order matters: unregister first, so the next navigation is not claimed
    // by the worker whose cache is the problem.
    expect(container.registration.unregister).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('keeps the registration when offline — the cache is all there is', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    })
    try {
      const module = await freshModule()
      const container = new FakeContainer()
      const reload = vi.fn()

      await module.reloadToLatest({
        container: asContainer(container),
        reload,
      })

      expect(container.registration.unregister).not.toHaveBeenCalled()
      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      Reflect.deleteProperty(navigator, 'onLine')
    }
  })

  it('falls back to unregistering when the adopted worker never takes over', async () => {
    vi.useFakeTimers()
    try {
      const module = await freshModule()
      const container = new FakeContainer()
      container.registration.waiting = new FakeWorker()
      const reload = vi.fn()

      const done = module.reloadToLatest({
        container: asContainer(container),
        reload,
      })
      await vi.advanceTimersByTimeAsync(5_000)
      await done

      expect(container.registration.unregister).toHaveBeenCalledTimes(1)
      expect(reload).toHaveBeenCalledTimes(1)

      // The worker taking over late must not fire a second reload.
      container.dispatchEvent(new Event('controllerchange'))
      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reloads plainly when nothing is registered', async () => {
    const module = await freshModule()
    const container = new FakeContainer()
    container.getRegistration.mockResolvedValueOnce(undefined)
    const reload = vi.fn()

    await module.reloadToLatest({ container: asContainer(container), reload })

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads plainly when the container cannot be asked', async () => {
    const module = await freshModule()
    const container = new FakeContainer()
    container.getRegistration.mockRejectedValueOnce(new Error('gone'))
    const reload = vi.fn()

    await module.reloadToLatest({ container: asContainer(container), reload })

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('still reloads when unregistering itself fails', async () => {
    const module = await freshModule()
    const container = new FakeContainer()
    container.registration.unregister.mockRejectedValueOnce(new Error('no'))
    const reload = vi.fn()

    await module.reloadToLatest({
      container: asContainer(container),
      reload,
    })

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('never reloads twice, however often it is asked', async () => {
    const module = await freshModule()
    const container = new FakeContainer()
    const reload = vi.fn()

    await module.reloadToLatest({
      container: asContainer(container),
      reload,
    })
    await module.reloadToLatest({
      container: asContainer(container),
      reload,
    })

    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('after the update is accepted', () => {
  it('does not raise a second prompt while the swap is in flight', async () => {
    // Seen on dev 2026-08-16: a second deploy's worker finished installing in
    // the moment between clicking Reload and the page actually reloading, and
    // a fresh prompt popped over the swap it was about to interrupt.
    const { registration, onUpdateReady, applyUpdate } = await register({
      waiting: new FakeWorker('99f00d1'),
    })
    await settle()
    expect(onUpdateReady).toHaveBeenCalledTimes(1)

    applyUpdate()
    registration.announceInstalled(new FakeWorker('beef002'))
    await settle()

    expect(onUpdateReady).toHaveBeenCalledTimes(1)
  })
})

describe('reloadToLatest with no seams', () => {
  it('falls back to a real reload when the browser has no worker support', async () => {
    const reload = vi.fn()
    const location = Object.getOwnPropertyDescriptor(window, 'location')
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      configurable: true,
    })
    try {
      const module = await freshModule()
      // jsdom has no navigator.serviceWorker: the container default resolves
      // to undefined and the plain-reload rung is all that is left.
      await module.reloadToLatest()
      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      if (location !== undefined)
        Object.defineProperty(window, 'location', location)
    }
  })

  it('finds the browser\u2019s own container when none is passed in', async () => {
    const reload = vi.fn()
    const location = Object.getOwnPropertyDescriptor(window, 'location')
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      configurable: true,
    })
    const container = new FakeContainer()
    Object.defineProperty(navigator, 'serviceWorker', {
      value: container,
      configurable: true,
    })
    try {
      const module = await freshModule()
      await module.reloadToLatest()

      expect(container.getRegistration).toHaveBeenCalledTimes(1)
      expect(container.registration.unregister).toHaveBeenCalledTimes(1)
      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      Reflect.deleteProperty(navigator, 'serviceWorker')
      if (location !== undefined)
        Object.defineProperty(window, 'location', location)
    }
  })
})
