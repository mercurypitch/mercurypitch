// Studio transport during a take — Repeat and the range hold still from the count-in until the take is kept, and move again after; a hidden tab leaves the song playing under the take, and a take with no song under it moves the playhead.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, expect, it, vi } from 'vitest'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioAsset, StudioProject } from '@/lib/studio/model/types'
import type { StudioTakeClock } from './take-clock'
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
  seek: vi.fn(() => Promise.resolve()),
  // A song that is not playing stands at its start.
  frameNow: vi.fn(() => 0),
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
  vi.useRealTimers()
  vi.clearAllMocks()
})

function mount(
  taking: boolean,
  running: StudioTakeClock | null = null,
  clock: AudioContext | null = null,
) {
  const fixture = studioFixture()
  const [project] = createSignal<StudioProject>(fixture.project)
  const [recording, setRecording] = createSignal(taking)
  const [take, setTake] = createSignal(running)
  let transport!: ReturnType<typeof useStudioTransport>
  const dispose = createRoot((dispose) => {
    transport = useStudioTransport({
      project,
      assets: (): readonly StudioAsset[] => [fixture.asset],
      readCanonicalAsset: () => Promise.reject(new Error('no audio')),
      audioLease: { ensure: () => clock, unlock: () => Promise.resolve(false) },
      recording,
      take,
    })
    return dispose
  })
  return { transport, dispose, setRecording, setTake, fixture }
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

it('reads a take only once the Studio around it is made, since its recorder comes after its transport', () => {
  // Arrange: as StudioWorkspace makes them, the recorder after the transport.
  const fixture = studioFixture()
  let recorderMade = false
  const take = () => {
    if (!recorderMade) throw new ReferenceError('The recorder is not made yet.')
    return null
  }

  // Act
  const mounting = () =>
    createRoot((dispose) => {
      const transport = useStudioTransport({
        project: () => fixture.project,
        assets: () => [fixture.asset],
        readCanonicalAsset: () => Promise.reject(new Error('no audio')),
        audioLease: {
          ensure: () => null,
          unlock: () => Promise.resolve(false),
        },
        take,
      })
      recorderMade = true
      return { transport, dispose }
    })

  // Assert: effects read it after setup; the transport shows no take.
  const { transport, dispose } = mounting()
  expect(transport.playing()).toBe(false)
  dispose()
})

it('moves the playhead and the clock with a take that has no song under it, and leaves them where the take stopped', async () => {
  // Arrange: an empty song's take, its count-in ending at clock time 10 s.
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  })
  const clock = { currentTime: 9, state: 'running' } as AudioContext
  const take = { anchor: { frame: 0, time: 10 }, loop: null }
  const { transport, dispose, setRecording, setTake, fixture } = mount(
    true,
    take,
    clock,
  )
  const ticked = vi.fn()
  transport.ticks(ticked)

  // Act: the count-in, then 2.5 s of the take, then Stop and the take kept.
  await vi.advanceTimersByTimeAsync(40)
  const counting = transport.playheadFrame()
  ;(clock as { currentTime: number }).currentTime = 12.5
  await vi.advanceTimersByTimeAsync(40)
  const recorded = transport.playheadFrame()
  const now = transport.frameNow()
  const shownRunning = transport.playing()
  setTake(null)
  const stopped = transport.playheadFrame()
  setRecording(false)

  // Assert
  expect(shownRunning).toBe(true)
  expect(counting).toBe(0)
  expect(recorded).toBe(2.5 * 48_000)
  expect(now).toBe(2.5 * 48_000)
  expect(ticked).toHaveBeenCalled()
  expect(transport.playing()).toBe(false)
  expect(stopped).toBe(2.5 * 48_000)
  expect(runtime.seek).toHaveBeenCalledExactlyOnceWith(
    2.5 * 48_000,
    fixture.project,
    [fixture.asset],
  )
  dispose()
})
