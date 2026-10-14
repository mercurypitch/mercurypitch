// ============================================================
// Merc's sampled call: the plan, the fallback and the lazy load
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'
import type { CallSchedule, CallVoice } from './merc-call'
import type { LoadedVoice, VoiceLoaderDeps } from './merc-sampler'
import { createVoiceLoader, planSampledCall, primingOf, SAMPLED_GAIN, samplerCall, } from './merc-sampler'
import { MERC_SAMPLES } from './merc-voice-set'

/** A Beginner 1-3-2 at A3: A3 C#4 B3, 0.9 s each, straight on. */
const BEGINNER: PhraseNote[] = [
  { midi: 57, at: 0, seconds: 0.9 },
  { midi: 61, at: 0.9, seconds: 0.9 },
  { midi: 59, at: 1.8, seconds: 0.9 },
]

const B3_RATE = 2 ** (-2 / 12)

// ── A context that records what is scheduled on it ─────────────

interface Automation {
  readonly calls: (readonly [string, ...number[]])[]
  value: number
}

function param(value = 1): Automation & Record<string, unknown> {
  const p: Automation & Record<string, unknown> = { calls: [], value }
  for (const name of [
    'setValueAtTime',
    'exponentialRampToValueAtTime',
    'linearRampToValueAtTime',
    'setTargetAtTime',
    'cancelScheduledValues',
  ]) {
    p[name] = (...args: number[]) => {
      p.calls.push([name, ...args])
      return p
    }
  }
  return p
}

interface FakeSource {
  buffer: unknown
  playbackRate: Automation
  starts: [number, number][]
  stops: number[]
  onended: (() => void) | null
  disconnect: () => void
}

function fakeContext(now = 0) {
  const sources: FakeSource[] = []
  const gains: { gain: Automation }[] = []
  const ctx = {
    currentTime: now,
    destination: {},
    createGain: () => {
      const node = {
        gain: param(1),
        connect: () => undefined,
        disconnect: () => undefined,
      }
      gains.push(node)
      return node
    },
    createBufferSource: () => {
      const source: FakeSource & Record<string, unknown> = {
        buffer: null,
        playbackRate: param(1),
        starts: [],
        stops: [],
        onended: null,
        connect: () => undefined,
        disconnect: () => undefined,
        start(when: number, offset: number) {
          source.starts.push([when, offset])
        },
        stop(when: number) {
          source.stops.push(when)
        },
      }
      sources.push(source)
      return source
    },
  }
  return { ctx: ctx as unknown as AudioContext, sources, gains }
}

/** A decoded sample whose attack starts at `attack` s. */
function buffer(attack = 0.021, rate = 48_000): AudioBuffer {
  const data = new Float32Array(Math.round(1.555 * rate))
  data.fill(0.5, Math.round(attack * rate))
  return {
    sampleRate: rate,
    length: data.length,
    duration: data.length / rate,
    getChannelData: () => data,
  } as unknown as AudioBuffer
}

function voiceOf(priming = 0): LoadedVoice {
  return {
    buffers: new Map(MERC_SAMPLES.map((s) => [s.midi, buffer()])),
    priming: new Map(MERC_SAMPLES.map((s) => [s.midi, priming])),
  }
}

/** A fallback that records the calls handed to it. */
function recordingFallback() {
  const sung: { notes: readonly PhraseNote[]; startAt: number }[] = []
  const schedule: CallSchedule = { onsets: [], endAt: 0, stop: () => undefined }
  const voice: CallVoice = {
    sing: (_ctx, notes, startAt) => {
      sung.push({ notes, startAt })
      return schedule
    },
  }
  return { voice, sung, schedule }
}

