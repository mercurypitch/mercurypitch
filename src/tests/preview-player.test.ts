// ============================================================
// preview-player — the pop-free envelope contract
// ============================================================
// jsdom has no real audio graph, so what these tests lock down is the
// ORDER and SHAPE of operations that make playback pop-free:
//   * gain starts at silence and swells (exponential) after play() runs
//   * pause decays exponentially first, pausing the element only after
//     the tail is inaudible
//   * a play() during the fade-out cancels the queued pause
//   * seeking while playing dips linearly around the position jump
//     (linear is fine there — the material is continuous, which masks it;
//     at silence boundaries linear reads as a squeezed pop, hence the
//     exponential shapes for start/stop)
// Break any of these and a discontinuity reaches the speakers.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPreviewPlayer, ENVELOPE_DEFAULTS } from '@/lib/preview-player'

type GainOp = { op: string; value?: number; at?: number; tau?: number }

class FakeGainParam {
  value = 0
  ops: GainOp[] = []
  setValueAtTime(value: number, at: number) {
    this.value = value
    this.ops.push({ op: 'set', value, at })
  }
  linearRampToValueAtTime(value: number, at: number) {
    this.value = value
    this.ops.push({ op: 'linear', value, at })
  }
  exponentialRampToValueAtTime(value: number, at: number) {
    this.value = value
    this.ops.push({ op: 'exp', value, at })
  }
  setTargetAtTime(value: number, at: number, tau: number) {
    this.value = value
    this.ops.push({ op: 'target', value, at, tau })
  }
  cancelScheduledValues(at: number) {
    this.ops.push({ op: 'cancel', at })
  }
}

class FakeAudioContext {
  currentTime = 0
  state = 'running'
  destination = {}
  gainParam = new FakeGainParam()
  createMediaElementSource() {
    return { connect: () => ({}) }
  }
  createGain() {
    return {
      gain: this.gainParam,
      connect: () => ({}),
      disconnect: () => {},
    }
  }
  resume() {
    return Promise.resolve()
  }
  close() {
    return Promise.resolve()
  }
}

class FakeAudio {
  static instances: FakeAudio[] = []
  src = ''
  preload = ''
  currentTime = 0
  duration = 200
  paused = true
  onended: (() => void) | null = null
  play = vi.fn(() => {
    this.paused = false
    return Promise.resolve()
  })
  pause = vi.fn(() => {
    this.paused = true
  })
  constructor() {
    FakeAudio.instances.push(this)
  }
}

let fakeCtx: FakeAudioContext

const lastElement = () => FakeAudio.instances.at(-1)!
const gainOps = () => fakeCtx.gainParam.ops
/** Wall time by which a default release has fully settled. */
const RELEASE_SETTLED_MS = ENVELOPE_DEFAULTS.releaseMs + 100

beforeEach(() => {
  vi.useFakeTimers()
  FakeAudio.instances = []
  fakeCtx = new FakeAudioContext()
  vi.stubGlobal('Audio', FakeAudio)
  // A constructor-function stub (not a class) — the rule dislikes
  // constructor-only classes, and all we need is `new AudioContext()`
  // handing back the shared recorder.
  vi.stubGlobal('AudioContext', function AudioContextStub() {
    return fakeCtx
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('createPreviewPlayer', () => {
  it('swells in exponentially, only after playback starts', async () => {
    const player = createPreviewPlayer()
    await player.play('blob:stem')

    const element = lastElement()
    expect(element.play).toHaveBeenCalledTimes(1)
    // The final op is the exponential rise to full level; the swap pinned
    // the gain to 0 before playback ran.
    expect(gainOps().at(-1)).toMatchObject({ op: 'exp', value: 1 })
    expect(player.playing).toBe(true)
  })

  it('pauses the element only after the exponential release settles', async () => {
    const player = createPreviewPlayer()
    await player.play('blob:stem')
    const element = lastElement()

    player.pause()
    // Envelope closes immediately, with the decay shape…
    expect(gainOps().at(-1)).toMatchObject({ op: 'target', value: 0 })
    // …but the transport keeps running until the tail is inaudible.
    expect(element.pause).not.toHaveBeenCalled()
    expect(player.playing).toBe(false)

    vi.advanceTimersByTime(RELEASE_SETTLED_MS)
    expect(element.pause).toHaveBeenCalledTimes(1)
    // The floor is hard-zeroed for the next attack.
    expect(fakeCtx.gainParam.value).toBe(0)
  })

  it('cancels a pending pause when play() wins the race', async () => {
    const player = createPreviewPlayer()
    await player.play('blob:stem')
    const element = lastElement()

    player.pause()
    await player.play('blob:stem') // during the fade-out window
    vi.advanceTimersByTime(RELEASE_SETTLED_MS * 2)

    expect(element.pause).not.toHaveBeenCalled()
    expect(player.playing).toBe(true)
    expect(gainOps().at(-1)).toMatchObject({ op: 'exp', value: 1 })
  })

  it('dips linearly around a seek while playing', async () => {
    const player = createPreviewPlayer()
    await player.play('blob:stem')
    const element = lastElement()

    player.seekToFraction(0.5)
    expect(gainOps().at(-1)).toMatchObject({ op: 'linear', value: 0 })
    expect(element.currentTime).toBe(0) // not moved yet — still dipping

    vi.advanceTimersByTime(ENVELOPE_DEFAULTS.seekFadeMs + 15)
    expect(element.currentTime).toBeCloseTo(100)
    expect(gainOps().at(-1)).toMatchObject({ op: 'linear', value: 1 })
  })

  it('seeks directly while paused — no signal, no pop, no dip', async () => {
    const player = createPreviewPlayer()
    await player.play('blob:stem')
    player.pause()
    vi.advanceTimersByTime(RELEASE_SETTLED_MS)

    const before = gainOps().length
    player.seekToFraction(0.25)
    expect(lastElement().currentTime).toBeCloseTo(50)
    expect(gainOps().length).toBe(before)
  })

  it('honors custom envelope timings', async () => {
    const player = createPreviewPlayer({ releaseMs: 500 })
    await player.play('blob:stem')
    const element = lastElement()

    player.pause()
    vi.advanceTimersByTime(RELEASE_SETTLED_MS)
    // Default settle time is not enough for a 500 ms release.
    expect(element.pause).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(element.pause).toHaveBeenCalledTimes(1)
  })

  it('degrades to direct control when the audio graph is unavailable', async () => {
    vi.stubGlobal('AudioContext', function BrokenAudioContext() {
      throw new Error('no audio')
    })
    const player = createPreviewPlayer()
    await player.play('blob:stem')
    const element = lastElement()
    expect(element.play).toHaveBeenCalled()

    player.pause()
    // No envelope to wait for — pause is immediate.
    expect(element.pause).toHaveBeenCalledTimes(1)
  })

  it('reports ended and resets the logical state', async () => {
    const onEnded = vi.fn()
    const player = createPreviewPlayer({ onEnded })
    await player.play('blob:stem')

    lastElement().onended?.()
    expect(onEnded).toHaveBeenCalledTimes(1)
    expect(player.playing).toBe(false)
  })
})
