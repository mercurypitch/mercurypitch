// ── The jam room's backing track, without the pop ───────────────────
//
// The stage drove its <audio> element bare, and every stop and start in
// a practice was a full-scale step in one sample. These cover the fix
// and, more importantly, the two ways the fix could be worse than the
// bug:
//
// - **Routing through Web Audio must never cause silence.** A
//   MediaElementAudioSourceNode is permanent, so attaching to a context
//   that is not running would mute the room for good.
// - **A fade must not swallow a transport command.** The pause is
//   deferred behind the release, and a stop is a rewind followed by a
//   pause -- so the rewind has to survive the pause that cancels its
//   fade.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJamSongTransport } from '@/lib/jam/jam-song-transport'

interface FakeGain {
  value: number
  ramps: { kind: string; to: number; at: number }[]
  disconnected: boolean
}

function makeContext(state: AudioContextState = 'running') {
  const gains: FakeGain[] = []
  const sources: { el: unknown; disconnected: boolean }[] = []
  const ctx = {
    currentTime: 0,
    state,
    destination: { kind: 'destination' },
    createGain() {
      const g: FakeGain = { value: 1, ramps: [], disconnected: false }
      gains.push(g)
      const note = (kind: string) => (to: number, at: number) => {
        g.ramps.push({ kind, to, at })
        g.value = to
      }
      return {
        gain: {
          get value() {
            return g.value
          },
          set value(v: number) {
            g.value = v
          },
          cancelScheduledValues: () => undefined,
          setValueAtTime: (v: number) => {
            g.value = v
          },
          linearRampToValueAtTime: note('linear'),
          exponentialRampToValueAtTime: note('exp'),
          setTargetAtTime: (v: number, at: number) => {
            g.ramps.push({ kind: 'target', to: v, at })
            g.value = v
          },
        },
        connect: () => undefined,
        disconnect: () => {
          g.disconnected = true
        },
      }
    },
    createMediaElementSource(el: unknown) {
      const s = { el, disconnected: false }
      sources.push(s)
      return {
        connect: () => undefined,
        disconnect: () => {
          s.disconnected = true
        },
      }
    },
  }
  return { ctx: ctx as unknown as AudioContext, raw: ctx, gains, sources }
}

function makeElement() {
  const state = {
    paused: true,
    ended: false,
    currentTime: 0,
    plays: 0,
    pauses: 0,
    reject: null as Error | null,
  }
  const el = {
    get paused() {
      return state.paused
    },
    get ended() {
      return state.ended
    },
    get currentTime() {
      return state.currentTime
    },
    set currentTime(v: number) {
      state.currentTime = v
    },
    play: async () => {
      state.plays += 1
      if (state.reject !== null) throw state.reject
      state.paused = false
    },
    pause: () => {
      state.pauses += 1
      state.paused = true
    },
  }
  return { el: el as unknown as HTMLAudioElement, state }
}

