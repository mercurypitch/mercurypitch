// ============================================================
// Lesson sound tests — a sung contour's shape, and a stop that never pops
// ============================================================
//
// jsdom cannot render audio, so these tests record what the page schedules
// on a fake AudioContext and replay it against the Web Audio curve
// definitions: the pitch must hold and glide exponentially through every
// point, the envelope must open on the house attack from the 1e-4 floor,
// and every scheduled stop must land below -40 dB, as the app's tail net
// asks of its own voices (src/tests/audio-engine.test.ts). With sound off,
// `canPlay` says no in one of two toasts, each with its Turn on button: a
// play that runs silently will be seen, one that needs sound can't play.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as SoundKit from './sound'
import type { FakeGain } from './sound-doubles.test-fixtures'
import { AUDIBLE, FakeContext, FakeNode, valueAt, } from './sound-doubles.test-fixtures'
import type * as TimbreKit from './timbre'

// Lesson 2's slide on A3 (FACTS 50): A held, up a semitone, held, and back
const A3 = 220
const A_SHARP_3 = 233.08
const SLIDE = [
  { hold: 1.2 },
  { glide: 0.5, to: A_SHARP_3 },
  { hold: 1 },
  { glide: 0.5, to: A3 },
  { hold: 1 },
]

async function soundOn(): Promise<{
  kit: typeof SoundKit
  ctx: FakeContext
}> {
  const kit = await import('./sound')
  kit.Sound.set('on')
  const ctx = FakeContext.last
  if (ctx === null) throw new Error('no context was made')
  return { kit, ctx }
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  FakeContext.last = null
  vi.stubGlobal('AudioContext', FakeContext)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Sound.canPlay', () => {
  /** The page's toast, as every lesson page has it. */
  function mountToast(): { text: HTMLElement; button: HTMLElement } {
    document.body.innerHTML =
      '<div id="toast"><p id="toastText"></p><button id="toastBtn" hidden></button></div>'
    const text = document.getElementById('toastText')
    const button = document.getElementById('toastBtn')
    if (text === null || button === null) throw new Error('no toast')
    return { text, button }
  }

  afterEach(() => {
    document.body.textContent = ''
  })

  it('with sound off, says a play will be seen but not heard, and offers to turn sound on', async () => {
    // Arrange
    const { text, button } = mountToast()
    const kit = await import('./sound')
    kit.Sound.set('off')

    // Act
    const may = kit.Sound.canPlay()

    // Assert
    expect(may).toBe(false)
    expect(text.textContent).toBe(
      "Sound is off, so you'll see this one but not hear it.",
    )
    expect(button.hidden).toBe(false)
  })

  it("with sound off, says a play that needs sound can't play, with the same Turn on button", async () => {
    // Arrange
    const { text, button } = mountToast()
    const kit = await import('./sound')
    kit.Sound.set('off')

    // Act
    const may = kit.Sound.canPlay({ needsSound: true })

    // Assert
    expect(may).toBe(false)
    expect(text.textContent).toBe(
      "Sound is off, so this one can't play. Turn it on to start.",
    )
    expect(button.hidden).toBe(false)
  })

  it('lets a play that needs sound turn sound on at the first tap, as any play does', async () => {
    // Arrange
    const { text } = mountToast()
    const kit = await import('./sound')

    // Act
    const may = kit.Sound.canPlay({ needsSound: true })

    // Assert
    expect(may).toBe(true)
    expect(kit.Sound.state).toBe('on')
    expect(FakeContext.last).not.toBeNull()
    expect(text.textContent).toBe('')
  })
})

describe('contourOf', () => {
  it('turns holds and glides into points at the right times and pitches', async () => {
    // Arrange
    const { kit } = await soundOn()

    // Act
    const points = kit.contourOf(A3, SLIDE)

    // Assert
    expect(points.map((p) => [p.t, p.hz])).toEqual([
      [0, A3],
      [1.2, A3],
      [1.7, A_SHARP_3],
      [2.7, A_SHARP_3],
      [3.2, A3],
      [4.2, A3],
    ])
    expect(kit.contourLength(points)).toBe(4.2)
  })
})

