// ============================================================
// Reading a song of the singer's own, on samples made here
// ============================================================
//
// The read's edges (the phone's store, the stream, the room's pitch read)
// are seams; behind them is a song made to a known answer: three lines of
// pure notes, synced lyrics, and a band of clicks at 120 bpm.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MergedNote } from '@/lib/midi-generator'
import type { VocalAnalysis } from '@/lib/pitch-pipeline'
import { BAND_RATE } from './entry-rules'
import type { BandSpan, BandStretch, OwnSongReadSeams } from './own-song-read'
import { keepNear, readOwnSong, setOwnSongReadSeams } from './own-song-read'

// A phone that cannot stream: the stems are decoded whole, where they fit.
vi.mock('@/features/stem-mixer/stem-stream-source', () => ({
  openStemStream: async () => null,
}))

/** Each stem's length as the phone tells it, s; by the blob's contents. */
const lengths = vi.hoisted(() => ({
  of: {} as Record<string, number | null>,
}))
vi.mock('@/lib/audio-duration', () => ({
  audioDurationSecs: async (blob: Blob) =>
    lengths.of[await blob.text()] ?? null,
}))

const RATE = 44_100
const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

const LINES = [
  { from: 2, to: 4, midi: 57, words: 'Lay down your weary head' },
  { from: 6.5, to: 8, midi: 60, words: 'And close your eyes' },
  { from: 10.5, to: 11.8, midi: 57, words: 'Goodbye to spring' },
]

const NOTES: MergedNote[] = LINES.map((line) => ({
  midi: line.midi,
  noteName: line.midi === 57 ? 'A3' : 'C4',
  startSec: line.from,
  endSec: line.to,
}))

const LRC = LINES.map(
  (line) => `[00:${line.from.toFixed(2).padStart(5, '0')}] ${line.words}`,
).join('\n')

function vocal(): Float32Array {
  const samples = new Float32Array(12 * RATE)
  for (const line of LINES) {
    const f = hz(line.midi)
    for (let i = Math.round(line.from * RATE); i < line.to * RATE; i++) {
      samples[i] = 0.5 * Math.sin((2 * Math.PI * f * i) / RATE)
    }
  }
  return samples
}

/** The band from `span.from` to `span.to` at `rate`: a click every half second from 0.25 s. */
function clicks(span: BandSpan, rate: number): Float32Array {
  const samples = new Float32Array(Math.round((span.to - span.from) * rate))
  const scale = rate / BAND_RATE
  let state = 7
  const random = (): number => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
  for (let i = 0; i < samples.length; i++) samples[i] = 0.01 * (random() - 0.5)
  for (let t = 0.25; t < span.to; t += 0.5) {
    if (t < span.from) continue
    const at = Math.round((t - span.from) * rate)
    for (let i = 0; i < 220 * scale && at + i < samples.length; i++) {
      samples[at + i] += 0.8 * (random() * 2 - 1) * Math.exp(-i / (40 * scale))
    }
  }
  return samples
}

/** The band at `span`, as a phone that streams reads it. */
function clicksAt(span: BandSpan): BandStretch {
  return { samples: clicks(span, BAND_RATE), rate: BAND_RATE, start: span.from }
}

/** A stem, its contents its name; jsdom's Blob reads as neither, a phone's does. */
const blob = (name: string): Blob =>
  Object.assign(new Blob([name], { type: 'audio/mp4' }), {
    text: async () => name,
    arrayBuffer: async () => new TextEncoder().encode(name).buffer,
  })

function seams(over: Partial<OwnSongReadSeams> = {}): OwnSongReadSeams {
  const made: OwnSongReadSeams = {
    stem: vi.fn(async (_id, type) => blob(type)),
    storedNotes: vi.fn(async () => NOTES),
    keepNotes: vi.fn(async () => undefined),
    syncedLyrics: vi.fn(async () => LRC),
    vocal: vi.fn(async (_blob, run) => {
      run.onProgress(0.5)
      run.onProgress(1)
      return { samples: vocal(), sampleRate: RATE, step: 1 }
    }),
    band: vi.fn(async (_blob, spans) => spans.map(clicksAt)),
    analyze: vi.fn(
      async () =>
        ({
          algo: 'yin',
          rawDetections: [],
          contour: [],
          mergedNotes: NOTES,
          segmentedNotes: NOTES,
        }) as unknown as VocalAnalysis,
    ),
    breathe: async () => undefined,
    now: () => 0,
    ...over,
  }
  setOwnSongReadSeams(made)
  return made
}

