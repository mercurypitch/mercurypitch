// ============================================================
// The demo soundtrack: Merc's voice as loud as the room's note
// ============================================================
//
// Every demo voice sits level with the room's Hear tone (demo-voice.ts
// VOICE_PEAK). Lip roll's buzz did not: its flutter only ever dips the
// level, and the buzz measured 4.5 to 5 LU under the room's own count-in
// tone (EBU R128 on Chromium's render, 15 Oct). The soundtrack gives a
// fluttered voice its loudness back, and leaves every other sound as it was.

import { describe, expect, it } from 'vitest'
import { flutterMakeup, LIP_FLUTTER } from '@/lib/demo-voice'
import { createDemoSoundtrack } from './demo-sound'

interface Node {
  kind: string
  gain?: { value: number }
  connections: unknown[]
}

function fakeContext(state: AudioContextState = 'running') {
  const made: Node[] = []
  const param = (value: number) => ({
    value,
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
    setTargetAtTime: () => undefined,
    cancelScheduledValues: () => undefined,
  })
  const node = (kind: string, extra: object = {}) => {
    const n = {
      kind,
      connections: [] as unknown[],
      connect: (to: unknown) => {
        n.connections.push(to)
        return to
      },
      disconnect: () => undefined,
      ...extra,
    }
    made.push(n)
    return n
  }
  const destination = { kind: 'destination', connections: [] }
  const ctx = {
    state,
    currentTime: 3,
    destination,
    createGain: () => node('gain', { gain: param(1) }),
    createOscillator: () =>
      node('oscillator', {
        frequency: param(440),
        detune: param(0),
        setPeriodicWave: () => undefined,
        start: () => undefined,
        stop: () => undefined,
        onended: null,
      }),
    createBiquadFilter: () =>
      node('filter', { type: 'lowpass', frequency: param(350), Q: param(1) }),
    createPeriodicWave: () => ({}),
  }
  return { ctx: ctx as unknown as AudioContext, made, destination }
}

/** The gain from `from` to the speakers, along its connections. */
function gainToSpeakers(from: Node, destination: unknown): number {
  if ((from as unknown) === destination) return 1
  for (const next of from.connections) {
    const rest = gainToSpeakers(next as Node, destination)
    if (rest > 0) return (from.gain?.value ?? 1) * rest
  }
  return 0
}

const TAKE = {
  voice: [
    { t: 0, cents: 0, level: 0 },
    { t: 0.4, cents: 0, level: 0.8 },
    { t: 1.6, cents: 0, level: 0.8 },
    { t: 2, cents: 0, level: 0 },
  ],
}

/** The voice's own level node: the first gain the voice made. */
function sung(flutter?: typeof LIP_FLUTTER) {
  const fake = fakeContext()
  const track = createDemoSoundtrack(fake.ctx, 0.12, undefined, 'ooh', flutter)
  const before = fake.made.length
  track.sing(TAKE, 57)
  const voice = fake.made.slice(before).find((n) => n.kind === 'gain')!
  return { ...fake, track, voice }
}

describe('createDemoSoundtrack', () => {
  it('gives a low note its octave, in the tone and in the voice, and a higher one none', () => {
    const oscillators = (
      play: (track: ReturnType<typeof createDemoSoundtrack>) => void,
    ): number => {
      const fake = fakeContext()
      const track = createDemoSoundtrack(fake.ctx, 0.12, undefined)
      const before = fake.made.length
      play(track)
      return fake.made
        .slice(before)
        .filter((made) => made.kind === 'oscillator').length
    }
    // A2 sits below C3, where the octave fades in; C4 is above it.
    expect(oscillators((track) => track.tone(45))).toBe(
      oscillators((track) => track.tone(60)) + 1,
    )
    expect(oscillators((track) => track.sing(TAKE, 45))).toBeGreaterThan(
      oscillators((track) => track.sing(TAKE, 60)),
    )
  })

  it("gives Lip roll's buzz the loudness its flutter takes away", () => {
    const { voice, destination } = sung(LIP_FLUTTER)
    expect(gainToSpeakers(voice, destination)).toBeCloseTo(
      flutterMakeup(LIP_FLUTTER),
      6,
    )
    expect(flutterMakeup(LIP_FLUTTER)).toBeGreaterThan(1.5)
  })

  it('leaves a voice without a flutter as it was', () => {
    const { voice, destination } = sung()
    expect(gainToSpeakers(voice, destination)).toBe(1)
  })

  it("plays the room's note at the Hear button's level, flutter or not", () => {
    const fake = fakeContext()
    const track = createDemoSoundtrack(
      fake.ctx,
      0.12,
      undefined,
      'ooh',
      LIP_FLUTTER,
    )
    const before = fake.made.length
    track.tone(57)
    // The tone's own envelope gain, then the soundtrack's bus.
    const tone = fake.made.slice(before).filter((n) => n.kind === 'gain')
    expect(tone).toHaveLength(1)
    expect(gainToSpeakers(tone[0], fake.destination)).toBe(1)
  })

  it('plays no note on a clock the app parked', () => {
    const fake = fakeContext('suspended')
    const track = createDemoSoundtrack(fake.ctx, 0.12, undefined)
    const before = fake.made.length
    track.tone(57)
    expect(fake.made.slice(before)).toEqual([])
  })
})
