// Studio input check tests — a check opens one input through MicManager's hold only while no lane is armed, learns its channel count and taps it; an arm, the view closing, or the hold taken over lets it go; a check that finishes opening after an arm lets go at once; a gone input or a refusal is said; and asking for the microphone opens the default, lets it go and lists the inputs again.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioInputCheckDeps, StudioInputHold } from './input-check'
import { createStudioInputCheck } from './input-check'

const indicator = vi.hoisted(() => ({
  on: null as null | (() => boolean),
}))
vi.mock('@/lib/mic-sentinel', () => ({
  registerMicIndicator: (_id: string, on: () => boolean) => {
    indicator.on = on
    return () => {
      indicator.on = null
    }
  },
}))

/** A hold on an input whose track reports `channelCount`. */
function hold(channelCount = 2, missing = false) {
  const track = { getSettings: () => ({ channelCount, deviceId: 'scarlett' }) }
  return {
    stream: { getAudioTracks: () => [track] } as unknown as MediaStream,
    missing,
    release: vi.fn(),
  } satisfies StudioInputHold
}

function fakeContext() {
  const source = { connect: vi.fn(), disconnect: vi.fn() }
  const splitter = { connect: vi.fn(), disconnect: vi.fn() }
  const context = {
    createMediaStreamSource: vi.fn(() => source),
    createChannelSplitter: vi.fn(() => splitter),
  }
  return { context: context as unknown as AudioContext, source, splitter }
}

const disposers: (() => void)[] = []
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
  vi.clearAllMocks()
})

function mount(over: Partial<StudioInputCheckDeps> = {}) {
  const [armed, setArmed] = createSignal(false)
  const graph = fakeContext()
  let ended: (() => void) | null = null
  const unwatch = vi.fn()
  const deps = {
    armed,
    acquire: vi.fn(async () => hold()),
    clock: vi.fn(async () => graph.context),
    remember: vi.fn(),
    watch: vi.fn((onEnded: () => void) => {
      ended = onEnded
      return unwatch
    }),
    refresh: vi.fn(async () => undefined),
    ...over,
  }
  let check!: ReturnType<typeof createStudioInputCheck>
  const dispose = createRoot((done) => {
    check = createStudioInputCheck(deps)
    return done
  })
  disposers.push(dispose)
  return {
    check,
    deps,
    graph,
    setArmed,
    dispose,
    unwatch,
    end: () => ended?.(),
  }
}

describe('the Inputs view check', () => {
  it('opens one input through its hold, learns its channels and taps it, with the mic icon on', async () => {
    const { check, deps, graph } = mount()

    await check.check('scarlett', 'scarlett')

    expect(deps.acquire).toHaveBeenCalledExactlyOnceWith('scarlett')
    expect(deps.remember).toHaveBeenCalledWith(expect.anything(), 2)
    expect(check.open()).toMatchObject({ deviceId: 'scarlett', channels: 2 })
    expect(graph.source.connect).toHaveBeenCalledWith(graph.splitter)
    expect(indicator.on?.()).toBe(true)
  })

  it('is not offered while a lane holds the microphone, and opens nothing then', async () => {
    const { check, deps, setArmed } = mount()
    setArmed(true)

    await check.check('scarlett', 'scarlett')

    expect(check.canCheck()).toBe(false)
    expect(deps.acquire).not.toHaveBeenCalled()
    expect(check.open()).toBeNull()
  })

  it('lets its input go and stops tapping as a lane arms', async () => {
    const opened = hold()
    const { check, graph, setArmed, unwatch } = mount({
      acquire: vi.fn(async () => opened),
    })
    await check.check('scarlett', 'scarlett')

    setArmed(true)

    expect(opened.release).toHaveBeenCalledOnce()
    expect(graph.source.disconnect).toHaveBeenCalled()
    expect(unwatch).toHaveBeenCalledOnce()
    expect(check.open()).toBeNull()
    expect(indicator.on?.()).toBe(false)
  })

  it('lets its input go as the view closes', async () => {
    const opened = hold()
    const { check, dispose } = mount({ acquire: vi.fn(async () => opened) })
    await check.check('scarlett', 'scarlett')

    dispose()

    expect(opened.release).toHaveBeenCalledOnce()
  })

  it('lets go at once of an input that opened after a lane armed', async () => {
    const opened = hold()
    let resolve!: (value: StudioInputHold) => void
    const { check, setArmed } = mount({
      acquire: vi.fn(
        () =>
          new Promise<StudioInputHold>((done) => {
            resolve = done
          }),
      ),
    })

    const checking = check.check('scarlett', 'scarlett')
    expect(check.opening()).toBe('scarlett')
    setArmed(true)
    resolve(opened)
    await checking

    expect(opened.release).toHaveBeenCalledOnce()
    expect(check.open()).toBeNull()
    expect(check.opening()).toBeNull()
  })

  it('lets go when the hold is taken over or the input goes', async () => {
    const opened = hold()
    const { check, end } = mount({ acquire: vi.fn(async () => opened) })
    await check.check('scarlett', 'scarlett')

    end()

    expect(opened.release).toHaveBeenCalledOnce()
    expect(check.open()).toBeNull()
  })

  it('says an input that is gone, and a refusal, in words', async () => {
    const gone = hold(2, true)
    const { check } = mount({
      acquire: vi
        .fn()
        .mockResolvedValueOnce(gone)
        .mockRejectedValueOnce({ kind: 'permission-denied' }),
    })

    await check.check('scarlett', 'scarlett')
    expect(gone.release).toHaveBeenCalledOnce()
    expect(check.error()).toBe('That input is not connected.')

    await check.check('scarlett', 'scarlett')
    expect(check.error()).toBe(
      "Studio can't hear your microphone. Allow it in the browser's site settings, then try again.",
    )
    expect(check.open()).toBeNull()
  })

  it('asks for the microphone by opening the default and letting it go, then lists the inputs again', async () => {
    const opened = hold()
    const { check, deps } = mount({ acquire: vi.fn(async () => opened) })

    await check.allow()

    expect(deps.acquire).toHaveBeenCalledExactlyOnceWith(null)
    expect(opened.release).toHaveBeenCalledOnce()
    expect(deps.refresh).toHaveBeenCalledOnce()
  })
})
