// ============================================================
// Mic reconciliation tests — the audio-engine <-> mic-manager <->
// practice-engine contract from the mic postmortem:
//   - a failed startMic must never leak a manager hold,
//   - concurrent startMic calls share one acquisition,
//   - practice-engine heals (and ANNOUNCES) an isMicActive mismatch,
//   - onMicLost fires when the shared stream dies while recording.
// Companion suites: mic-manager.test.ts (manager core),
// mic-sentinel.test.ts (watchdog invariants).
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioEngine } from '@/lib/audio-engine'
import { micManager } from '@/lib/mic-manager'
import { PracticeEngine } from '@/lib/practice-engine'

// ── Stubs ──────────────────────────────────────────────────────

interface MockTrack {
  readyState: string
  stop: ReturnType<typeof vi.fn>
  addEventListener: (name: string, cb: () => void) => void
}

interface MockStream {
  getTracks: () => MockTrack[]
  track: MockTrack
  /** Simulate the OS revoking the device (track 'ended'). */
  fireEnded: () => void
}

function makeStream(): MockStream {
  const listeners = new Map<string, Array<() => void>>()
  const track: MockTrack = {
    readyState: 'live',
    stop: vi.fn(() => {
      track.readyState = 'ended'
    }),
    addEventListener: (name, cb) => {
      const list = listeners.get(name) ?? []
      list.push(cb)
      listeners.set(name, list)
    },
  }
  return {
    getTracks: () => [track],
    track,
    fireEnded: () => {
      track.readyState = 'ended'
      for (const cb of listeners.get('ended') ?? []) cb()
    },
  }
}

/** Replace navigator.mediaDevices.getUserMedia with a controllable mock
 *  (same pattern as mic-manager.test.ts — the singleton picks it up). */
function mockGetUserMedia(
  impl: () => Promise<unknown>,
): ReturnType<typeof vi.fn> {
  const fn = vi.fn(impl)
  ;(
    globalThis.navigator as unknown as {
      mediaDevices: { getUserMedia: unknown }
    }
  ).mediaDevices = { getUserMedia: fn }
  return fn
}

interface StubAudioContextInstance {
  createMediaStreamSource: ReturnType<typeof vi.fn>
}

/** Minimal AudioContext covering everything AudioEngine.init() touches.
 *  Returns the created instances so tests can assert on the audio graph. */
