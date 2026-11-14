// ============================================================
// Lesson recording tests — a take kept in memory, and played back as sung
// ============================================================
//
// Lesson 14 WEB-SPEC, Tests 10, with a fake MediaRecorder and a spied
// AudioContext: the recorder runs over the stream it is given and records
// only between its start and its stop; a take discarded keeps nothing; the
// shelf keeps a new take 2 in the old one's place and Delete drops both;
// nothing is written to storage or sent; playback starts through the page's
// one "now playing" owner from 0.2 s before the voice, another sound stops
// it, and with the sound off it plays nothing; two takes at different levels
// play at the same peak through one gain each, so a take's own swell is
// kept, and the gain goes straight to the speakers, past the compressor.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSoundOwner } from './now-playing'
import type { KeptTake } from './record'
import type { PartUnder } from './record'
import { canRecord, gainFor, keepTake, LEAD_IN_SEC, PART_LEAD_SEC, PART_TAIL_SEC, peakOf, PLAYBACK_PEAK, playTake, playWithPart, recorderFor, startOf, TakeShelf, } from './record'
import { Sound } from './sound'

/** A MediaRecorder double: records its stream, its state, and hands over one chunk on stop. */
class FakeRecorder {
  static made: FakeRecorder[] = []
  static isTypeSupported = (mime: string): boolean => mime === 'audio/webm'
  state: RecordingState = 'inactive'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  constructor(
    readonly stream: MediaStream,
    readonly options: { mimeType: string },
  ) {
    FakeRecorder.made.push(this)
  }
  start(): void {
    this.state = 'recording'
  }
  stop(): void {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['take'], { type: 'audio/webm' }) })
    this.onstop?.()
  }
  addEventListener(): void {}
  removeEventListener(): void {}
}

/** An AudioBuffer double: one channel of `samples` at 100 samples a second. */
function bufferOf(samples: readonly number[]): AudioBuffer {
  const data = Float32Array.from(samples)
  return {
    numberOfChannels: 1,
    length: data.length,
    duration: data.length / 100,
    sampleRate: 100,
    getChannelData: () => data,
  } as unknown as AudioBuffer
}

/** A spied AudioContext: what each buffer source is started at, and where each gain goes. */
function contextDouble(decoded: AudioBuffer) {
  const sources: {
    buffer: AudioBuffer | null
    started: [number, number] | null
    stopAt: number | null
    stopped: boolean
    onended: (() => void) | null
    to: unknown[]
  }[] = []
  const gains: {
    gain: { value: number }
    ramps: [string, number, number][]
    to: unknown[]
  }[] = []
  const destination = { name: 'speakers' }
  const context = {
    currentTime: 10,
    state: 'running',
    destination,
    decodeAudioData: vi.fn(() => Promise.resolve(decoded)),
    resume: () => Promise.resolve(),
    createBufferSource() {
      const s = {
        buffer: null as AudioBuffer | null,
        started: null as [number, number] | null,
        stopped: false,
        onended: null as (() => void) | null,
        to: [] as unknown[],
        connect(n: unknown) {
          s.to.push(n)
        },
        start(when: number, offset: number) {
          s.started = [when, offset]
        },
        stopAt: null as number | null,
        stop(when?: number) {
          // a stop booked ahead only marks when; one now ends it
          if (when !== undefined) {
            s.stopAt = when
            return
          }
          s.stopped = true
          s.onended?.()
        },
      }
      sources.push(s)
      return s
    },
    createGain() {
      const g = {
        ramps: [] as [string, number, number][],
        gain: {
          value: 1,
          setValueAtTime(v: number, t: number) {
            g.ramps.push(['set', v, t])
          },
          linearRampToValueAtTime(v: number, t: number) {
            g.ramps.push(['ramp', v, t])
          },
        },
        to: [] as unknown[],
        connect(n: unknown) {
          g.to.push(n)
        },
      }
      gains.push(g)
      return g
    },
  }
  return {
    context: context as unknown as AudioContext,
    sources,
    gains,
    destination,
  }
}