describe('contourVoice', () => {
  it('holds and glides exponentially through every point of the line', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()

    // Act
    kit.contourVoice(kit.contourOf(A3, SLIDE), { kind: 'merc' })

    // Assert
    const voice = ctx.oscillators[0]
    expect(voice.frequency.events).toEqual([
      ['setValueAtTime', A3, 0],
      ['exponentialRampToValueAtTime', A3, 1.2],
      ['exponentialRampToValueAtTime', A_SHARP_3, 1.7],
      ['exponentialRampToValueAtTime', A_SHARP_3, 2.7],
      ['exponentialRampToValueAtTime', A3, 3.2],
      ['exponentialRampToValueAtTime', A3, 4.2],
    ])
    expect(valueAt(voice.frequency.events, 1.45, A3)).toBeCloseTo(
      Math.sqrt(A3 * A_SHARP_3),
      6,
    )
  })

  it('opens on an exponential attack from the floor and releases at its last point', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()

    // Act
    kit.contourVoice(kit.contourOf(A3, SLIDE), { kind: 'merc' })

    // Assert: master is the first gain; then the voice's envelope
    const envelope = ctx.gains[1].gain.events
    expect(envelope).toEqual([
      ['setValueAtTime', 1e-4, 0],
      ['exponentialRampToValueAtTime', 1, 0.09],
      ['setValueAtTime', 1, 4.2],
      ['setTargetAtTime', 0, 4.2, 0.34 / 5],
    ])
  })

  it('stops the voice and its vibrato only once the release is below audibility', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()

    // Act
    kit.contourVoice(kit.contourOf(A3, SLIDE), { kind: 'merc' })

    // Assert
    const [voice, vibrato] = ctx.oscillators
    const stopAt = voice.stops.at(-1) ?? 0
    expect(stopAt).toBeCloseTo(4.2 + 0.34 + 0.06, 9)
    expect(vibrato.stops.at(-1)).toBe(stopAt)
    expect(valueAt(ctx.gains[1].gain.events, stopAt, 0)).toBeLessThan(AUDIBLE)
  })

  it('releases from wherever the line is when stopped early, and still stops below audibility', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()
    const v = kit.contourVoice(kit.contourOf(A3, SLIDE), { kind: 'merc' })
    const envelope = ctx.gains[1].gain
    ctx.currentTime = 2
    envelope.value = 1

    // Act
    v?.stop()

    // Assert: the scheduled release at 4.2 is cancelled, a new one starts now
    const stopAt = ctx.oscillators[0].stops.at(-1) ?? 0
    expect(envelope.events).toContainEqual(['cancelScheduledValues', 2])
    expect(envelope.events.at(-1)).toEqual(['setTargetAtTime', 0, 2, 0.34 / 5])
    expect(valueAt(envelope.events, 4.2, 0)).toBeLessThan(AUDIBLE)
    expect(stopAt).toBeCloseTo(2 + 0.34 + 0.06, 9)
    expect(valueAt(envelope.events, stopAt, 0)).toBeLessThan(AUDIBLE)
  })

  it('moves the level along the line, never ramping it to zero', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()
    const swell = kit.contourOf(A3, [
      { hold: 1, level: 0.5 },
      { hold: 1, level: 0 },
    ])

    // Act
    kit.contourVoice(swell, { gain: 0.2 })

    // Assert: the level gain is the voice's second gain
    const level = ctx.gains[2].gain.events
    expect(level).toEqual([
      ['setValueAtTime', 0.2, 0],
      ['exponentialRampToValueAtTime', 0.1, 1],
      ['exponentialRampToValueAtTime', 1e-4, 2],
    ])
  })

  it('plays nothing while sound is off', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()
    kit.Sound.set('off')

    // Act
    const v = kit.contourVoice(kit.contourOf(A3, SLIDE))

    // Assert
    expect(v).toBeNull()
    expect(ctx.oscillators).toHaveLength(0)
  })
})

describe('a voice that starts later (Lesson 5, the air-first start)', () => {
  it('opens on the house attack at its own time on the audio clock', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()

    // Act
    kit.Sound.voice(A3, { kind: 'merc', at: 0.25, attack: 0.25 })

    // Assert: the master is the first gain; then the voice's envelope
    expect(ctx.oscillators[0].frequency.events).toEqual([
      ['setValueAtTime', A3, 0.25],
    ])
    expect(ctx.gains[1].gain.events).toEqual([
      ['setValueAtTime', 1e-4, 0.25],
      ['exponentialRampToValueAtTime', 1, 0.5],
    ])
  })
})

