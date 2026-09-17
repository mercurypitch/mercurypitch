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
    let activeGraph = graph
    const activateGraph = vi.fn(async () => activeGraph)
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
      setGraph: (next: GuitarSessionAudioGraph) => {
        activeGraph = next
      },
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
  it('automatically queues the latest selection without restarting playback', async () => {
    const f = fixture()
    await f.controller.start()
    const original = f.controller.active()
    f.controller.change({ bars: 16 })
    f.controller.change({ fillEvery: 8, kitId: 'crocell' })
    expect(mocked.engine.update).toHaveBeenLastCalledWith(
      f.controller.settings(),
    )
    expect(f.controller.active()).toBe(original)
    expect(f.controller.changed()).toBe(true)
    mocked.options!.onApplied(f.controller.settings())
    expect(f.controller.changed()).toBe(false)
    expect(mocked.engine.start).toHaveBeenCalledOnce()
    f.controller.stop()
    mocked.engine.update.mockClear()
    f.controller.change({ bars: 4 })
    expect(mocked.engine.update).not.toHaveBeenCalled()
  })
  it('publishes audible scheduled hits only while a recorder is subscribed', async () => {
    const f = fixture()
    const listener = vi.fn()
    const unsubscribe = f.controller.subscribeHit(listener)
    await f.controller.start()
    const hit = {
      contextTime: 4.25,
      gmKey: 38,
      velocity: 112,
      kitId: 'crocell',
      level: 1.1,
    }
    mocked.options!.onHit?.(hit)
    expect(listener).toHaveBeenCalledExactlyOnceWith(hit)
    unsubscribe()
    mocked.options!.onHit?.({ ...hit, contextTime: 4.5 })
    expect(listener).toHaveBeenCalledOnce()
  })
  it('does not lose choices changed while audio is warming up', async () => {
    const f = fixture()
    mocked.engine.start.mockImplementationOnce(
      async (settings: SessionDrummerSettings) => {
        f.controller.change({ bars: 16, fillStyle: 'snare' })
        mocked.options!.onApplied(settings)
        return true
      },
    )
    await f.controller.start()
    expect(mocked.engine.update).toHaveBeenLastCalledWith(
      f.controller.settings(),
    )
    expect(f.controller.settings()).toMatchObject({
      bars: 16,
      fillStyle: 'snare',
    })
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
  it('rebuilds its engine when the room recycles the audio graph', async () => {
    const f = fixture()
    await f.controller.start()
    f.controller.stop()
    const replacement = {} as GuitarSessionAudioGraph
    f.setGraph(replacement)

    await f.controller.start()

    expect(mocked.engine.dispose).toHaveBeenCalledOnce()
    expect(await mocked.options!.activateGraph()).toBe(replacement)
    expect(mocked.engine.start).toHaveBeenCalledTimes(2)
    expect(f.controller.armed()).toBe(true)
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