const kept = (samples: readonly number[], voicedAt = 1): KeptTake => {
  const buffer = bufferOf(samples)
  return { buffer, gain: gainFor(buffer), voicedAt, length: buffer.duration }
}

// jsdom's Blob has no arrayBuffer(), which every browser's has
const hadBytes = typeof Blob.prototype.arrayBuffer === 'function'

beforeEach(() => {
  if (!hadBytes)
    Blob.prototype.arrayBuffer = function (this: Blob) {
      return Promise.resolve(new ArrayBuffer(this.size))
    }
  FakeRecorder.made = []
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  Sound.set('on')
})

afterEach(() => {
  if (!hadBytes)
    delete (Blob.prototype as { arrayBuffer?: unknown }).arrayBuffer
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
  Sound.set('unset')
})

describe('recording a take', () => {
  it('records the stream it is given, only between start and stop, and hands over its audio', async () => {
    // Arrange
    const media = { id: 'the listener’s stream' } as unknown as MediaStream
    const tape = recorderFor(media)

    // Act
    const started = tape?.start()
    const recording = FakeRecorder.made[0]?.state
    const blob = await tape?.stop()

    // Assert
    expect(canRecord()).toBe(true)
    expect(started).toBe(true)
    expect(FakeRecorder.made[0]?.stream).toBe(media)
    expect(recording).toBe('recording')
    expect(FakeRecorder.made[0]?.state).toBe('inactive')
    expect(blob?.size).toBeGreaterThan(0)
  })

  it('can record nothing in a browser with no MediaRecorder, or none of its formats', () => {
    // Arrange
    vi.stubGlobal('MediaRecorder', undefined)

    // Act
    const none = [canRecord(), recorderFor({} as MediaStream)]
    vi.stubGlobal(
      'MediaRecorder',
      Object.assign(FakeRecorder, { isTypeSupported: () => false }),
    )
    const formatless = [canRecord(), recorderFor({} as MediaStream)]
    FakeRecorder.isTypeSupported = (mime: string) => mime === 'audio/webm'

    // Assert
    expect(none).toEqual([false, null])
    expect(formatless).toEqual([false, null])
  })

  it('discards a take with no voice, or one abandoned, and hands over nothing', async () => {
    // Arrange
    const tape = recorderFor({} as MediaStream)
    tape?.start()

    // Act
    tape?.discard()
    const blob = await tape?.stop()

    // Assert
    expect(blob).toBeNull()
  })

  it('decodes a take on the page’s context and keeps it with its gain and its voice’s start', async () => {
    // Arrange
    const decoded = bufferOf([0, 0.1, -0.25, 0.2])
    const { context } = contextDouble(decoded)

    // Act
    const take = await keepTake(new Blob(['take']), context, 1.3)

    // Assert
    expect(take).toEqual({
      buffer: decoded,
      gain: PLAYBACK_PEAK / 0.25,
      voicedAt: 1.3,
      length: decoded.duration,
    })
  })

  it('keeps nothing where nothing was captured, or the audio will not decode', async () => {
    // Arrange
    const { context } = contextDouble(bufferOf([0.1]))
    vi.spyOn(context, 'decodeAudioData').mockRejectedValue(
      new Error('EncodingError'),
    )

    // Act
    const nothing = await keepTake(null, context, 1)
    const broken = await keepTake(new Blob(['take']), context, 1)

    // Assert
    expect([nothing, broken]).toEqual([null, null])
  })
})

