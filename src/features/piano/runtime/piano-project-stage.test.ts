// ============================================================
// Piano project stage tests — exact canonical ticks at the runtime boundary
// ============================================================

import { describe, expect, it } from 'vitest'
import type { PianoProject, PianoProjectChannelEvent, PianoProjectTrack, } from '@/features/piano-project/piano-project'
import { pianoProjectToStage } from './piano-project-stage'

function noteTrack(
  id: string,
  channel: number,
  events: PianoProjectChannelEvent[],
): PianoProjectTrack {
  return {
    id,
    sourceTrackIndex: 0,
    channel,
    isPercussion: false,
    name: 'Piano',
    instrumentName: 'Acoustic Grand Piano',
    events,
  }
}

function projectFixture(): PianoProject {
  const createdAt = '2026-08-10T12:00:00.000Z'
  const scoreTrack = noteTrack('score', 2, [
    {
      type: 'note-off',
      sourceTrackIndex: 0,
      order: 2,
      tick: 720,
      channel: 2,
      note: 69,
      velocity: 32,
    },
    {
      type: 'note-on',
      sourceTrackIndex: 0,
      order: 1,
      tick: 240,
      channel: 2,
      note: 69,
      velocity: 96,
    },
  ])
  const backingTrack = noteTrack('backing', 3, [
    {
      type: 'note-on',
      sourceTrackIndex: 1,
      order: 0,
      tick: 0,
      channel: 3,
      note: 48,
      velocity: 100,
    },
    {
      type: 'note-off',
      sourceTrackIndex: 1,
      order: 1,
      tick: 1920,
      channel: 3,
      note: 48,
      velocity: 20,
    },
  ])

  return {
    schemaVersion: 1,
    id: 'piano-project-stage-fixture',
    name: 'Nocturne Study',
    createdAt,
    updatedAt: createdAt,
    source: {
      kind: 'midi',
      fileName: 'nocturne.mid',
      byteLength: 128,
      sha256: 'a'.repeat(64),
      format: 1,
      ticksPerQuarter: 480,
    },
    durationTicks: 1920,
    tempoMap: [
      {
        sourceTrackIndex: 0,
        order: 0,
        tick: 0,
        microsecondsPerQuarter: 600_000,
      },
    ],
    timeSignatures: [],
    keySignatures: [],
    tracks: [scoreTrack, backingTrack],
    scoreTrackId: scoreTrack.id,
    backingTrackIds: [backingTrack.id],
    metaEvents: [],
    systemEvents: [],
  }
}

describe('pianoProjectToStage', () => {
  it('projects only the score track into exact beat-native performance notes', () => {
    const project = projectFixture()
    const originalEvents = [...project.tracks[0].events]

    const stage = pianoProjectToStage(project)

    expect(stage).toMatchObject({
      title: 'Nocturne Study',
      totalBeats: 4,
      initialTempoBpm: 100,
    })
    expect(stage.notes).toEqual([
      {
        id: 'score:1',
        midi: 69,
        name: 'A',
        startBeat: 0.5,
        duration: 1,
        targetFreq: 440,
        isBacking: false,
        trackId: 'score',
        velocity: 96 / 127,
        releaseVelocity: 32 / 127,
        channel: 2,
      },
    ])
    expect(project.tracks[0].events).toEqual(originalEvents)
    expect(Object.isFrozen(stage)).toBe(true)
    expect(Object.isFrozen(stage.notes)).toBe(true)
    expect(Object.isFrozen(stage.notes[0])).toBe(true)
  })

  it('pairs equal-pitch overlaps FIFO after ordering a copied event list', () => {
    const project = projectFixture()
    project.tracks = [
      noteTrack('score', 0, [
        {
          type: 'note-off',
          sourceTrackIndex: 0,
          order: 3,
          tick: 480,
          channel: 0,
          note: 60,
          velocity: 16,
        },
        {
          type: 'note-on',
          sourceTrackIndex: 0,
          order: 1,
          tick: 120,
          channel: 0,
          note: 60,
          velocity: 64,
        },
        {
          type: 'note-off',
          sourceTrackIndex: 0,
          order: 2,
          tick: 240,
          channel: 0,
          note: 60,
          velocity: 32,
        },
        {
          type: 'note-on',
          sourceTrackIndex: 0,
          order: 0,
          tick: 0,
          channel: 0,
          note: 60,
          velocity: 127,
        },
      ]),
    ]
    project.backingTrackIds = []

    const stage = pianoProjectToStage(project)

    expect(stage.notes).toEqual([
      expect.objectContaining({
        id: 'score:0',
        startBeat: 0,
        duration: 0.5,
        velocity: 1,
        releaseVelocity: 32 / 127,
      }),
      expect.objectContaining({
        id: 'score:1',
        startBeat: 0.25,
        duration: 0.75,
        velocity: 64 / 127,
        releaseVelocity: 16 / 127,
      }),
    ])
  })

  it('treats note-on velocity zero as release and ignores unmatched events', () => {
    const project = projectFixture()
    project.tracks = [
      noteTrack('score', 0, [
        {
          type: 'note-off',
          sourceTrackIndex: 0,
          order: 0,
          tick: 0,
          channel: 0,
          note: 72,
          velocity: 12,
        },
        {
          type: 'note-on',
          sourceTrackIndex: 0,
          order: 1,
          tick: 120,
          channel: 0,
          note: 72,
          velocity: 80,
        },
        {
          type: 'note-on',
          sourceTrackIndex: 0,
          order: 2,
          tick: 600,
          channel: 0,
          note: 72,
          velocity: 0,
          encodedAsNoteOn: true,
        },
        {
          type: 'note-on',
          sourceTrackIndex: 0,
          order: 3,
          tick: 720,
          channel: 0,
          note: 76,
          velocity: 90,
        },
      ]),
    ]
    project.backingTrackIds = []

    expect(pianoProjectToStage(project).notes).toEqual([
      expect.objectContaining({
        id: 'score:1',
        midi: 72,
        startBeat: 0.25,
        duration: 1,
        releaseVelocity: 0,
      }),
    ])
  })

  it('returns an empty 120 BPM stage when no canonical score is selected', () => {
    const project = projectFixture()
    project.scoreTrackId = null
    project.tempoMap = []

    expect(pianoProjectToStage(project)).toEqual({
      title: 'Nocturne Study',
      notes: [],
      totalBeats: 4,
      initialTempoBpm: 120,
    })
  })
})
