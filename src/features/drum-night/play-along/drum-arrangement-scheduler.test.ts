// Drum arrangement scheduler tests — one transport, tempo, loops, and bounds.
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { MidiSong, MidiSongPitchedTrack } from '@/lib/midi-song'
import type { DrumRuntimeClock } from '../runtime/drum-transport'
import { createDrumTransport } from '../runtime/drum-transport'
import { percussionTrackFixture, readyDocumentFixture, } from '../session/drum-session.test-fixtures'
import { createDrumArrangement } from './drum-arrangement'
import type { DrumArrangementBackingPlayerPort, DrumArrangementBackingTriggerOutcome, } from './drum-arrangement-player'
import { createDrumArrangementScheduler } from './drum-arrangement-scheduler'

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
  outcome: DrumArrangementBackingTriggerOutcome = 'synthesized',
) {
  return {
    activate: vi.fn<DrumArrangementBackingPlayerPort['activate']>(() => true),
    trigger: vi.fn<DrumArrangementBackingPlayerPort['trigger']>(() => outcome),
    setTrackLevel: vi.fn<DrumArrangementBackingPlayerPort['setTrackLevel']>(),
    panic: vi.fn<DrumArrangementBackingPlayerPort['panic']>(),
    dispose: vi.fn<DrumArrangementBackingPlayerPort['dispose']>(),
  } satisfies DrumArrangementBackingPlayerPort
}

function pitchedTrack(
  notes: MidiSongPitchedTrack['notes'],
  options: { id?: string; name?: string; instrumentName?: string } = {},
): MidiSongPitchedTrack {
  return {
    id: options.id ?? 'bass',
    kind: 'pitched',
    name: options.name ?? 'Bass',
    instrumentName: options.instrumentName ?? 'Fingered Bass',
    noteCount: notes.length,
    notes,
  }
}

function mixedSong(
  tracks: readonly MidiSongPitchedTrack[],
  durationBeats = 8,
): MidiSong {
  return {
    bpm: 120,
    tempoChanges: [
      { beat: 0, usPerBeat: 500_000 },
      { beat: 1, usPerBeat: 1_000_000 },
    ],
    timeSignatures: [{ beat: 0, numerator: 4, denominator: 4 }],
    tracks: [
      percussionTrackFixture({
        hits: [
          {
            gmKey: 36,
            startBeat: 0,
            velocity: 100,
            writtenDuration: durationBeats,
          },
        ],
      }),
      ...tracks,
    ],
  }
}

function prepareTransport(
  clock: FakeClock,
  song: MidiSong,
  durationBeats: number,
) {
  const transport = createDrumTransport({ clock, countInBeats: 0 })
  transport.setAuthoredTiming({
    tempoBpm: song.bpm,
    tempoChanges: song.tempoChanges,
    durationBeats,
  })
  return transport
}

