import { describe, expect, it } from 'vitest'
import { playHoldTone } from './demo-audio'
import type { VoicePoint } from './demo-voice'
import { flutterMakeup, LIP_FLUTTER, playVoiceContour } from './demo-voice'
import { lowNoteOctaveLevel, normalizedFundamental, } from './low-note-reinforcement'

type Call = readonly [
  method: string,
  value: number,
  time: number,
  ...rest: number[],
]

/** An AudioParam that remembers every automation call. */
function recordingParam(initial = 1) {
  const calls: Call[] = []
  const record =
    (method: string) =>
    (value: number, time: number, ...rest: number[]) => {
      calls.push([method, value, time, ...rest])
    }
  return {
    value: initial,
    calls,
    setValueAtTime: record('set'),
    linearRampToValueAtTime: record('linear'),
    exponentialRampToValueAtTime: record('exponential'),
    setTargetAtTime: record('target'),
    cancelScheduledValues: (time: number) => calls.push(['cancel', 0, time]),
  }
}

type Param = ReturnType<typeof recordingParam>

interface FakeNode {
  kind: string
  connections: unknown[]
  disconnected: boolean
  connect: (to: unknown) => unknown
  disconnect: () => void
}

function fakeNode(kind: string): FakeNode {
  const node: FakeNode = {
    kind,
    connections: [],
    disconnected: false,
    connect: (to) => {
      node.connections.push(to)
      return to
    },
    disconnect: () => {
      node.disconnected = true
    },
  }
  return node
}

function fakeContext() {
  const gains: (FakeNode & { gain: Param })[] = []
  const oscillators: (FakeNode & {
    type: string
    frequency: Param
    detune: Param
    starts: number[]
    stops: number[]
    onended: (() => void) | null
  })[] = []
  const filters: (FakeNode & { frequency: Param; Q: Param })[] = []
  const destination = fakeNode('destination')
  const ctx = {
    currentTime: 10,
    destination,
    createGain: () => {
      const node = Object.assign(fakeNode('gain'), { gain: recordingParam() })
      gains.push(node)
      return node
    },
    createOscillator: () => {
      const node = Object.assign(fakeNode('oscillator'), {
        type: 'sine',
        frequency: recordingParam(440),
        detune: recordingParam(0),
        starts: [] as number[],
        stops: [] as number[],
        onended: null as (() => void) | null,
        setPeriodicWave: () => undefined,
        start: (when: number) => node.starts.push(when),
        stop: (when: number) => node.stops.push(when),
      })
      oscillators.push(node)
      return node
    },
    createBiquadFilter: () => {
      const node = Object.assign(fakeNode('filter'), {
        type: 'lowpass',
        frequency: recordingParam(350),
        Q: recordingParam(1),
      })
      filters.push(node)
      return node
    },
    createPeriodicWave: () => ({}),
  }
  return {
    ctx: ctx as unknown as AudioContext,
    gains,
    oscillators,
    filters,
    destination,
  }
}

/** A breath, a note that scoops up and drifts, a rest, a short second note. */
const LINE: VoicePoint[] = [
  { t: 0, cents: 0, level: 0 },
  { t: 0.5, cents: -30, level: 0.6 },
  { t: 1, cents: 0, level: 0.8 },
  { t: 2, cents: 50, level: 0.8 },
  { t: 2.5, cents: 0, level: 0 },
  { t: 3, cents: 0, level: 0 },
  { t: 3.5, cents: 10, level: 0.7 },
  { t: 4, cents: 0, level: 0.7 },
]

const VIBRATO = { hz: 5.5, cents: 14, rampSec: 0.35 }

function play() {
  const fake = fakeContext()
  const handle = playVoiceContour(fake.ctx, LINE, {
    hz: 220,
    startAt: 11,
    vibrato: VIBRATO,
  })
  // master, level, vibrato depth; voice, vibrato
  const [master, level, depth] = fake.gains
  const [voice, lfo] = fake.oscillators
  return { ...fake, handle, master, level, depth, voice, lfo }
}

