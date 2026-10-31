// Studio transport warm-up — after Export, Compare or auto-balance let go of the song's audio, the graph is built ahead again once they finish.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioAsset, StudioProject } from '@/lib/studio/model/types'
import { useStudioTransport } from './useStudioTransport'

const runtime = vi.hoisted(() => ({
  warm: vi.fn(() => Promise.resolve()),
  releaseAudio: vi.fn(() => Promise.resolve()),
  setSnapshot: vi.fn(() => Promise.resolve()),
  setMasterGain: vi.fn(),
  setPageHidden: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  dispose: vi.fn(),
  prepareToSuspend: vi.fn(() => 0),
}))

vi.mock('@/lib/studio/playback/transport', () => ({
  createStudioTransport: () => runtime,
}))

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

/** The hook on a song, with a switch for work that holds the audio it released. */
function mount() {
  const { project, asset } = studioFixture()
  const [busy, setBusy] = createSignal(false)
  let transport!: ReturnType<typeof useStudioTransport>
  const dispose = createRoot((dispose) => {
    transport = useStudioTransport({
      project: (): StudioProject => project,
      assets: (): readonly StudioAsset[] => [asset],
      readCanonicalAsset: () => Promise.reject(new Error('no audio')),
      audioLease: {
        ensure: () => null,
        unlock: () => Promise.resolve(false),
      },
      audioBusy: busy,
    })
    return dispose
  })
  return { transport, dispose, setBusy }
}

describe('Studio transport warm-up after a release', () => {
  it('builds the graph ahead again once the work that released the audio is done, not while it runs', async () => {
    vi.useFakeTimers()
    const { transport, dispose, setBusy } = mount()
    await vi.advanceTimersByTimeAsync(0)
    expect(runtime.warm).toHaveBeenCalledTimes(1)

    // An export starts: it releases the song's audio and renders for a while.
    setBusy(true)
    await transport.releaseAudio()
    expect(runtime.releaseAudio).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(5000)
    expect(runtime.warm).toHaveBeenCalledTimes(1)

    // It finishes: the next Play finds a graph built ahead again.
    setBusy(false)
    await vi.advanceTimersByTimeAsync(400)
    expect(runtime.warm).toHaveBeenCalledTimes(2)
    dispose()
  })
})
