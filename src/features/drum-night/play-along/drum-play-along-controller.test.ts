// Drum play-along controller tests — aggregate and per-track live mix truth.
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { MidiSong, MidiSongPitchedTrack } from '@/lib/midi-song'
import type { DrumRuntimeClock } from '../runtime/drum-transport'
import { createDrumTransport } from '../runtime/drum-transport'
import { percussionTrackFixture, readyDocumentFixture, } from '../session/drum-session.test-fixtures'
import type { DrumArrangementBackingPlayerPort } from './drum-arrangement-player'
import { createDrumPlayAlongController } from './drum-play-along-controller'

class IdleClock implements DrumRuntimeClock {
  nowMs = (): number => 0
  requestFrame = (): number => 1
  cancelFrame = (): void => undefined
}

function track(
  id: string,
  name: string,
  instrumentName: string,
): MidiSongPitchedTrack {
  return {
    id,
    kind: 'pitched',
    name,
    instrumentName,
    noteCount: 1,
    notes: [{ midi: id === 'bass' ? 40 : 64, startBeat: 0, duration: 2 }],
  }
}

function mixedSong(): MidiSong {
  return {
    bpm: 120,
    tempoChanges: [{ beat: 0, usPerBeat: 500_000 }],
    timeSignatures: [{ beat: 0, numerator: 4, denominator: 4 }],
    tracks: [
      percussionTrackFixture({
        hits: [
          {
            gmKey: 36,
            startBeat: 0,
            velocity: 100,
            writtenDuration: 2,
          },
        ],
      }),
      track('bass', 'Bass', 'Fingered Bass'),
      track('keys', 'Keys', 'Electric Piano'),
    ],
  }
}

function playerFixture() {
  return {
    activate: vi.fn<DrumArrangementBackingPlayerPort['activate']>(() => true),
    trigger: vi.fn<DrumArrangementBackingPlayerPort['trigger']>(
      () => 'synthesized' as const,
    ),
    setTrackLevel: vi.fn<DrumArrangementBackingPlayerPort['setTrackLevel']>(),
    panic: vi.fn<DrumArrangementBackingPlayerPort['panic']>(),
    dispose: vi.fn<DrumArrangementBackingPlayerPort['dispose']>(),
  } satisfies DrumArrangementBackingPlayerPort
}

describe('Drum play-along controller', () => {
  it('keeps setup inert, then applies pop-free player levels after activation', async () => {
    const transport = createDrumTransport({
      clock: new IdleClock(),
      countInBeats: 0,
    })
    const player = playerFixture()
    const onDrumsLevelChange = vi.fn()
    const controller = createDrumPlayAlongController({
      transport,
      player,
      performanceTimestampToContextTime: () => null,
      onDrumsLevelChange,
    })

    controller.setSession(readyDocumentFixture({ song: mixedSong() }))
    expect(player.activate).not.toHaveBeenCalled()
    expect(onDrumsLevelChange).not.toHaveBeenCalled()
    expect(controller.snapshot()).toMatchObject({
      drums: {
        available: true,
        trackCount: 1,
        eventCount: 1,
        effectiveLevel: 1,
      },
      backing: {
        available: true,
        trackCount: 2,
        eventCount: 2,
        effectiveLevel: 0.78,
      },
    })

    expect(await controller.activate()).toBe(true)
    expect(onDrumsLevelChange).toHaveBeenLastCalledWith(1)
    expect(player.setTrackLevel).toHaveBeenLastCalledWith('keys', 0.78)
  })

  it('applies bus mute, track solo, and live levels without restarting time', async () => {
    const transport = createDrumTransport({
      clock: new IdleClock(),
      countInBeats: 0,
    })
    const player = playerFixture()
    const onDrumsLevelChange = vi.fn()
    const controller = createDrumPlayAlongController({
      transport,
      player,
      performanceTimestampToContextTime: () => null,
      onDrumsLevelChange,
    })
    controller.setSession(readyDocumentFixture({ song: mixedSong() }))
    await controller.activate()
    player.panic.mockClear()
    const revision = transport.scheduleRevision()

    controller.setBusMuted('backing', true)
    expect(controller.snapshot().backing.effectiveLevel).toBe(0)
    expect(
      controller.snapshot().backingTracks.map((part) => part.effectiveLevel),
    ).toEqual([0, 0])
    expect(player.setTrackLevel).toHaveBeenLastCalledWith('keys', 0)

    controller.setBusMuted('backing', false)
    controller.setTrackSolo('bass', true)
    expect(controller.snapshot().drums.effectiveLevel).toBe(0)
    expect(onDrumsLevelChange).toHaveBeenLastCalledWith(0)
    expect(
      controller
        .snapshot()
        .backingTracks.map((part) => [part.id, part.effectiveLevel]),
    ).toEqual([
      ['bass', 0.78],
      ['keys', 0],
    ])

    controller.setTrackLevel('bass', 0.5)
    expect(controller.snapshot().backingTracks[0]?.effectiveLevel).toBe(0.39)
    expect(player.setTrackLevel).toHaveBeenCalledWith('bass', 0.39)

    controller.setBusSolo('drums', true)
    expect(controller.snapshot().drums.effectiveLevel).toBe(1)
    expect(controller.snapshot().backingTracks[0]?.effectiveLevel).toBe(0.39)
    expect(transport.scheduleRevision()).toBe(revision)
    expect(player.panic).not.toHaveBeenCalled()
  })

  it('reports percussion-only availability and owns cleanup', async () => {
    const transport = createDrumTransport({
      clock: new IdleClock(),
      countInBeats: 0,
    })
    const player = playerFixture()
    const controller = createDrumPlayAlongController({
      transport,
      player,
      performanceTimestampToContextTime: () => null,
    })
    controller.setSession(readyDocumentFixture())

    expect(controller.snapshot()).toMatchObject({
      backing: { available: false, trackCount: 0, effectiveLevel: 0 },
      backingTracks: [],
      scheduler: { status: 'empty', indexedNoteCount: 0 },
    })
    expect(await controller.activate()).toBe(true)
    expect(player.activate).not.toHaveBeenCalled()

    await controller.dispose()
    expect(player.panic).toHaveBeenCalled()
    expect(player.dispose).toHaveBeenCalledOnce()
  })
})
