// Studio recorder lanes tests — lanes arm one at a time beside each other and one Record records them all from the same frame: two lanes on one stereo input share its split and each keeps only its own side, an instrument lane records beside a microphone lane, each take is placed by its own path and journaled on its own, a lost input ends only its own lanes' takes, memory is held for every lane or Record is refused, and the shared microphone goes with its last lane.
import type { Mock } from 'vitest'
import { describe, expect, it, vi } from 'vitest'
import type { ChannelPick } from '@/lib/audio-input/input-channels'
import type { StudioInputLostWords, StudioInstrumentHold, StudioMicHold, } from './recorder-types'
import { MIC_LOST_MID_TAKE } from './studio-recorder'
import type { FakeGraphNode } from './studio-recorder.test-fixtures'
import { chunkOf, fakeGraphNode, harness, RATE, settle, } from './studio-recorder.test-fixtures'

const single = (channel: number): ChannelPick => ({ channel, pair: false })

/** One stereo input, opened once and handed to every lane that records from it, each with its own pick and release. */
function stereoInput(picks: Record<string, ChannelPick>) {
  const track = { getSettings: () => ({ channelCount: 2 }), readyState: 'live' }
  const stream = { getAudioTracks: () => [track] } as unknown as MediaStream
  const releases: Record<string, Mock<() => void>> = {}
  const acquireMic = vi.fn(
    async (trackId: string | null): Promise<StudioMicHold> => {
      const lane = trackId ?? 'new'
      releases[lane] = vi.fn<() => void>()
      return { stream, pick: picks[lane] ?? null, release: releases[lane] }
    },
  )
  return { stream, acquireMic, releases }
}

/** A MIDI lane's instrument: its own node, and its port connected. */
function instrument(name: string) {
  const node = fakeGraphNode(name)
  const release = vi.fn()
  const hold: StudioInstrumentHold = {
    kind: 'instrument',
    play: () => node as unknown as AudioNode,
    connected: () => true,
    release,
  }
  return { node, hold, release }
}

const edges = (node: FakeGraphNode) =>
  node.edges.map(([to, output, input]) => [to.name, output, input])

let ids = 0
const nextId = () => `take-${++ids}`