describe('playVoiceContour', () => {
  it('follows the line in cents, on the note it is given', () => {
    const { voice } = play()
    expect(voice.frequency.value).toBe(220)
    const detune = voice.detune.calls
    // Each run jumps to its first point, then ramps through the rest.
    expect(detune.filter(([m]) => m === 'set')).toEqual([
      ['set', -30, 11.5],
      ['set', 10, 14.5],
    ])
    expect(detune.filter(([m]) => m === 'linear')).toEqual([
      ['linear', 0, 12],
      ['linear', 50, 13],
      ['linear', 0, 15],
    ])
  })

  it('opens each note from the floor and closes each rest on a target', () => {
    const { level } = play()
    const calls = level.gain.calls
    // First note: exponential attack from 1e-4.
    expect(calls).toContainEqual(['set', 0.0001, 11.5])
    expect(calls).toContainEqual([
      'exponential',
      expect.closeTo(0.18, 3),
      11.59,
    ])
    // Its rest: anchored at its level, then a setTargetAtTime (len 0.18).
    expect(calls).toContainEqual(['set', expect.closeTo(0.24, 3), 13.5])
    expect(calls).toContainEqual(['target', 0, 13.5, expect.closeTo(0.036, 6)])
    // The second note opens from the floor again.
    expect(calls).toContainEqual(['set', 0.0001, 14.5])
    expect(calls.some(([m, v]) => m === 'linear' && v === 0)).toBe(false)
  })

  it('grows the vibrato in after every onset', () => {
    const { depth, lfo, voice } = play()
    expect(lfo.frequency.value).toBe(5.5)
    expect(depth.connections).toContain(voice.detune)
    expect(depth.gain.calls).toEqual([
      ['set', 0, 11],
      ['set', 0, 11.5],
      ['linear', 14, 11.85],
      ['set', 0, 14.5],
      ['linear', 14, 14.85],
    ])
    expect(lfo.starts).toEqual([11])
  })

  it('stops only after the last release has died away', () => {
    const { voice, lfo, level } = play()
    const lastClose = level.gain.calls.filter(([m]) => m === 'target').pop()
    expect(lastClose).toBeDefined()
    if (lastClose === undefined) return
    const [, , close, tau] = lastClose
    const stop = voice.stops[0]
    expect(lfo.stops[0]).toBe(stop)
    // Below -50 dB of its level by the time the oscillator stops.
    expect(Math.exp(-(stop - close) / (tau ?? 1))).toBeLessThan(0.003)
  })

  it('closes on stop() with a setTargetAtTime, never a linear ramp', () => {
    const { handle, master, voice, lfo } = play()
    handle.stop()
    handle.stop()
    const calls = master.gain.calls
    expect(calls).toContainEqual(['cancel', 0, 10])
    expect(calls).toContainEqual(['target', 0, 10, expect.closeTo(0.036, 6)])
    expect(calls.some(([m]) => m === 'linear')).toBe(false)
    expect(voice.stops[voice.stops.length - 1]).toBeCloseTo(10.24, 6)
    expect(lfo.stops[lfo.stops.length - 1]).toBeCloseTo(10.24, 6)
    // Called twice, closed once.
    expect(calls.filter(([m]) => m === 'target')).toHaveLength(1)
  })

  it('leaves nothing connected once it has ended', () => {
    const { voice, gains } = play()
    voice.onended?.()
    expect(voice.disconnected).toBe(true)
    expect(gains.every((gain) => gain.disconnected)).toBe(true)
  })

  it('goes where it is sent', () => {
    const fake = fakeContext()
    const bus = fakeNode('bus')
    playVoiceContour(fake.ctx, LINE, {
      hz: 220,
      destination: bus as unknown as AudioNode,
    })
    expect(fake.gains[0].connections).toEqual([bus])
  })
})

describe("playVoiceContour's timbres", () => {
  const colourOf = (timbre?: 'ooh' | 'hum') => {
    const fake = fakeContext()
    playVoiceContour(fake.ctx, LINE, { hz: 110, timbre })
    const [filter] = fake.filters
    return { hz: filter.frequency.value, q: filter.Q.value }
  }

  it('sings an open "ooh" unless told otherwise', () => {
    expect(colourOf()).toEqual(colourOf('ooh'))
    expect(colourOf('ooh').hz).toBe(2600)
  })

  it('hums through a lower, slightly resonant filter: the same partials, duller', () => {
    const ooh = colourOf('ooh')
    const hum = colourOf('hum')
    expect(hum.hz).toBeLessThan(ooh.hz / 2)
    expect(hum.q).toBeGreaterThan(ooh.q)
    // A low hum on a phone speaker still reaches its overtones: A2's 8th.
    expect(hum.hz).toBeGreaterThan(110 * 8)
  })
})