describe('a call planned through the set', () => {
  it('lands each note sung straight on with its held pitch on the onset: its whole attack goes first', () => {
    const plan = planSampledCall(BEGINNER, 1, 0)
    if (!plan.ok) throw new Error(plan.reason)

    expect(plan.notes.map((n) => n.sampleMidi)).toEqual([57, 61, 61])
    expect(plan.notes[2].rate).toBeCloseTo(B3_RATE, 12)
    // 40 ms of sample before the hold: 40 ms at rate 1, longer when slower.
    expect(plan.notes[1].startAt).toBeCloseTo(1.9 - 0.04, 12)
    expect(plan.notes[2].startAt).toBeCloseTo(2.8 - 0.04 / B3_RATE, 12)
    for (const note of plan.notes) expect(note.offset).toBe(0.02)
  })

  it('starts a note after silence a moment early: its attack is what is heard', () => {
    const plan = planSampledCall(BEGINNER, 1, 0)
    if (!plan.ok) throw new Error(plan.reason)

    expect(plan.notes[0].startAt).toBeCloseTo(1 - 0.005, 12)
  })

  it("holds each note at its sample's level, so it is as loud as the synth's", () => {
    const plan = planSampledCall(BEGINNER, 1, 0)
    if (!plan.ok) throw new Error(plan.reason)

    // A3 is 1.4 dB over SAMPLED_GAIN, C#4 1.6 dB (merc-voice-set.ts).
    expect(plan.notes.map((n) => +n.level.toFixed(4))).toEqual([
      +(10 ** (1.4 / 20)).toFixed(4),
      +(10 ** (1.6 / 20)).toFixed(4),
      +(10 ** (1.6 / 20)).toFixed(4),
    ])
  })

  it('joins notes sung straight on: each fades out as the next arrives', () => {
    const plan = planSampledCall(BEGINNER, 1, 0)
    if (!plan.ok) throw new Error(plan.reason)
    const [first, second, last] = plan.notes

    // From 10 ms before the next onset, gone in 40 ms (five time constants).
    expect(first.fadeAt).toBeCloseTo(1.9 - 0.01, 12)
    expect(second.fadeAt).toBeCloseTo(2.8 - 0.01, 12)
    expect(first.fadeTau).toBeCloseTo(0.008, 12)
    expect(first.stopAt).toBeCloseTo(1.89 + 0.04 + 0.06, 12)
    // The next note sounds under it before it goes: no gap between them.
    expect(second.startAt).toBeLessThan(first.fadeAt)
    // The last closes on the house release at its end.
    expect(last.fadeAt).toBeCloseTo(3.7, 12)
    expect(last.fadeTau).toBeCloseTo(0.036, 12)
    expect(last.stopAt).toBeCloseTo(3.7 + 0.24, 12)
  })

  it('closes a note before a rest on the house release', () => {
    const plan = planSampledCall(
      [
        { midi: 57, at: 0, seconds: 0.5 },
        { midi: 60, at: 1, seconds: 0.5 },
      ],
      0,
      0,
    )
    if (!plan.ok) throw new Error(plan.reason)

    expect(plan.notes[0].fadeAt).toBe(0.5)
    expect(plan.notes[0].fadeTau).toBeCloseTo(0.036, 12)
    // After the rest, the next note starts as from silence.
    expect(plan.notes[1].startAt).toBeCloseTo(
      1 - 0.005 / plan.notes[1].rate,
      12,
    )
  })

  it('starts a note due in the past now, further into its sample', () => {
    const plan = planSampledCall(BEGINNER, 1, 1)
    if (!plan.ok) throw new Error(plan.reason)

    expect(plan.notes[0].startAt).toBe(1)
    expect(plan.notes[0].offset).toBeCloseTo(0.025, 12)
  })

  it('cannot sing a call with a note beyond D#2 to G5', () => {
    // A settled E2 puts the 1-3-5 call on D2 (38); a settled C6 on A#5 up.
    const low: PhraseNote[] = [
      { midi: 38, at: 0, seconds: 0.9 },
      { midi: 42, at: 0.9, seconds: 0.9 },
    ]
    const high: PhraseNote[] = [
      { midi: 79, at: 0, seconds: 0.9 },
      { midi: 82, at: 0.9, seconds: 0.9 },
    ]

    expect(planSampledCall(low, 0, 0)).toEqual({
      ok: false,
      reason: 'out-of-reach',
    })
    expect(planSampledCall(high, 0, 0)).toEqual({
      ok: false,
      reason: 'out-of-reach',
    })
    expect(planSampledCall([{ midi: 39, at: 0, seconds: 0.9 }], 0, 0).ok).toBe(
      true,
    )
    expect(planSampledCall([{ midi: 79, at: 0, seconds: 0.9 }], 0, 0).ok).toBe(
      true,
    )
  })

  it('cannot sing a note longer than the sample holds at its rate', () => {
    // G5 is F5 at 1.122: 1.3 s of hold covers 1.158 s of note.
    expect(planSampledCall([{ midi: 79, at: 0, seconds: 1.15 }], 0, 0).ok).toBe(
      true,
    )
    expect(planSampledCall([{ midi: 79, at: 0, seconds: 1.2 }], 0, 0)).toEqual({
      ok: false,
      reason: 'too-long',
    })
  })
})

