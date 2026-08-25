// ============================================================
// Drum stem play-along tests — one transport and exact loop seams
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { PlayAlongBackingLease, PlayAlongBackingSource, } from '@/features/play-along/song-port'
import type { PlayAlongStemMixEngine, PlayAlongStemMixStatus, PlayAlongStemSchedule, } from '@/features/play-along/stem-mix-engine'
import type { PlayAlongStemLease } from '@/features/play-along/stem-mix-engine'
import type { DrumRuntimeClock } from '../runtime/drum-transport'
import { createDrumTransport } from '../runtime/drum-transport'
import { createDrumStemPlayAlongController } from './drum-stem-play-along'

class FakeClock implements DrumRuntimeClock {
  private now = 0
  private nextId = 1
  private frames = new Map<number, (timestamp: number) => void>()

  nowMs = () => this.now
  requestFrame = (callback: (timestamp: number) => void): number => {
    const id = this.nextId++
    this.frames.set(id, callback)
    return id
  }
  cancelFrame = (id: number): void => {
    this.frames.delete(id)
  }
  advance(milliseconds: number): void {
    this.now += milliseconds
    const callbacks = [...this.frames.values()]
    this.frames.clear()
    for (const callback of callbacks) callback(this.now)
  }
}

function fakeEngine() {
  let status: PlayAlongStemMixStatus = 'idle'
  let duration = 12
  let listener: (() => void) | null = null
  const starts = vi.fn((_schedule: PlayAlongStemSchedule) => {
    status = 'playing'
    listener?.()
    return true
  })
  const seeks = vi.fn((_schedule: PlayAlongStemSchedule) => true)
  const pause = vi.fn(() => {
    status = 'paused'
  })
  const stop = vi.fn(() => {
    status = 'stopped'
  })
  const configure = vi.fn((lease: PlayAlongStemLease | null) => {
    status = lease === null ? 'idle' : 'configured'
  })
  const engine: PlayAlongStemMixEngine = {
    configure,
    load: vi.fn(async () => {
      status = 'ready'
      listener?.()
      return true
    }),
    start: starts,
    pause,
    stop,
    seek: seeks,
    setTrackMuted: vi.fn(),
    setTrackLevel: vi.fn(),
    setBusMuted: vi.fn(),
    setBusLevel: vi.fn(),
    getStatus: () => status,
    getProgress: () => null,
    getError: () => null,
    getDurationSeconds: () => duration,
    getTrackStates: () => [],
    getBusStates: () => [],
    subscribe(nextListener) {
      listener = nextListener
      return () => {
        if (listener === nextListener) listener = null
      }
    },
    dispose: vi.fn(() => {
      status = 'disposed'
    }),
  }
  return {
    engine,
    configure,
    pause,
    seeks,
    setDuration(value: number) {
      duration = value
    },
    starts,
    stop,
  }
}

function fullPartsLease(): PlayAlongBackingLease<'drums'> {
  return {
    sessionId: 'uvr-42',
    title: 'Prepared take',
    stems: [
      { kind: 'drums', url: 'blob:drums', sizeBytes: 100, durationSeconds: 12 },
      { kind: 'bass', url: 'blob:bass', sizeBytes: 100, durationSeconds: 12 },
      { kind: 'vocal', url: 'blob:vocal', sizeBytes: 100, durationSeconds: 12 },
    ],
    defaultMix: {
      kind: 'parts',
      audible: ['drums', 'bass', 'vocal'],
      muted: [],
    },
    release: vi.fn(),
  }
}

function sourceFromLease(
  lease: PlayAlongBackingLease<'drums'>,
): PlayAlongBackingSource<'drums'> {
  return {
    sessionId: lease.sessionId,
    title: lease.title,
    stemKinds: lease.stems.map((stem) => stem.kind),
    plannedMix: lease.defaultMix,
    durationSeconds: Math.max(
      0,
      ...lease.stems.map((stem) => stem.durationSeconds ?? 0),
    ),
    source: lease.source,
    load: vi.fn(async () => ({ ok: true as const, lease })),
    release: vi.fn(),
  }
}

function fullPartsSource(): PlayAlongBackingSource<'drums'> {
  return sourceFromLease(fullPartsLease())
}

