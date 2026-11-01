// ============================================================
// Merc's speech: a line he has said aloud, hushed, and never late
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { MercSpeechDeps } from './merc-speech'
import { createMercSpeech, HUSH_SECONDS, SPEECH_GAIN, SPEECH_LEAD_SECONDS, } from './merc-speech'

interface FakeSource {
  buffer: unknown
  readonly starts: number[]
  readonly stops: number[]
  disconnected: boolean
  onended: (() => void) | null
}

interface FakeGain {
  readonly gain: { value: number; readonly calls: string[] }
  readonly connections: unknown[]
}

/** A running clock that records the sources and gains made on it. */
function fakeContext(now = 2) {
  const sources: FakeSource[] = []
  const gains: FakeGain[] = []
  const decodes: ArrayBuffer[] = []
  const ctx = {
    currentTime: now,
    destination: { name: 'speakers' },
    state: 'running',
    createGain: () => {
      const calls: string[] = []
      const gain = {
        value: 1,
        calls,
        cancelScheduledValues: () => calls.push('cancel'),
        setValueAtTime: () => calls.push('hold'),
        setTargetAtTime: (target: number) => calls.push(`to ${target}`),
      }
      const node: FakeGain & Record<string, unknown> = {
        gain,
        connections: [],
        connect: (to: unknown) => {
          node.connections.push(to)
        },
        disconnect: () => undefined,
      }
      gains.push(node)
      return node
    },
    createBufferSource: () => {
      const source: FakeSource & Record<string, unknown> = {
        buffer: null,
        starts: [],
        stops: [],
        disconnected: false,
        onended: null,
        connect: () => undefined,
        disconnect: () => {
          source.disconnected = true
        },
        start: (at: number) => {
          source.starts.push(at)
        },
        stop: (at: number) => {
          source.stops.push(at)
        },
      }
      sources.push(source)
      return source
    },
    // A recording decodes to where it was read from, so a test can tell
    // which line sounded.
    decodeAudioData: (bytes: ArrayBuffer) => {
      decodes.push(bytes)
      return Promise.resolve({
        duration: 4.2,
        from: new TextDecoder().decode(bytes),
      })
    },
  }
  return { ctx: ctx as unknown as AudioContext, sources, gains, decodes }
}