describe('the shelf', () => {
  it('keeps a new take 2 in the old one’s place, and Delete drops both', () => {
    // Arrange
    const shelf = new TakeShelf()
    const one = kept([0.1])
    const two = kept([0.2])
    const again = kept([0.3])
    shelf.set(1, one)
    shelf.set(2, two)

    // Act
    shelf.set(2, again)
    const before = [shelf.get(1), shelf.get(2), shelf.size]
    shelf.clear()

    // Assert
    expect(before).toEqual([one, again, 2])
    expect([shelf.get(1), shelf.get(2), shelf.size]).toEqual([null, null, 0])
  })

  it('writes nothing to storage, IndexedDB or the Cache, and sends nothing, from record to Delete', async () => {
    // Arrange
    const spies = [
      vi.spyOn(Storage.prototype, 'setItem'),
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response()),
    ]
    const beacon = vi.fn()
    const xhr = vi.fn()
    const idb = vi.fn()
    const caches = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: beacon })
    vi.stubGlobal('XMLHttpRequest', xhr)
    vi.stubGlobal('indexedDB', { open: idb })
    vi.stubGlobal('caches', { open: caches })
    const { context } = contextDouble(bufferOf([0.1, 0.3]))
    const owner = createSoundOwner()
    const shelf = new TakeShelf()

    // Act: a whole take's life, recorded, kept, played, deleted
    const tape = recorderFor({} as MediaStream)
    tape?.start()
    const take = await keepTake((await tape?.stop()) ?? null, context, 0.5)
    if (take !== null) shelf.set(1, take)
    const playback = take === null ? null : playTake(take, context, owner)
    playback?.stop()
    shelf.clear()

    // Assert
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
    for (const fn of [beacon, xhr, idb, caches])
      expect(fn).not.toHaveBeenCalled()
    expect(take).not.toBeNull()
  })
})