describe('several lanes armed at once', () => {
  it('arms each lane in its own press beside the others, and disarms one leaving the rest', async () => {
    // Arrange
    const input = stereoInput({ vox: single(0), gtr: single(1) })
    const h = harness({ acquireMic: input.acquireMic })

    // Act
    const armed = [await h.recorder.arm('vox'), await h.recorder.arm('gtr')]
    const twice = await h.recorder.arm('vox')
    const both = h.view()
    h.recorder.disarm('vox')

    // Assert
    expect(armed).toEqual([true, true])
    expect(twice).toBe(false)
    expect(both.phase).toBe('armed')
    expect(both.lanes?.map((lane) => [lane.trackId, lane.microphone])).toEqual([
      ['vox', true],
      ['gtr', true],
    ])
    expect(h.view().lanes?.map((lane) => lane.trackId)).toEqual(['gtr'])
    expect(h.view()).toMatchObject({ phase: 'armed', targetTrackId: 'gtr' })
    expect(input.releases.vox).toHaveBeenCalledOnce()
    expect(input.releases.gtr).not.toHaveBeenCalled()
    expect(h.source.disconnect).not.toHaveBeenCalled()
  })

  it('records two lanes on one stereo input from the same frame, each keeping only its own side', async () => {
    // Arrange
    const input = stereoInput({ vox: single(0), gtr: single(1) })
    const h = harness(
      { acquireMic: input.acquireMic, createId: nextId },
      { countInBars: 0 },
    )
    await h.recorder.arm('vox')
    await h.recorder.arm('gtr')
    const [vox, gtr] = h.worklets

    // Act
    h.recorder.record()
    vox.started(1.1 * RATE)
    gtr.started(1.1 * RATE)
    vox.chunk(0, 4096, chunkOf(4096, 0.4))
    gtr.chunk(0, 4096, chunkOf(4096, 0.1))
    h.recorder.stop()
    vox.stopped(4096, 'stopped')
    gtr.stopped(4096, 'stopped')
    await settle()

    // Assert
    const [splitter] = h.splitters
    const [voxNode, gtrNode] = h.gains
    expect(h.ctx.createChannelSplitter).toHaveBeenCalledExactlyOnceWith(2)
    expect(edges(splitter)).toEqual([
      ['gain', 0, 0],
      ['gain', 1, 0],
    ])
    expect(h.captureInputs.slice(0, 2)).toEqual([voxNode, gtrNode])
    expect(h.captures[0].start).toHaveBeenCalledWith(52800, expect.any(Number))
    expect(h.captures[1].start).toHaveBeenCalledWith(52800, expect.any(Number))
    expect(h.kept.map((take) => [take.trackId, take.samples[0]])).toEqual([
      ['vox', expect.closeTo(0.4, 6)],
      ['gtr', expect.closeTo(0.1, 6)],
    ])
    expect(new Set(h.kept.map((take) => take.id)).size).toBe(2)
    expect(h.view()).toMatchObject({ phase: 'armed' })
    expect(h.view().lanes).toHaveLength(2)
  })

  it('records an instrument lane beside a microphone lane, each take placed by its own path', async () => {
    // Arrange
    const keys = instrument('keys')
    const roundTrip = vi.fn(
      (_context: AudioContext, stream: MediaStream | null) =>
        stream === null ? 0.02 : 0.05,
    )
    const h = harness(
      {
        acquireInstrument: (trackId) =>
          trackId === 'keys' ? Promise.resolve(keys.hold) : null,
        roundTrip,
        createId: nextId,
      },
      { countInBars: 0 },
    )
    await h.recorder.arm('vox')
    await h.recorder.arm('keys')
    const [vox, piano] = h.worklets

    // Act
    h.recorder.record()
    for (const worklet of [vox, piano]) {
      worklet.started(1.1 * RATE)
      worklet.chunk(0, 4096, chunkOf(4096, 0.25))
    }
    h.recorder.stop()
    vox.stopped(4096, 'stopped')
    piano.stopped(4096, 'stopped')
    await settle()

    // Assert
    expect(h.deps.acquireMic).toHaveBeenCalledExactlyOnceWith('vox')
    expect(h.captureInputs.slice(0, 2)).toEqual([h.source, keys.node])
    const [voice, played] = h.kept
    expect(played.heardFirst - voice.heardFirst).toBe(
      Math.round((0.05 - 0.02) * RATE),
    )
    expect(h.view().lanes?.map((lane) => lane.microphone)).toEqual([
      true,
      false,
    ])
  })

  it('records two instrument lanes, each keeping only its own sound', async () => {
    // Arrange
    const keys = instrument('keys')
    const pads = instrument('pads')
    const h = harness(
      {
        acquireInstrument: (trackId) =>
          Promise.resolve(trackId === 'keys' ? keys.hold : pads.hold),
        createId: nextId,
      },
      { countInBars: 0 },
    )
    await h.recorder.arm('keys')
    await h.recorder.arm('pads')
    const [onKeys, onPads] = h.worklets

    // Act
    h.recorder.record()
    onKeys.started(1.1 * RATE)
    onPads.started(1.1 * RATE)
    onKeys.chunk(0, 4096, chunkOf(4096, 0.5))
    onPads.chunk(0, 4096, chunkOf(4096, 0.2))
    h.recorder.stop()
    onKeys.stopped(4096, 'stopped')
    onPads.stopped(4096, 'stopped')
    await settle()

    // Assert
    expect(h.captureInputs.slice(0, 2)).toEqual([keys.node, pads.node])
    expect(h.monitorInputs).toEqual([keys.node, pads.node])
    expect(h.kept.map((take) => [take.trackId, take.samples[0]])).toEqual([
      ['keys', expect.closeTo(0.5, 6)],
      ['pads', expect.closeTo(0.2, 6)],
    ])
  })

  it('journals each lane on its own, so a closed tab keeps every lane', async () => {
    // Arrange
    const input = stereoInput({ vox: single(0), gtr: single(1) })
    const h = harness(
      { acquireMic: input.acquireMic, createId: nextId },
      { countInBars: 0 },
    )
    await h.recorder.arm('vox')
    await h.recorder.arm('gtr')
    const [vox, gtr] = h.worklets

    // Act
    h.recorder.record()
    vox.started(1.1 * RATE)
    gtr.started(1.1 * RATE)
    for (let at = 0; at < 3 * 4096 * 4; at += 4096) {
      vox.chunk(at, 4096, chunkOf(4096, 0.4))
      gtr.chunk(at, 4096, chunkOf(4096, 0.1))
    }
    await settle()
    h.recorder.dispose()
    await settle()

    // Assert
    const begun = (
      h.journal.begin.mock.calls as unknown as [{ trackId: string }][]
    ).map(([header]) => header.trackId)
    expect(begun).toEqual(['vox', 'gtr'])
    const appended = new Set(h.journal.append.mock.calls.map(([id]) => id))
    expect(appended.size).toBe(2)
    expect(h.journal.discard).not.toHaveBeenCalled()
    expect(h.releaseMemory).toHaveBeenCalledTimes(2)
  })

  it('holds memory for every lane before the take, and refuses Record for all when one cannot have it', async () => {
    // Arrange
    const released = vi.fn()
    let reserved = 0
    const h = harness({
      acquireInstrument: (trackId) =>
        trackId === 'keys' ? Promise.resolve(instrument('keys').hold) : null,
      reserveMemory: vi.fn(() => {
        if (++reserved > 1) throw new Error('no room')
        return released
      }),
    })
    await h.recorder.arm('vox')
    await h.recorder.arm('keys')

    // Act
    const started = h.recorder.record()

    // Assert
    expect(started).toBe(false)
    expect(released).toHaveBeenCalledOnce()
    expect(
      h.captures.some((capture) => capture.start.mock.calls.length > 0),
    ).toBe(false)
    expect(h.view()).toMatchObject({
      phase: 'armed',
      error: 'described Error: no room',
    })
    expect(h.journal.begin).not.toHaveBeenCalled()
  })
})

