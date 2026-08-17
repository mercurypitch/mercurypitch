// Two stems, two clocks, and the servo that has to hold them together.
// ============================================================
//
// The reported symptom was a room that stuttered its way through a song and
// stuttered far worse after seeking. The cause is in here: a stem more than
// the tolerance from the master was seeked straight to the master's clock,
// and setting `currentTime` on a PLAYING element stalls it for as long as its
// pipeline needs to re-prime. By the time that correction lands the master
// has moved on by exactly that latency, so the stem is behind again — by more
// than the tolerance — and the next tick seeks it again. Forever, every
// interval, each one an audible hole.
//
// So the element fake here models the one property that matters and that a
// plain `currentTime = value` stub cannot: a seek takes time, and the element
// does not advance while it is taking it.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createGuitarBackingStreamEngine } from './guitar-backing-stream'
import type { GuitarBackingTrack } from './guitar-backing-transport'

const SYNC_MS = 400
const TOLERANCE = 0.06
/** Mirrors the engine's own settle window; the tests step past it on purpose. */
const SEEK_SETTLE_MS = 700

class FakeStemElement extends EventTarget {
  duration = 240
  /** Listeners still attached, by type — teardown has to give them back. */
  readonly listeners = new Map<string, number>()
  /** Report a clock the engine cannot use, the way a torn-down element does. */
  broken = false
  paused = true
  playbackRate = 1
  preservesPitch = false
  ended = false
  src = ''
  preload = ''
  /** How long this element takes to complete a seek. */
  seekLatencyMs = 0
  /** Every seek this element was asked to perform. */
  readonly seeks: number[] = []

  private position = 0
  private pending: { to: number; remainingMs: number } | null = null

  get seeking(): boolean {
    return this.pending !== null
  }

  get currentTime(): number {
    return this.broken ? Number.NaN : this.position
  }

  override addEventListener(type: string, listener: EventListener): void {
    this.listeners.set(type, (this.listeners.get(type) ?? 0) + 1)
    super.addEventListener(type, listener)
  }

  override removeEventListener(type: string, listener: EventListener): void {
    this.listeners.set(type, Math.max(0, (this.listeners.get(type) ?? 0) - 1))
    super.removeEventListener(type, listener)
  }

  set currentTime(value: number) {
    this.seeks.push(value)
    if (this.seekLatencyMs <= 0) {
      this.position = value
      return
    }
    this.pending = { to: value, remainingMs: this.seekLatencyMs }
    this.dispatchEvent(new Event('seeking'))
  }

  play = vi.fn(async () => {
    this.paused = false
  })

  pause = vi.fn(() => {
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  })

  load = vi.fn()

  removeAttribute(name: string): void {
    if (name === 'src') this.src = ''
  }

  /** Wall time passes: a seeking element stalls, a playing one advances. */
  advance(ms: number): void {
    const seek = this.pending
    if (seek !== null) {
      seek.remainingMs -= ms
      if (seek.remainingMs > 0) return
      this.position = seek.to
      this.pending = null
      this.dispatchEvent(new Event('seeked'))
      return
    }
    if (this.paused) return
    this.position += (ms / 1000) * this.playbackRate
  }
}

class FakeAudioNode {
  readonly connect = vi.fn((destination: unknown) => destination)
  readonly disconnect = vi.fn()
  readonly gain = {
    value: 1,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  }
}

function fakeContext(): AudioContext {
  return {
    currentTime: 0,
    createGain: () => new FakeAudioNode() as unknown as GainNode,
    createMediaElementSource: () =>
      new FakeAudioNode() as unknown as MediaElementAudioSourceNode,
  } as unknown as AudioContext
}

function stem(id: string): GuitarBackingTrack {
  return {
    id,
    label: id,
    url: `blob:${id}`,
    sizeBytes: 1024,
    durationSeconds: 240,
    channelCount: 2,
  }
}

