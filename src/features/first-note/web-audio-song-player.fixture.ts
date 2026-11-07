// ============================================================
// First note's Web Audio player under test: a clock the test moves, stems
// that count what is asked of them
// ============================================================
//
// jsdom has no audio graph and no decoder. The player under test is the
// real one, and so is Karaoke's streaming voice it plays each stem with
// (stem-mixer/streaming-stem-voice.ts, handed in by the test file): only
// the context, the stems' files and their decoder are doubles. The context keeps every gain it made, what
// each was told and when, and every window the voice scheduled; its clock
// moves only when the test moves it, as the audio thread would. A stem's
// samples are all one level, so a window says which stem it came from.

import { vi } from 'vitest'
import type { FirstNoteEntry, FirstNoteSong } from './first-note-songs'
import type { OpenStem, SongStreams, StemChunk } from './web-audio-song-player'

export const RATE = 48_000
/** What the decoder yields at a time, s: an AAC packet is about 21 ms. */
const CHUNK_SECONDS = 0.5

/** The band's samples, and the voice's: a window says which stem it is. */
export const BAND_LEVEL = 0.5
export const VOICE_LEVEL = 0.25

export interface ParamOp {
  readonly op: 'set' | 'linear' | 'exp' | 'target' | 'cancel'
  readonly at: number
  readonly value?: number
  readonly tau?: number
}

class FakeParam {
  value = 1
  readonly ops: ParamOp[] = []
  setValueAtTime(value: number, at: number): void {
    this.value = value
    this.ops.push({ op: 'set', value, at })
  }
  linearRampToValueAtTime(value: number, at: number): void {
    this.value = value
    this.ops.push({ op: 'linear', value, at })
  }
  exponentialRampToValueAtTime(value: number, at: number): void {
    this.value = value
    this.ops.push({ op: 'exp', value, at })
  }
  setTargetAtTime(value: number, at: number, tau: number): void {
    this.value = value
    this.ops.push({ op: 'target', value, at, tau })
  }
  cancelScheduledValues(at: number): void {
    this.ops.push({ op: 'cancel', at })
  }
}

export class FakeNode {
  readonly connections: unknown[] = []
  disconnected = false
  connect(target: unknown): void {
    this.connections.push(target)
  }
  disconnect(): void {
    this.disconnected = true
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam()
}

/** A window the voice scheduled: what it plays, from when, until when. */
export class FakeSource extends FakeNode {
  buffer: AudioBuffer | null = null
  readonly playbackRate = { value: 1 }
  onended: (() => void) | null = null
  startedAt: number | null = null
  /** Every stop asked of it: a clock time, or -1 for "now". */
  readonly stops: number[] = []
  start(when: number): void {
    this.startedAt = when
  }
  stop(at?: number): void {
    this.stops.push(at ?? -1)
  }
  /** The stem this window plays: its samples' level. */
  level(): number {
    return this.buffer?.getChannelData(0)[0] ?? 0
  }
  /** Played to its end. */
  end(): void {
    this.onended?.()
  }
}

function fakeBuffer(
  channels: number,
  frames: number,
  sampleRate: number,
  level = 0,
): AudioBuffer {
  const data = Array.from({ length: channels }, () =>
    new Float32Array(frames).fill(level),
  )
  return {
    numberOfChannels: channels,
    length: frames,
    sampleRate,
    duration: frames / sampleRate,
    getChannelData: (channel: number) => data[channel],
    copyToChannel: (source: Float32Array, channel: number, offset = 0) => {
      data[channel].set(source, offset)
    },
  } as unknown as AudioBuffer
}

/** The room's clock: it moves when the test moves it. */
export class FakeClock extends EventTarget {
  currentTime = 0
  state = 'running'
  readonly sampleRate = RATE
  readonly destination = new FakeNode()
  readonly gains: FakeGain[] = []
  readonly sources: FakeSource[] = []
  createGain(): FakeGain {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain
  }
  createBufferSource(): FakeSource {
    const source = new FakeSource()
    this.sources.push(source)
    return source
  }
  createBuffer(channels: number, frames: number, rate: number): AudioBuffer {
    return fakeBuffer(channels, frames, rate)
  }
  /** iOS takes the sound (a call, another app): the clock stops, and says so. */
  interrupt(): void {
    this.state = 'interrupted'
    this.dispatchEvent(new Event('statechange'))
  }
  get context(): AudioContext {
    return this as unknown as AudioContext
  }
  /** The gains that feed the room's output (room-output.ts): the stems'. */
  stemGains(): FakeGain[] {
    const bus = this.gains.find((gain) =>
      gain.connections.includes(this.destination),
    )
    return this.gains.filter((gain) => gain.connections.includes(bus))
  }
  /** The windows scheduled from the stem whose samples are `level`. */
  windowsOf(level: number): FakeSource[] {
    return this.sources.filter((source) => source.level() === level)
  }
}

/** A stem `seconds` long, decoded on demand, counting what was pulled. */
export class FakeStem implements OpenStem {
  /** Where each playback asked to start, song s. */
  readonly asked: number[] = []
  /** Song seconds decoded so far. */
  pulledSeconds = 0
  disposed = false
  private readonly level: number
  private readonly seconds: number

