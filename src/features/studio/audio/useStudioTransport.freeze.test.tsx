// Studio transport and the lane freezer — renders follow the song, wait while Export, Compare or auto-balance hold the audio, and a render that lands rebuilds the graph kept for Play.
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

const freezer = vi.hoisted(() => ({
  options: null as null | { changed?: () => void },
  update: vi.fn(),
  resume: vi.fn(),
  pause: vi.fn(),
  dispose: vi.fn(),
  hold: vi.fn(() => null),
  differs: vi.fn(() => false),
}))

vi.mock('@/lib/studio/playback/transport', () => ({
  createStudioTransport: () => runtime,
}))

vi.mock('@/lib/studio/playback/lane-freezer', () => ({
  createStudioLaneFreezer: (options: { changed?: () => void }) => {
    freezer.options = options
    return freezer
  },
}))

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

function mount() {
  const fixture = studioFixture()
  const [project, setProject] = createSignal<StudioProject>(fixture.project)
  const [busy, setBusy] = createSignal(false)
  let transport!: ReturnType<typeof useStudioTransport>
  const dispose = createRoot((dispose) => {
    transport = useStudioTransport({
      project,
      assets: (): readonly StudioAsset[] => [fixture.asset],
      readCanonicalAsset: () => Promise.reject(new Error('no audio')),
      audioLease: {
        ensure: () => null,
        unlock: () => Promise.resolve(false),
      },
      audioBusy: busy,
    })
    return dispose
  })
  const edit = () =>
    setProject((song) => ({ ...song, revision: song.revision + 1 }))
  return { transport, dispose, setBusy, edit }
}

describe('Studio transport and the lane freezer', () => {
  it('renders nothing while an export holds the audio, and goes on once it is done', async () => {
    vi.useFakeTimers()
    const { transport, dispose, setBusy, edit } = mount()
    await vi.advanceTimersByTimeAsync(0)
    expect(freezer.update).toHaveBeenCalledTimes(1)
    expect(freezer.resume).toHaveBeenCalledTimes(1)

    setBusy(true)
    await transport.releaseAudio()
    expect(freezer.pause).toHaveBeenCalledOnce()
    // An edit while it renders is followed, but starts no render.
    const resumed = freezer.resume.mock.calls.length
    const updated = freezer.update.mock.calls.length
    edit()
    expect(freezer.update).toHaveBeenCalledTimes(updated + 1)
    expect(freezer.resume).toHaveBeenCalledTimes(resumed)

    setBusy(false)
    expect(freezer.resume).toHaveBeenCalledTimes(resumed + 1)
    dispose()
    await vi.advanceTimersByTimeAsync(0)
    expect(freezer.dispose).toHaveBeenCalled()
  })

  it('builds the graph for Play again once renders stop landing', async () => {
    vi.useFakeTimers()
    const { dispose } = mount()
    await vi.advanceTimersByTimeAsync(1000)
    const warmed = runtime.warm.mock.calls.length
    // Two renders land in quick succession: one rebuild, after they settle.
    freezer.options?.changed?.()
    await vi.advanceTimersByTimeAsync(500)
    freezer.options?.changed?.()
    await vi.advanceTimersByTimeAsync(1400)
    expect(runtime.warm).toHaveBeenCalledTimes(warmed)
    await vi.advanceTimersByTimeAsync(100)
    expect(runtime.warm).toHaveBeenCalledTimes(warmed + 1)
    dispose()
  })
})