describe('a lost input among several lanes', () => {
  const PORT: StudioInputLostWords = {
    armed: 'Keys gone, armed.',
    midTake: 'Keys gone mid-take.',
    beforeTake: 'Keys gone before the take.',
  }

  async function recordingTwo() {
    const keys = instrument('keys')
    const h = harness(
      {
        acquireInstrument: (trackId) =>
          trackId === 'keys' ? Promise.resolve(keys.hold) : null,
        createId: nextId,
      },
      { countInBars: 0 },
    )
    await h.recorder.arm('vox')
    await h.recorder.arm('keys')
    const [vox, piano] = h.worklets
    h.recorder.record()
    for (const worklet of [vox, piano]) {
      worklet.started(1.1 * RATE)
      worklet.chunk(0, 4096, chunkOf(4096, 0.25))
    }
    return {
      h,
      keys,
      vox,
      piano,
      voxCapture: h.captures[0],
      keysCapture: h.captures[1],
    }
  }

  it('ends only the takes on a microphone that went, and the instrument lane records on', async () => {
    // Arrange
    const { h, vox, piano, voxCapture, keysCapture } = await recordingTwo()

    // Act
    h.recorder.micLost()
    const after = h.view()
    vox.stopped(4096, 'input-lost')
    await settle()
    const lost = h.view()
    h.recorder.stop()
    piano.stopped(4096, 'stopped')
    await settle()

    // Assert
    expect(voxCapture.stop).toHaveBeenCalledExactlyOnceWith(null, 'input-lost')
    expect(keysCapture.stop).toHaveBeenCalledExactlyOnceWith(
      expect.any(Number),
      'stopped',
    )
    expect(after).toMatchObject({
      phase: 'recording',
      notice: MIC_LOST_MID_TAKE,
    })
    expect(lost.phase).toBe('recording')
    expect(lost.lanes?.map((lane) => lane.trackId)).toEqual(['keys'])
    expect(h.releaseMic).toHaveBeenCalledOnce()
    expect(h.kept.map((take) => take.trackId)).toEqual(['vox', 'keys'])
    expect(h.view().notices).toEqual([
      { trackId: 'vox', text: MIC_LOST_MID_TAKE },
    ])
    expect(h.view()).toMatchObject({ phase: 'armed', targetTrackId: 'keys' })
  })

  it("ends only its own lane's take when a port goes, saying so for that lane", async () => {
    // Arrange
    const { h, keys, vox, piano, voxCapture, keysCapture } =
      await recordingTwo()

    // Act
    h.recorder.inputLost(PORT, 'keys')
    piano.stopped(4096, 'input-lost')
    await settle()
    const during = h.view()
    h.recorder.stop()
    vox.stopped(4096, 'stopped')
    await settle()

    // Assert
    expect(keysCapture.stop).toHaveBeenCalledExactlyOnceWith(null, 'input-lost')
    expect(voxCapture.stop).toHaveBeenCalledExactlyOnceWith(
      expect.any(Number),
      'stopped',
    )
    expect(during).toMatchObject({ phase: 'recording', notice: PORT.midTake })
    expect(keys.release).toHaveBeenCalledOnce()
    expect(h.releaseMic).not.toHaveBeenCalled()
    expect(h.kept.map((take) => take.trackId)).toEqual(['keys', 'vox'])
    expect(h.view().lanes?.map((lane) => lane.trackId)).toEqual(['vox'])
  })

  it('drops only its lane from a count-in when its port goes, and the others count on', async () => {
    // Arrange
    const keys = instrument('keys')
    const h = harness({
      acquireInstrument: (trackId) =>
        trackId === 'keys' ? Promise.resolve(keys.hold) : null,
      createId: nextId,
    })
    await h.recorder.arm('vox')
    await h.recorder.arm('keys')
    h.recorder.record()

    // Act
    h.recorder.inputLost(PORT, 'keys')
    await settle()

    // Assert
    expect(h.view()).toMatchObject({ phase: 'counting', error: PORT.armed })
    expect(h.view().lanes?.map((lane) => lane.trackId)).toEqual(['vox'])
    expect(keys.release).toHaveBeenCalledOnce()
    expect(h.journal.discard).toHaveBeenCalledOnce()
  })
})