  constructor(level: number, seconds: number) {
    this.level = level
    this.seconds = seconds
  }

  async *chunks(fromSeconds: number): AsyncGenerator<StemChunk> {
    this.asked.push(fromSeconds)
    for (let t = fromSeconds; t < this.seconds - 1e-9; t += CHUNK_SECONDS) {
      const length = Math.min(CHUNK_SECONDS, this.seconds - t)
      this.pulledSeconds += length
      yield {
        buffer: fakeBuffer(2, Math.round(length * RATE), RATE, this.level),
        timestamp: t,
      }
    }
  }

  dispose(): void {
    this.disposed = true
  }
}

/** A song's stems as files the fake decoder tells apart by their size. */
export interface FakeSongFiles {
  readonly song: FirstNoteSong
  readonly band: FakeStem
  readonly voice: FakeStem
}

/** A song of `seconds` with `entries`, its stems at an example's URLs. */
export function fakeSong(
  slug: string,
  entries: readonly FirstNoteEntry[],
  seconds = 200,
): FakeSongFiles {
  return {
    song: {
      slug,
      sessionId: slug,
      kind: 'example',
      title: slug,
      artist: '',
      credit: '',
      stems: {
        vocal: `/karaoke/examples/${slug}/vocal.m4a`,
        instrumental: `/karaoke/examples/${slug}/instrumental.m4a`,
      },
      entries,
    },
    band: new FakeStem(BAND_LEVEL, seconds),
    voice: new FakeStem(VOICE_LEVEL, seconds),
  }
}

/**
 * Karaoke's streams around the fake decoder: `fetch` serves each stem's URL
 * a file of a size of its own, and `open` finds the stem by that size.
 * `voice` is Karaoke's own, which the test file imports and hands in (a
 * test file may reach into another feature; this helper may not). Installs
 * the `fetch`; undo with `vi.unstubAllGlobals()`.
 */
export function fakeStreams(
  songs: readonly FakeSongFiles[],
  voice: SongStreams['voice'],
  canStream = true,
): SongStreams & { readonly opened: string[] } {
  const files = new Map<string, { size: number; stem: FakeStem }>()
  for (const { song, band, voice } of songs) {
    files.set(song.stems.instrumental, { size: 64 + files.size, stem: band })
    files.set(song.stems.vocal, { size: 64 + files.size, stem: voice })
  }
  vi.stubGlobal('fetch', async (url: string) => {
    const file = files.get(url)
    return {
      ok: file !== undefined,
      status: file === undefined ? 404 : 200,
      arrayBuffer: async () => new ArrayBuffer(file?.size ?? 0),
    }
  })
  const opened: string[] = []
  return {
    opened,
    canStream: () => canStream,
    open: async (blob) => {
      for (const [url, file] of files) {
        if (file.size !== blob.size) continue
        opened.push(url)
        return file.stem
      }
      return null
    },
    voice,
  }
}

/** Frames as the screen draws them: one each 16 ms of the fake timers. */
export function stubFrames(): void {
  vi.stubGlobal('requestAnimationFrame', (step: FrameRequestCallback) =>
    setTimeout(() => step(0), 16),
  )
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
}