interface Rig {
  elements: FakeStemElement[]
  engine: ReturnType<typeof createGuitarBackingStreamEngine>
  interrupted: ReturnType<typeof vi.fn>
  /** Advance both the elements and the engine's timers, in that order. */
  run(totalMs: number, stepMs?: number): void
  /** Move only the engine's wall clock — nothing else makes progress. */
  skipClock(ms: number): void
}

function rig(trackIds: readonly string[] = ['vocal', 'instrumental']): Rig {
  const elements: FakeStemElement[] = []
  const interrupted = vi.fn()
  let clockMs = 0
  const engine = createGuitarBackingStreamEngine({
    now: () => clockMs,
    createMediaElement: () => {
      const element = new FakeStemElement()
      elements.push(element)
      return element as unknown as HTMLAudioElement
    },
    syncIntervalMs: SYNC_MS,
    driftToleranceSeconds: TOLERANCE,
    onEnded: vi.fn(),
    onTrackError: vi.fn(),
    onInterrupted: interrupted,
  })
  const context = fakeContext()
  engine.load(
    context,
    new FakeAudioNode() as unknown as AudioNode,
    trackIds.map(stem),
    () => 1,
  )
  return {
    elements,
    engine,
    interrupted,
    run(totalMs, stepMs = 50) {
      for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
        clockMs += stepMs
        for (const element of elements) element.advance(stepMs)
        vi.advanceTimersByTime(stepMs)
      }
    },
    skipClock(ms) {
      clockMs += ms
    },
  }
}

async function playing(trackIds?: readonly string[]): Promise<Rig> {
  const harness = rig(trackIds)
  await harness.engine.play(0, () => 1)
  // The master is chosen from the elements that started; both have the same
  // declared duration, so it is the first.
  for (const element of harness.elements) element.seeks.length = 0
  return harness
}