describe('a tick booked ahead (Lesson 8, the beat clock)', () => {
  it('rises at its own time on the audio clock, into the bus it is given', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()
    const into = vi.spyOn(FakeNode.prototype, 'connect')
    const bus = ctx.createGain()
    ctx.currentTime = 1
    into.mockClear()

    // Act
    kit.Sound.tick(1000, 0.06, { when: 2.5, to: bus as unknown as AudioNode })

    // Assert
    const tick = ctx.gains.at(-1)
    expect(tick?.gain.events.slice(0, 2)).toEqual([
      ['setValueAtTime', 1e-4, 2.5],
      ['exponentialRampToValueAtTime', 0.06, 2.503],
    ])
    expect(ctx.oscillators.at(-1)?.stops).toEqual([2.6])
    expect(into).toHaveBeenLastCalledWith(bus)
    into.mockRestore()
  })

  it('sounds at once on the master with no options, as it always has', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()
    ctx.currentTime = 3

    // Act
    kit.Sound.tick()

    // Assert
    expect(ctx.gains[1].gain.events).toEqual([
      ['setValueAtTime', 1e-4, 3],
      ['exponentialRampToValueAtTime', 0.09, 3.003],
      ['exponentialRampToValueAtTime', 1e-4, 3.07],
    ])
    expect(ctx.oscillators[0].stops).toEqual([3.1])
  })
})

describe('playNoise', () => {
  it('plays a band-passed burst on the house envelope, stopped only once its release is below audibility', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()

    // Act: the air of an "h", 0.35 s
    kit.playNoise({
      dur: 0.35,
      gain: 0.06,
      band: { hz: 2400, q: 0.8 },
      release: 0.12,
    })

    // Assert
    const [source] = ctx.sources
    const envelope = ctx.gains[1].gain.events
    expect(envelope).toEqual([
      ['setValueAtTime', 1e-4, 0],
      ['exponentialRampToValueAtTime', 0.06, 0.02],
      ['setValueAtTime', 0.06, 0.35],
      ['setTargetAtTime', 0, 0.35, 0.12 / 5],
    ])
    expect(ctx.filters.at(-1)?.type).toBe('bandpass')
    expect(source.starts).toEqual([0])
    const stopAt = source.stops.at(-1) ?? 0
    expect(stopAt).toBeCloseTo(0.35 + 0.12 + 0.06, 9)
    expect(valueAt(envelope, stopAt, 0)).toBeLessThan(AUDIBLE / 10)
  })

  it('makes a 3 ms click at its own time, white, with no band', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()
    const filtersBefore = ctx.filters.length

    // Act
    kit.playNoise({
      dur: 0.003,
      gain: 0.25,
      attack: 0.0005,
      release: 0.002,
      at: 0.15,
    })

    // Assert
    expect(ctx.sources[0].starts).toEqual([0.15])
    expect(ctx.filters).toHaveLength(filtersBefore)
    expect(ctx.gains[1].gain.events[0]).toEqual(['setValueAtTime', 1e-4, 0.15])
  })

  it('plays nothing while sound is off or a take is open', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()

    // Act
    kit.Sound.hush(true)
    const hushed = kit.playNoise({ dur: 0.35 })
    kit.Sound.hush(false)
    kit.Sound.set('off')
    const off = kit.playNoise({ dur: 0.35 })

    // Assert
    expect(ctx.sources).toHaveLength(0)
    expect([hushed, off]).toEqual([null, null])
  })

  it('stops from where it stands, as every voice does, once its voice is told to', async () => {
    // Arrange: an in-breath of 0.3 s, cut 0.1 s in
    const { kit, ctx } = await soundOn()
    const breath = kit.playNoise({ dur: 0.3, band: { hz: 1800, q: 0.6 } })
    ctx.currentTime = 0.1

    // Act
    breath?.stop(0.04)

    // Assert: the envelope falls from 0.1 s, and the source stops once it has
    const envelope = ctx.gains[1].gain.events
    expect(envelope.slice(-3)).toEqual([
      ['cancelScheduledValues', 0.1],
      ['setValueAtTime', expect.any(Number), 0.1],
      ['setTargetAtTime', 0, 0.1, 0.04 / 5],
    ])
    expect(ctx.sources[0].stops.at(-1)).toBeCloseTo(0.1 + 0.04 + kit.SLACK, 9)
    expect(breath?.alive).toBe(false)
  })

  it('stops when every sound stops: the Sound switch turned off', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()
    const breath = kit.playNoise({ dur: 0.3 })
    ctx.currentTime = 0.05

    // Act
    kit.Sound.set('off')

    // Assert
    expect(breath?.alive).toBe(false)
    expect(ctx.sources[0].stops.at(-1)).toBeLessThan(0.3)
  })
})