/** The read's edges, with the phone's own reads of the vocal and the band. */
function phoneSeams(): void {
  const made = seams()
  setOwnSongReadSeams({
    stem: made.stem,
    storedNotes: made.storedNotes,
    keepNotes: made.keepNotes,
    syncedLyrics: made.syncedLyrics,
    analyze: made.analyze,
    breathe: made.breathe,
    now: made.now,
  })
}

afterEach(() => {
  setOwnSongReadSeams(null)
})

describe("a song of the singer's own", () => {
  it('reads its entries: the notes, the lines and their words, the beats', async () => {
    const edges = seams()
    const progress: number[] = []
    const read = await readOwnSong('mine', {
      onProgress: (percent) => progress.push(percent),
    })

    expect(read.entries.map((entry) => entry.midi)).toEqual([57, 60, 57])
    expect(read.entries.map((entry) => entry.words)).toEqual(
      LINES.map((line) => line.words),
    )
    for (const [i, entry] of read.entries.entries()) {
      expect(entry.at).toBeGreaterThan(LINES[i].from - 0.15)
      expect(entry.at).toBeLessThanOrEqual(LINES[i].from)
    }
    // The band's lead-ins carry the clicks' grid: four beats each.
    expect(read.entries.map((entry) => entry.beats.length)).toEqual([4, 4, 4])
    // Only the lead-ins were read of the band, not the whole song.
    const spans = vi.mocked(edges.band).mock.calls[0][1]
    expect(spans).toHaveLength(3)
    for (const [i, span] of spans.entries()) {
      expect(span.to).toBeCloseTo(read.entries[i].at + 0.3, 3)
    }
    // The room had read it: its notes are used as they are, and kept as they were.
    expect(edges.analyze).not.toHaveBeenCalled()
    expect(edges.keepNotes).not.toHaveBeenCalled()
    // Progress only goes forward, to the end.
    expect(progress[0]).toBe(0)
    expect(progress[progress.length - 1]).toBe(100)
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]).toBeGreaterThan(progress[i - 1])
    }
  })

  it('reads one the Karaoke room has not, as the room would, and keeps the notes for it', async () => {
    const edges = seams({
      storedNotes: vi.fn(async () => null),
      vocal: vi.fn(async () => ({
        samples: vocal(),
        sampleRate: RATE,
        step: 2,
      })),
    })
    const read = await readOwnSong('mine')

    expect(read.entries).toHaveLength(3)
    expect(edges.analyze).toHaveBeenCalledTimes(1)
    // The mixer's window, the same span of time at the rate kept.
    expect(vi.mocked(edges.analyze).mock.calls[0][2]).toEqual({
      bufferSize: 512,
    })
    expect(edges.keepNotes).toHaveBeenCalledWith(
      'mine',
      expect.objectContaining({ segmentedNotes: NOTES }),
    )
  })

  it('keeps nothing from a read that heard no notes', async () => {
    const edges = seams({
      storedNotes: vi.fn(async () => null),
      analyze: vi.fn(
        async () =>
          ({
            algo: 'yin',
            rawDetections: [],
            contour: [],
            mergedNotes: [],
            segmentedNotes: [],
          }) as unknown as VocalAnalysis,
      ),
    })
    const read = await readOwnSong('mine')

    expect(read.entries).toEqual([])
    expect(edges.keepNotes).not.toHaveBeenCalled()
    expect(edges.band).not.toHaveBeenCalled()
  })

  it('finds its lines where the voice comes in after a breath when its lyrics are not synced', async () => {
    seams({ syncedLyrics: vi.fn(async () => null) })
    const read = await readOwnSong('mine')

    expect(read.entries.map((entry) => entry.midi)).toEqual([57, 60, 57])
    expect(read.entries.every((entry) => entry.words === '')).toBe(true)
  })

  it('keeps its entries without beats when the band will not read', async () => {
    seams({
      band: vi.fn(async () => {
        throw new Error('no decoder')
      }),
    })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const read = await readOwnSong('mine')

    expect(read.entries).toHaveLength(3)
    expect(read.entries.every((entry) => entry.beats.length === 0)).toBe(true)
  })

  it('leaves out a song with no voice to read, and says why', async () => {
    const edges = seams({
      stem: vi.fn(async (_id, type) => (type === 'vocal' ? null : blob(type))),
    })
    expect(await readOwnSong('mine')).toEqual({
      entries: [],
      dropped: [],
      out: 'no-voice',
    })
    expect(edges.vocal).not.toHaveBeenCalled()
  })

  it('leaves out a song too long for the phone to hold, and reads no further', async () => {
    const edges = seams({ vocal: vi.fn(async () => null) })
    expect(await readOwnSong('mine')).toEqual({
      entries: [],
      dropped: [],
      out: 'too-long',
    })
    expect(edges.analyze).not.toHaveBeenCalled()
    expect(edges.band).not.toHaveBeenCalled()
  })

  it('stops when the room lets go', async () => {
    const controller = new AbortController()
    seams({
      vocal: vi.fn(async () => {
        controller.abort()
        return { samples: vocal(), sampleRate: RATE, step: 1 }
      }),
    })
    await expect(
      readOwnSong('mine', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('on a phone that cannot stream', () => {
  /** The stems decoded, in order, by their contents. */
  let decoded: string[] = []
  /** The channels read of each decode: "vocal 0". */
  let channels: string[] = []

  class OfflineDecoder {
    async decodeAudioData(bytes: ArrayBuffer): Promise<AudioBuffer> {
      const name = new TextDecoder().decode(bytes)
      decoded.push(name)
      const data =
        name === 'vocal' ? vocal() : clicks({ from: 0, to: 12 }, RATE)
      return {
        sampleRate: RATE,
        length: data.length,
        duration: data.length / RATE,
        numberOfChannels: 2,
        getChannelData: (channel: number) => {
          channels.push(`${name} ${channel}`)
          return data
        },
      } as unknown as AudioBuffer
    }
  }

  beforeEach(() => {
    decoded = []
    channels = []
    lengths.of = { vocal: 12, instrumental: 12 }
    vi.stubGlobal('OfflineAudioContext', OfflineDecoder)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('decodes one stem at a time, the vocal first, and keeps one channel of it', async () => {
    phoneSeams()
    const read = await readOwnSong('mine')

    expect(read.entries.map((entry) => entry.midi)).toEqual([57, 60, 57])
    expect(decoded).toEqual(['vocal', 'instrumental'])
    expect(channels).toEqual(['vocal 0', 'instrumental 0'])
  })

  it('leaves out, without decoding it, a vocal too long to decode whole', async () => {
    // Seven minutes would stream at every second sample; whole, it cannot.
    lengths.of.vocal = 7 * 60
    phoneSeams()

    expect(await readOwnSong('mine')).toEqual({
      entries: [],
      dropped: [],
      out: 'too-long',
    })
    expect(decoded).toEqual([])
  })

  it('reads no beats from a band too long to decode whole', async () => {
    lengths.of.instrumental = 7 * 60
    phoneSeams()
    const read = await readOwnSong('mine')

    expect(read.entries).toHaveLength(3)
    expect(read.entries.every((entry) => entry.beats.length === 0)).toBe(true)
    expect(decoded).toEqual(['vocal'])
  })
})

describe('the screen, while a song is read', () => {
  it('draws after every line and every lead-in', async () => {
    const breathe = vi.fn(async () => undefined)
    seams({ breathe, now: () => 0 })
    const read = await readOwnSong('mine')

    expect(read.entries).toHaveLength(3)
    // Three lines and three lead-ins, each followed by a moment however quick.
    expect(breathe).toHaveBeenCalledTimes(6)
  })

  it('draws inside a line or a lead-in that runs past a slice', async () => {
    let clock = 0
    const breathe = vi.fn(async () => undefined)
    // Each look at the clock finds 5 ms of work done since the last.
    seams({ breathe, now: () => (clock += 5) })
    const read = await readOwnSong('mine')

    expect(read.entries).toHaveLength(3)
    expect(breathe.mock.calls.length).toBeGreaterThan(30)
  })

  it('stops at the next moment for the screen when the room lets go', async () => {
    const controller = new AbortController()
    let moments = 0
    seams({
      breathe: async () => {
        moments += 1
        if (moments === 2) controller.abort()
      },
    })
    await expect(
      readOwnSong('mine', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(moments).toBe(2)
  })
})

describe('keeping samples near a rate', () => {
  it('keeps the mean of a whole number of them', () => {
    const kept = keepNear(
      Float32Array.from([1, 3, 5, 7, 9, 11, 13]),
      48_000,
      16_000,
    )
    expect(kept.rate).toBe(16_000)
    expect(Array.from(kept.samples)).toEqual([3, 9])
    const same = Float32Array.from([1, 2])
    expect(keepNear(same, 22_050, 16_000).samples).toBe(same)
  })
})