describe('holding two stems together', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    return () => vi.useRealTimers()
  })

  it('closes a drift with a rate trim rather than a seek', async () => {
    const harness = await playing()
    const [master, follower] = harness.elements
    // Let the settle window pass, then push the follower 120 ms behind — the
    // scale of drift two independently clocked elements accumulate.
    harness.run(1000)
    follower.currentTime = master.currentTime - 0.12
    follower.seeks.length = 0

    harness.run(4000)

    expect(follower.seeks).toEqual([])
    expect(follower.playbackRate).not.toBe(1)
    expect(Math.abs(follower.currentTime - master.currentTime)).toBeLessThan(
      0.12,
    )
  })

  it('converges and then stops correcting, instead of seeking forever', async () => {
    // The defect: a 150 ms seek latency exceeds the 60 ms tolerance, so every
    // correction landed the follower a further 150 ms behind and the next
    // tick corrected it again — a hole every 400 ms for the whole song.
    const harness = await playing()
    const [master, follower] = harness.elements
    follower.seekLatencyMs = 150
    harness.run(1000)
    follower.currentTime = master.currentTime - 0.12
    follower.advance(150)
    follower.seeks.length = 0

    harness.run(12_000)

    expect(follower.seeks).toEqual([])
    expect(Math.abs(follower.currentTime - master.currentTime)).toBeLessThan(
      TOLERANCE,
    )
    // Back on the base rate once it is level: a servo that never lets go is
    // just a slower version of the same bug.
    expect(follower.playbackRate).toBe(1)
  })

  it('still seeks a stem that was interrupted rather than merely drifting', async () => {
    const harness = await playing()
    const [master, follower] = harness.elements
    harness.run(1000)
    // Four seconds apart is not drift; a 4% trim would need 100 seconds.
    follower.currentTime = master.currentTime - 4
    follower.seeks.length = 0

    harness.run(1000)

    expect(follower.seeks).toHaveLength(1)
    // One correction, and it lands them together — the trim then holds.
    expect(Math.abs(follower.currentTime - master.currentTime)).toBeLessThan(
      TOLERANCE,
    )
  })

  it('leaves the clocks alone while a seek is in flight', async () => {
    const harness = await playing()
    const [, follower] = harness.elements
    follower.seekLatencyMs = 600
    harness.run(1000)

    void harness.engine.seek(90)
    // Two sync ticks pass while the elements are still seeking.
    harness.run(500, 100)

    // One seek each: the one that was asked for, and nothing on top of it.
    for (const element of harness.elements) {
      expect(element.seeks).toEqual([90])
    }
  })

  it('holds off for a seek that outlasts the settle window', async () => {
    // The settle window is a guess at how long a seek takes; a cold stem on a
    // phone can take longer. Past the window the elements' own `seeking` flag
    // is the only thing standing between a slow seek and a hard correction to
    // a clock that means nothing yet.
    const harness = await playing()
    const [, follower] = harness.elements
    harness.run(1000)
    follower.seekLatencyMs = 5000

    void harness.engine.seek(30)
    follower.seeks.length = 0
    // The window expires with the seek still in flight.
    harness.skipClock(SEEK_SETTLE_MS * 2)
    harness.run(1200, 100)

    // The master landed on 30 while the follower is still stuck near 1s — a
    // drift a hard seek would have "fixed", restarting the stall.
    expect(follower.seeks).toEqual([])
  })

  it('ignores a stem whose clock stops being a number', async () => {
    const harness = await playing()
    const [, follower] = harness.elements
    harness.run(1000)

    // A detached or errored element reads back NaN; every comparison against
    // it is false, so an unguarded servo would fall through to a rate trim.
    follower.broken = true
    harness.run(2000)

    expect(follower.seeks).toEqual([])
    expect(follower.playbackRate).toBe(1)
  })

  it('waits for every element before reporting a seek complete', async () => {
    const harness = await playing()
    harness.elements[0].seekLatencyMs = 100
    harness.elements[1].seekLatencyMs = 400
    let settled = false

    const arrival = harness.engine.seek(45).then(() => {
      settled = true
    })

    harness.run(200, 50)
    await Promise.resolve()
    expect(settled).toBe(false)

    harness.run(400, 50)
    await arrival
    expect(settled).toBe(true)
    // Both landed on the target and are running on from it, not from where
    // they were before the seek.
    for (const element of harness.elements) {
      expect(element.currentTime).toBeGreaterThanOrEqual(45)
      expect(element.currentTime).toBeLessThan(46)
    }
  })

  it('reports a stem the OS paused behind our back', async () => {
    const harness = await playing()
    harness.run(1000)

    // iOS's Now Playing control pauses the one element it attached to.
    harness.elements[1].pause()

    expect(harness.interrupted).toHaveBeenCalledTimes(1)
    expect(harness.interrupted.mock.calls[0][0]).toBe('instrumental')
  })

  it('says nothing when it is the one doing the pausing', async () => {
    const harness = await playing()
    harness.run(1000)

    harness.engine.pause()

    expect(harness.interrupted).not.toHaveBeenCalled()
  })

  it('says nothing when a stem simply reached its end', async () => {
    const harness = await playing()
    harness.run(1000)

    harness.elements[1].ended = true
    harness.elements[1].pause()

    expect(harness.interrupted).not.toHaveBeenCalled()
  })

  it('lets go of every element it took', async () => {
    // Four listeners go on each element; a reload that leaves any of them
    // attached leaves a dead engine reacting to a live one's events.
    const harness = await playing()
    harness.run(1000)

    harness.engine.dispose()

    for (const element of harness.elements) {
      for (const [type, count] of element.listeners) {
        expect(`${type}:${count}`).toBe(`${type}:0`)
      }
      expect(element.listeners.size).toBeGreaterThan(0)
    }
  })

  it('drops every trim when the player changes speed', async () => {
    const harness = await playing()
    const [master, follower] = harness.elements
    harness.run(1000)
    follower.currentTime = master.currentTime - 0.12
    harness.run(1000)
    expect(follower.playbackRate).not.toBe(1)

    harness.engine.setPlaybackRate(0.75)

    expect(follower.playbackRate).toBe(0.75)
    expect(master.playbackRate).toBe(0.75)
    expect(follower.preservesPitch).toBe(true)
  })
})