describe('the sampled call voice', () => {
  it('sings the call from the set: a source per note, on its sample and rate', () => {
    const voice = voiceOf()
    const { ctx, sources, gains } = fakeContext()
    const fallback = recordingFallback()
    const schedule = samplerCall(() => voice, fallback.voice).sing(
      ctx,
      BEGINNER,
      2,
    )

    expect(fallback.sung).toEqual([])
    expect(sources.map((s) => s.buffer)).toEqual([
      voice.buffers.get(57),
      voice.buffers.get(61),
      voice.buffers.get(61),
    ])
    expect(sources[2].playbackRate.value).toBeCloseTo(B3_RATE, 12)
    expect(sources[0].starts).toEqual([[2 - 0.005, 0.02]])
    expect(sources[1].starts[0][0]).toBeCloseTo(2.9 - 0.04, 12)
    expect(gains[0].gain.value).toBe(SAMPLED_GAIN)
    // The seam's schedule: the onsets the notes land on, and the end.
    expect(schedule.onsets.map((t) => +t.toFixed(9))).toEqual([2, 2.9, 3.8])
    expect(schedule.endAt).toBeCloseTo(4.7, 9)
  })

  it("moves each sample's start past the priming silence its decoder left", () => {
    const { ctx, sources } = fakeContext()
    samplerCall(() => voiceOf(0.023), recordingFallback().voice).sing(
      ctx,
      BEGINNER,
      2,
    )

    expect(sources[0].starts[0][1]).toBeCloseTo(0.043, 12)
    expect(sources[0].starts[0][0]).toBeCloseTo(1.995, 12)
  })

  it('hands the call to the fallback while the set loads', () => {
    const { ctx, sources } = fakeContext()
    const fallback = recordingFallback()
    const schedule = samplerCall(() => null, fallback.voice).sing(
      ctx,
      BEGINNER,
      2,
    )

    expect(fallback.sung).toEqual([{ notes: BEGINNER, startAt: 2 }])
    expect(schedule).toBe(fallback.schedule)
    expect(sources).toEqual([])
  })

  it('hands a call beyond its reach to the fallback, whole and at its own pitch', () => {
    const { ctx, sources } = fakeContext()
    const fallback = recordingFallback()
    const settledE2: PhraseNote[] = [
      { midi: 38, at: 0, seconds: 0.9 },
      { midi: 42, at: 0.9, seconds: 0.9 },
      { midi: 45, at: 1.8, seconds: 0.9 },
    ]
    samplerCall(() => voiceOf(), fallback.voice).sing(ctx, settledE2, 1)

    expect(fallback.sung).toEqual([{ notes: settledE2, startAt: 1 }])
    expect(sources).toEqual([])
  })

  it('stops every note it scheduled, once, and no later than planned', () => {
    const { ctx, sources, gains } = fakeContext()
    const schedule = samplerCall(
      () => voiceOf(),
      recordingFallback().voice,
    ).sing(ctx, BEGINNER, 2)
    ;(ctx as { currentTime: number }).currentTime = 2.5
    schedule.stop()
    schedule.stop()

    const master = gains[0].gain.calls.map((call) => call[0])
    expect(master.filter((name) => name === 'setTargetAtTime')).toHaveLength(1)
    // The first note was due to stop before the release ends: it keeps that.
    expect(sources[0].stops.at(-1)).toBeCloseTo(
      Math.min(sources[0].stops[0], 2.74),
      12,
    )
    expect(sources[2].stops.at(-1)).toBeCloseTo(2.5 + 0.24, 12)
  })

  it('schedules nothing for an empty phrase', () => {
    const { ctx, sources } = fakeContext()
    const schedule = samplerCall(
      () => voiceOf(),
      recordingFallback().voice,
    ).sing(ctx, [], 3)

    expect(sources).toEqual([])
    expect(schedule.onsets).toEqual([])
    expect(schedule.endAt).toBe(3)
  })

  it('says which voice sang when it changes, not on every call', () => {
    const report = vi.fn()
    let voice: LoadedVoice | null = null
    const call = samplerCall(() => voice, recordingFallback().voice, report)
    call.sing(fakeContext().ctx, BEGINNER, 1)
    call.sing(fakeContext().ctx, BEGINNER, 1)
    voice = voiceOf()
    call.sing(fakeContext().ctx, BEGINNER, 1)

    expect(report.mock.calls).toEqual([
      ['call', { voice: 'synth', reason: 'loading' }],
      ['call', { voice: 'sampler' }],
    ])
  })
})