describe('timbres (Lesson 7, kit/timbre.ts)', () => {
  /** Sound on, and the timbres from the same module graph. */
  async function withTimbres(): Promise<{
    kit: typeof SoundKit
    ctx: FakeContext
    timbre: typeof TimbreKit
  }> {
    const { kit, ctx } = await soundOn()
    const timbre = await import('./timbre')
    return { kit, ctx, timbre }
  }

  it('builds a voice with no timbre exactly as before: one lowpass, the tone and its vibrato', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()

    // Act
    kit.contourVoice(kit.contourOf(A3, SLIDE), { kind: 'merc' })

    // Assert
    expect(ctx.filters.map((f) => [f.type, f.frequency.value])).toEqual([
      ['lowpass', 2600],
    ])
    expect(ctx.oscillators).toHaveLength(2)
    expect(ctx.sources).toHaveLength(0)
  })

  it('sings "ng" through a lowpass at 900 Hz, adding nothing else', async () => {
    // Arrange
    const { kit, ctx, timbre } = await withTimbres()

    // Act
    kit.contourVoice(kit.contourOf(A3, SLIDE), {
      kind: 'merc',
      timbre: timbre.NG,
    })

    // Assert
    expect(ctx.filters.map((f) => f.frequency.value)).toEqual([900])
    expect(ctx.oscillators).toHaveLength(2)
    expect(ctx.sources).toHaveLength(0)
  })

  it('trills at 22 Hz, 70 % deep, over looped breath noise in a band', async () => {
    // Arrange
    const { kit, ctx, timbre } = await withTimbres()

    // Act
    kit.contourVoice(kit.contourOf(A3, SLIDE), {
      kind: 'merc',
      timbre: timbre.LIP_TRILL,
    })

    // Assert: the wobble swings 0.65 ± 0.35, from 1 down to 0.3
    const buzz = ctx.oscillators.find((o) => o.frequency.value === 22)
    expect(buzz).toBeDefined()
    const levels = ctx.gains.map((g) => g.gain.value)
    expect(levels).toContain(0.65)
    expect(levels).toContain(0.35)
    expect(ctx.sources).toHaveLength(1)
    expect(ctx.sources[0].loop).toBe(true)
    expect(ctx.sources[0].starts).toEqual([0])
    expect(
      ctx.filters.map((f) => [f.type, f.frequency.value, f.Q.value]),
    ).toEqual([
      ['lowpass', 2600, 0.5],
      ['bandpass', 1800, 0.7],
    ])
  })

  it("stops the trill's buzz and breath with the voice, once its release is below audibility", async () => {
    // Arrange
    const { kit, ctx, timbre } = await withTimbres()

    // Act
    kit.contourVoice(kit.contourOf(A3, SLIDE), {
      kind: 'merc',
      timbre: timbre.LIP_TRILL,
    })

    // Assert
    const stopAt = ctx.oscillators[0].stops.at(-1) ?? 0
    expect(stopAt).toBeCloseTo(4.2 + 0.34 + 0.06, 9)
    for (const o of ctx.oscillators) expect(o.stops.at(-1)).toBe(stopAt)
    expect(ctx.sources[0].stops.at(-1)).toBe(stopAt)
  })

  it('stops a trill stopped early, buzz and breath too', async () => {
    // Arrange
    const { kit, ctx, timbre } = await withTimbres()
    const v = kit.contourVoice(kit.contourOf(A3, SLIDE), {
      kind: 'merc',
      timbre: timbre.LIP_TRILL,
    })
    ctx.currentTime = 1

    // Act
    v?.stop()

    // Assert
    const early = 1 + 0.34 + 0.06
    expect(ctx.sources[0].stops.at(-1)).toBeCloseTo(early, 9)
    for (const o of ctx.oscillators)
      expect(o.stops.at(-1)).toBeCloseTo(early, 9)
  })
})

