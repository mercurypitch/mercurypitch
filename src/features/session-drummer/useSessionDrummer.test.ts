// Controller tests keep transport admission, cancellation and persisted intent separate.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarSessionAudioGraph } from '@/features/guitar/backing/guitar-session-audio-graph'
import type { SubscribeSessionBeat } from '@/lib/session-beat-clock'
import type { SessionDrummerEngineOptions } from './session-drummer-engine'
import type { SessionDrummerSettings } from './session-drummer-pattern'
import { DRUMMER_STORAGE_KEY } from './session-drummer-pattern'
import { useSessionDrummer } from './useSessionDrummer'

const mocked = vi.hoisted(() => ({
  options: null as SessionDrummerEngineOptions | null,
  engine: {
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
    accept: vi.fn(),
    update: vi.fn(),
    setLevel: vi.fn(),
    snapshot: vi.fn(() => null),
  },
}))
vi.mock('./session-drummer-engine', () => ({
  createSessionDrummerEngine: (options: SessionDrummerEngineOptions) => {
    mocked.options = options
    return mocked.engine
  },
}))
const disposers: Array<() => void> = []
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mocked.engine.start.mockImplementation(
    async (settings: SessionDrummerSettings) => {
      mocked.options?.onApplied(settings)
      return true
    },
  )
})
afterEach(() => disposers.splice(0).forEach((dispose) => dispose()))

function fixture(follow = false) {
  return createRoot((dispose) => {
    disposers.push(dispose)
    const unsubscribe = vi.fn()
    const subscribe: SubscribeSessionBeat = vi.fn(() => unsubscribe)
    const [clock, setClock] = createSignal<SubscribeSessionBeat | null>(
      follow ? subscribe : null,
    )
    const [running, setRunning] = createSignal(false)
    const [reason, setReason] = createSignal<string | null>(null)
    const graph = {} as GuitarSessionAudioGraph
    const activateGraph = vi.fn(async () => graph)
    let openAtHostStart: boolean | null = null
    const startHost = vi.fn(() => {
      openAtHostStart = controller.open()
      setRunning(true)
    })
    const controller = useSessionDrummer({
      activateGraph,
      clock,
      tempo: () => 120,
      running,
      startHost,
      unavailableReason: reason,
    })
    return {
      controller,
      activateGraph,
      graph,
      setClock,
      setRunning,
      setReason,
      startHost,
      unsubscribe,
      openAtHostStart: () => openAtHostStart,
    }
  })
}

describe('session drummer UI lifecycle', () => {
  it('persists only choices and never starts audio from opening or changing a picker', () => {
    const f = fixture()
    f.controller.setOpen(true)
    f.controller.change({ bars: 16, kitId: 'crocell' })
    expect(f.activateGraph).not.toHaveBeenCalled()
    expect(mocked.engine.start).not.toHaveBeenCalled()
    expect(
      JSON.parse(localStorage.getItem(DRUMMER_STORAGE_KEY)!),
    ).toMatchObject({ bars: 16, kitId: 'crocell' })
    expect(f.controller.armed()).toBe(false)
  })
  it('applies level immediately without offering an unnecessary boundary confirmation', async () => {
    const f = fixture()
    await f.controller.start()
    f.controller.setLevel(1.2)
    expect(mocked.engine.setLevel).toHaveBeenCalledWith(1.2)
    expect(f.controller.active()?.level).toBe(1.2)
    expect(f.controller.changed()).toBe(false)
    f.controller.change({ bars: 16 })
    expect(f.controller.changed()).toBe(true)
  })
  it('closes the picker before calling the host Play/Listening lifecycle', async () => {
    const f = fixture(true)
    f.controller.setOpen(true)
    await f.controller.start()
    expect(f.startHost).toHaveBeenCalledOnce()
    expect(f.openAtHostStart()).toBe(false)
    expect(f.controller.armed()).toBe(true)
  })
  it('does not toggle a host that started during asynchronous kit activation', async () => {
    const f = fixture(true)
    mocked.engine.start.mockImplementationOnce(async () => {
      f.setRunning(true)
      return true
    })
    await f.controller.start()
    expect(f.startHost).not.toHaveBeenCalled()
    expect(f.controller.armed()).toBe(true)
  })
  it('cancels pending activation and cannot start host playback after Stop', async () => {
    const f = fixture(true)
    let resolve!: (graph: GuitarSessionAudioGraph) => void
    f.activateGraph.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const pending = f.controller.start()
    expect(f.controller.busy()).toBe(true)
    f.controller.stop()
    resolve(f.graph)
    await pending
    expect(mocked.engine.start).not.toHaveBeenCalled()
    expect(f.startHost).not.toHaveBeenCalled()
    expect(f.controller.armed()).toBe(false)
    expect(f.controller.busy()).toBe(false)
  })
  it('stops and unsubscribes when leaving the score clock', async () => {
    const f = fixture(true)
    await f.controller.start()
    f.setClock(null)
    expect(f.unsubscribe).toHaveBeenCalledOnce()
    expect(mocked.engine.stop).toHaveBeenCalled()
    expect(f.controller.armed()).toBe(false)
  })
  it('keeps unsupported scores silent with a visible reason', async () => {
    const f = fixture(true)
    f.setReason('This score needs a 6/8 groove.')
    await f.controller.start()
    expect(f.controller.unavailableReason()).toContain('6/8')
    expect(f.activateGraph).not.toHaveBeenCalled()
  })
})
