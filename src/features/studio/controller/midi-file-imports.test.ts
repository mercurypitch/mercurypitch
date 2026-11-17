// Studio MIDI file import tests — a file's lanes go in through one call that commits them as one undo step, a song with no clips taking the file's tempo in that step; a refused file is said with its reason and adds nothing; a file of no notes is refused; lanes left out, and a file cut at five minutes, are said on the lanes; and nothing happens while the song cannot be edited.
import { describe, expect, it, vi } from 'vitest'
import type { StudioMidiFileTrack } from '@/lib/studio/midi/midi-file'
import { writeStudioMidiFile } from '@/lib/studio/midi/midi-file'
import { createStudioProject } from '@/lib/studio/model/defaults'
import { studioMidiFixture, TEST_NOW, } from '@/lib/studio/model/model.test-fixtures'
import type { StudioProject } from '@/lib/studio/model/types'
import type { StudioMidiFileImportOptions } from './midi-file-imports'
import { createStudioMidiFileImports, studioMidiImportNotice, } from './midi-file-imports'

/** A picked file of `bytes`: jsdom's Blob reads none, so this one stands in. */
function picked(bytes: Uint8Array): Blob {
  return {
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.slice().buffer,
  } as unknown as Blob
}

const keys = (notes: number, name = 'Keys'): StudioMidiFileTrack => ({
  name,
  channel: 0,
  program: 0,
  endTick: notes * 20,
  notes: Array.from({ length: notes }, (_, index) => ({
    pitch: 60 + (index % 12),
    startTick: index * 20,
    endTick: index * 20 + 10,
    velocity: 100,
    releaseVelocity: 64,
  })),
})

/** A file at `tempoBpm` of the given tracks, as the Studio writes one. */
const midiFile = (tracks: StudioMidiFileTrack[], tempoBpm = 96) =>
  picked(writeStudioMidiFile({ name: 'Song', tempoBpm, tracks }))

function mount(
  song: StudioProject | null,
  over: Partial<StudioMidiFileImportOptions> = {},
) {
  const calls = {
    addMidiClips: vi.fn<StudioMidiFileImportOptions['addMidiClips']>(
      async (clips) => clips.map((_, index) => `clip-${index}`),
    ),
    clearRefusal: vi.fn(),
    refuse: vi.fn(),
    notice: vi.fn(),
  }
  const imports = createStudioMidiFileImports({
    project: () => song,
    canEdit: () => true,
    ...calls,
    ...over,
  })
  return { ...calls, addMidiFile: imports.addMidiFile }
}

const EMPTY = createStudioProject({ id: 'song', now: TEST_NOW })
const BUSY = studioMidiFixture().project