function stubAudioContext(
  opts: { mediaSourceThrows?: boolean } = {},
): StubAudioContextInstance[] {
  const makeGain = () => ({
    gain: { value: 0, setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })
  const makeAnalyser = () => ({
    fftSize: 2048,
    smoothingTimeConstant: 0,
    frequencyBinCount: 1024,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getFloatTimeDomainData: vi.fn(),
    getFloatFrequencyData: vi.fn(),
    getByteFrequencyData: vi.fn(),
  })
  const instances: StubAudioContextInstance[] = []
  vi.stubGlobal(
    'AudioContext',
    vi.fn().mockImplementation(function (this: object) {
      instances.push(this as unknown as StubAudioContextInstance)
      Object.assign(this, {
        state: 'running' as const,
        sampleRate: 44100,
        currentTime: 0,
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        createGain: vi.fn(makeGain),
        createAnalyser: vi.fn(makeAnalyser),
        createDynamicsCompressor: vi.fn(() => ({
          threshold: { value: 0 },
          knee: { value: 0 },
          ratio: { value: 0 },
          attack: { value: 0 },
          release: { value: 0 },
          connect: vi.fn(),
          disconnect: vi.fn(),
        })),
        createMediaStreamSource:
          opts.mediaSourceThrows === true
            ? vi.fn(() => {
                throw new Error('wiring failed')
              })
            : vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
        destination: {},
      })
    }),
  )
  return instances
}

// ── Suite ──────────────────────────────────────────────────────

describe('mic reconciliation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(async () => {
    // The manager is an app-wide singleton: drop any holds this test left and
    // run out the linger so the next test starts from a closed device.
    for (const id of micManager.getConsumers()) micManager.release(id)
    await vi.advanceTimersByTimeAsync(2500)
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('releases the manager hold when startMic fails after acquire', async () => {
    // The acquire succeeds, but wiring the stream into the analyser graph
    // throws — the failure path must drop the hold, or the manager keeps the
    // device open forever with every UI reporting off (the phantom-hold leak).
    stubAudioContext({ mediaSourceThrows: true })
    mockGetUserMedia(() => Promise.resolve(makeStream()))
    const engine = new AudioEngine()

    const ok = await engine.startMic()

    expect(ok).toBe(false)
    expect(engine.isMicActive()).toBe(false)
    // release() is enqueued on the manager's serialisation queue — flush it.
    await vi.advanceTimersByTimeAsync(0)
    expect(micManager.getConsumers()).toEqual([])
  })

  it('re-entrant startMic calls share one start: one acquire, one source graph', async () => {
    // Note: startMic is an async method, so each CALL returns a fresh outer
    // promise by language semantics — the shared thing is the underlying run.
    // The observable contract asserted here: two concurrent calls produce one
    // getUserMedia acquire and wire exactly one source graph (the regression
    // was a duplicate, orphaned graph over the same stream).
    const contexts = stubAudioContext()
    const gum = mockGetUserMedia(() => Promise.resolve(makeStream()))
    const engine = new AudioEngine()

    const first = engine.startMic()
    const second = engine.startMic()

    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(true)
    expect(gum).toHaveBeenCalledTimes(1)
    expect(contexts).toHaveLength(1)
    expect(contexts[0].createMediaStreamSource).toHaveBeenCalledTimes(1)

    // A call after completion short-circuits on isRecording (still one open).
    await expect(engine.startMic()).resolves.toBe(true)
    expect(gum).toHaveBeenCalledTimes(1)
    expect(contexts[0].createMediaStreamSource).toHaveBeenCalledTimes(1)
    expect(engine.isMicActive()).toBe(true)
  })

  it('adopts a pending capture for a replacement logical owner', async () => {
    const contexts = stubAudioContext()
    let resolveStream: ((stream: MockStream) => void) | undefined
    const gum = mockGetUserMedia(
      () =>
        new Promise<MockStream>((resolve) => {
          resolveStream = resolve
        }),
    )
    const engine = new AudioEngine()

    const staleGuitarStart = engine.startMic('guitar')
    engine.stopMic('guitar')
    const currentPracticeStart = engine.startMic('practice')
    await vi.advanceTimersByTimeAsync(0)
    expect(resolveStream).toBeTypeOf('function')
    resolveStream?.(makeStream())

    await expect(staleGuitarStart).resolves.toBe(false)
    await expect(currentPracticeStart).resolves.toBe(true)
    expect(engine.isMicActive()).toBe(true)
    expect(gum).toHaveBeenCalledTimes(1)
    expect(contexts[0].createMediaStreamSource).toHaveBeenCalledTimes(1)

    engine.stopMic('practice')
    expect(engine.isMicActive()).toBe(false)
  })

  it('preserves the device-busy recovery message through practice-engine', async () => {
    stubAudioContext()
    mockGetUserMedia(() => {
      const error = new Error('device busy')
      error.name = 'NotReadableError'
      return Promise.reject(error)
    })
    const engine = new AudioEngine()
    const practice = new PracticeEngine(engine)
    const errors: string[] = []
    practice.addCallbacks({
      onMicStateChange: (active, error) => {
        if (!active && error !== undefined) errors.push(error)
      },
    })

    const started = practice.startMic()
    await vi.advanceTimersByTimeAsync(250)

    await expect(started).resolves.toBe(false)
    expect(errors).toEqual([
      'The microphone is in use by another app or browser tab.',
    ])
  })

  it('practice-engine heals an isMicActive mismatch and emits onMicStateChange', () => {
    let engineActive = true
    const fakeAudioEngine = {
      isMicActive: () => engineActive,
      onMicLost: () => () => {},
    } as unknown as AudioEngine
    const practice = new PracticeEngine(fakeAudioEngine)
    const events: boolean[] = []
    practice.addCallbacks({
      onMicStateChange: (active) => events.push(active),
    })

    // Internal false vs engine true: heal to the engine's truth and ANNOUNCE
    // it — the silent sync left the UI signal on the wrong side forever.
    expect(practice.isMicActive()).toBe(true)
    expect(events).toEqual([true])

    // And the other direction (engine lost the mic under us).
    engineActive = false
    expect(practice.isMicActive()).toBe(false)
    expect(events).toEqual([true, false])

    // In agreement: no further emits.
    expect(practice.isMicActive()).toBe(false)
    expect(events).toEqual([true, false])
  })

  it('fires onMicLost and resets when the shared stream dies while recording', async () => {
    stubAudioContext()
    const stream = makeStream()
    mockGetUserMedia(() => Promise.resolve(stream))
    const engine = new AudioEngine()
    const lost = vi.fn()
    engine.onMicLost(lost)

    await expect(engine.startMic()).resolves.toBe(true)
    expect(engine.isMicActive()).toBe(true)
    expect(lost).not.toHaveBeenCalled()

    // OS revoke / device switch: the track ends, the manager tears the shared
    // stream down, and the engine must reset itself and tell its wrappers.
    stream.fireEnded()

    expect(lost).toHaveBeenCalledTimes(1)
    expect(engine.isMicActive()).toBe(false)
    expect(engine.getMicStream()).toBeNull()
    // The stale hold was dropped (release is enqueued — flush it).
    await vi.advanceTimersByTimeAsync(0)
    expect(micManager.getConsumers()).toEqual([])
  })

  it('a plain stopMic does NOT fire onMicLost', async () => {
    stubAudioContext()
    mockGetUserMedia(() => Promise.resolve(makeStream()))
    const engine = new AudioEngine()
    const lost = vi.fn()
    engine.onMicLost(lost)

    await expect(engine.startMic()).resolves.toBe(true)
    engine.stopMic()
    await vi.advanceTimersByTimeAsync(2500) // linger + teardown emit

    expect(engine.isMicActive()).toBe(false)
    expect(lost).not.toHaveBeenCalled()
  })
})
