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
  /** End of the one buffered range this fake exposes. */
  bufferedStart = 0
  bufferedEnd = 240
  /** Safari can reject currentTime before play() has opened metadata. */
  rejectSeekWhilePaused = false
  /** Populate a target-local range when the first usable seek arrives. */
  bufferAfterAcceptedSeekSeconds = 0
  readyState = 4
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

  get buffered(): TimeRanges {
    const end = this.bufferedEnd
    return {
      length: end > this.bufferedStart ? 1 : 0,
      start: () => this.bufferedStart,
      end: () => end,
    }
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
    if (this.rejectSeekWhilePaused && this.paused) {
      throw new DOMException('metadata is not ready', 'InvalidStateError')
    }
    this.seeks.push(value)
    if (this.bufferAfterAcceptedSeekSeconds > 0) {
      this.bufferedStart = value
      this.bufferedEnd = value + this.bufferAfterAcceptedSeekSeconds
    }
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

function rig(
  trackIds: readonly string[] = ['vocal', 'instrumental'],
  readiness: {
    playableWindowSeconds?: number
    playableWindowTimeoutMs?: number
  } = {},
): Rig {
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
    ...readiness,
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

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve()
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

  it('keeps a cold start pending until every stem has five seconds ahead', async () => {
    const harness = rig()
    for (const element of harness.elements) element.bufferedEnd = 1
    let settled = false

    const start = harness.engine
      .play(0, () => 1)
      .then((result) => {
        settled = true
        return result
      })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(settled).toBe(false)

    harness.elements[0].bufferedEnd = 8
    harness.elements[0].dispatchEvent(new Event('progress'))
    await Promise.resolve()
    expect(settled).toBe(false)

    harness.elements[1].bufferedEnd = 8
    harness.elements[1].dispatchEvent(new Event('progress'))
    await expect(start).resolves.not.toBeNull()
    expect(settled).toBe(true)
  })

  it('waits for the accepted common seek before reporting the room ready', async () => {
    const harness = rig(['instrumental'])
    harness.elements[0].seekLatencyMs = 400
    let settled = false

    const start = harness.engine
      .play(90, () => 1)
      .then((result) => {
        settled = true
        return result
      })
    await flushMicrotasks()
    expect(settled).toBe(false)

    harness.run(250, 50)
    await Promise.resolve()
    expect(settled).toBe(false)

    harness.run(250, 50)
    await expect(start).resolves.not.toBeNull()
    // Reuse the accepted in-flight seek instead of restarting the decoder
    // merely because its buffer was already available.
    expect(harness.elements[0].seeks).toEqual([90])
    expect(harness.elements[0].currentTime).toBeGreaterThanOrEqual(90)
    expect(harness.elements[0].currentTime).toBeLessThan(91)
  })

  it('spends the remaining readiness budget on a slow final alignment', async () => {
    const harness = rig(['instrumental'], {
      playableWindowTimeoutMs: 5000,
    })
    const element = harness.elements[0]
    element.bufferedEnd = 1
    let settled = false

    const start = harness.engine
      .play(90, () => 1)
      .then((result) => {
        settled = true
        return result
      })
    await flushMicrotasks()

    // Warm-up advances the hidden element before its target range arrives.
    harness.run(1300, 100)
    element.seekLatencyMs = 2000
    element.bufferedStart = 90
    element.bufferedEnd = 98
    element.dispatchEvent(new Event('progress'))
    await flushMicrotasks()

    harness.run(1300, 100)
    await flushMicrotasks()
    expect(settled).toBe(false)

    harness.run(900, 100)
    await expect(start).resolves.not.toBeNull()
    expect(element.currentTime).toBeGreaterThanOrEqual(90)
    expect(element.currentTime).toBeLessThan(91)
  })

  it('clamps the five-second window to the music remaining near the end', async () => {
    const harness = rig(['instrumental'])
    harness.elements[0].bufferedEnd = 240

    await expect(harness.engine.play(238, () => 1)).resolves.not.toBeNull()
  })

  it('requests a forward target again after pre-metadata Safari rejects it', async () => {
    const harness = rig(['instrumental'])
    const element = harness.elements[0]
    element.rejectSeekWhilePaused = true
    element.bufferedEnd = 1
    element.bufferAfterAcceptedSeekSeconds = 8

    await expect(harness.engine.play(90, () => 1)).resolves.not.toBeNull()

    // The pre-play assignment threw; the one recorded request is the retry
    // after play() opened the element. No redundant final seek is needed.
    expect(element.seeks).toEqual([90])
    expect(element.bufferedStart).toBe(90)
    expect(element.bufferedEnd).toBe(98)
  })

  it('keeps an accepted slow Safari seek inside the readiness budget', async () => {
    const harness = rig(['instrumental'], {
      playableWindowTimeoutMs: 5000,
    })
    const element = harness.elements[0]
    element.seekLatencyMs = 2000
    element.bufferedEnd = 1
    element.bufferAfterAcceptedSeekSeconds = 8
    let settled = false

    const start = harness.engine
      .play(90, () => 1)
      .then((result) => {
        settled = true
        return result
      })
    await flushMicrotasks()

    // The old 1.2 second generic seek timeout discarded this otherwise
    // healthy iOS stem before its five-second target window could arrive.
    harness.run(1300, 100)
    await flushMicrotasks()
    expect(settled).toBe(false)
    expect(element.paused).toBe(false)

    harness.run(900, 100)
    await expect(start).resolves.not.toBeNull()
    expect(element.currentTime).toBeGreaterThanOrEqual(90)
    expect(element.currentTime).toBeLessThan(91)
  })

  it('accepts the browser enough-data promise when ranges never materialize', async () => {
    const harness = rig(['instrumental'], {
      playableWindowTimeoutMs: 100,
    })
    harness.elements[0].bufferedEnd = 0
    harness.elements[0].readyState = 4

    const start = harness.engine.play(0, () => 1)
    await flushMicrotasks()
    vi.advanceTimersByTime(100)
    await flushMicrotasks()

    await expect(start).resolves.not.toBeNull()
  })

  it('fails a timed-out element that has neither a window nor enough data', async () => {
    const harness = rig(['instrumental'], {
      playableWindowTimeoutMs: 100,
    })
    harness.elements[0].bufferedEnd = 0
    harness.elements[0].readyState = 2

    const start = harness.engine.play(0, () => 1)
    await flushMicrotasks()
    vi.advanceTimersByTime(100)
    await flushMicrotasks()

    await expect(start).resolves.toBeNull()
    expect(harness.elements[0].paused).toBe(true)
  })

  it('cancels a pending warm-up when the player pauses', async () => {
    const harness = rig(['instrumental'])
    const element = harness.elements[0]
    const listenerBaseline = new Map(element.listeners)
    element.bufferedEnd = 1

    const start = harness.engine.play(0, () => 1)
    await Promise.resolve()
    harness.engine.pause()

    await expect(start).resolves.toBeNull()
    expect(element.paused).toBe(true)
    for (const [type, count] of element.listeners) {
      expect(count).toBe(listenerBaseline.get(type) ?? 0)
    }
  })

  it('cancels the final Safari seek immediately when the player pauses', async () => {
    const harness = rig(['instrumental'])
    const element = harness.elements[0]
    const listenerBaseline = new Map(element.listeners)
    element.seekLatencyMs = 5000

    const start = harness.engine.play(40, () => 1)
    await flushMicrotasks()
    expect(element.seeking).toBe(true)

    harness.engine.pause()

    await expect(start).resolves.toBeNull()
    expect(element.paused).toBe(true)
    for (const [type, count] of element.listeners) {
      expect(count).toBe(listenerBaseline.get(type) ?? 0)
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