describe("playVoiceContour's lip buzz", () => {
  function buzz() {
    const fake = fakeContext()
    const handle = playVoiceContour(fake.ctx, LINE, {
      hz: 130,
      startAt: 11,
      flutter: LIP_FLUTTER,
    })
    // master, level, the lips' gain, the flutter's amount; voice, flutter
    const [master, level, lips, amount] = fake.gains
    const [voice, shape] = fake.oscillators
    return { ...fake, handle, master, level, lips, amount, voice, shape }
  }

  it('flutters 25 times a second, the lip rate of a trill', () => {
    const { shape } = buzz()
    expect(LIP_FLUTTER.hz).toBe(25)
    expect(shape.frequency.value).toBe(25)
  })

  it('swings the loudness from full down to 1 - depth, never below silence', () => {
    const { lips, amount } = buzz()
    const swing = LIP_FLUTTER.depth / 2
    expect(lips.gain.value).toBeCloseTo(1 - swing, 9)
    expect(amount.gain.value).toBeCloseTo(swing, 9)
    // The shape peaks at 1 either way: the gain runs 1 - depth to 1.
    expect(lips.gain.value + amount.gain.value).toBeCloseTo(1, 9)
    expect(lips.gain.value - amount.gain.value).toBeCloseTo(
      1 - LIP_FLUTTER.depth,
      9,
    )
    expect(1 - LIP_FLUTTER.depth).toBeGreaterThan(0)
  })

  it('sits between the line and the speaker, moving the loudness, not the pitch', () => {
    const { level, lips, amount, master, shape, voice } = buzz()
    expect(level.connections).toEqual([lips])
    expect(lips.connections).toEqual([master])
    expect(shape.connections).toEqual([amount])
    expect(amount.connections).toEqual([lips.gain])
    expect(voice.detune.calls.some((c) => c[0] === 'set')).toBe(true)
    expect(shape.connections).not.toContain(voice.detune)
  })

  it('starts with the line, stops with it, and leaves nothing connected', () => {
    const { voice, shape, gains, oscillators } = buzz()
    expect(shape.starts).toEqual([11])
    expect(shape.stops).toEqual(voice.stops)
    voice.onended?.()
    for (const node of [...gains, ...oscillators]) {
      expect(node.disconnected, node.kind).toBe(true)
    }
  })

  it('leaves a line without it as it was: straight to the speaker', () => {
    const fake = fakeContext()
    playVoiceContour(fake.ctx, LINE, { hz: 130 })
    const [master, level] = fake.gains
    expect(level.connections).toEqual([master])
    expect(fake.oscillators).toHaveLength(1)
  })
})