describe("a voice's partials (Lesson 11's gears, `wave`)", () => {
  const MERC = [1, 0.62, 0.38, 0.24, 0.14, 0.08, 0.045, 0.025]
  const SOFT = [1, 0.3, 0.11, 0.05, 0.024, 0.012]

  it('lets the kind pick the partials when no wave is given, as it always has', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()

    // Act
    kit.contourVoice(kit.contourOf(A3, SLIDE), { kind: 'merc' })
    kit.contourVoice(kit.contourOf(A3, SLIDE), { kind: 'soft' })

    // Assert: Merc's tone and its vibrato, then the soft tone alone
    expect(ctx.oscillators.map((o) => o.wave?.partials ?? null)).toEqual([
      MERC,
      null,
      SOFT,
    ])
    expect(ctx.filters.map((f) => f.frequency.value)).toEqual([2600, 3400])
  })

  it('gives a Merc voice the soft partials, keeping its vibrato, its filter and its level', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()

    // Act
    kit.contourVoice(kit.contourOf(A3, SLIDE), { kind: 'merc', wave: 'soft' })

    // Assert: the soft tone on Merc's oscillator, and Merc's vibrato beside it
    expect(ctx.oscillators).toHaveLength(2)
    expect(ctx.oscillators[0].wave?.partials).toEqual(SOFT)
    expect(ctx.oscillators[1].frequency.value).toBe(5.5)
    expect(ctx.filters.map((f) => f.frequency.value)).toEqual([2600])
    expect(ctx.gains.map((g) => g.gain.value)).toContain(0.2)
  })
})

describe("a voice's vibrato (Lesson 22 WEB-SPEC, What the kit and the app still need, item 4)", () => {
  /** The gain whose events grow a vibrato's depth from 0: the modulator's depth, in cents. */
  const depthOf = (ctx: FakeContext): FakeGain | undefined =>
    ctx.gains.find((g) =>
      g.gain.events.some(([m]) => m === 'linearRampToValueAtTime'),
    )

  it('builds no modulator for a straight note, of either kind', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()

    // Act
    kit.contourVoice(kit.contourOf(A3, [{ hold: 1 }]), {
      kind: 'merc',
      vibrato: null,
    })
    kit.contourVoice(kit.contourOf(A3, [{ hold: 1 }]), { vibrato: null })

    // Assert: one oscillator a voice, and nothing on its detune
    expect(ctx.oscillators).toHaveLength(2)
    expect(depthOf(ctx)).toBeUndefined()
  })

  it('swings at its own rate, its depth reaching its extent at its grow-in, from 0 at the start', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()
    ctx.currentTime = 2

    // Act
    kit.contourVoice(kit.contourOf(A3, [{ hold: 3 }]), {
      kind: 'merc',
      vibrato: { rate: 6, extent: 50, growIn: 0.3 },
    })

    // Assert
    expect(ctx.oscillators[1].frequency.value).toBe(6)
    const depth = depthOf(ctx)?.gain.events ?? []
    expect(valueAt(depth, 2, 0)).toBe(0)
    expect(valueAt(depth, 2.15, 0)).toBeCloseTo(25, 6)
    expect(valueAt(depth, 2.3, 0)).toBeCloseTo(50, 6)
    expect(valueAt(depth, 4, 0)).toBeCloseTo(50, 6)
  })

  it("keeps every voice built without the option as it was: Merc's 5.5 swings at ±14 over 0.35 s, the soft tone none", async () => {
    // Arrange
    const { kit, ctx } = await soundOn()

    // Act
    kit.contourVoice(kit.contourOf(A3, SLIDE), { kind: 'merc' })
    const merc = depthOf(ctx)?.gain.events ?? []
    kit.contourVoice(kit.contourOf(A3, SLIDE))

    // Assert: Merc's tone and his modulator, then the soft tone alone
    expect(kit.MERC_VIBRATO).toEqual({ rate: 5.5, extent: 14, growIn: 0.35 })
    expect(ctx.oscillators).toHaveLength(3)
    expect(ctx.oscillators[1].frequency.value).toBe(5.5)
    expect(valueAt(merc, 0, 0)).toBe(0)
    expect(valueAt(merc, 0.35, 0)).toBeCloseTo(14, 6)
  })

  it('glides a sounding vibrato to a new rate and extent within 50 ms, without restarting the voice', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()
    const v = kit.contourVoice(kit.contourOf(A3, [{ hold: 4 }]), {
      kind: 'merc',
      vibrato: { rate: 6, extent: 30, growIn: 0.3 },
    })
    ctx.currentTime = 1
    const made = ctx.oscillators.length
    const stops = ctx.oscillators.map((o) => [...o.stops])

    // Act
    v?.setVibrato?.({ rate: 7.5, extent: 60 })

    // Assert
    const rate = ctx.oscillators[1].frequency.events
    const depth = depthOf(ctx)?.gain.events ?? []
    expect(valueAt(rate, 1 + kit.VIBRATO_GLIDE, 6)).toBeCloseTo(7.5, 6)
    expect(valueAt(depth, 1 + kit.VIBRATO_GLIDE, 0)).toBeCloseTo(60, 6)
    expect(kit.VIBRATO_GLIDE).toBeLessThanOrEqual(0.05)
    expect(ctx.oscillators).toHaveLength(made)
    expect(ctx.oscillators.map((o) => o.stops)).toEqual(stops)
  })
})

