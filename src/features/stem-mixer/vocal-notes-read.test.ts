// ============================================================
// A song's notes read with no mixer up: the room's read at rest
// ============================================================
//
// The read walks a vocal stood in for by a stream of known chunks, through
// the real walk (streamed-vocal-samples.ts), and keeps what it reads in a
// store held in memory, through the real service the mixer reads its notes
// back from. The pitch read itself is a seam: what is under test is what
// the read does around it, which songs it reads and when it keeps nothing.

import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadPitchAnalysisFromDbStrict, savePitchAnalysisToDbStrict, } from '@/db/services/session-pitch-analysis-service'
import type { MergedNote } from '@/lib/midi-generator'
import type { analyzeVocalSamples, VocalAnalysis } from '@/lib/pitch-pipeline'
import { InMemoryAdapter } from '@/tests/utils/in-memory-db'
import type { StemStreamChunk } from './streaming-stem-voice'

const store = vi.hoisted(() => ({ adapter: null as unknown }))
vi.mock('@/db', () => ({ getDb: async () => store.adapter }))

/** The phone's stream of the vocal: null for a phone that cannot stream. */
const phone = vi.hoisted(() => ({
  stream: null as null | {
    sampleRate: number
    durationSeconds: number
    channelCount: number
    opened: number[]
    disposed: number
    chunks(from: number): AsyncIterable<StemStreamChunk>
    dispose(): void
  },
}))
vi.mock('./stem-stream-source', () => ({
  canStreamStems: () => phone.stream !== null,
  openStemStream: async () => phone.stream,
}))

/** A whole decode: what the room's read must never start. */
const decoding = vi.hoisted(() => ({ probed: 0, decoded: 0 }))
vi.mock('@/lib/audio-duration', () => ({
  audioDurationSecs: async () => {
    decoding.probed += 1
    return 30
  },
}))
vi.mock('@/lib/decode-audio-to-mono', () => ({
  DECODE_RATE: 44_100,
  decodeAudioBytes: async () => {
    decoding.decoded += 1
    throw new Error('not in this test')
  },
}))

const { keepNear, readSongNotes, setVocalNotesSeams } =
  await import('./vocal-notes-read')

const RATE = 44_100

const NOTES: MergedNote[] = [
  { midi: 57, noteName: 'A3', startSec: 0.5, endSec: 1 },
  { midi: 60, noteName: 'C4', startSec: 1.2, endSec: 1.8 },
  { midi: 62, noteName: 'D4', startSec: 2, endSec: 2.6 },
]

function analysis(notes: MergedNote[]): VocalAnalysis {
  return {
    algo: 'yin',
    rawDetections: [],
    contour: [],
    mergedNotes: notes,
    segmentedNotes: notes,
  }
}

/** A decoded chunk of `seconds` from `timestamp`, a quiet tone on channel 0. */
function chunk(timestamp: number, seconds: number): StemStreamChunk {
  const data = new Float32Array(Math.round(seconds * RATE))
  for (let i = 0; i < data.length; i++) data[i] = 0.1 * Math.sin(i / 20)
  const buffer = {
    sampleRate: RATE,
    length: data.length,
    numberOfChannels: 1,
    duration: seconds,
    getChannelData: () => data,
  } as unknown as AudioBuffer
  return { buffer, timestamp }
}

/**
 * A vocal of `seconds` that streams in one-second chunks; `onChunk` runs as
 * each is handed over.
 */
function streamOf(
  seconds: number,
  onChunk: (index: number) => void = () => undefined,
): NonNullable<typeof phone.stream> {
  const made: NonNullable<typeof phone.stream> = {
    sampleRate: RATE,
    durationSeconds: seconds,
    channelCount: 1,
    opened: [],
    disposed: 0,
    chunks(from) {
      made.opened.push(from)
      return (async function* () {
        for (let i = 0; i < Math.ceil(seconds); i++) {
          await Promise.resolve()
          onChunk(i)
          yield chunk(i, Math.min(1, seconds - i))
        }
      })()
    },
    dispose() {
      made.disposed += 1
    },
  }
  return made
}

const vocalBlob = (): Promise<Blob> =>
  Promise.resolve(new Blob([new Uint8Array(1234)], { type: 'audio/mp4' }))

/** The record the mixer reads back, or null. */
const record = (sessionId: string) => loadPitchAnalysisFromDbStrict(sessionId)

let gone: Set<string>
let analyze: Mock<typeof analyzeVocalSamples>

beforeEach(() => {
  store.adapter = new InMemoryAdapter()
  phone.stream = streamOf(3)
  decoding.probed = 0
  decoding.decoded = 0
  gone = new Set()
  analyze = vi.fn<typeof analyzeVocalSamples>(async () => analysis(NOTES))
  setVocalNotesSeams({
    analyze,
    exists: (sessionId) => !gone.has(sessionId),
  })
})

afterEach(() => {
  setVocalNotesSeams(null)
})