describe('priming silence', () => {
  it('is none where the attack sits where the set measured it', () => {
    expect(primingOf(buffer(0.021))).toBe(0)
    expect(primingOf(buffer(0.0204))).toBe(0)
    expect(primingOf(buffer(0.024))).toBe(0)
  })

  it("is the attack's lateness where a decoder kept the encoder's delay", () => {
    // LAME's 1105 samples of delay and padding, kept at 48 kHz: 23 ms.
    expect(primingOf(buffer(0.021 + 1105 / 48_000))).toBeCloseTo(
      1105 / 48_000,
      3,
    )
  })
})

describe('loading the set', () => {
  function deps() {
    const read = vi.fn(async (url: string) => ({
      bytes: new TextEncoder().encode(url).buffer as ArrayBuffer,
      status: 0,
    }))
    const decodeAudioData = vi.fn(async () => buffer())
    const decoder = vi.fn(
      () => ({ decodeAudioData }) as unknown as BaseAudioContext,
    )
    const report = vi.fn()
    return { read, decoder, decodeAudioData, report }
  }
  const samples = MERC_SAMPLES.map((s) => ({ ...s, url: `u${s.midi}` }))

  it('reads nothing until it is asked to load', () => {
    const d = deps()
    const loader = createVoiceLoader(samples, d)

    expect(d.read).not.toHaveBeenCalled()
    expect(loader.loaded()).toBeNull()
  })

  it('reads and decodes each note once, however often it is asked', async () => {
    const d = deps()
    const loader = createVoiceLoader(samples, d)
    const [a, b] = await Promise.all([loader.load(), loader.load()])
    const c = await loader.load()

    expect(a).not.toBeNull()
    expect(b).toBe(a)
    expect(c).toBe(a)
    expect(loader.loaded()).toBe(a)
    expect(d.read).toHaveBeenCalledTimes(10)
    expect(d.read.mock.calls.map(([url]) => url)).toEqual(
      samples.map((s) => s.url),
    )
    expect(d.decodeAudioData).toHaveBeenCalledTimes(10)
    expect([...(a?.buffers.keys() ?? [])]).toEqual(samples.map((s) => s.midi))
    expect(d.report).toHaveBeenCalledWith(
      'decoded',
      expect.objectContaining({ notes: 10, primingMs: 0 }),
    )
  })

  it('keeps none of the set when one note fails to decode, and tries again next time', async () => {
    const d = deps()
    d.decodeAudioData.mockRejectedValueOnce(new Error('EncodingError'))
    const loader = createVoiceLoader(samples, d)

    expect(await loader.load()).toBeNull()
    expect(loader.loaded()).toBeNull()
    expect(d.report).toHaveBeenCalledWith(
      'load-failed',
      { error: 'EncodingError' },
      true,
    )

    expect(await loader.load()).not.toBeNull()
  })

  it('keeps none when a read fails', async () => {
    const d: VoiceLoaderDeps = {
      ...deps(),
      read: () => Promise.reject(new Error('Asset request failed (404)')),
    }
    const loader = createVoiceLoader(samples, d)

    expect(await loader.load()).toBeNull()
    expect(loader.loaded()).toBeNull()
  })

  it('reads nothing where nothing can decode it', async () => {
    const d = deps()
    expect(
      await createVoiceLoader(samples, { ...d, decoder: () => null }).load(),
    ).toBeNull()
    expect(d.read).not.toHaveBeenCalled()
  })

  it('reads nothing in a build that folded the files away', async () => {
    const d = deps()
    const folded = samples.map((s) => ({ ...s, url: '' }))
    expect(await createVoiceLoader(folded, d).load()).toBeNull()
    expect(d.read).not.toHaveBeenCalled()
    expect(d.decoder).not.toHaveBeenCalled()
  })
})

describe("the room's voice", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('loads nothing as the app loads it, and the set once as the singer enters', async () => {
    const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])))
    const decodeAudioData = vi.fn(async () => buffer())
    const contexts: unknown[] = []
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal(
      'OfflineAudioContext',
      vi.fn(function OfflineAudioContext(this: unknown, ...args: unknown[]) {
        contexts.push(args)
        return { decodeAudioData }
      }),
    )
    vi.resetModules()
    const room = await import('./merc-sampler')

    expect(fetch).not.toHaveBeenCalled()
    expect(contexts).toEqual([])

    room.preloadMercVoice()
    room.preloadMercVoice()
    await vi.waitFor(() => expect(decodeAudioData).toHaveBeenCalledTimes(10))

    expect(fetch).toHaveBeenCalledTimes(10)
    expect(contexts).toEqual([[1, 1, 48_000]])
    room.preloadMercVoice()
    await Promise.resolve()
    expect(fetch).toHaveBeenCalledTimes(10)
  })
})