describe('playing a take back', () => {
  it('starts through the now-playing owner, from 0.2 s before the voice, stopping the sound before it', () => {
    // Arrange
    const { context, sources } = contextDouble(bufferOf([0.1]))
    const owner = createSoundOwner()
    const before = vi.fn()
    owner.claim(before)
    const take = kept(new Array(500).fill(0.2), 1.5)

    // Act
    const playback = playTake(take, context, owner)

    // Assert
    expect(before).toHaveBeenCalledOnce()
    expect(sources[0]?.started).toEqual([10, 1.5 - LEAD_IN_SEC])
    expect(startOf(take)).toBeCloseTo(1.3)
    expect(playback).not.toBeNull()
  })

  it('stops when another sound takes the owner, and says it was not heard to its end', async () => {
    // Arrange
    const { context, sources } = contextDouble(bufferOf([0.1]))
    const owner = createSoundOwner()
    const playback = playTake(kept(new Array(500).fill(0.2)), context, owner)

    // Act: Merc's phrase claims the owner
    owner.claim(() => undefined)

    // Assert
    expect(sources[0]?.stopped).toBe(true)
    await expect(playback?.done).resolves.toBe(false)
  })

  it('says a take played to its end was heard, and lets the owner go', async () => {
    // Arrange
    const { context, sources } = contextDouble(bufferOf([0.1]))
    const owner = createSoundOwner()
    const next = vi.fn()
    const playback = playTake(kept(new Array(500).fill(0.2)), context, owner)

    // Act
    sources[0]?.onended?.()
    owner.claim(next)

    // Assert
    await expect(playback?.done).resolves.toBe(true)
    expect(sources[0]?.stopped).toBe(false)
  })

  it('keeps the position where a playback stopped, and the take’s end once it played to it', () => {
    // Arrange: a 5 s take, voiced from 1 s, so played from 0.8 s
    const { context, sources } = contextDouble(bufferOf([0.1]))
    const clock = context as unknown as { currentTime: number }
    const take = kept(new Array(500).fill(0.2))
    const cut = playTake(take, context, createSoundOwner())
    clock.currentTime += 1.5

    // Act
    const playing = cut?.position()
    cut?.stop()
    clock.currentTime += 2
    const stopped = cut?.position()
    const whole = playTake(take, context, createSoundOwner())
    sources[1]?.onended?.()

    // Assert
    expect(playing).toBeCloseTo(2.3, 9)
    expect(stopped).toBeCloseTo(2.3, 9)
    expect(whole?.position()).toBe(5)
  })

  it('stops when every sound stops: the Sound switch turned off', async () => {
    // Arrange
    const { context, sources } = contextDouble(bufferOf([0.1]))
    const playback = playTake(
      kept(new Array(500).fill(0.2)),
      context,
      createSoundOwner(),
    )

    // Act
    Sound.set('off')

    // Assert
    expect(sources[0]?.stopped).toBe(true)
    await expect(playback?.done).resolves.toBe(false)
  })

  it('plays nothing with the sound off, or while a take is open', () => {
    // Arrange
    const { context, sources } = contextDouble(bufferOf([0.1]))
    const take = kept([0.2])

    // Act
    Sound.set('off')
    const off = playTake(take, context, createSoundOwner())
    Sound.set('on')
    Sound.hush(true)
    const hushed = playTake(take, context, createSoundOwner())
    Sound.hush(false)

    // Assert
    expect([off, hushed]).toEqual([null, null])
    expect(sources).toHaveLength(0)
  })

  it('starts from where the seek bar left it, and seeking alone starts nothing', () => {
    // Arrange
    const { context, sources } = contextDouble(bufferOf([0.1]))
    const take = kept(new Array(620).fill(0.2), 1)

    // Act: the seek bar's value is only where the next play starts
    const seeked = 2.4
    const before = sources.length
    playTake(take, context, createSoundOwner(), seeked)

    // Assert
    expect(before).toBe(0)
    expect(sources[0]?.started).toEqual([10, 2.4])
  })

  it('plays two takes sung at different levels at the same peak, through one gain each, straight to the speakers', () => {
    // Arrange: a quiet take and one four times louder
    const { context, gains, sources, destination } = contextDouble(
      bufferOf([0.1]),
    )
    const quiet = kept([0.05, -0.1, 0.08])
    const loud = kept([0.2, -0.4, 0.32])

    // Act
    playTake(quiet, context, createSoundOwner())
    playTake(loud, context, createSoundOwner())

    // Assert: each peak times its gain is the one playback peak
    expect(peakOf(quiet.buffer) * (gains[0]?.gain.value ?? 0)).toBeCloseTo(
      PLAYBACK_PEAK,
    )
    expect(peakOf(loud.buffer) * (gains[1]?.gain.value ?? 0)).toBeCloseTo(
      PLAYBACK_PEAK,
    )
    expect(sources[0]?.to).toEqual([gains[0]])
    expect(gains[0]?.to).toEqual([destination])
  })

  it('keeps a take’s own swell: a take 6 dB louder in its middle plays 6 dB louder there', () => {
    // Arrange: 0.25 at its ends, twice that, 6 dB more, in its middle
    const take = kept([0.25, 0.25, 0.5, 0.5, 0.25, 0.25])

    // Act: one gain for the whole take
    const out = Array.from(take.buffer.getChannelData(0)).map(
      (s) => s * take.gain,
    )

    // Assert
    const db = 20 * Math.log10((out[2] ?? 0) / (out[0] ?? 1))
    expect(db).toBeCloseTo(6.02, 1)
    expect(Math.max(...out)).toBeCloseTo(PLAYBACK_PEAK)
  })
})