describe("playVoiceContour's low-note octave", () => {
  // Asked (the premium rooms ask), a line that goes below C3 gets the
  // classic engine's help on a small speaker: a sine an octave up, at the
  // engine's level relative to the voice's fundamental, fading in below C3
  // as the line's pitch moves, under the voice's own filter and envelope.
  const OOH_PARTIALS = [0, 1, 0.62, 0.38, 0.24, 0.14, 0.08, 0.045, 0.025]
  const E2 = 82.41

  function low(hz = E2, lowNoteOctave = true) {
    const fake = fakeContext()
    const handle = playVoiceContour(fake.ctx, LINE, {
      hz,
      startAt: 11,
      vibrato: VIBRATO,
      lowNoteOctave,
    })
    // voice, octave, vibrato
    const [voice, octave, lfo] = fake.oscillators
    const octaveLevel = fake.gains.find((gain) =>
      octave?.connections.includes(gain),
    )
    return { ...fake, handle, voice, octave, lfo, octaveLevel }
  }

  it('sings a sine an octave up, following the line in cents', () => {
    const { voice, octave } = low()
    expect(octave.type).toBe('sine')
    expect(octave.frequency.value).toBeCloseTo(E2 * 2, 9)
    expect(octave.detune.calls).toEqual(voice.detune.calls)
  })

  it("sets the octave's level from the line's pitch, point by point", () => {
    const { octaveLevel } = low()
    expect(octaveLevel).toBeDefined()
    const fundamental = normalizedFundamental(OOH_PARTIALS)
    const expected = LINE.map((point, i) => [
      i === 0 ? 'set' : 'linear',
      expect.closeTo(
        lowNoteOctaveLevel(E2 * 2 ** (point.cents / 1200)) * fundamental,
        9,
      ),
      11 + point.t,
    ])
    expect(octaveLevel?.gain.calls).toEqual(expected)
  })

  it("goes through the voice's filter, so the voice's envelope shapes it", () => {
    const { octaveLevel, filters, voice } = low()
    expect(octaveLevel?.connections).toEqual([filters[0]])
    expect(voice.connections).toEqual([filters[0]])
  })

  it('wavers with the vibrato, and starts and stops with the voice', () => {
    const { octave, voice, gains } = low()
    const depth = gains.find((gain) => gain.connections.includes(voice.detune))
    expect(depth?.connections).toContain(octave.detune)
    expect(octave.starts).toEqual(voice.starts)
    expect(octave.stops).toEqual(voice.stops)
  })

  it('closes with the voice on stop(), and leaves nothing connected', () => {
    const { handle, octave, voice, gains, oscillators } = low()
    handle.stop()
    expect(octave.stops.at(-1)).toBe(voice.stops.at(-1))
    voice.onended?.()
    for (const node of [...gains, ...oscillators]) {
      expect(node.disconnected, node.kind).toBe(true)
    }
  })

  it('fades out as the line climbs past C3', () => {
    // From just under C3 to a tone above it: the octave is there at the
    // start and gone once the line is over C3.
    const fake = fakeContext()
    playVoiceContour(
      fake.ctx,
      [
        { t: 0, cents: 0, level: 0.8 },
        { t: 1, cents: 200, level: 0.8 },
        { t: 1.5, cents: 200, level: 0 },
      ],
      { hz: 123.47, startAt: 11, lowNoteOctave: true },
    )
    const [, octave] = fake.oscillators
    const level = fake.gains.find((gain) => octave.connections.includes(gain))
    const values = level?.gain.calls.map(([, value]) => value) ?? []
    expect(values[0]).toBeGreaterThan(0)
    expect(values[1]).toBe(0)
  })

  it('adds nothing to a line at C3 and above, or when not asked', () => {
    // Voice and vibrato only, as before.
    expect(low(220).oscillators).toHaveLength(2)
    expect(low(E2, false).oscillators).toHaveLength(2)
  })
})

describe('flutterMakeup', () => {
  // The flutter dips the level and never lifts it, so a buzzed line is
  // quieter than the line: Lip roll's demo measured 4.5 to 5 LU under its
  // own count-in tone (EBU R128, Chromium's render, 15 Oct). The makeup is
  // the gain that gives the line its loudness back: 1 over the RMS of the
  // swing, computed here apart from the code (numpy, 2^16 points of the
  // shape, normalised to a peak of 1 as Web Audio does).
  it("gives Lip roll's buzz back the 4.0 dB its flutter takes", () => {
    expect(flutterMakeup(LIP_FLUTTER)).toBeCloseTo(1.589, 2)
  })

  it('adds nothing where nothing flutters, and more the deeper it goes', () => {
    expect(flutterMakeup({ hz: 25, depth: 0 })).toBeCloseTo(1, 6)
    const shallow = flutterMakeup({ hz: 25, depth: 0.4 })
    expect(shallow).toBeGreaterThan(1)
    expect(flutterMakeup(LIP_FLUTTER)).toBeGreaterThan(shallow)
  })
})

describe('the older demo sounds', () => {
  it('still close on their quick ramp', () => {
    const fake = fakeContext()
    playHoldTone(fake.ctx, 220).stop()
    const [master] = fake.gains
    expect(master.gain.calls).toContainEqual(['linear', 0.0001, 10.04])
    expect(master.connections).toEqual([fake.destination])
  })
})
