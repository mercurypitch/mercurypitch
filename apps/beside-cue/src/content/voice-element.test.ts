// Element voice port regressions — a retired handle must never start later.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AudioSourceVariant } from './audio-manifest'
import { createElementAudioPort } from './voice'

const source: AudioSourceVariant = {
  src: 'audio/voice/en/the-scroll/meet.m4a',
  mimeType: 'audio/mp4',
  sha256: 'a'.repeat(64),
  byteLength: 100,
  durationMs: 2_000,
  sampleRateHz: 48_000,
  channels: 1,
}

function audioBoundary() {
  const elements: FakeAudio[] = []
  class FakeAudio extends EventTarget {
    readonly play = vi.fn(() => Promise.resolve())
    readonly pause = vi.fn()
    constructor(readonly src: string) {
      super()
      elements.push(this)
    }
  }
  vi.stubGlobal('Audio', FakeAudio)
  return elements
}

afterEach(() => vi.unstubAllGlobals())

describe('element voice port', () => {
  it('does not dispatch a deferred play after its handle was stopped', async () => {
    const elements = audioBoundary()
    const port = createElementAudioPort()!
    const first = port.play(source)
    const started = first.started.catch(() => undefined)
    first.stop()
    await started
    expect(elements[0]!.play).not.toHaveBeenCalled()
    await expect(first.finished).resolves.toBe('stopped')
  })

  it('dispatches only the latest same-asset handle during immediate replacement', async () => {
    const elements = audioBoundary()
    const port = createElementAudioPort()!
    const first = port.play(source)
    const retired = first.started.catch(() => undefined)
    first.stop()
    const latest = port.play(source)
    await Promise.all([retired, latest.started])
    expect(elements[0]!.play).not.toHaveBeenCalled()
    expect(elements[1]!.play).toHaveBeenCalledOnce()
    expect(elements[1]!.pause).not.toHaveBeenCalled()
    port.dispose()
  })

  it('does not dispatch a deferred play after the port was disposed', async () => {
    const elements = audioBoundary()
    const port = createElementAudioPort()!
    const cue = port.play(source)
    const started = cue.started.catch(() => undefined)
    port.dispose()
    await started
    expect(elements[0]!.play).not.toHaveBeenCalled()
    await expect(cue.finished).resolves.toBe('stopped')
  })
})
