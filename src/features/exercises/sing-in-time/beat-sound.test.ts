import { describe, expect, it, vi } from 'vitest'
import type { InTimeEngine } from './beat-sound'
import { COUNT_BEATS, createInTimeSound, DO_BEATS, LEAD_BEATS, tuneBars, } from './beat-sound'
import { seeded } from './take-frames.fixture'
import { planTune, TUNE_BEATS } from './tune-plan'

const TUNE = planTune({
  level: 7,
  clef: 'treble',
  voice: 'alto',
  random: seeded(9),
})

// ── A context that records what is booked into it ───────────────────

type Call = readonly [string, ...number[]]

interface FakeParam {
  value: number
  readonly calls: Call[]
  setValueAtTime(v: number, t: number): void
  exponentialRampToValueAtTime(v: number, t: number): void
  setTargetAtTime(v: number, t: number, c: number): void
  cancelScheduledValues(t: number): void
}

function param(value = 1): FakeParam {
  const calls: Call[] = []
  return {
    value,
    calls,
    setValueAtTime: (v, t) => calls.push(['set', v, t]),
    exponentialRampToValueAtTime: (v, t) => calls.push(['exp', v, t]),
    setTargetAtTime: (v, t, c) => calls.push(['target', v, t, c]),
    cancelScheduledValues: (t) => calls.push(['cancel', t]),
  }
}

interface FakeNode {
  readonly to: unknown[]
  connect(n: unknown): void
  disconnect(): void
}

interface FakeGain extends FakeNode {
  readonly gain: FakeParam
}

interface FakeSource extends FakeNode {
  readonly starts: number[]
  readonly stops: number[]
  start(t: number): void
  stop(t: number): void
}

interface FakeOsc extends FakeSource {
  type: string
  readonly frequency: FakeParam
}

interface FakeBufferSource extends FakeSource {
  buffer: unknown
}

interface FakeFilter extends FakeNode {
  type: string
  readonly frequency: FakeParam
  readonly Q: FakeParam
}

function node(): FakeNode {
  const to: unknown[] = []
  return { to, connect: (n) => to.push(n), disconnect: () => {} }
}

function source(): FakeSource {
  const starts: number[] = []
  const stops: number[] = []
  return {
    ...node(),
    starts,
    stops,
    start: (t) => starts.push(t),
    stop: (t) => stops.push(t),
  }
}

