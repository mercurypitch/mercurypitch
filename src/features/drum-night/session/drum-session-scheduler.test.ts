// Drum session scheduler tests — tempo-map occurrences on one injected clock.
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { DrumKitPlayerPort } from '../runtime/drum-runtime-types'
import type { DrumRuntimeClock } from '../runtime/drum-transport'
import { createDrumTransport } from '../runtime/drum-transport'
import { drumSongFixture, percussionTrackFixture, readyDocumentFixture, } from './drum-session.test-fixtures'
import { createDrumSessionScheduler } from './drum-session-scheduler'
import { AUTHORED_CYMBAL_CHOKE_TAIL_SECONDS, MAX_DRUM_SESSION_ACTION_EARLY_MS, } from './drum-session-scheduler'

class FakeClock implements DrumRuntimeClock {
  private timestampMs = 0
  private nextFrameId = 1
  private frames = new Map<number, (timestampMs: number) => void>()

  nowMs = (): number => this.timestampMs

  requestFrame = (callback: (timestampMs: number) => void): number => {
    const id = this.nextFrameId++
    this.frames.set(id, callback)
    return id
  }

  cancelFrame = (handle: number): void => {
    this.frames.delete(handle)
  }

  advance(milliseconds: number): void {
    this.timestampMs += milliseconds
    const pending = [...this.frames.values()]
    this.frames.clear()
    for (const callback of pending) callback(this.timestampMs)
  }
}

function playerFixture(
  result: ReturnType<DrumKitPlayerPort['trigger']> = 'synth-fallback',
) {
  return {
    activate: vi.fn<DrumKitPlayerPort['activate']>(() => true),
    trigger: vi.fn<DrumKitPlayerPort['trigger']>(() => result),
    panic: vi.fn<DrumKitPlayerPort['panic']>(),
    dispose: vi.fn<DrumKitPlayerPort['dispose']>(),
  } satisfies DrumKitPlayerPort
}