describe('playing a take back with its part (Lesson 28)', () => {
  /** The part under a take: bars 1 to 8 at 72 BPM, its bookings kept, its voice a double. */
  function partOf(onset: number) {
    const booked: number[] = []
    const voice = { stop: vi.fn() }
    const part: PartUnder = {
      book: (at) => {
        booked.push(at)
        return voice
      },
      seconds: 26.67,
      onset,
    }
    return { part, booked, voice }
  }

  it('books the part from its bar 1 a moment from now, and the take so its voice plays as late as it came in the run', () => {
    // Arrange: the voice 0.9 s into the recording, sung 0.3 s after bar 1
    const { context, sources } = contextDouble(bufferOf([0.1]))
    const { part, booked } = partOf(0.3)
    vi.spyOn(performance, 'now').mockReturnValue(5000)

    // Act
    const playback = playWithPart(
      kept(new Array(3000).fill(0.2), 0.9),
      context,
      createSoundOwner(),
      part,
    )

    // Assert: P = 10.1 s on the audio clock; the take's 0.9 s plays at P + 0.3
    expect(booked).toEqual([PART_LEAD_SEC])
    expect(sources[0]?.started?.[0]).toBeCloseTo(10 + PART_LEAD_SEC, 9)
    expect(sources[0]?.started?.[1]).toBeCloseTo(0.6, 9)
    expect(playback?.bar1).toBeCloseTo(5000 + PART_LEAD_SEC * 1000, 9)
  })

  it('starts the recording later where it holds less before the voice than the singer was late', () => {
    // Arrange: the voice 0.2 s into the recording, sung 0.5 s after bar 1
    const { context, sources } = contextDouble(bufferOf([0.1]))

    // Act
    playWithPart(
      kept(new Array(3000).fill(0.2), 0.2),
      context,
      createSoundOwner(),
      partOf(0.5).part,
    )

    // Assert: start(P + late - O, 0)
    expect(sources[0]?.started?.[0]).toBeCloseTo(10 + PART_LEAD_SEC + 0.3, 9)
    expect(sources[0]?.started?.[1]).toBe(0)
  })

  it('ends the take with the part’s last note, fading over its release, and lasts as long as the part', async () => {
    // Arrange
    vi.useFakeTimers()
    const { context, sources, gains } = contextDouble(bufferOf([0.1]))
    const take = kept(new Array(3000).fill(0.2), 0.9)
    const playback = playWithPart(
      take,
      context,
      createSoundOwner(),
      partOf(0).part,
    )
    let heard: boolean | null = null
    void playback?.done.then((h) => {
      heard = h
    })
    const end = 10 + PART_LEAD_SEC + 26.67

    // Act: the recording runs out 1 s before the part does
    ;(context as unknown as { currentTime: number }).currentTime = end - 1
    sources[0]?.onended?.()
    await Promise.resolve()
    const early = heard
    vi.advanceTimersByTime((1 + PART_TAIL_SEC) * 1000)
    await Promise.resolve()

    // Assert
    expect(sources[0]?.stopAt).toBeCloseTo(end + PART_TAIL_SEC, 9)
    expect(gains[0]?.ramps).toEqual([
      ['set', take.gain, end],
      ['ramp', 0, end + PART_TAIL_SEC],
    ])
    expect(gains[0]?.to).toEqual([
      (context as unknown as { destination: unknown }).destination,
    ])
    expect(early).toBeNull()
    expect(heard).toBe(true)
  })

  it('is one sound: it stops what sounded before, and another sound stops the take and the part', async () => {
    // Arrange
    const { context, sources } = contextDouble(bufferOf([0.1]))
    const owner = createSoundOwner()
    const before = vi.fn()
    owner.claim(before)
    const { part, voice } = partOf(0)
    const playback = playWithPart(
      kept(new Array(3000).fill(0.2), 0.9),
      context,
      owner,
      part,
    )

    // Act
    owner.claim(() => undefined)

    // Assert
    expect(before).toHaveBeenCalledOnce()
    expect(sources[0]?.stopped).toBe(true)
    expect(voice.stop).toHaveBeenCalledOnce()
    await expect(playback?.done).resolves.toBe(false)
  })

  it('stops when every sound stops, and plays nothing with the sound off or while a take is open', async () => {
    // Arrange
    const { context, sources } = contextDouble(bufferOf([0.1]))
    const take = kept(new Array(3000).fill(0.2), 0.9)
    const { part, booked } = partOf(0)
    const playing = playWithPart(take, context, createSoundOwner(), part)

    // Act
    Sound.set('off')
    const off = playWithPart(take, context, createSoundOwner(), part)
    Sound.set('on')
    Sound.hush(true)
    const hushed = playWithPart(take, context, createSoundOwner(), part)
    Sound.hush(false)

    // Assert
    await expect(playing?.done).resolves.toBe(false)
    expect(sources[0]?.stopped).toBe(true)
    expect([off, hushed]).toEqual([null, null])
    expect([sources.length, booked.length]).toEqual([1, 1])
  })
})