describe('Drum arrangement scheduler', () => {
  it('constructs inertly and schedules only pitched backing on the route clock', () => {
    const clock = new FakeClock()
    const song = mixedSong([
      pitchedTrack([
        { id: 'authored-bass-opening', midi: 40, startBeat: 0, duration: 0.5 },
        { midi: 43, startBeat: 1, duration: 0.5 },
        { midi: 47, startBeat: 1.5, duration: 0.25 },
      ]),
    ])
    const arrangement = createDrumArrangement(readyDocumentFixture({ song }))
    const transport = prepareTransport(clock, song, arrangement.durationBeats)
    const player = playerFixture()
    const mapper = vi.fn(
      (timestampMs: number) => 10 + (timestampMs - clock.nowMs()) / 1_000,
    )
    const scheduler = createDrumArrangementScheduler({
      transport,
      player,
      lookaheadMs: 1_200,
      performanceTimestampToContextTime: mapper,
    })

    scheduler.setArrangement(arrangement)
    expect(scheduler.snapshot()).toMatchObject({
      status: 'ready',
      indexedNoteCount: 3,
      playableNoteCount: 3,
      invalidNoteCount: 0,
    })
    expect(player.activate).not.toHaveBeenCalled()
    expect(player.trigger).not.toHaveBeenCalled()
    expect(mapper).not.toHaveBeenCalled()

    transport.start()

    expect(player.trigger).toHaveBeenCalledTimes(3)
    expect(player.trigger.mock.calls[0]?.[0].sourceId).toBe(
      'authored-bass-opening',
    )
    expect(
      player.trigger.mock.calls.map(([note]) => [
        note.trackId,
        note.midi,
        note.atContextTime,
        note.voice,
      ]),
    ).toEqual([
      ['bass', 40, 10, 'bass'],
      ['bass', 43, 10.5, 'bass'],
      ['bass', 47, 11, 'bass'],
    ])
    expect(player.trigger.mock.calls[1]?.[0].durationSeconds).toBeCloseTo(0.5)
    expect(scheduler.schedule(1_200)).toEqual([])
  })

  it('preserves loop occurrence identity and invalidates on seek/revision', () => {
    const clock = new FakeClock()
    const song = mixedSong(
      [pitchedTrack([{ midi: 52, startBeat: 0, duration: 0.5 }])],
      2,
    )
    song.tempoChanges = [{ beat: 0, usPerBeat: 500_000 }]
    const arrangement = createDrumArrangement(readyDocumentFixture({ song }))
    const transport = prepareTransport(clock, song, arrangement.durationBeats)
    const player = playerFixture()
    const scheduler = createDrumArrangementScheduler({
      transport,
      player,
      lookaheadMs: 600,
      performanceTimestampToContextTime: (timestampMs) =>
        20 + (timestampMs - clock.nowMs()) / 1_000,
    })

    scheduler.setArrangement(arrangement)
    expect(transport.setLoop({ startBeat: 0, endBeat: 1 })).toBe(true)
    transport.start()

    expect(player.trigger).toHaveBeenCalledTimes(2)
    expect(scheduler.snapshot().lastOccurrence).toMatchObject({
      authoredBeat: 0,
      timelineBeat: 1,
      loopIteration: 1,
    })

    const panicsBeforeSeek = player.panic.mock.calls.length
    transport.seek(0)
    expect(player.panic.mock.calls.length).toBeGreaterThan(panicsBeforeSeek)
    expect(player.trigger).toHaveBeenCalledTimes(4)
    expect(scheduler.snapshot().transportRevision).toBe(
      transport.scheduleRevision(),
    )
  })

  it('bounds simultaneous overload without scanning it into voices', () => {
    const clock = new FakeClock()
    const notes = Array.from({ length: 500 }, (_, index) => ({
      midi: 36 + (index % 48),
      startBeat: 0,
      duration: 1,
    }))
    const song = mixedSong([pitchedTrack(notes)], 2)
    song.tempoChanges = [{ beat: 0, usPerBeat: 500_000 }]
    const arrangement = createDrumArrangement(readyDocumentFixture({ song }))
    const transport = prepareTransport(clock, song, arrangement.durationBeats)
    const player = playerFixture('synthesized-with-steal')
    const mapper = vi.fn(() => 10)
    const scheduler = createDrumArrangementScheduler({
      transport,
      player,
      performanceTimestampToContextTime: mapper,
    })

    scheduler.setArrangement(arrangement)
    transport.start()

    expect(player.trigger).toHaveBeenCalledTimes(48)
    expect(mapper).toHaveBeenCalledTimes(48)
    expect(scheduler.snapshot()).toMatchObject({
      indexedNoteCount: 500,
      scheduledOccurrenceCount: 48,
      dedupeLedgerSize: 49,
      overloadOmittedOccurrenceCount: 452,
      deferredOccurrenceCount: 0,
      triggerCounts: { synthesizedWithSteal: 48 },
    })
  })

  it('waits for an existing audio mapping and panics on teardown', () => {
    const clock = new FakeClock()
    const song = mixedSong([
      pitchedTrack([{ midi: 60, startBeat: 0, duration: 1 }]),
    ])
    const arrangement = createDrumArrangement(readyDocumentFixture({ song }))
    const transport = prepareTransport(clock, song, arrangement.durationBeats)
    const player = playerFixture()
    let audioReady = false
    const scheduler = createDrumArrangementScheduler({
      transport,
      player,
      performanceTimestampToContextTime: () => (audioReady ? 10 : null),
    })

    scheduler.setArrangement(arrangement)
    transport.start()
    expect(scheduler.snapshot().status).toBe('waiting-for-audio')
    expect(player.trigger).not.toHaveBeenCalled()

    audioReady = true
    expect(scheduler.schedule()).toHaveLength(1)
    scheduler.dispose()
    expect(player.panic).toHaveBeenCalled()
    expect(scheduler.snapshot().status).toBe('disposed')
  })
})
