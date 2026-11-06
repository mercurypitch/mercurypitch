// Studio transport during a take — Repeat and the range hold still from the count-in until the take is kept, and move again after; a hidden tab leaves the song playing under the take.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, expect, it, vi } from 'vitest'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioAsset, StudioProject } from '@/lib/studio/model/types'
import { useStudioTransport } from './useStudioTransport'

const runtime = vi.hoisted(() => ({
  warm: vi.fn(() => Promise.resolve()),
  releaseAudio: vi.fn(() => Promise.resolve()),
  setSnapshot: vi.fn(() => Promise.resolve()),
  setRepeat: vi.fn(),
  setLoopRange: vi.fn(),
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

vi.mock('@/lib/studio/playback/lane-freezer', () => ({
  createStudioLaneFreezer: () => ({
    update: vi.fn(),
    resume: vi.fn(),
    pause: vi.fn(),
    dispose: vi.fn(),
    hold: vi.fn(() => null),
    differs: vi.fn(() => false),
  }),
}))

afterEach(() => {
  // The document's own `hidden` again, from its prototype.
  delete (document as { hidden?: boolean }).hidden
  vi.clearAllMocks()
})

function mount(taking: boolean) {
  const fixture = studioFixture()
  const [project] = createSignal<StudioProject>(fixture.project)
  const [recording, setRecording] = createSignal(taking)
  let transport!: ReturnType<typeof useStudioTransport>
  const dispose = createRoot((dispose) => {
    transport = useStudioTransport({
      project,
      assets: (): readonly StudioAsset[] => [fixture.asset],
      readCanonicalAsset: () => Promise.reject(new Error('no audio')),
      audioLease: { ensure: () => null, unlock: () => Promise.resolve(false) },
      recording,
    })
    return dispose
  })
  return { transport, dispose, setRecording }
}

function showPage(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

it('holds Repeat and the range while a take runs, so the take keeps what they said when it started', async () => {
  const { transport, dispose, setRecording } = mount(false)
  const range = { startFrame: 48000, endFrame: 96000 }

  setRecording(true)
  await transport.setRepeat(true)
  await transport.setRange(range)
  expect(transport.repeating()).toBe(false)
  expect(transport.range()).toBeNull()
  expect(runtime.setRepeat).not.toHaveBeenCalled()
  expect(runtime.setLoopRange).not.toHaveBeenCalled()

  setRecording(false)
  await transport.setRange(range)
  await transport.setRepeat(true)
  expect(transport.range()).toEqual(range)
  expect(transport.repeating()).toBe(true)
  expect(runtime.setLoopRange).toHaveBeenCalledExactlyOnceWith(range)
  dispose()
})

it('plays the song on under a take while the tab is hidden, and pauses it there when no take runs', () => {
  // Arrange
  const { dispose, setRecording } = mount(true)

  // Act: the singer goes to the words in another tab mid-take, and back.
  showPage(true)
  showPage(false)
  setRecording(false)
  showPage(true)

  // Assert
  expect(runtime.pause).toHaveBeenCalledOnce()
  expect(runtime.setPageHidden.mock.calls).toEqual([[true], [false], [true]])
  dispose()
})