function recordingContext(state: AudioContextState = 'running') {
  const gains: FakeGain[] = []
  const oscs: FakeOsc[] = []
  const sources: FakeBufferSource[] = []
  const filters: FakeFilter[] = []
  const ctx = {
    state,
    currentTime: 10,
    sampleRate: 48000,
    destination: { name: 'out' },
    createGain: (): FakeGain => {
      const g = { ...node(), gain: param() }
      gains.push(g)
      return g
    },
    createOscillator: (): FakeOsc => {
      const o = { ...source(), type: '', frequency: param() }
      oscs.push(o)
      return o
    },
    createBufferSource: (): FakeBufferSource => {
      const s = { ...source(), buffer: null }
      sources.push(s)
      return s
    },
    createBiquadFilter: (): FakeFilter => {
      const f = { ...node(), type: '', frequency: param(), Q: param() }
      filters.push(f)
      return f
    },
    createBuffer: (_c: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
    getOutputTimestamp: () => ({ contextTime: 9.95, performanceTime: 5000 }),
  }
  return { ctx: ctx as unknown as AudioContext, gains, oscs, sources, filters }
}

const engineOf = (ctx: AudioContext | null): InTimeEngine => ({
  getAudioContext: () => ctx,
  getVolume: () => 0.8,
  getMetronomeVolume: () => 0.5,
})

// ── The bars ────────────────────────────────────────────────────────

describe('a tune, as bars on the beat clock', () => {
  it("opens on Merc's do and the count-in's four clicks, then the tune's two bars", () => {
    const list = tuneBars(TUNE, {
      lead: true,
      tune: true,
      click: false,
      voiced: true,
    })
    expect(list.map((b) => b.beats)).toEqual([DO_BEATS, COUNT_BEATS, 4, 4])
    expect(list.reduce((n, b) => n + b.beats, 0)).toBe(LEAD_BEATS + TUNE_BEATS)
    expect(list[0].hits).toEqual([
      {
        beat: 0,
        data: {
          kind: 'do',
          midi: TUNE.doMidi,
          seconds: DO_BEATS * (60 / TUNE.bpm) * 0.8,
        },
      },
    ])
    expect(list[1].hits.map((h) => h.data)).toEqual([
      { kind: 'click', accent: true, count: true },
      { kind: 'click', accent: false, count: true },
      { kind: 'click', accent: false, count: true },
      { kind: 'click', accent: false, count: true },
    ])
  })

  it('sounds each note on its own beat in its own bar, most of its length', () => {
    const list = tuneBars(TUNE, {
      lead: false,
      tune: true,
      click: false,
      voiced: true,
    })
    const notes = list.flatMap((bar, k) =>
      bar.hits.map((h) => ({ at: k * 4 + h.beat, data: h.data })),
    )
    expect(notes.map((n) => n.at)).toEqual(TUNE.notes.map((n) => n.beat))
    for (const [i, n] of notes.entries())
      expect(n.data).toEqual({
        kind: 'note',
        index: i,
        midi: TUNE.notes[i].midi,
        seconds: TUNE.notes[i].beats * (60 / TUNE.bpm) * 0.9,
      })
  })

  it('clicks under the singing only when asked, softer than the count-in', () => {
    const quiet = tuneBars(TUNE, {
      lead: true,
      tune: true,
      click: false,
      voiced: false,
    })
    expect(quiet.slice(2).every((b) => b.hits.length === 0)).toBe(true)
    const clicking = tuneBars(TUNE, {
      lead: true,
      tune: true,
      click: true,
      voiced: false,
    })
    for (const bar of clicking.slice(2))
      expect(bar.hits.map((h) => h.data)).toEqual([
        { kind: 'click', accent: true, count: false },
        { kind: 'click', accent: false, count: false },
        { kind: 'click', accent: false, count: false },
        { kind: 'click', accent: false, count: false },
      ])
  })

  it('plays the do alone for Hear do', () => {
    const list = tuneBars(TUNE, {
      lead: true,
      tune: false,
      click: true,
      voiced: true,
    })
    expect(list).toHaveLength(1)
    expect(list[0].hits[0].data.kind).toBe('do')
  })
})

// ── The sound ───────────────────────────────────────────────────────

describe("the drill's sound", () => {
  it('is silent with no audio context, or one not running: the clock keeps the page’s time', () => {
    for (const ctx of [null, recordingContext('suspended').ctx]) {
      const sound = createInTimeSound(engineOf(ctx))
      expect(sound.audible()).toBe(false)
      expect(sound.env.audioTime()).toBeNull()
      expect(sound.env.bus(() => {})).toBeNull()
    }
  })

  it("plays into a bus of the run's own at the app's volume, and fades it out once closed", () => {
    vi.useFakeTimers()
    const rec = recordingContext()
    const sound = createInTimeSound(engineOf(rec.ctx))
    expect(sound.audible()).toBe(true)
    expect(sound.env.audioTime()).toBe(10)
    expect(sound.env.outputStamp()).toEqual({
      contextTime: 9.95,
      performanceTime: 5000,
    })
    const closed = vi.fn()
    const bus = sound.env.bus(closed)
    if (bus === null) throw new Error('no bus')
    expect(rec.gains[0].gain.calls).toEqual([['set', 0.8, 10]])
    expect(rec.gains[0].to).toEqual([rec.ctx.destination])
    bus.close()
    bus.close()
    expect(closed).toHaveBeenCalledTimes(1)
    expect(bus.open).toBe(false)
    expect(rec.gains[0].gain.calls.at(-1)).toEqual(['target', 0, 10, 0.03 / 5])
    vi.useRealTimers()
  })

  it('books a click as band-passed noise on the pop-free envelope, the bar’s first brighter', () => {
    const rec = recordingContext()
    const sound = createInTimeSound(engineOf(rec.ctx))
    const bus = sound.env.bus(() => {})
    if (bus === null) throw new Error('no bus')
    sound.book({ kind: 'click', accent: true, count: true }, 12, bus)
    sound.book({ kind: 'click', accent: false, count: false }, 13, bus)
    const [accent, under] = rec.filters
    expect(accent.type).toBe('bandpass')
    expect(accent.frequency.calls[0]).toEqual(['set', 3200, 12])
    expect(under.frequency.calls[0]).toEqual(['set', 2200, 13])
    // the envelopes: from the floor, up in 1.5 ms, then away
    const [, first, second] = rec.gains
    expect(first.gain.calls[0]).toEqual(['set', 1e-4, 12])
    expect(first.gain.calls[1][0]).toBe('exp')
    expect(first.gain.calls[1][1]).toBeCloseTo(0.9 * 0.5, 9)
    expect(first.gain.calls[2][0]).toBe('target')
    // under the singing: the metronome's level, softer still
    expect(second.gain.calls[1][1]).toBeCloseTo(0.6 * 0.55 * 0.5, 9)
    // each source stopped only after its release and the slack
    expect(rec.sources[0].starts).toEqual([12])
    expect(rec.sources[0].stops[0]).toBeCloseTo(12 + 0.12, 9)
  })

  it('books a note as a warm voice: its pitch and two quiet partials, released before it stops', () => {
    const rec = recordingContext()
    const sound = createInTimeSound(engineOf(rec.ctx))
    const bus = sound.env.bus(() => {})
    if (bus === null) throw new Error('no bus')
    sound.book({ kind: 'note', index: 0, midi: 69, seconds: 0.9 }, 12, bus)
    expect(rec.oscs.map((o) => o.frequency.calls[0])).toEqual([
      ['set', 440, 12],
      ['set', 880, 12],
      ['set', 1320, 12],
    ])
    const env = rec.gains[1]
    expect(env.gain.calls[0]).toEqual(['set', 1e-4, 12])
    expect(env.gain.calls[1]).toEqual(['exp', 0.32, 12 + 0.025])
    expect(env.gain.calls.at(-1)).toEqual(['target', 0, 12.9, 0.12 / 5])
    for (const o of rec.oscs)
      expect(o.stops[0]).toBeCloseTo(12.9 + 0.12 + 0.06, 9)
  })
})
