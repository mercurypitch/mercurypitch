import { describe, expect, it, vi } from 'vitest'
import type { UvrSession } from '@/stores/uvr-store'
import type { WildAnalysisDeps, WildProgress } from './wild-analysis'
import { CHORD_RATE, chordsOf, decimate, keyOf, monoOf, noteSeconds, readWildSession, STEM_PHASE_PCT, } from './wild-analysis'

vi.mock('@/db/services/uvr-service', () => ({
  getStemBlobUrl: vi.fn(async () => null),
}))

function fakeBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  return {
    numberOfChannels: channels.length,
    sampleRate,
    length: channels[0].length,
    duration: channels[0].length / sampleRate,
    getChannelData: (index: number) => channels[index],
  } as unknown as AudioBuffer
}

const session: UvrSession = {
  sessionId: 's1',
  status: 'completed',
  progress: 100,
  createdAt: 1,
  outputs: { vocal: 'blob:v', instrumental: 'blob:i' },
}

describe('the readings', () => {
  it('folds stereo to mono and decimates by averaging', () => {
    const mono = monoOf(
      fakeBuffer(
        [
          new Float32Array([1, 0, 0.5, 0.5]),
          new Float32Array([0, 0, 0.5, 0.5]),
        ],
        4,
      ),
    )
    expect(Array.from(mono)).toEqual([0.5, 0, 0.5, 0.5])
    expect(Array.from(decimate(new Float32Array([1, 3, 5, 7, 9]), 2))).toEqual([
      2, 6,
    ])
  })

  it('turns the generator ticks into seconds and frames into chords', () => {
    const notes = noteSeconds([{ midi: 64, tickOn: 960, tickOff: 1920 }])
    expect(notes[0]).toEqual({ midi: 64, startS: 1, endS: 2 })
    expect(
      keyOf({
        tonic: 9,
        mode: 'minor',
        confidence: 0.4,
        keyName: 'A',
        scaleType: 'natural-minor',
      }),
    ).toEqual({ tonicPc: 9, mode: 'minor', keyName: 'A' })
    const chords = chordsOf(
      [
        { time: 0, chord: 'C', root: 'C', quality: 'major', confidence: 1 },
        { time: 2, chord: '?', root: 'H', quality: 'unknown', confidence: 0 },
        { time: 3, chord: 'Gm', root: 'G', quality: 'minor', confidence: 1 },
      ],
      5,
    )
    expect(chords).toEqual([
      { rootPc: 0, startS: 0, endS: 2 },
      { rootPc: 7, startS: 3, endS: 5 },
    ])
  })
})

describe('readWildSession', () => {
  function deps(overrides: Partial<WildAnalysisDeps> = {}) {
    const rate = 44_100
    const samples = new Float32Array(rate * 2)
    const chordFrames = vi.fn<WildAnalysisDeps['chordFrames']>(() => [
      { time: 0, chord: 'C', root: 'C', quality: 'major', confidence: 1 },
      { time: 1, chord: 'G', root: 'G', quality: 'major', confidence: 1 },
    ])
    const all: WildAnalysisDeps = {
      stemUrl: async (_session, stem) =>
        stem === 'vocal' ? 'blob:v' : stem === 'instrumental' ? 'blob:i' : null,
      fetchBytes: async () => new ArrayBuffer(4),
      decode: async () => fakeBuffer([samples], rate),
      detectNotes: async (_mono, _rate, onProgress) => {
        onProgress?.(50)
        onProgress?.(100)
        return [{ midi: 64, tickOn: 960, tickOff: 1920 }]
      },
      detectKey: () => ({
        tonic: 0,
        mode: 'major',
        confidence: 0.6,
        keyName: 'C',
        scaleType: 'major',
      }),
      chordFrames,
      ...overrides,
    }
    return { deps: all, chordFrames }
  }

  it('reads the book from the stems, on the instrumental when there is no bass part', async () => {
    const { deps: d, chordFrames } = deps()
    const progress: WildProgress[] = []
    const reading = await readWildSession(session, d, (p) => progress.push(p))
    expect(reading.book.key).toEqual({
      tonicPc: 0,
      mode: 'major',
      keyName: 'C',
    })
    expect(reading.book.home.map((item) => item.degree)).toEqual([3])
    expect(
      reading.book.bassline.map((item) => [item.fromDegree, item.toDegree]),
    ).toEqual([[1, 5]])
    expect(reading.stems.bass).toBeNull()
    // The instrumental, decimated to the chroma rate.
    expect(chordFrames).toHaveBeenCalledTimes(1)
    const [mono, rate] = chordFrames.mock.calls[0]
    expect(rate).toBe(CHORD_RATE)
    expect(mono.length).toBe(Math.floor((44_100 * 2) / 4))
    expect(progress.map((p) => p.phase)).toEqual([
      ...Array.from({ length: progress.length - 4 }, () => 'stems'),
      'notes',
      'notes',
      'chords',
      'chords',
    ])
    expect(progress[progress.length - 1].pct).toBe(100)
  })

  it('names each stem it opens and never lets the bar go backwards', async () => {
    const { deps: d } = deps({
      stemUrl: async (_s, stem) => `blob:${stem}`,
      // A stem served with a Content-Length: the reader reports fractions as
      // the bytes land, which is what the stems phase used to throw away.
      fetchBytes: async (_url, onProgress) => {
        onProgress?.(0)
        onProgress?.(0.5)
        onProgress?.(1)
        return new ArrayBuffer(4)
      },
    })
    const progress: WildProgress[] = []
    await readWildSession(session, d, (p) => progress.push(p))

    const stems = progress.filter((p) => p.phase === 'stems')
    expect([...new Set(stems.map((p) => p.detail))]).toEqual([
      undefined,
      'vocal',
      'instrumental',
      'bass',
    ])
    // Each stem moves the bar while it downloads rather than jumping once.
    for (const stem of ['vocal', 'instrumental', 'bass']) {
      const own = stems.filter((p) => p.detail === stem)
      expect(new Set(own.map((p) => p.pct)).size).toBeGreaterThan(2)
    }
    expect(Math.max(...stems.map((p) => p.pct))).toBe(STEM_PHASE_PCT)
    const pcts = progress.map((p) => p.pct)
    expect(pcts).toEqual([...pcts].sort((a, b) => a - b))
  })

  it('holds the bar still for a stem the server sends without a length', async () => {
    const { deps: d } = deps({
      fetchBytes: async (_url, onProgress) => {
        onProgress?.(null)
        onProgress?.(null)
        return new ArrayBuffer(4)
      },
    })
    const progress: WildProgress[] = []
    await readWildSession(session, d, (p) => progress.push(p))
    const vocal = progress.filter((p) => p.detail === 'vocal')
    // No invented motion: the slice's start, the download's end, the decode.
    expect(vocal.map((p) => p.pct)).toEqual([0, 5, 7])
  })

  it('refuses a song without both stems', async () => {
    const { deps: d } = deps({
      stemUrl: async (_s, stem) => (stem === 'vocal' ? 'blob:v' : null),
    })
    await expect(readWildSession(session, d)).rejects.toThrow(
      'no vocal and instrumental stems',
    )
  })
})