function reconstructedSource(): PlayAlongBackingSource<'drums'> {
  return sourceFromLease({
    sessionId: 'uvr-reconstructed',
    title: 'Reconstructed take',
    stems: [
      { kind: 'vocal', url: 'blob:vocal', sizeBytes: 100 },
      { kind: 'instrumental', url: 'blob:instrumental', sizeBytes: 100 },
      { kind: 'drums', url: 'blob:drums', sizeBytes: 100 },
    ],
    defaultMix: {
      kind: 'parts',
      audible: ['vocal', 'instrumental', 'drums'],
      muted: [],
    },
    release: vi.fn(),
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

function room(options: { countInBeats?: number } = {}) {
  const clock = new FakeClock()
  const context = { currentTime: 10, state: 'running' } as AudioContext
  const transport = createDrumTransport({
    clock,
    countInBeats: options.countInBeats ?? 0,
    authoredTiming: { tempoBpm: 60, durationBeats: 12 },
  })
  const fake = fakeEngine()
  const controller = createDrumStemPlayAlongController({
    transport,
    activeContext: () => context,
    activeOutput: () => ({}) as AudioNode,
    performanceTimestampToContextTime: (timestamp) =>
      context.currentTime + (timestamp - clock.nowMs()) / 1_000,
    createEngine: async () => fake.engine,
  })
  return {
    clock,
    context,
    controller,
    fake,
    transport,
    advance(milliseconds: number) {
      ;(context as unknown as { currentTime: number }).currentTime +=
        milliseconds / 1_000
      clock.advance(milliseconds)
    },
  }
}

describe('Drum stem play-along', () => {
  it('is inert until explicit load and borrows rather than releases the source lease', async () => {
    const session = room()
    const source = fullPartsSource()
    session.controller.configure(source)

    expect(session.fake.configure).not.toHaveBeenCalled()
    expect(session.fake.starts).not.toHaveBeenCalled()
    expect(source.load).not.toHaveBeenCalled()
    expect(session.controller.snapshot()).toMatchObject({
      status: 'configured',
      mixPreset: 'full',
      hasIndependentDrums: true,
      durationSeconds: 12,
    })

    expect(await session.controller.load()).toBe(true)
    expect(source.load).toHaveBeenCalledOnce()
    expect(session.fake.configure).toHaveBeenCalledOnce()
    expect(source.release).not.toHaveBeenCalled()

    session.controller.configure(null)
    expect(session.fake.configure).toHaveBeenLastCalledWith(null)
    expect(source.release).not.toHaveBeenCalled()
    session.controller.dispose()
    session.transport.dispose()
  })

  it('queues one future start after count-in and schedules each loop wrap on the same clock', async () => {
    const session = room({ countInBeats: 2 })
    session.controller.configure(fullPartsSource())
    expect(await session.controller.load()).toBe(true)
    expect(session.transport.setLoop({ startBeat: 2, endBeat: 4 })).toBe(true)

    session.transport.start()
    expect(session.fake.starts).toHaveBeenCalledTimes(1)
    const queuedStart = session.fake.starts.mock.calls[0]?.[0]
    expect(queuedStart?.atContextTime).toBe(12)
    expect(queuedStart?.sourceOffsetSeconds).toBe(2)
    expect(queuedStart?.playbackRate).toBe(1)
    expect(session.controller.snapshot().status).toBe('queued')

    session.advance(2_000)
    expect(session.fake.starts).toHaveBeenCalledTimes(1)
    session.advance(2_000)
    expect(session.fake.seeks).toHaveBeenCalledWith({
      atContextTime: 14,
      sourceOffsetSeconds: 2,
      playbackRate: 1,
    })
    expect(session.controller.snapshot().scheduledLoopCount).toBeGreaterThan(0)

    session.controller.dispose()
    session.transport.dispose()
  })

  it('restarts at the visible source offset after seek and preserves source-time rate math', async () => {
    const session = room()
    session.controller.configure(fullPartsSource())
    expect(await session.controller.load()).toBe(true)
    session.transport.setSpeedScale(0.5)
    session.transport.seek(6)
    session.transport.start()

    expect(session.fake.starts).toHaveBeenLastCalledWith({
      atContextTime: 10,
      sourceOffsetSeconds: 6,
      playbackRate: 0.5,
    })

    session.transport.seek(8)
    expect(session.fake.stop).toHaveBeenCalled()
    expect(session.fake.starts).toHaveBeenLastCalledWith({
      atContextTime: 10,
      sourceOffsetSeconds: 8,
      playbackRate: 0.5,
    })

    session.controller.dispose()
    session.transport.dispose()
  })

  it('keeps mixed two-stem sessions honest and rejects independent drum presets', () => {
    const session = room()
    session.controller.configure(
      sourceFromLease({
        sessionId: 'two-stem',
        title: 'Mixed take',
        stems: [
          { kind: 'vocal', url: 'blob:vocal', sizeBytes: 100 },
          { kind: 'instrumental', url: 'blob:mix', sizeBytes: 100 },
        ],
        defaultMix: {
          kind: 'mixed-instrumental',
          audible: ['vocal', 'instrumental'],
          muted: [],
        },
        release: vi.fn(),
      }),
    )

    expect(session.controller.snapshot()).toMatchObject({
      mixKind: 'mixed-instrumental',
      hasIndependentDrums: false,
      mixPreset: 'full',
    })
    expect(session.controller.applyPreset('drum-focus')).toBe(false)
    expect(session.controller.applyPreset('play-along')).toBe(false)

    session.controller.dispose()
    session.transport.dispose()
  })

  it('applies full, drum-focus, and play-along without touching the live kit bus', async () => {
    const session = room()
    session.controller.configure(fullPartsSource())
    expect(await session.controller.load()).toBe(true)

    expect(session.controller.applyPreset('drum-focus')).toBe(true)
    expect(session.controller.snapshot()).toMatchObject({
      mixPreset: 'drum-focus',
      buses: {
        drums: { muted: false, level: 1 },
        backing: { muted: true, level: 1 },
      },
    })
    expect(session.controller.applyPreset('play-along')).toBe(true)
    expect(session.controller.snapshot()).toMatchObject({
      mixPreset: 'play-along',
      buses: {
        drums: { muted: true, level: 1 },
        backing: { muted: false, level: 1 },
      },
    })
    expect(session.controller.applyPreset('full')).toBe(true)

    session.controller.dispose()
    session.transport.dispose()
  })

  it('routes one aligned inverted drum send through reconstructed backing', async () => {
    const session = room()
    session.controller.configure(reconstructedSource())

    expect(await session.controller.load()).toBe(true)
    const configured = session.fake.configure.mock.calls[0]?.[0]
    const instrumental = configured?.stems.find(
      (track) => track.label === 'Backing (drums removed)',
    )
    const drums = configured?.stems.find((track) => track.label === 'Drums')
    expect(instrumental).toMatchObject({
      bus: 'backing',
      subtractAssetId: drums?.id,
    })
    expect(drums).toMatchObject({ bus: 'drums' })

    session.controller.dispose()
    session.transport.dispose()
  })

  it('preserves track mute and level choices made before Play hydrates the stems', async () => {
    const session = room()
    session.controller.configure(fullPartsSource())
    const bassTrack = session.controller
      .snapshot()
      .tracks.find((track) => track.label === 'Bass')
    expect(bassTrack).toBeDefined()

    session.controller.setTrackMuted(bassTrack!.id, true)
    session.controller.setTrackLevel(bassTrack!.id, 0.35)

    expect(await session.controller.load()).toBe(true)
    expect(
      session.controller
        .snapshot()
        .tracks.find((track) => track.label === 'Bass'),
    ).toMatchObject({
      id: bassTrack!.id,
      muted: true,
      level: 0.35,
    })
    const configuredLease = session.fake.configure.mock.calls[0]?.[0]
    expect(
      configuredLease?.stems.find(
        (track: { label?: string }) => track.label === 'Bass',
      ),
    ).toMatchObject({
      id: bassTrack!.id,
      muted: true,
      level: 0.35,
    })

    session.controller.dispose()
    session.transport.dispose()
  })

  it('aborts a Play-owned source load when the selected song changes', async () => {
    const session = room()
    const lease = fullPartsLease()
    const pending = deferred<{
      readonly ok: true
      readonly lease: PlayAlongBackingLease<'drums'>
    }>()
    const loadSignals: AbortSignal[] = []
    const source: PlayAlongBackingSource<'drums'> = {
      ...sourceFromLease(lease),
      load: vi.fn((options) => {
        loadSignals.push(options.signal)
        return pending.promise
      }),
    }
    session.controller.configure(source)

    const loading = session.controller.load()
    expect(session.controller.snapshot().status).toBe('loading')
    expect(loadSignals[0]?.aborted).toBe(false)

    session.controller.configure(null)
    expect(loadSignals[0]?.aborted).toBe(true)
    pending.resolve({ ok: true, lease })
    await expect(loading).resolves.toBe(false)
    expect(session.fake.configure).not.toHaveBeenCalled()
    expect(source.release).not.toHaveBeenCalled()

    session.controller.dispose()
    session.transport.dispose()
  })

  it('discloses encoded-source budget refusal without constructing the engine', async () => {
    const session = room()
    const source: PlayAlongBackingSource<'drums'> = {
      ...fullPartsSource(),
      load: vi.fn(async () => ({
        ok: false as const,
        code: 'encoded-budget' as const,
        requiredBytes: 300,
        budgetBytes: 200,
      })),
    }
    session.controller.configure(source)

    await expect(session.controller.load()).resolves.toBe(false)
    expect(session.fake.configure).not.toHaveBeenCalled()
    expect(session.controller.snapshot()).toMatchObject({
      status: 'error',
      error: {
        code: 'encoded-budget',
        requiredBytes: 300,
        budgetBytes: 200,
      },
    })

    session.controller.dispose()
    session.transport.dispose()
  })
})