describe('a MIDI file added to a song', () => {
  it('goes in through one call, with the tempo a song with no clips takes from the file in its undo step', async () => {
    // Arrange
    const ui = mount(EMPTY)

    // Act
    const added = await ui.addMidiFile(midiFile([keys(4)]))

    // Assert
    expect(added).toBe(true)
    expect(ui.clearRefusal).toHaveBeenCalledOnce()
    expect(ui.addMidiClips).toHaveBeenCalledOnce()
    const [clips, before] = ui.addMidiClips.mock.calls[0]
    expect(clips.map((clip) => clip.lane)).toEqual([
      { name: 'Keys', role: 'keys' },
    ])
    expect(clips[0].notes).toHaveLength(4)
    expect(before).toEqual([
      { type: 'set-project-settings', changes: { tempoBpm: 96 } },
    ])
    expect(ui.refuse).not.toHaveBeenCalled()
    expect(ui.notice).not.toHaveBeenCalled()
  })

  it('keeps the tempo of a song with clips: nothing joins the clips', async () => {
    // Arrange
    const ui = mount(BUSY)

    // Act
    await ui.addMidiFile(midiFile([keys(4)]))

    // Assert
    const [clips, before] = ui.addMidiClips.mock.calls[0]
    expect(before).toEqual([])
    expect(clips[0].tempoBpm).toBe(120)
  })

  it('is refused with the parser’s reason, as an unreadable audio file is, and adds nothing', async () => {
    // Arrange
    const ui = mount(EMPTY)

    // Act
    const added = await ui.addMidiFile(
      picked(new TextEncoder().encode('RIFF....WAVEfmt ')),
    )

    // Assert
    expect(added).toBe(false)
    expect(ui.refuse).toHaveBeenCalledExactlyOnceWith(
      'This MIDI file could not be read: MIDI file must begin with an MThd header.',
    )
    expect(ui.addMidiClips).not.toHaveBeenCalled()
  })

  it('is refused when it is empty or holds no notes', async () => {
    // Arrange
    const ui = mount(EMPTY)

    // Act
    const empty = await ui.addMidiFile(picked(new Uint8Array(0)))
    const silent = await ui.addMidiFile(midiFile([keys(0)]))

    // Assert
    expect([empty, silent]).toEqual([false, false])
    expect(ui.refuse.mock.calls).toEqual([
      ['This MIDI file is empty.'],
      ['This MIDI file has no notes to add.'],
    ])
    expect(ui.addMidiClips).not.toHaveBeenCalled()
  })

  it('says on the lanes which lanes it left out, once the rest are in', async () => {
    // Arrange
    const ui = mount(BUSY)

    // Act
    await ui.addMidiFile(midiFile([keys(10_001, 'Busy'), keys(3, 'Calm')]))

    // Assert
    expect(ui.addMidiClips.mock.calls[0][0].map((clip) => clip.lane)).toEqual([
      { name: 'Calm', role: 'keys' },
    ])
    expect(ui.notice).toHaveBeenCalledExactlyOnceWith(
      'Busy was left out: a MIDI clip holds 10,000 notes at most.',
    )
  })

  it('is refused, naming them, when every lane is left out', async () => {
    // Arrange
    const ui = mount(BUSY)

    // Act
    const added = await ui.addMidiFile(
      midiFile([keys(10_001, 'Busy'), keys(10_001, 'Busier')]),
    )

    // Assert
    expect(added).toBe(false)
    expect(ui.refuse).toHaveBeenCalledExactlyOnceWith(
      'Nothing was added. Busy and Busier were left out: a MIDI clip holds 10,000 notes at most.',
    )
  })

  it('adds nothing, and reads nothing, while the song cannot be edited', async () => {
    // Arrange
    const load = vi.fn()
    const ui = mount(EMPTY, { canEdit: () => false, load })

    // Act
    const added = await ui.addMidiFile(midiFile([keys(4)]))

    // Assert
    expect(added).toBe(false)
    expect(load).not.toHaveBeenCalled()
    expect(ui.addMidiClips).not.toHaveBeenCalled()
  })

  it('reports nothing more when the commit adds nothing: the importer has said why', async () => {
    // Arrange
    const ui = mount(EMPTY, { addMidiClips: vi.fn(async () => null) })

    // Act
    const added = await ui.addMidiFile(
      midiFile([keys(10_001, 'Busy'), keys(4)]),
    )

    // Assert
    expect(added).toBe(false)
    expect(ui.notice).not.toHaveBeenCalled()
  })
})

describe('what a MIDI file left out, in words', () => {
  it('names the lanes left out, and how long a file ran that was cut at five minutes', () => {
    expect(
      studioMidiImportNotice({ clips: [], leftOut: ['A', 'B', 'C'] }),
    ).toBe('A, B and C were left out: a MIDI clip holds 10,000 notes at most.')
    expect(
      studioMidiImportNotice({ clips: [], leftOut: [], cutFrom: 361.5 }),
    ).toBe(
      'The file runs 6:01: its clips hold its first five minutes, the most a MIDI clip runs.',
    )
    expect(studioMidiImportNotice({ clips: [], leftOut: [] })).toBeNull()
  })
})
