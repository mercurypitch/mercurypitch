// Studio microphone share, a re-arm inside a heard lane's glide — the recorder on the Studio's share and a real MicManager: a re-arm that finds the input alive shares it and opens nothing; once MicManager has let the input go inside the glide (another tab, a hidden page, an unplug, the input-loss watch), the re-arm opens it afresh and listens to a live track, and the first lane's late close leaves the new hold alone.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { releaseMicLock } from '@/lib/mic-lock'
import { MicManager } from '@/lib/mic-manager'
import { createStudioInputMonitor } from '@/lib/studio/record/input-monitor'
import { createStudioMonitorMaster } from '@/lib/studio/record/monitor-master'
import { fakeGraphNode, harness, laneSound, settle, } from '@/lib/studio/record/studio-recorder.test-fixtures'
import { EMPTY_CHAIN } from '@/lib/studio-fx/chain-spec'
import { createManualScheduler, FakeAudioContext, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { createStudioMicShare } from './studio-mic-share'

/** The house release and its slack, in ms: when a disarmed lane's heard monitor has come apart. */
const RELEASED_MS = 240
/** How long a lane's input sounds before its monitor rises, in ms. */
const SETTLE_MS = 250

afterEach(() => releaseMicLock())

/** A device whose every open is a stream of one live track, which stopping ends. */
function fakeDevice() {
  const tracks: { readyState: MediaStreamTrackState }[] = []
  const getUserMedia = vi.fn(async () => {
    const track = {
      readyState: 'live' as MediaStreamTrackState,
      stop: vi.fn(() => {
        track.readyState = 'ended'
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getSettings: () => ({ deviceId: 'usb-1' }),
    }
    tracks.push(track)
    return { getTracks: () => [track], getAudioTracks: () => [track] }
  })
  ;(globalThis.navigator as unknown as { mediaDevices: unknown }).mediaDevices =
    { getUserMedia }
  return { getUserMedia, tracks }
}

/** The recorder arming through the Studio's share on a real MicManager, every lane heard through the real monitor. */
function rig() {
  const device = fakeDevice()
  const mic = new MicManager()
  const graph = new FakeAudioContext()
  const scheduler = createManualScheduler()
  const master = createStudioMonitorMaster(EMPTY_CHAIN)
  /** The stream each source the recorder made listens to. */
  const sourcesOn: MediaStream[] = []
  const share = createStudioMicShare({
    open: (deviceId) => mic.acquireFrom('studio-record', deviceId),
    // Asked only once the recorder below exists.
    armed: (trackId) =>
      (h.view().lanes ?? []).some((lane) => lane.trackId === trackId),
    laneName: (trackId) => trackId ?? 'the new lane',
  })
  const h = harness({
    acquireMic: async (trackId) => {
      const held = await share.open(trackId, {
        deviceId: 'usb-1',
        name: 'USB mic',
      })
      return { stream: held.stream, pick: null, release: held.release }
    },
    createSource: (_context, stream) => {
      sourcesOn.push(stream)
      return fakeGraphNode('source') as unknown as AudioNode
    },
    createMonitor: (_context, input, options) =>
      createStudioInputMonitor(graph.asContext, input, {
        ...options,
        master,
        schedule: scheduler.schedule,
      }),
    monitorSound: () => laneSound(true),
  })
  return { device, mic, scheduler, h, sourcesOn }
}

/** Arm lane 1, hear it, and disarm it: 100 ms into its monitor's glide, its input still held. */
async function disarmHeard({
  h,
  scheduler,
}: ReturnType<typeof rig>): Promise<void> {
  await h.recorder.arm('lane-1')
  await settle()
  h.worklet.level(0.3, 1536)
  scheduler.advance(SETTLE_MS)
  h.recorder.disarm()
  scheduler.advance(100)
}

describe("a re-arm inside a heard lane's glide", () => {
  it('shares the input it finds alive, and opens nothing', async () => {
    // Arrange
    const r = rig()
    await disarmHeard(r)

    // Act
    const rearmed = await r.h.recorder.arm('lane-1')
    await settle()

    // Assert
    expect(rearmed).toBe(true)
    expect(r.device.getUserMedia).toHaveBeenCalledOnce()
    expect(r.sourcesOn).toHaveLength(1)
  })

  it("opens the input afresh once MicManager let it go inside the glide, and keeps it through the first lane's late close", async () => {
    // Arrange
    const r = rig()
    await disarmHeard(r)

    // Act: another tab asks for the microphone, then the lane is armed again.
    await r.mic.forceReleaseAll('other-tab')
    await settle()
    const rearmed = await r.h.recorder.arm('lane-1')
    await settle()
    r.scheduler.advance(RELEASED_MS - 100)
    await settle()

    // Assert
    expect(rearmed).toBe(true)
    expect(r.device.getUserMedia).toHaveBeenCalledTimes(2)
    expect(r.device.tracks.map((track) => track.readyState)).toEqual([
      'ended',
      'live',
    ])
    expect(r.sourcesOn).toHaveLength(2)
    expect(r.sourcesOn[1].getAudioTracks()[0].readyState).toBe('live')
    expect(r.mic.getScopedHold()?.consumerId).toBe('studio-record')
    expect(r.h.view()).toMatchObject({ phase: 'armed', error: null })
  })
})