describe("the room's read of a song's notes", () => {
  it('reads a song with none from its stream, and keeps them where the mixer looks', async () => {
    const progress: number[] = []
    const read = await readSongNotes('mine', {
      vocal: vocalBlob,
      onProgress: (percent) => progress.push(percent),
    })

    expect(read).toMatchObject({ kind: 'kept', notes: 3 })
    expect((await record('mine'))?.segmentedNotes).toEqual(NOTES)
    // The whole vocal walked from its start, and the stream let go.
    expect(phone.stream?.opened).toEqual([0])
    expect(phone.stream?.disposed).toBe(1)
    // The mixer's window, at the rate the walk kept: every sample here.
    expect(analyze.mock.calls[0][2]).toEqual({ bufferSize: 1024 })
    // Progress only goes forward, to the end.
    expect(progress[0]).toBe(0)
    expect(progress.at(-1)).toBe(100)
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]).toBeGreaterThan(progress[i - 1])
    }
  })

  it('reads nothing of a song that has a record of its notes', async () => {
    await savePitchAnalysisToDbStrict('mine', {
      mergedNotes: NOTES,
      segmentedNotes: NOTES,
      pitchHistory: [],
    })

    const read = await readSongNotes('mine', { vocal: vocalBlob })

    expect(read).toEqual({ kind: 'had-notes' })
    expect(phone.stream?.opened).toEqual([])
    expect(analyze).not.toHaveBeenCalled()
  })

  it('keeps nothing over a record that appeared while it read, edits and all', async () => {
    const edited = [{ midi: 64, noteName: 'E4', startSec: 0, endSec: 1 }]
    analyze.mockImplementation(async () => {
      // The singer turned the notes on meanwhile, and edited one.
      await savePitchAnalysisToDbStrict('mine', {
        mergedNotes: edited,
        segmentedNotes: edited,
        pitchHistory: [],
        editLayer: {
          manual: [],
          deleted: [{ startBeat: 2, endBeat: 3 }],
          seq: 1,
        },
      })
      return analysis(NOTES)
    })

    const read = await readSongNotes('mine', { vocal: vocalBlob })

    expect(read).toEqual({ kind: 'appeared' })
    const kept = await record('mine')
    expect(kept?.segmentedNotes).toEqual(edited)
    expect(kept?.editLayer?.deleted).toEqual([{ startBeat: 2, endBeat: 3 }])
  })

  it('keeps nothing from a read that heard no notes', async () => {
    analyze.mockImplementation(async () => analysis([]))

    const read = await readSongNotes('mine', { vocal: vocalBlob })

    expect(read).toMatchObject({ kind: 'no-notes' })
    expect(await record('mine')).toBeNull()
  })

  it('refuses a song too long for this phone before walking it', async () => {
    // An hour holds more than the walk may, even at every fourth sample.
    phone.stream = streamOf(60 * 60)

    const read = await readSongNotes('mine', { vocal: vocalBlob })

    expect(read).toEqual({ kind: 'too-long', bytes: 1234 })
    expect(phone.stream.opened).toEqual([])
    expect(phone.stream.disposed).toBe(1)
    expect(analyze).not.toHaveBeenCalled()
  })

  it('leaves no record behind a song removed while it was read', async () => {
    analyze.mockImplementation(async () => {
      gone.add('mine')
      return analysis(NOTES)
    })

    const read = await readSongNotes('mine', { vocal: vocalBlob })

    expect(read).toEqual({ kind: 'gone' })
    expect(await record('mine')).toBeNull()
  })

  it('leaves no record behind a song removed while it looked for one', async () => {
    let looks = 0
    setVocalNotesSeams({
      analyze,
      exists: (sessionId) => !gone.has(sessionId),
      hasRecord: async (sessionId) => {
        looks += 1
        // Removed in the studio while the read looked, before keeping.
        if (looks === 2) gone.add(sessionId)
        return (await record(sessionId)) !== null
      },
    })

    const read = await readSongNotes('mine', { vocal: vocalBlob })

    expect(read).toEqual({ kind: 'gone' })
    expect(await record('mine')).toBeNull()
  })

  it('decodes nothing whole on a phone that cannot stream', async () => {
    phone.stream = null

    const read = await readSongNotes('mine', { vocal: vocalBlob })

    expect(read).toEqual({ kind: 'no-stream' })
    expect(decoding).toEqual({ probed: 0, decoded: 0 })
    expect(analyze).not.toHaveBeenCalled()
  })

  it('fails, not reads as no vocal, when the store will not answer for it', async () => {
    // A store that cannot say is tried again at the next launch; a song with
    // no vocal is kept as one (karaoke-notes-reader.ts).
    const stems = (store.adapter as InMemoryAdapter).getRepository(
      'uvrStemBlobs',
    )
    stems.findAll = async () => {
      throw new Error('the store would not answer')
    }

    await expect(readSongNotes('mine')).rejects.toThrow(
      'the store would not answer',
    )
    expect(phone.stream?.opened).toEqual([])
  })

  it('reads nothing of a song with no vocal', async () => {
    const read = await readSongNotes('mine', { vocal: async () => null })

    expect(read).toEqual({ kind: 'no-vocal' })
    expect(phone.stream?.opened).toEqual([])
  })
})

describe('a read stopped part-way', () => {
  it('keeps nothing when stopped during the walk', async () => {
    const controller = new AbortController()
    phone.stream = streamOf(3, (index) => {
      if (index === 1) controller.abort()
    })

    await expect(
      readSongNotes('mine', { vocal: vocalBlob, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(analyze).not.toHaveBeenCalled()
    expect(phone.stream.disposed).toBe(1)
    expect(await record('mine')).toBeNull()
  })

  it('keeps nothing when stopped during the pitch read', async () => {
    const controller = new AbortController()
    analyze.mockImplementation(async () => {
      controller.abort()
      return analysis(NOTES)
    })

    await expect(
      readSongNotes('mine', { vocal: vocalBlob, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(await record('mine')).toBeNull()
  })

  it('keeps nothing when stopped while it looks for a record again', async () => {
    const controller = new AbortController()
    let looks = 0
    setVocalNotesSeams({
      analyze,
      exists: () => true,
      hasRecord: async (sessionId) => {
        looks += 1
        // The second look is the one before keeping.
        if (looks === 2) controller.abort()
        return (await record(sessionId)) !== null
      },
    })

    await expect(
      readSongNotes('mine', { vocal: vocalBlob, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(looks).toBe(2)
    expect(await record('mine')).toBeNull()
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