describe('Drum Night session scheduler', () => {
  it('is silent on construction and exposes an explicit session revision seam', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = playerFixture()
    const mapper = vi.fn(() => 10)
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      performanceTimestampToContextTime: mapper,
    })

    expect(scheduler.snapshot()).toMatchObject({
      status: 'empty',
      sessionRevision: 0,
      indexedHitCount: 0,
    })
    expect(player.activate).not.toHaveBeenCalled()
    expect(player.trigger).not.toHaveBeenCalled()
    expect(player.panic).not.toHaveBeenCalled()
    expect(mapper).not.toHaveBeenCalled()

    scheduler.setSession(readyDocumentFixture())
    expect(scheduler.sessionRevision()).toBe(1)
    expect(scheduler.snapshot()).toMatchObject({
      status: 'ready',
      indexedHitCount: 4,
      playableHitCount: 4,
    })
    expect(player.activate).not.toHaveBeenCalled()
  })

  it.each([
    ['percussion-only', false],
    ['mixed', true],
  ] as const)(
    'schedules only canonical percussion from a %s file',
    (_, mixed) => {
      const clock = new FakeClock()
      const transport = createDrumTransport({ clock, countInBeats: 0 })
      const player = playerFixture('sampled')
      const scheduler = createDrumSessionScheduler({
        transport,
        player,
        lookaheadMs: 600,
        performanceTimestampToContextTime: (timestampMs) =>
          10 + (timestampMs - clock.nowMs()) / 1_000,
      })
      const song = drumSongFixture({
        includePitched: mixed,
        percussionTracks: [
          percussionTrackFixture({
            hits: [{ id: 'kick', gmKey: 36, startBeat: 0, velocity: 111 }],
          }),
        ],
      })

      scheduler.setSession(readyDocumentFixture({ song }))
      transport.start()

      expect(player.trigger).toHaveBeenCalledTimes(1)
      expect(player.trigger).toHaveBeenCalledWith({
        gmKey: 36,
        velocity: 111,
        atContextTime: 10,
        sourceId: 'authored:drums:kick',
        lane: 'authored',
      })
      expect(scheduler.snapshot().triggerCounts.sampled).toBe(1)
    },
  )

  it('reports an explicitly selected synth model as successful authored playback, not fallback', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = playerFixture('synthesized')
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 600,
      performanceTimestampToContextTime: (timestampMs) =>
        10 + timestampMs / 1_000,
    })

    scheduler.setSession(readyDocumentFixture())
    transport.start()

    expect(player.trigger).toHaveBeenCalledWith(
      expect.objectContaining({ lane: 'authored' }),
    )
    expect(scheduler.snapshot().triggerCounts).toMatchObject({
      synthesized: 2,
      synthFallback: 0,
    })
    expect(scheduler.snapshot().lastOccurrence?.triggerTruth).toBe(
      'synthesized',
    )
  })

  it('strikes an authored choked cymbal before scheduling its lane-safe release', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const order: string[] = []
    const player = {
      ...playerFixture('sampled'),
      trigger: vi.fn<DrumKitPlayerPort['trigger']>(() => {
        order.push('trigger')
        return 'sampled'
      }),
      choke: vi.fn<NonNullable<DrumKitPlayerPort['choke']>>(() => {
        order.push('choke')
        return 'choked'
      }),
    } satisfies DrumKitPlayerPort
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 600,
      performanceTimestampToContextTime: () => 10,
    })
    scheduler.setSession(
      readyDocumentFixture({
        song: drumSongFixture({
          percussionTracks: [
            percussionTrackFixture({
              hits: [
                {
                  id: 'grabbed-crash',
                  gmKey: 49,
                  startBeat: 0,
                  velocity: 118,
                  articulation: 'choke',
                },
              ],
            }),
          ],
        }),
      }),
    )

    transport.start()

    expect(order).toEqual(['trigger', 'choke'])
    expect(player.choke).toHaveBeenCalledWith({
      gmKey: 49,
      atContextTime: 10 + AUTHORED_CYMBAL_CHOKE_TAIL_SECONDS,
      sourceId: 'authored:drums:grabbed-crash:choke',
      lane: 'authored',
    })
    expect(scheduler.snapshot().lastOccurrence).toMatchObject({
      articulation: 'choke',
      triggerTruth: 'sampled',
      chokeTruth: 'choked',
    })
  })

  it('schedules a group choke after every same-GM attack inside its authored tail', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const actionOrder: string[] = []
    const activeCrashSources: string[] = []
    const player = {
      ...playerFixture('sampled'),
      trigger: vi.fn<DrumKitPlayerPort['trigger']>((hit) => {
        actionOrder.push(`trigger:${hit.sourceId}:${hit.atContextTime}`)
        if (hit.gmKey === 49 && hit.sourceId !== undefined) {
          activeCrashSources.push(hit.sourceId)
        }
        return 'sampled'
      }),
      choke: vi.fn<NonNullable<DrumKitPlayerPort['choke']>>((request) => {
        actionOrder.push(
          `choke:${request.sourceId}:${activeCrashSources.join(',')}:${request.atContextTime}`,
        )
        return 'choked'
      }),
    } satisfies DrumKitPlayerPort
    let contextReady = false
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 600,
      performanceTimestampToContextTime: (timestampMs) =>
        contextReady ? 10 + timestampMs / 1_000 : null,
    })
    scheduler.setSession(
      readyDocumentFixture({
        song: drumSongFixture({
          bpm: 120,
          percussionTracks: [
            percussionTrackFixture({
              hits: [
                {
                  id: 'grabbed-crash',
                  gmKey: 49,
                  startBeat: 0,
                  velocity: 118,
                  articulation: 'choke',
                },
                {
                  id: 'following-crash',
                  gmKey: 49,
                  startBeat: 0.1,
                  velocity: 112,
                },
              ],
            }),
          ],
        }),
      }),
    )
    transport.start()

    contextReady = true
    const occurrences = scheduler.schedule(600)

    expect(actionOrder).toEqual([
      'trigger:authored:drums:grabbed-crash:10',
      'trigger:authored:drums:following-crash:10.05',
      'choke:authored:drums:grabbed-crash:choke:authored:drums:grabbed-crash,authored:drums:following-crash:10.11',
    ])
    expect(player.choke).toHaveBeenCalledWith({
      gmKey: 49,
      atContextTime: 10 + AUTHORED_CYMBAL_CHOKE_TAIL_SECONDS,
      sourceId: 'authored:drums:grabbed-crash:choke',
      lane: 'authored',
    })
    expect(
      occurrences.find(
        (occurrence) => occurrence.sourceHitId === 'grabbed-crash',
      ),
    ).toMatchObject({
      triggerTruth: 'sampled',
      chokeTruth: 'choked',
    })
  })

  it('holds a choke release until the next horizon reveals every earlier same-GM attack', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const actionOrder: string[] = []
    const activeCrashSources: string[] = []
    const player = {
      ...playerFixture('sampled'),
      trigger: vi.fn<DrumKitPlayerPort['trigger']>((hit) => {
        const sourceId = hit.sourceId ?? 'unknown'
        actionOrder.push(`trigger:${sourceId}`)
        if (hit.gmKey === 49) activeCrashSources.push(sourceId)
        return 'sampled'
      }),
      choke: vi.fn<NonNullable<DrumKitPlayerPort['choke']>>(() => {
        actionOrder.push(`choke:${activeCrashSources.join(',')}`)
        return 'choked'
      }),
    } satisfies DrumKitPlayerPort
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 100,
      performanceTimestampToContextTime: (timestampMs) =>
        10 + timestampMs / 1_000,
      humanize: (hit) => ({
        timeOffsetMs: 0,
        velocity: hit.velocity,
        ornaments: [],
      }),
    })
    scheduler.setSession(
      readyDocumentFixture({
        song: drumSongFixture({
          bpm: 120,
          percussionTracks: [
            percussionTrackFixture({
              hits: [
                {
                  id: 'grabbed-crash',
                  gmKey: 49,
                  startBeat: 0,
                  velocity: 118,
                  articulation: 'choke',
                },
                {
                  id: 'horizon-crash',
                  gmKey: 49,
                  startBeat: 0.21,
                  velocity: 112,
                },
              ],
            }),
          ],
        }),
      }),
    )

    transport.start()
    expect(actionOrder).toEqual(['trigger:authored:drums:grabbed-crash'])

    clock.advance(80)

    expect(actionOrder).toEqual([
      'trigger:authored:drums:grabbed-crash',
      'trigger:authored:drums:horizon-crash',
      'choke:authored:drums:grabbed-crash,authored:drums:horizon-crash',
    ])
    expect(player.choke).toHaveBeenCalledWith({
      gmKey: 49,
      atContextTime: 10 + AUTHORED_CYMBAL_CHOKE_TAIL_SECONDS,
      sourceId: 'authored:drums:grabbed-crash:choke',
      lane: 'authored',
    })
    expect(scheduler.snapshot()).toMatchObject({
      scheduledOccurrenceCount: 2,
      triggerCounts: { sampled: 2 },
      lastOccurrence: {
        sourceHitId: 'horizon-crash',
        triggerTruth: 'sampled',
      },
    })
  })

  it('invalidates authored audio without releasing a concurrent live lane', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const activeLanes = new Set<'authored' | 'live'>(['live'])
    const player = {
      activate: vi.fn<DrumKitPlayerPort['activate']>(() => true),
      trigger: vi.fn<DrumKitPlayerPort['trigger']>((hit) => {
        activeLanes.add(hit.lane ?? 'live')
        return 'sampled'
      }),
      panic: vi.fn<DrumKitPlayerPort['panic']>((lane) => {
        if (lane === undefined) activeLanes.clear()
        else activeLanes.delete(lane)
      }),
      dispose: vi.fn<DrumKitPlayerPort['dispose']>(),
    } satisfies DrumKitPlayerPort
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      performanceTimestampToContextTime: (timestampMs) =>
        10 + timestampMs / 1_000,
    })

    scheduler.setSession(readyDocumentFixture())
    expect(activeLanes).toEqual(new Set(['live']))
    expect(player.panic).toHaveBeenLastCalledWith('authored')

    transport.start()
    expect(activeLanes).toEqual(new Set(['live', 'authored']))
    scheduler.setSession(readyDocumentFixture())
    expect(activeLanes).toEqual(new Set(['live', 'authored']))
    transport.pause()
    expect(activeLanes).toEqual(new Set(['live']))
    expect(player.panic.mock.calls.every(([lane]) => lane === 'authored')).toBe(
      true,
    )
  })

  it('hot-reindexes an edit without moving or stopping the active take', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = playerFixture()
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 600,
      performanceTimestampToContextTime: (timestampMs) =>
        10 + timestampMs / 1_000,
    })
    const endingHit = {
      id: 'ending-crash',
      gmKey: 49,
      startBeat: 8,
      velocity: 110,
      writtenDuration: 0.25,
    }
    const initial = readyDocumentFixture({
      song: drumSongFixture({
        percussionTracks: [percussionTrackFixture({ hits: [endingHit] })],
      }),
    })
    const edited = readyDocumentFixture({
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              {
                id: 'new-snare',
                gmKey: 38,
                startBeat: 2.25,
                velocity: 105,
              },
              endingHit,
            ],
          }),
        ],
      }),
    })

    scheduler.setSession(initial)
    expect(transport.setLoop({ startBeat: 1, endBeat: 5 })).toBe(true)
    transport.seek(2)
    transport.setSpeedScale(0.7)
    transport.start()
    expect(player.trigger).not.toHaveBeenCalled()

    const revisionBefore = transport.scheduleRevision()
    scheduler.updateSession(edited)

    expect(transport.state()).toMatchObject({
      phase: 'playing',
      positionBeats: 2,
      speedScale: 0.7,
      loop: { startBeat: 1, endBeat: 5 },
    })
    expect(transport.scheduleRevision()).toBe(revisionBefore)
    expect(player.panic).toHaveBeenLastCalledWith('authored')
    expect(player.trigger).toHaveBeenCalledOnce()
    expect(player.trigger).toHaveBeenCalledWith(
      expect.objectContaining({
        gmKey: 38,
        sourceId: 'authored:drums:new-snare',
        lane: 'authored',
      }),
    )
  })

  it('binary-queries sorted hits across authored tempo changes', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = playerFixture()
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 1_200,
      performanceTimestampToContextTime: (timestampMs) =>
        20 + timestampMs / 1_000,
    })
    const song = drumSongFixture({
      percussionTracks: [
        percussionTrackFixture({
          hits: [
            { id: 'late', gmKey: 42, startBeat: 1.5, velocity: 70 },
            { id: 'opening', gmKey: 36, startBeat: 0, velocity: 100 },
            { id: 'change', gmKey: 38, startBeat: 1, velocity: 110 },
          ],
        }),
      ],
    })
    song.tempoChanges = [
      { beat: 0, usPerBeat: 500_000 },
      { beat: 1, usPerBeat: 1_000_000 },
    ]

    scheduler.setSession(readyDocumentFixture({ song }))
    expect(scheduler.snapshot()).toMatchObject({
      appliedTempoChangeCount: 2,
      omittedTempoChangeCount: 0,
      adjustedTempoChangeCount: 0,
    })
    transport.start()

    expect(player.trigger.mock.calls.map(([hit]) => hit.gmKey)).toEqual([
      36, 38, 42,
    ])
    const contextTimes = player.trigger.mock.calls.map(
      ([hit]) => hit.atContextTime,
    )
    expect(contextTimes[0]).toBeCloseTo(20)
    expect(contextTimes[1]).toBeCloseTo(20.5)
    expect(contextTimes[2]).toBeCloseTo(21)
  })

  it('dedupes overlapping lookahead while preserving loop occurrence time', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = playerFixture()
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 600,
      performanceTimestampToContextTime: (timestampMs) =>
        10 + timestampMs / 1_000,
    })
    const song = drumSongFixture({
      percussionTracks: [
        percussionTrackFixture({
          hits: [
            {
              id: 'loop-kick',
              gmKey: 36,
              startBeat: 0,
              velocity: 100,
              writtenDuration: 1,
            },
            {
              id: 'exclusive-end-snare',
              gmKey: 38,
              startBeat: 1,
              velocity: 120,
            },
          ],
        }),
      ],
    })

    scheduler.setSession(readyDocumentFixture({ song }))
    expect(transport.setLoop({ startBeat: 0, endBeat: 1 })).toBe(true)
    transport.start()

    expect(player.trigger).toHaveBeenCalledTimes(2)
    expect(player.trigger.mock.calls.map(([hit]) => hit.gmKey)).toEqual([
      36, 36,
    ])
    expect(scheduler.snapshot().lastOccurrence).toMatchObject({
      authoredBeat: 0,
      timelineBeat: 1,
      loopIteration: 1,
    })
    expect(scheduler.schedule(600)).toEqual([])
    expect(player.trigger).toHaveBeenCalledTimes(2)
  })

  it('keeps the overlap ledger bounded across thousands of loop iterations', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = playerFixture()
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 25,
      performanceTimestampToContextTime: (timestampMs) =>
        10 + timestampMs / 1_000,
    })
    const song = drumSongFixture({
      percussionTracks: [
        percussionTrackFixture({
          hits: [
            {
              gmKey: 36,
              startBeat: 0,
              velocity: 100,
              writtenDuration: 1,
            },
          ],
        }),
      ],
    })
    scheduler.setSession(readyDocumentFixture({ song }))
    expect(transport.setLoop({ startBeat: 0, endBeat: 1 })).toBe(true)
    transport.start()

    for (let iteration = 0; iteration < 3_000; iteration += 1) {
      clock.advance(500)
    }

    expect(player.trigger).toHaveBeenCalledTimes(3_001)
    expect(scheduler.snapshot()).toMatchObject({
      scheduledOccurrenceCount: 3_001,
      dedupeLedgerSize: 1,
    })
  })

  it('schedules a terminal attack before authored trailing duration auto-stop', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = playerFixture()
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 600,
      performanceTimestampToContextTime: (timestampMs) =>
        10 + timestampMs / 1_000,
    })
    const song = drumSongFixture({
      bpm: 120,
      percussionTracks: [
        percussionTrackFixture({
          hits: [{ id: 'terminal', gmKey: 49, startBeat: 0.5, velocity: 120 }],
        }),
      ],
    })

    scheduler.setSession(readyDocumentFixture({ song }))
    transport.start()
    expect(player.trigger).toHaveBeenCalledTimes(1)
    expect(player.trigger.mock.calls[0]?.[0]).toMatchObject({
      gmKey: 49,
      atContextTime: 10.25,
    })
    const panicsBeforeEnd = player.panic.mock.calls.length

    clock.advance(250)
    expect(transport.state()).toMatchObject({
      phase: 'stopped',
      positionBeats: 0.5,
    })
    expect(player.panic).toHaveBeenCalledTimes(panicsBeforeEnd)
  })

  it('prequeues beat zero during count-in once and invalidates it on restart', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({
      clock,
      tempoBpm: 120,
      countInBeats: 2,
    })
    const player = playerFixture()
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 100,
      performanceTimestampToContextTime: (timestampMs) =>
        10 + timestampMs / 1_000,
    })
    const song = drumSongFixture({
      percussionTracks: [
        percussionTrackFixture({
          hits: [
            {
              id: 'opening-kick',
              gmKey: 36,
              startBeat: 0,
              velocity: 112,
              writtenDuration: 2,
            },
          ],
        }),
      ],
    })
    scheduler.setSession(readyDocumentFixture({ song }))

    transport.start()
    expect(transport.state().phase).toBe('count-in')
    expect(player.trigger).toHaveBeenCalledTimes(1)
    expect(player.trigger.mock.calls[0]?.[0].atContextTime).toBeCloseTo(11)

    clock.advance(250)
    expect(player.trigger).toHaveBeenCalledTimes(1)
    const panicsBeforePause = player.panic.mock.calls.length
    transport.pause()
    expect(player.panic.mock.calls.length).toBeGreaterThan(panicsBeforePause)

    clock.advance(1_000)
    transport.start()
    expect(transport.state()).toMatchObject({
      phase: 'count-in',
      countInBeat: 1,
    })
    expect(player.trigger).toHaveBeenCalledTimes(2)
    expect(player.trigger.mock.calls[1]?.[0].atContextTime).toBeCloseTo(12.25)

    clock.advance(1_000)
    expect(transport.state()).toMatchObject({
      phase: 'playing',
      positionBeats: 0,
    })
    expect(player.trigger).toHaveBeenCalledTimes(2)
  })

  it.each([0, 1])(
    'reschedules beat zero after natural end with %i count-in beats',
    (countInBeats) => {
      const clock = new FakeClock()
      const transport = createDrumTransport({ clock, countInBeats })
      const player = playerFixture()
      const scheduler = createDrumSessionScheduler({
        transport,
        player,
        lookaheadMs: 100,
        performanceTimestampToContextTime: (timestampMs) =>
          10 + timestampMs / 1_000,
      })
      const song = drumSongFixture({
        bpm: 120,
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              {
                id: 'replay-kick',
                gmKey: 36,
                startBeat: 0,
                velocity: 100,
                writtenDuration: 1,
              },
            ],
          }),
        ],
      })
      scheduler.setSession(readyDocumentFixture({ song }))

      transport.start()
      if (countInBeats > 0) clock.advance(countInBeats * 500)
      clock.advance(500)
      expect(transport.state().phase).toBe('stopped')
      expect(player.trigger).toHaveBeenCalledTimes(1)

      transport.start()
      expect(transport.state().positionBeats).toBe(0)
      expect(player.trigger).toHaveBeenCalledTimes(2)
    },
  )

  it('keeps late binary queries intact and bounds a 500k-hit burst', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = playerFixture()
    const mapper = vi.fn((timestampMs: number) => 10 + timestampMs / 1_000)
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      performanceTimestampToContextTime: mapper,
    })
    const simultaneousHits = Array.from({ length: 500_000 }, (_, index) => ({
      gmKey: 35 + (index % 47),
      startBeat: 0,
      velocity: 1 + (index % 127),
      ...(index === 0 ? { writtenDuration: 1 } : {}),
    }))
    const song = drumSongFixture({
      percussionTracks: [
        percussionTrackFixture({
          hits: [
            ...simultaneousHits,
            {
              id: 'late-crash',
              gmKey: 49,
              startBeat: 1_000,
              velocity: 120,
              writtenDuration: 1,
            },
          ],
        }),
      ],
    })

    scheduler.setSession(readyDocumentFixture({ song }))
    transport.seek(1_000)
    transport.start()
    expect(player.trigger).toHaveBeenCalledTimes(1)
    expect(player.trigger.mock.calls[0]?.[0].gmKey).toBe(49)

    transport.stop()
    player.trigger.mockClear()
    mapper.mockClear()
    transport.start()

    expect(player.trigger).toHaveBeenCalledTimes(48)
    // One extra conversion establishes the safe action-queue watermark.
    expect(mapper).toHaveBeenCalledTimes(49)
    expect(scheduler.snapshot()).toMatchObject({
      indexedHitCount: 500_001,
      playableHitCount: 500_001,
      scheduledOccurrenceCount: 48,
      dedupeLedgerSize: 49,
      overloadOmittedOccurrenceCount: 499_952,
      deferredOccurrenceCount: 0,
    })
  })

  it('promotes expired deferred work to durable capacity-omission truth', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = playerFixture()
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 1_000,
      performanceTimestampToContextTime: () => 10,
    })
    const hits = Array.from({ length: 300 }, (_, index) => ({
      gmKey: 42,
      // Unique timestamps, all elapsed before a real 16ms next frame.
      startBeat: index / 1_000_000,
      velocity: 80,
      ...(index === 0 ? { writtenDuration: 2 } : {}),
    }))
    const song = drumSongFixture({
      percussionTracks: [percussionTrackFixture({ hits })],
    })

    scheduler.setSession(readyDocumentFixture({ song }))
    transport.start()

    expect(player.trigger).toHaveBeenCalledTimes(256)
    expect(scheduler.snapshot()).toMatchObject({
      scheduledOccurrenceCount: 256,
      dedupeLedgerSize: 256,
      overloadOmittedOccurrenceCount: 0,
      deferredOccurrenceCount: 44,
      capacityOmittedOccurrenceCount: 0,
    })

    clock.advance(16)
    expect(player.trigger).toHaveBeenCalledTimes(256)
    expect(scheduler.snapshot()).toMatchObject({
      deferredOccurrenceCount: 0,
      capacityOmittedOccurrenceCount: 44,
    })

    clock.advance(16)
    expect(scheduler.snapshot()).toMatchObject({
      deferredOccurrenceCount: 0,
      capacityOmittedOccurrenceCount: 44,
    })
  })

  it('panics and reschedules against fresh context time after pause/resume', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = playerFixture()
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 100,
      performanceTimestampToContextTime: (timestampMs) =>
        30 + (timestampMs - clock.nowMs()) / 1_000,
    })
    const song = drumSongFixture({
      percussionTracks: [
        percussionTrackFixture({
          hits: [
            {
              id: 'future-hat',
              gmKey: 42,
              startBeat: 0.1,
              velocity: 70,
              writtenDuration: 1,
            },
          ],
        }),
      ],
    })

    scheduler.setSession(readyDocumentFixture({ song }))
    transport.start()
    expect(player.trigger).toHaveBeenCalledTimes(1)
    expect(player.trigger.mock.calls[0]?.[0].atContextTime).toBeCloseTo(30.05)

    transport.pause()
    clock.advance(5_000)
    transport.start()

    expect(player.panic.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(player.trigger).toHaveBeenCalledTimes(2)
    expect(player.trigger.mock.calls[1]?.[0].atContextTime).toBeCloseTo(30.05)
  })

  it('drops a watermark-held action on pause before scheduling a fresh resume occurrence', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = playerFixture('sampled')
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 100,
      performanceTimestampToContextTime: (timestampMs) =>
        10 + timestampMs / 1_000,
      humanize: (hit) => ({
        timeOffsetMs: 0,
        velocity: hit.velocity,
        ornaments: [],
      }),
    })
    scheduler.setSession(
      readyDocumentFixture({
        song: drumSongFixture({
          bpm: 120,
          percussionTracks: [
            percussionTrackFixture({
              hits: [
                {
                  id: 'held-hat',
                  gmKey: 42,
                  startBeat: 0.19,
                  velocity: 70,
                  writtenDuration: 1,
                },
              ],
            }),
          ],
        }),
      }),
    )

    transport.start()
    expect(player.trigger).not.toHaveBeenCalled()
    transport.pause()
    clock.advance(1_000)
    transport.start()
    clock.advance(60)

    expect(player.trigger).toHaveBeenCalledOnce()
    expect(player.trigger).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: 'authored:drums:held-hat',
        atContextTime: 11.095,
      }),
    )
    expect(player.panic.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(scheduler.snapshot().scheduledOccurrenceCount).toBe(1)
  })

  it('reports unsupported and fallback truth without substituting a snare', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = playerFixture('unmapped')
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 100,
      performanceTimestampToContextTime: (timestampMs) =>
        10 + timestampMs / 1_000,
    })
    const song = drumSongFixture({
      percussionTracks: [
        percussionTrackFixture({
          droppedHitCount: 2,
          hits: [
            { id: 'vendor-note', gmKey: 90, startBeat: 0, velocity: 100 },
            {
              id: 'cowbell',
              gmKey: 56,
              startBeat: 0,
              velocity: 90,
              writtenDuration: 1,
            },
          ],
        }),
      ],
    })

    scheduler.setSession(readyDocumentFixture({ song }))
    transport.start()

    expect(player.trigger).toHaveBeenCalledTimes(1)
    expect(player.trigger.mock.calls[0]?.[0].gmKey).toBe(56)
    expect(scheduler.snapshot()).toMatchObject({
      indexedHitCount: 2,
      playableHitCount: 1,
      unsupportedGmHitCount: 1,
      sourceDroppedHitCount: 2,
      triggerCounts: {
        sampled: 0,
        synthesized: 0,
        synthFallback: 0,
        unmapped: 1,
        dropped: 0,
        unreported: 0,
      },
    })
  })

  it('waits truthfully when the route-owned audio clock is unavailable', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = playerFixture()
    let contextReady = false
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      performanceTimestampToContextTime: (timestampMs) =>
        contextReady ? 10 + timestampMs / 1_000 : null,
    })

    scheduler.setSession(readyDocumentFixture())
    transport.start()
    expect(scheduler.snapshot().status).toBe('waiting-for-audio')
    expect(player.trigger).not.toHaveBeenCalled()

    contextReady = true
    expect(scheduler.schedule()).toHaveLength(1)
    expect(scheduler.snapshot().status).toBe('playing')
  })
})