describe('a drone under a take (Lesson 24 WEB-SPEC, What the kit and the app still need, item 5)', () => {
  /** The page's toast, so a test can see that a hushed play says nothing. */
  function mountToast(): HTMLElement {
    document.body.innerHTML =
      '<div id="toast"><p id="toastText"></p><button id="toastBtn" hidden></button></div>'
    const text = document.getElementById('toastText')
    if (text === null) throw new Error('no toast')
    return text
  }

  afterEach(() => {
    document.body.textContent = ''
  })

  it('keeps the drone it is given sounding while it stops everything else, and plays nothing and says nothing until it lifts', async () => {
    // Arrange: the drone on D3 and a note, both started before the take
    const { kit, ctx } = await soundOn()
    const text = mountToast()
    const drone = kit.Sound.voice(146.83, { kind: 'merc', vibrato: null })
    const note = kit.Sound.voice(220)
    ctx.currentTime = 2

    // Act
    const hushed = kit.Sound.hush(true, drone)
    const made = ctx.oscillators.length
    const play = kit.Sound.voice(330)
    const noise = kit.playNoise({ dur: 0.35 })
    const may = kit.Sound.canPlay()

    // Assert: the note is stopped, the drone is not, and nothing new sounds
    expect(hushed).toBe(true)
    expect(note?.alive).toBe(false)
    expect(drone?.alive).toBe(true)
    expect(ctx.oscillators[0].stops).toEqual([])
    expect(ctx.oscillators[1].stops.length).toBeGreaterThan(0)
    expect([play, noise, may]).toEqual([null, null, false])
    expect(ctx.oscillators).toHaveLength(made)
    expect(text.textContent).toBe('')
  })

  it('lets the drone sound until its own release, which ends it below audibility', async () => {
    // Arrange
    const { kit, ctx } = await soundOn()
    const drone = kit.Sound.voice(146.83, { kind: 'merc', vibrato: null })
    kit.Sound.hush(true, drone)
    ctx.currentTime = 9

    // Act: the take ends, and the drone releases over 0.3 s
    drone?.stop(0.3)
    kit.Sound.hush(false)

    // Assert
    const stopAt = ctx.oscillators[0].stops.at(-1) ?? 0
    expect(stopAt).toBeCloseTo(9 + 0.3 + kit.SLACK, 6)
    const env = ctx.gains.find((g) =>
      g.gain.events.some(([m, , t]) => m === 'setTargetAtTime' && t === 9),
    )
    expect(valueAt(env?.gain.events ?? [], stopAt, 1)).toBeLessThan(AUDIBLE)
    expect(drone?.alive).toBe(false)
  })

  it('refuses a second kept voice while the first still sounds, and changes nothing', async () => {
    // Arrange: two drones before the take; the first is kept
    const { kit, ctx } = await soundOn()
    const first = kit.Sound.voice(146.83, { kind: 'merc', vibrato: null })
    const second = kit.Sound.voice(196, { kind: 'merc', vibrato: null })
    kit.Sound.hush(true, first)
    const stopsBefore = ctx.oscillators[0].stops.length

    // Act
    const again = kit.Sound.hush(true, second)

    // Assert: the first drone sounds on, still the take's, and the hush holds
    expect(again).toBe(false)
    expect(first?.alive).toBe(true)
    expect(ctx.oscillators[0].stops).toHaveLength(stopsBefore)
    expect(kit.Sound.hushed).toBe(true)
    expect(kit.Sound.voice(330)).toBeNull()
  })

  it('stops the kept drone with the rest when the page is hidden', async () => {
    // Arrange
    const { kit } = await soundOn()
    const drone = kit.Sound.voice(146.83, { kind: 'merc', vibrato: null })
    kit.Sound.hush(true, drone)

    // Act
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))

    // Assert
    expect(drone?.alive).toBe(false)
  })

  it('keeps nothing for a take that names no drone, as every take before Lesson 24 opens', async () => {
    // Arrange
    const { kit } = await soundOn()
    const note = kit.Sound.voice(220)

    // Act
    const hushed = kit.Sound.hush(true)

    // Assert
    expect(hushed).toBe(true)
    expect(note?.alive).toBe(false)
  })
})
