// The melody has to stay a melody when the level plays fast.
// ============================================================
//
// The bug this guards was audible rather than structural, so what it
// pins is the three properties that made it audible:
//
//   The Journey played every note through pitch-engine's demo-audio and
//   threw away the stop handle that module's header says the caller MUST
//   keep. Notes accumulated instead of replacing each other, and a level
//   at humSeconds 1.2 with a faster beat had four or five sounding at
//   once -- each a PAIR of sines detuned four cents, so each beating
//   against itself. Reported from a device as trombone-like, mushy and
//   distorted at the same time, with the tune not recognisable inside
//   it. All three descriptions are one fact: unbounded overlap.
//
// A fake context rather than a real render, matching audio/
// web-audio-output.test.ts: no new dependency, and the invariants that
// matter here -- how many oscillators may be live, that stealing stops
// the stolen note, that there is a ceiling on the bus -- are all
// countable without producing samples.

import { beforeEach, describe, expect, it } from 'vitest'
import { resetSharedAudioContext } from '@/audio/shared-audio-context'
import { createGameVoice } from './game-voice'

interface FakeParam {
  value: number
  setValueAtTime(v: number, t: number): FakeParam
  exponentialRampToValueAtTime(v: number, t: number): FakeParam
  linearRampToValueAtTime(v: number, t: number): FakeParam
  setTargetAtTime(v: number, t: number, c: number): FakeParam
  cancelScheduledValues(t: number): FakeParam
}

const param = (value = 0): FakeParam => {
  const p: FakeParam = {
    value,
    setValueAtTime: (v) => ((p.value = v), p),
    exponentialRampToValueAtTime: (v) => ((p.value = v), p),
    linearRampToValueAtTime: (v) => ((p.value = v), p),
    setTargetAtTime: (v) => ((p.value = v), p),
    cancelScheduledValues: () => p,
  }
  return p
}

interface FakeOsc {
  frequency: FakeParam
  type: string
  started: boolean
  stoppedAt: number | null
  start(t: number): void
  stop(t?: number): void
  connect<T>(n: T): T
  disconnect(): void
}

interface Recorded {
  oscillators: FakeOsc[]
  compressors: number
  now: number
}

const createFakeContext = (): { ctx: AudioContext; log: Recorded } => {
  const log: Recorded = { oscillators: [], compressors: 0, now: 0 }
  const node = (): Record<string, unknown> => ({
    connect: <T>(n: T): T => n,
    disconnect: () => undefined,
  })
  const ctx = {
    get currentTime() {
      return log.now
    },
    destination: node(),
    state: 'running',
    sampleRate: 48000,
    resume: async () => undefined,
    suspend: async () => undefined,
    close: async () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    createGain: () => ({ ...node(), gain: param(1) }),
    createBiquadFilter: () => ({
      ...node(),
      type: 'lowpass',
      frequency: param(),
      Q: param(),
    }),
    createDynamicsCompressor: () => {
      log.compressors += 1
      return {
        ...node(),
        threshold: param(),
        knee: param(),
        ratio: param(),
        attack: param(),
        release: param(),
      }
    },
    createOscillator: () => {
      const osc: FakeOsc = {
        ...(node() as unknown as FakeOsc),
        frequency: param(),
        type: 'sine',
        started: false,
        stoppedAt: null,
        start(t: number) {
          this.started = true
          void t
        },
        stop(t?: number) {
          // Last stop wins, which is what the spec says: "If stop is
          // called again after having already been called, the last
          // invocation will be the only one applied." Getting this
          // backwards makes stealing look broken when it is not.
          this.stoppedAt = t ?? 0
        },
        connect: <T>(n: T): T => n,
        disconnect: () => undefined,
      }
      log.oscillators.push(osc)
      return osc
    },
  } as unknown as AudioContext
  return { ctx, log }
}

const install = (): Recorded => {
  const { ctx, log } = createFakeContext()
  resetSharedAudioContext({ createContext: () => ctx })
  return log
}

/** Oscillators still sounding at time `t`.
 *
 * Probed well after the 80 ms steal fade, not during it: a note being
 * stolen is still legitimately audible for those milliseconds, and
 * counting it would measure the fade rather than the cap. */
const liveAt = (log: Recorded, t: number): number =>
  log.oscillators.filter((o) => o.started && (o.stoppedAt ?? Infinity) > t)
    .length

beforeEach(() => {
  resetSharedAudioContext()
})

/** Oscillators one note builds -- PARTIALS.length in game-voice.ts. */
const PARTIALS_PER_NOTE = 4

describe('the game voice', () => {
  it('puts a ceiling on the bus', () => {
    // Without this, overlap turns into clipping rather than loudness --
    // the "distorted" half of the report.
    const log = install()
    const voice = createGameVoice('test')
    voice.start()
    expect(log.compressors).toBe(1)
  })

  it('bounds how many notes sound at once', () => {
    const log = install()
    const voice = createGameVoice('test')
    voice.start()

    // The reported case: notes arriving far faster than they decay.
    for (let i = 0; i < 12; i++) voice.note(60 + i, 1.2)

    // Four voices of four partials each, once the steal fades are done.
    // The old path had no cap at all, so this was 12 notes x 2
    // oscillators = 24 and climbing with the level's tempo.
    expect(liveAt(log, 0.5)).toBeLessThanOrEqual(4 * PARTIALS_PER_NOTE)
    expect(liveAt(log, 0.5)).toBeGreaterThan(0)
  })

  it('stops the note it steals', () => {
    const log = install()
    const voice = createGameVoice('test')
    voice.start()

    for (let i = 0; i < 12; i++) voice.note(60 + i, 4)

    // A stolen note stops inside the 80 ms fade. The threshold has to be
    // that tight, not merely "before the note was due": the brightest
    // partial decays in a fifth of the note's length anyway, so a looser
    // bound counts natural decay as stealing and proves nothing.
    const stolen = log.oscillators.filter(
      (o) => (o.stoppedAt ?? Infinity) < 0.2,
    )
    expect(stolen.length).toBe((12 - 4) * PARTIALS_PER_NOTE)
  })

  it('gives each note an attack, not a drone', () => {
    // Partials at whole-ish multiples with independent decays is what
    // separates one note from the next by ear. Two sustained sines four
    // cents apart -- the old timbre -- have no attack to separate.
    const log = install()
    const voice = createGameVoice('test')
    voice.start()
    voice.note(69, 1)

    expect(log.oscillators.length).toBeGreaterThanOrEqual(3)
    const freqs = log.oscillators.map((o) => o.frequency.value)
    const fundamental = Math.min(...freqs)
    expect(fundamental).toBeCloseTo(440, 0)
    // Spread over at least two octaves: a real partial stack, not a
    // detuned unison.
    expect(Math.max(...freqs) / fundamental).toBeGreaterThan(3)
  })

  it('stopAll stops every live oscillator', () => {
    const log = install()
    const voice = createGameVoice('test')
    voice.start()
    voice.note(69, 4)
    voice.note(72, 4)
    voice.stopAll()

    for (const osc of log.oscillators) {
      expect(osc.stoppedAt).not.toBeNull()
      expect(osc.stoppedAt as number).toBeLessThan(1)
    }
  })

  it('is safe before start and after dispose', () => {
    install()
    const voice = createGameVoice('test')
    // A note before the gesture is dropped, not thrown.
    expect(() => voice.note(69, 1)).not.toThrow()
    voice.start()
    voice.dispose()
    expect(() => voice.note(69, 1)).not.toThrow()
    expect(() => voice.stopAll()).not.toThrow()
    expect(() => voice.dispose()).not.toThrow()
  })
})
