// Studio controller MIDI files — a MIDI file comes into the song as new lanes, each with a stale clip on one quarter second of silence, and the tempo a song with no clips takes from the file, all in one undo step that one undo takes away; a refused file is said as an import's refusal; and a lane left out is said on the lanes.
import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { createStudioMidiKeys } from '@/lib/studio/midi/clip-keys'
import type { StudioMidiFileTrack } from '@/lib/studio/midi/midi-file'
import { writeStudioMidiFile } from '@/lib/studio/midi/midi-file'
import { controllerServiceFixture, preparedFixture, } from './controller/controller.fixture'
import type { StudioController } from './useStudioController'
import { useStudioController } from './useStudioController'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

function mount(): StudioController {
  let serial = 0
  let controller!: StudioController
  createRoot((dispose) => {
    cleanups.push(dispose)
    controller = useStudioController({
      service: controllerServiceFixture(),
      createId: () => `id-${++serial}`,
      prepareFile: async (_blob, info) => preparedFixture(info),
    })
  })
  return controller
}

/** A picked file of `bytes`: jsdom's Blob reads none, so this one stands in. */
function picked(bytes: Uint8Array): Blob {
  return {
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.slice().buffer,
  } as unknown as Blob
}

/** A track of `notes` notes, `step` ticks apart, each half a step long. */
const track = (
  name: string,
  channel: number,
  notes: number,
  step = 960,
): StudioMidiFileTrack => ({
  name,
  channel,
  endTick: notes * step,
  notes: Array.from({ length: notes }, (_, index) => ({
    pitch: 36 + (index % 48),
    startTick: index * step,
    endTick: index * step + step / 2,
    velocity: 100,
    releaseVelocity: 64,
  })),
})

/** A file at 96 bpm of a piano and a drum track. */
const BAND = picked(
  writeStudioMidiFile({
    name: 'Band',
    tempoBpm: 96,
    tracks: [track('Piano', 0, 4), track('Kit', 9, 8)],
  }),
)

describe('a MIDI file added in the Studio', () => {
  it('comes in as new lanes, their stale clips and sequences and the file’s tempo, in one undo step one undo takes away', async () => {
    // Arrange
    const controller = mount()
    await controller.open('one')

    // Act
    const added = await controller.addMidiFile(BAND)
    const song = controller.project()!
    const label = controller.undoLabel()
    controller.undo()

    // Assert
    expect(added).toBe(true)
    expect(song.tempoBpm).toBe(96)
    expect(song.tracks.map((lane) => [lane.name, lane.role])).toEqual([
      ['Piano', 'keys'],
      ['Kit', 'drums'],
    ])
    expect(song.clips.map((clip) => clip.startFrame)).toEqual([0, 0])
    expect(new Set(song.clips.map((clip) => clip.assetId)).size).toBe(1)
    expect(song.sequences!.map((sequence) => sequence.notes.length)).toEqual([
      4, 8,
    ])
    expect(
      createStudioMidiKeys()
        .staleClips(song)
        .map((stale) => stale.clip.id),
    ).toEqual(song.clips.map((clip) => clip.id))
    expect(label).toBe('Undo add lanes')
    expect(controller.project()!.tracks).toEqual([])
    expect(controller.project()!.clips).toEqual([])
    expect(controller.project()).not.toHaveProperty('sequences')
    expect(controller.project()!.tempoBpm).toBe(120)
  })

  it('is refused with the parser’s reason where an import’s refusal is said, and changes nothing', async () => {
    // Arrange
    const controller = mount()
    await controller.open('one')
    const before = controller.project()

    // Act
    const added = await controller.addMidiFile(
      picked(new TextEncoder().encode('not a MIDI file')),
    )

    // Assert
    expect(added).toBe(false)
    expect(controller.importRefusal()).toBe(
      'This MIDI file could not be read: MIDI file must begin with an MThd header.',
    )
    expect(controller.project()).toBe(before)
  })

  it('says on the lanes which lane it left out for holding too many notes', async () => {
    // Arrange
    const controller = mount()
    await controller.open('one')

    // Act
    await controller.addMidiFile(
      picked(
        writeStudioMidiFile({
          name: 'Band',
          tempoBpm: 120,
          tracks: [track('Piano', 0, 4), track('Flood', 1, 10_001, 20)],
        }),
      ),
    )

    // Assert
    expect(controller.project()!.tracks.map((lane) => lane.name)).toEqual([
      'Piano',
    ])
    expect(controller.laneNotice()).toEqual({
      text: 'Flood was left out: a MIDI clip holds 10,000 notes at most.',
    })
  })
})