describe('humanize hook', () => {
  function humanizedHarness(
    humanize: Parameters<typeof createDrumSessionScheduler>[0]['humanize'],
  ) {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = playerFixture('sampled')
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 600,
      performanceTimestampToContextTime: (timestampMs) =>
        10 + (timestampMs - clock.nowMs()) / 1_000,
      ...(humanize === undefined ? {} : { humanize }),
    })
    const song = drumSongFixture({
      percussionTracks: [
        percussionTrackFixture({
          hits: [{ id: 'kick', gmKey: 36, startBeat: 0, velocity: 111 }],
        }),
      ],
    })
    scheduler.setSession(readyDocumentFixture({ song }))
    transport.start()
    return { player, scheduler }
  }

  it('shifts timing, replaces velocity, and schedules ornaments', () => {
    const humanize = vi.fn(() => ({
      timeOffsetMs: 12,
      velocity: 99,
      ornaments: [{ leadMs: 25, velocity: 54 }],
    }))
    const { player, scheduler } = humanizedHarness(humanize)

    expect(humanize).toHaveBeenCalledWith({
      gmKey: 36,
      velocity: 111,
      startBeat: 0,
      timelineBeat: 0,
      loopIteration: 0,
    })
    expect(player.trigger).toHaveBeenCalledTimes(2)
    const calls = player.trigger.mock.calls.map(([hit]) => hit)
    const ornament = calls.find((hit) =>
      (hit.sourceId ?? '').endsWith(':ornament'),
    )
    const main = calls.find((hit) => hit.sourceId === 'authored:drums:kick')
    expect(main).toMatchObject({ gmKey: 36, velocity: 99 })
    expect(main?.atContextTime).toBeCloseTo(10.012, 6)
    expect(ornament).toMatchObject({ gmKey: 36, velocity: 54 })
    expect(ornament?.atContextTime).toBeCloseTo(10.012 - 0.025, 6)
    expect(scheduler.snapshot().lastOccurrence).toMatchObject({
      velocity: 99,
    })
    expect(scheduler.snapshot().lastOccurrence?.atContextTime).toBeCloseTo(
      10.012,
      6,
    )
  })

  it('executes reversed open and closed hats in their humanized time order', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = playerFixture('sampled')
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 600,
      performanceTimestampToContextTime: () => 10,
      humanize: (hit) => ({
        timeOffsetMs: hit.gmKey === 46 ? 20 : -20,
        velocity: hit.velocity,
        ornaments: [],
      }),
    })
    scheduler.setSession(
      readyDocumentFixture({
        song: drumSongFixture({
          percussionTracks: [
            percussionTrackFixture({
              hits: [
                { id: 'closed', gmKey: 42, startBeat: 0, velocity: 90 },
                { id: 'open', gmKey: 46, startBeat: 0, velocity: 100 },
              ],
            }),
          ],
        }),
      }),
    )

    transport.start()

    expect(
      player.trigger.mock.calls.map(([hit]) => [
        hit.sourceId,
        hit.atContextTime,
      ]),
    ).toEqual([
      ['authored:drums:closed', 9.98],
      ['authored:drums:open', 10.02],
    ])
  })

  it.each([
    {
      first: { id: 'first-closed', gmKey: 42 },
      horizon: { id: 'horizon-open', gmKey: 46 },
      expected: ['authored:drums:horizon-open', 'authored:drums:first-closed'],
    },
    {
      first: { id: 'first-open', gmKey: 46 },
      horizon: { id: 'horizon-closed', gmKey: 42 },
      expected: ['authored:drums:horizon-closed', 'authored:drums:first-open'],
    },
  ])(
    'holds $first.id until the next horizon reveals earlier $horizon.id',
    ({ first, horizon, expected }) => {
      const clock = new FakeClock()
      const transport = createDrumTransport({ clock, countInBeats: 0 })
      const player = playerFixture('sampled')
      const scheduler = createDrumSessionScheduler({
        transport,
        player,
        lookaheadMs: 100,
        performanceTimestampToContextTime: (timestampMs) =>
          10 + timestampMs / 1_000,
        humanize: (hit) => ({
          timeOffsetMs: hit.startBeat > 0.2 ? -30 : 0,
          velocity: hit.velocity,
          ornaments: [],
        }),
      })
      scheduler.setSession(
        readyDocumentFixture({
          song: drumSongFixture({
            bpm: 120,
            percussionTracks: [
              percussionTrackFixture({
                hits: [
                  { ...first, startBeat: 0.19, velocity: 90 },
                  { ...horizon, startBeat: 0.22, velocity: 100 },
                ],
              }),
            ],
          }),
        }),
      )

      transport.start()
      expect(player.trigger).not.toHaveBeenCalled()

      clock.advance(60)

      const calls = player.trigger.mock.calls.map(([hit]) => hit)
      expect(calls.map((hit) => hit.sourceId)).toEqual(expected)
      expect(calls[0]?.atContextTime).toBeCloseTo(10.08, 6)
      expect(calls[1]?.atContextTime).toBeCloseTo(10.095, 6)
    },
  )

  it('holds an action exactly on the finite watermark for a tied next-horizon closer', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = playerFixture('sampled')
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 100,
      performanceTimestampToContextTime: (timestampMs) =>
        10 + timestampMs / 1_000,
      humanize: (hit) => ({
        timeOffsetMs: hit.gmKey === 46 ? -MAX_DRUM_SESSION_ACTION_EARLY_MS : 0,
        velocity: hit.velocity,
        ornaments: [],
      }),
    })
    scheduler.setSession(
      readyDocumentFixture({
        song: drumSongFixture({
          bpm: 120,
          percussionTracks: [
            percussionTrackFixture({
              hits: [
                {
                  id: 'watermark-closed',
                  gmKey: 42,
                  startBeat: 0.102,
                  velocity: 90,
                },
                {
                  id: 'next-horizon-open',
                  gmKey: 46,
                  startBeat: 0.2,
                  velocity: 100,
                },
                {
                  id: 'duration-anchor',
                  gmKey: 36,
                  startBeat: 1,
                  velocity: 80,
                },
              ],
            }),
          ],
        }),
      }),
    )

    transport.start()
    expect(player.trigger).not.toHaveBeenCalled()

    clock.advance(16)

    const calls = player.trigger.mock.calls.map(([hit]) => hit)
    expect(calls.map((hit) => hit.sourceId)).toEqual([
      'authored:drums:next-horizon-open',
      'authored:drums:watermark-closed',
    ])
    expect(calls[0]?.atContextTime).toBeCloseTo(10.051, 6)
    expect(calls[1]?.atContextTime).toBeCloseTo(10.051, 6)
  })

  it('executes a later source ornament before an earlier source main hit', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = playerFixture('sampled')
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 600,
      performanceTimestampToContextTime: () => 10,
      humanize: (hit) =>
        hit.gmKey === 38
          ? {
              timeOffsetMs: 30,
              velocity: hit.velocity,
              ornaments: [{ leadMs: 50, velocity: 54 }],
            }
          : {
              timeOffsetMs: 20,
              velocity: hit.velocity,
              ornaments: [],
            },
    })
    scheduler.setSession(
      readyDocumentFixture({
        song: drumSongFixture({
          percussionTracks: [
            percussionTrackFixture({
              hits: [
                { id: 'kick', gmKey: 36, startBeat: 0, velocity: 100 },
                { id: 'snare', gmKey: 38, startBeat: 0, velocity: 110 },
              ],
            }),
          ],
        }),
      }),
    )

    transport.start()

    const calls = player.trigger.mock.calls.map(([hit]) => hit)
    expect(calls.map((hit) => hit.sourceId)).toEqual([
      'authored:drums:snare:ornament',
      'authored:drums:kick',
      'authored:drums:snare',
    ])
    expect(calls[0]?.atContextTime).toBeCloseTo(9.98, 6)
    expect(calls[1]?.atContextTime).toBeCloseTo(10.02, 6)
    expect(calls[2]?.atContextTime).toBeCloseTo(10.03, 6)
  })

  it('clamps an injected hook to the action-queue early watermark contract', () => {
    const clock = new FakeClock()
    const transport = createDrumTransport({ clock, countInBeats: 0 })
    const player = playerFixture('sampled')
    const scheduler = createDrumSessionScheduler({
      transport,
      player,
      lookaheadMs: 600,
      performanceTimestampToContextTime: () => 10,
      humanize: (hit) => ({
        timeOffsetMs: -1_000,
        velocity: hit.velocity,
        ornaments: [{ leadMs: 1_000, velocity: 54 }],
      }),
    })
    scheduler.setSession(
      readyDocumentFixture({
        song: drumSongFixture({
          percussionTracks: [
            percussionTrackFixture({
              hits: [{ id: 'kick', gmKey: 36, startBeat: 0, velocity: 100 }],
            }),
          ],
        }),
      }),
    )

    transport.start()

    const earliest = 10 - MAX_DRUM_SESSION_ACTION_EARLY_MS / 1_000
    expect(player.trigger).toHaveBeenCalledTimes(2)
    for (const [hit] of player.trigger.mock.calls) {
      expect(hit.atContextTime).toBeCloseTo(earliest, 6)
    }
  })

  it('keeps authored values when the hook throws or returns null', () => {
    for (const humanize of [
      vi.fn(() => {
        throw new Error('bad hook')
      }),
      vi.fn(() => null),
    ]) {
      const { player } = humanizedHarness(humanize)
      expect(player.trigger).toHaveBeenCalledTimes(1)
      expect(player.trigger).toHaveBeenCalledWith({
        gmKey: 36,
        velocity: 111,
        atContextTime: 10,
        sourceId: 'authored:drums:kick',
        lane: 'authored',
      })
    }
  })
})