describe('the microphone lanes share', () => {
  it('opens it once for every lane on it, takes each lane off its split as it leaves, and lets it go with the last', async () => {
    // Arrange
    const input = stereoInput({ vox: single(0), gtr: single(1) })
    const source = fakeGraphNode('source')
    const createSource = vi.fn(() => source as unknown as AudioNode)
    const h = harness({ acquireMic: input.acquireMic, createSource })
    await h.recorder.arm('vox')
    await h.recorder.arm('gtr')
    const [splitter] = h.splitters
    const [voxNode] = h.gains

    // Act
    h.recorder.disarm('vox')
    const leftOne = splitter.disconnect.mock.calls.slice()
    const sourceKept = source.disconnect.mock.calls.length
    h.recorder.disarm('gtr')

    // Assert
    expect(createSource).toHaveBeenCalledOnce()
    expect(leftOne).toEqual([[voxNode]])
    expect(sourceKept).toBe(0)
    expect(source.disconnect).toHaveBeenCalledWith(splitter)
    expect(source.disconnect).toHaveBeenLastCalledWith()
    expect(input.releases.vox).toHaveBeenCalledOnce()
    expect(input.releases.gtr).toHaveBeenCalledOnce()
    expect(h.recorder.inputTap()).toBeNull()
    expect(h.view().phase).toBe('idle')
  })
})