/** Lets every pending promise settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const LINES = {
  'intro-a': '/voice/merc-says-intro-a.mp3',
  'intro-b': '/voice/merc-says-intro-b.mp3',
}

function speechWith(overrides: Partial<MercSpeechDeps> = {}) {
  const fake = fakeContext()
  const report = vi.fn()
  const read = vi.fn((url: string) =>
    Promise.resolve({
      bytes: new TextEncoder().encode(url).buffer as ArrayBuffer,
    }),
  )
  const audio = vi.fn(() => Promise.resolve(fake.ctx))
  // A decoder apart from the room's clock, as on a phone.
  const decoder = vi.fn(() => fakeContext().ctx as BaseAudioContext)
  const speech = createMercSpeech(LINES, {
    audio,
    read,
    decoder,
    report,
    ...overrides,
  })
  return { ...fake, speech, report, read, audio, decoder }
}

describe("Merc's speech", () => {
  it('says a line he has through the room, once the room has settled', async () => {
    const { speech, sources, gains, report } = speechWith()
    speech.say('intro-a')
    await settle()
    expect(sources).toHaveLength(1)
    expect(sources[0].starts).toEqual([2 + SPEECH_LEAD_SECONDS])
    expect(sources[0].buffer).toMatchObject({ from: LINES['intro-a'] })
    // His level, and on to the room's output, not straight to the speakers.
    const voice = gains.find((g) => g.gain.value === SPEECH_GAIN)
    expect(voice?.connections).toHaveLength(1)
    expect(voice?.connections[0]).not.toEqual({ name: 'speakers' })
    expect(speech.speaking()).toBe(true)
    expect(report).toHaveBeenCalledWith(
      'said',
      expect.objectContaining({ id: 'intro-a', seconds: 4.2 }),
    )
    // How long it waited, for the device's log.
    const [, detail] =
      report.mock.calls.find(([event]) => event === 'said') ?? []
    expect(detail).toMatchObject({
      clockMs: expect.any(Number),
      readyMs: expect.any(Number),
    })
  })

  it('goes quiet when a line he has no recording of takes over', async () => {
    const { speech, sources } = speechWith()
    speech.say('intro-a')
    await settle()
    speech.say('result-all')
    await settle()
    expect(sources).toHaveLength(1)
    expect(sources[0].stops).toEqual([2 + HUSH_SECONDS])
    expect(speech.speaking()).toBe(false)
  })

  it('fades out at once on a hush', async () => {
    const { speech, sources, gains } = speechWith()
    speech.say('intro-a')
    await settle()
    speech.hush()
    expect(sources[0].stops).toEqual([2 + HUSH_SECONDS])
    const voice = gains.find((g) => g.gain.calls.length > 0)
    expect(voice?.gain.calls).toEqual(['cancel', 'hold', 'to 0'])
  })

  it('never says a line hushed while it was still loading', async () => {
    let arrive: (bytes: { bytes: ArrayBuffer }) => void = () => undefined
    const read = vi.fn(
      () =>
        new Promise<{ bytes: ArrayBuffer }>((resolve) => {
          arrive = resolve
        }),
    )
    const { speech, sources } = speechWith({ read })
    speech.say('intro-a')
    await settle()
    speech.hush()
    arrive({ bytes: new ArrayBuffer(8) })
    await settle()
    expect(sources).toEqual([])
  })

  it('says only the newest of two lines asked for in a row', async () => {
    const { speech, sources } = speechWith()
    speech.say('intro-a')
    speech.say('intro-b')
    await settle()
    expect(sources).toHaveLength(1)
    expect(sources[0].buffer).toMatchObject({ from: LINES['intro-b'] })
  })

  it('says nothing where the clock will not start', async () => {
    const { speech, sources, report } = speechWith({
      audio: () => Promise.resolve(null),
    })
    speech.say('intro-a')
    await settle()
    expect(sources).toEqual([])
    expect(report).toHaveBeenCalledWith('no-clock', { id: 'intro-a' })
  })

  it('says nothing on a clock that has not started', async () => {
    const parked = fakeContext()
    Object.assign(parked.ctx, { state: 'suspended' })
    const { speech, report } = speechWith({
      audio: () => Promise.resolve(parked.ctx),
    })
    speech.say('intro-a')
    await settle()
    expect(parked.sources).toEqual([])
    expect(report).toHaveBeenCalledWith('no-clock', { id: 'intro-a' })
  })

  it('decodes on a context of its own while the clock starts', async () => {
    let start: (ctx: AudioContext) => void = () => undefined
    const { speech, sources, read, decoder, ctx } = speechWith({
      audio: () =>
        new Promise<AudioContext>((resolve) => {
          start = resolve
        }),
    })
    speech.say('intro-a')
    await settle()
    // Read and decoded already, and nothing on the room's clock.
    expect(read).toHaveBeenCalledTimes(1)
    expect(decoder).toHaveBeenCalledTimes(1)
    expect(sources).toEqual([])
    start(ctx)
    await settle()
    expect(sources).toHaveLength(1)
    expect(sources[0].buffer).toMatchObject({ from: LINES['intro-a'] })
  })

  it('says nothing where there is no context to decode with', async () => {
    const { speech, sources, report } = speechWith({ decoder: () => null })
    speech.say('intro-a')
    await settle()
    expect(sources).toEqual([])
    expect(report).toHaveBeenCalledWith(
      'load-failed',
      { id: 'intro-a', error: 'No context to decode with' },
      true,
    )
  })

  it('asks for no clock in a build without his voice', async () => {
    const audio = vi.fn(() => Promise.resolve(null))
    const speech = createMercSpeech(
      { 'intro-a': '' },
      { audio, read: vi.fn(), report: vi.fn() },
    )
    speech.say('intro-a')
    await settle()
    expect(audio).not.toHaveBeenCalled()
  })

  it('reads a recording once, and again after a read that failed', async () => {
    let fail = true
    const read = vi.fn(() =>
      fail
        ? Promise.reject(new Error('Asset was empty'))
        : Promise.resolve({ bytes: new ArrayBuffer(8) }),
    )
    const { speech, sources, report } = speechWith({ read })
    speech.say('intro-a')
    await settle()
    expect(sources).toEqual([])
    expect(report).toHaveBeenCalledWith(
      'load-failed',
      { id: 'intro-a', error: 'Asset was empty' },
      true,
    )
    fail = false
    speech.say('intro-a')
    await settle()
    speech.say('intro-a')
    await settle()
    expect(read).toHaveBeenCalledTimes(2)
    expect(sources).toHaveLength(2)
  })

  it('leaves nothing in the graph once a line has ended', async () => {
    const { speech, sources } = speechWith()
    speech.say('intro-a')
    await settle()
    sources[0].onended?.()
    expect(sources[0].disconnected).toBe(true)
    expect(speech.speaking()).toBe(false)
  })

  it('says nothing more once the room has gone', async () => {
    const { speech, sources, audio } = speechWith()
    speech.say('intro-a')
    await settle()
    speech.dispose()
    expect(sources[0].stops).toEqual([2 + HUSH_SECONDS])
    speech.say('intro-b')
    await settle()
    expect(sources).toHaveLength(1)
    expect(audio).toHaveBeenCalledTimes(1)
  })
})