/** The element and a running context, wired the way the stage wires them. */
function setup(opts: { contextState?: AudioContextState } = {}) {
  const fake = makeContext(opts.contextState ?? 'running')
  const { el, state } = makeElement()
  const transport = createJamSongTransport({
    element: () => el,
    context: () => fake.ctx,
  })
  return { fake, el, state, transport }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('attaching', () => {
  it('routes through a gain once the context is running', async () => {
    const { fake, transport } = setup()
    await transport.play()
    expect(transport.enveloped()).toBe(true)
    expect(fake.sources).toHaveLength(1)
  })

  it('leaves the element alone while the context is asleep', async () => {
    const { fake, state, transport } = setup({ contextState: 'suspended' })
    await transport.play()
    // A source node cannot be detached. Attaching to a context that never
    // resumes would be silence, which is far worse than the pop.
    expect(transport.enveloped()).toBe(false)
    expect(fake.sources).toHaveLength(0)
    expect(state.plays).toBe(1)
    expect(state.paused).toBe(false)
  })

  it('attaches on a later play, once a tap has resumed the context', async () => {
    const fake = makeContext('suspended')
    const { el } = makeElement()
    const transport = createJamSongTransport({
      element: () => el,
      context: () => fake.ctx,
    })
    await transport.play()
    expect(transport.enveloped()).toBe(false)

    fake.raw.state = 'running'
    await transport.play()
    expect(transport.enveloped()).toBe(true)
  })

  it('keeps playing when the graph refuses to be built', async () => {
    const fake = makeContext()
    fake.raw.createMediaElementSource = () => {
      throw new Error('already connected to another graph')
    }
    const { el, state } = makeElement()
    const transport = createJamSongTransport({
      element: () => el,
      context: () => fake.ctx,
    })
    await transport.play()
    expect(transport.enveloped()).toBe(false)
    expect(state.paused).toBe(false)
  })
})

describe('play', () => {
  it('opens from silence only once playback has really begun', async () => {
    const { fake, transport } = setup()
    const started = transport.play()
    const gain = fake.gains[0]!
    // Still silent while play() is in flight: ramping from the moment of
    // the call spends the attack on nothing and lands at full scale.
    expect(gain.value).toBe(0)
    expect(gain.ramps).toEqual([])

    await started
    expect(gain.ramps).toEqual([{ kind: 'exp', to: 1, at: 0.09 }])
  })

  it('hands a refused play back to the caller', async () => {
    const { state, transport } = setup()
    state.reject = new Error('NotAllowedError')
    // The stage turns this into an "allow audio" notice. An envelope that
    // swallowed it would leave a room silently "playing".
    await expect(transport.play()).rejects.toThrow('NotAllowedError')
  })
})

describe('pause', () => {
  it('fades out before the element stops', async () => {
    const { fake, state, transport } = setup()
    await transport.play()
    transport.pause()

    expect(fake.gains[0]!.ramps.at(-1)).toEqual({
      kind: 'target',
      to: 0,
      at: 0,
    })
    expect(state.pauses).toBe(0)

    await vi.advanceTimersByTimeAsync(240)
    expect(state.pauses).toBe(1)
    expect(state.paused).toBe(true)
  })

  it('cuts straight when there is no graph', async () => {
    const { state, transport } = setup({ contextState: 'suspended' })
    await transport.play()
    transport.pause()
    expect(state.pauses).toBe(1)
  })

  it('a play during the tail never stops the element at all', async () => {
    const { state, transport } = setup()
    await transport.play()
    transport.pause()
    await vi.advanceTimersByTimeAsync(100)
    await transport.play()
    await vi.advanceTimersByTimeAsync(400)
    // Stop-then-start inside a quarter second is a real thing to do in a
    // practice, and it should be inaudible rather than a fade chased by
    // a fade.
    expect(state.pauses).toBe(0)
    expect(state.paused).toBe(false)
  })
})

describe('seek', () => {
  it('dips around the jump while it is sounding', async () => {
    const { fake, state, transport } = setup()
    await transport.play()
    const gain = fake.gains[0]!
    gain.ramps.length = 0

    transport.seek(42)
    expect(gain.ramps).toEqual([{ kind: 'linear', to: 0, at: 0.015 }])
    expect(state.currentTime).toBe(0)

    await vi.advanceTimersByTimeAsync(20)
    expect(state.currentTime).toBe(42)
    expect(gain.ramps.at(-1)).toEqual({ kind: 'linear', to: 1, at: 0.015 })
  })

  it('moves at once when nothing is sounding', async () => {
    const { fake, state, transport } = setup()
    await transport.play()
    transport.pause()
    fake.gains[0]!.ramps.length = 0

    transport.seek(12)
    expect(state.currentTime).toBe(12)
    expect(fake.gains[0]!.ramps).toEqual([])
  })

  it('still rewinds when a stop pauses mid-dip', async () => {
    const { fake, state, transport } = setup()
    await transport.play()
    const gain = fake.gains[0]!

    // What jamSongStop does: rewind, then pause, in one batch.
    transport.seek(0)
    transport.pause()
    await vi.advanceTimersByTimeAsync(20)
    expect(state.currentTime).toBe(0)
    // ...and the dip is not lifted: the pause's release owns the gain
    // now, so un-fading here would play the song's first moments back at
    // full volume on the way out.
    expect(gain.ramps.at(-1)?.to).toBe(0)

    await vi.advanceTimersByTimeAsync(240)
    expect(state.paused).toBe(true)
  })

  it('ignores a position that is not a number', async () => {
    const { state, transport } = setup()
    await transport.play()
    transport.seek(Number.NaN)
    expect(state.currentTime).toBe(0)
  })
})

describe('dispose', () => {
  it('drops its own nodes and stops answering', async () => {
    const { fake, state, transport } = setup()
    await transport.play()
    transport.pause()
    transport.dispose()

    expect(fake.gains[0]!.disconnected).toBe(true)
    expect(fake.sources[0]!.disconnected).toBe(true)
    await vi.advanceTimersByTimeAsync(500)
    // The pause timer was armed before dispose; firing it against a torn
    // down stage is how a teardown throws.
    expect(state.pauses).toBe(0)
    await transport.play()
    expect(state.plays).toBe(1)
  })
})
