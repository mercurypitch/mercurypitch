// Studio recorder instrument tests — a MIDI lane arms its instrument and never a microphone: the take and the monitor hear the instrument's node, its take is moved by what the hook gives for no stream, its port going ends an arm or a take in its own words, and a kept take says when its first sample was captured.
import { describe, expect, it, vi } from 'vitest'
import type { StudioInputLostWords, StudioInstrumentHold, } from './recorder-types'
import { fakeGraphNode, harness, RATE, settle, } from './studio-recorder.test-fixtures'

function instrument(connected = true) {
  const node = fakeGraphNode('instrument')
  const play = vi.fn((_context: AudioContext) => node as unknown as AudioNode)
  const release = vi.fn()
  const hold: StudioInstrumentHold = {
    kind: 'instrument',
    play,
    connected: () => connected,
    release,
  }
  return { node, hold, play, release }
}

const LOST: StudioInputLostWords = {
  armed: 'Keys gone, armed.',
  midTake: 'Keys gone mid-take.',
  beforeTake: 'Keys gone before the take.',
}

describe('the Studio recorder on an instrument', () => {
  it('arms the instrument in place of a microphone, hands the take and the monitor its node, and lets it go on disarm', async () => {
    // Arrange
    const { node, hold, play, release } = instrument()
    const inputOpened = vi.fn()
    const h = harness({
      acquireInstrument: () => Promise.resolve(hold),
      inputOpened,
    })

    // Act
    const armed = await h.recorder.arm('keys')
    h.recorder.disarm()

    // Assert
    expect(armed).toBe(true)
    expect(h.deps.acquireMic).not.toHaveBeenCalled()
    expect(play).toHaveBeenCalledExactlyOnceWith(h.ctx)
    expect(h.captureInputs).toEqual([node])
    expect(h.monitorInputs).toEqual([node])
    expect(inputOpened).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledOnce()
    expect(h.releaseMic).not.toHaveBeenCalled()
  })

  it('has no channels to meter beside a take', async () => {
    // Arrange
    const { hold } = instrument()
    const h = harness({ acquireInstrument: () => Promise.resolve(hold) })

    // Act
    await h.recorder.arm('keys')

    // Assert
    expect(h.recorder.inputTap()).toBeNull()
  })

  it('moves an instrument take by what the hook gives for no stream, and says when its first sample was captured', async () => {
    // Arrange
    const { hold } = instrument()
    const roundTrip = vi.fn(() => 0.03)
    const h = harness(
      { acquireInstrument: () => Promise.resolve(hold), roundTrip },
      { countInBars: 0 },
    )
    await h.recorder.arm('keys')

    // Act
    h.recorder.record()
    h.worklet.started(1.1 * RATE)
    h.chunk(0, 4096)
    h.recorder.stop()
    h.worklet.stopped(4096, 'stopped')
    await settle()

    // Assert
    expect(roundTrip).toHaveBeenCalledExactlyOnceWith(h.ctx, null)
    expect(h.kept).toHaveLength(1)
    expect(h.kept[0].capturedFrom).toBeCloseTo(1.1, 9)
  })

  it('disarms in its own words when its port goes while armed', async () => {
    // Arrange
    const { hold, release } = instrument()
    const h = harness({ acquireInstrument: () => Promise.resolve(hold) })
    await h.recorder.arm('keys')

    // Act
    h.recorder.inputLost(LOST)

    // Assert
    expect(h.view()).toMatchObject({ phase: 'idle', error: LOST.armed })
    expect(release).toHaveBeenCalledOnce()
  })

  it('ends a take in its own words when its port goes, and says nothing was kept before the take began', async () => {
    // Arrange
    const { hold } = instrument()
    const h = harness(
      { acquireInstrument: () => Promise.resolve(hold) },
      { countInBars: 0 },
    )
    await h.recorder.arm('keys')
    h.recorder.record()

    // Act
    h.recorder.inputLost(LOST)
    const finishing = h.view()
    h.worklet.stopped(0, 'input-lost')
    await settle()

    // Assert
    expect(finishing).toMatchObject({
      phase: 'finishing',
      notice: LOST.midTake,
    })
    expect(h.view()).toMatchObject({
      phase: 'idle',
      notice: LOST.beforeTake,
    })
    expect(h.kept).toEqual([])
  })

  it('stays armed after a take only while its port is connected', async () => {
    // Arrange
    let connected = true
    const node = fakeGraphNode('instrument')
    const release = vi.fn()
    const hold: StudioInstrumentHold = {
      kind: 'instrument',
      play: () => node as unknown as AudioNode,
      connected: () => connected,
      release,
    }
    const h = harness(
      { acquireInstrument: () => Promise.resolve(hold) },
      { countInBars: 0 },
    )
    await h.recorder.arm('keys')
    h.recorder.record()
    h.worklet.started(1.1 * RATE)
    h.chunk(0, 4096)

    // Act
    connected = false
    h.recorder.stop()
    h.worklet.stopped(4096, 'stopped')
    await settle()

    // Assert
    expect(h.view().phase).toBe('idle')
    expect(release).toHaveBeenCalledOnce()
  })
})
