// Studio MIDI download tests — the song saves as "<title>.mid" holding every MIDI lane, a clip alone as "<title> - <take>.mid" holding that clip, each read back from the bytes handed to the browser; a file's name keeps only safe characters; an audio clip saves nothing; and the object URL goes after ten seconds.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyStudioCommand } from '@/lib/studio/model/commands'
import { studioMidiFixture, TEST_NOW, } from '@/lib/studio/model/model.test-fixtures'
import type { StudioProject } from '@/lib/studio/model/types'
import { readStudioMidiFile } from '@/tests/utils/studio-midi-file.fixture'
import type { SavedStudioFile } from './export.test-fixtures'
import { captureStudioDownloads, savedBytes } from './export.test-fixtures'
import { downloadStudioClipMidi, downloadStudioSongMidi } from './midi-download'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

/** The fixture's Keys clip split at 1.75 s: the left half plays C4 and the start of E4. */
function splitSong(): ReturnType<typeof studioMidiFixture> {
  const fixture = studioMidiFixture()
  const project = applyStudioCommand(
    fixture.project,
    {
      type: 'split-clip',
      clipId: 'clip-midi',
      atFrame: 84_000,
      newClipId: 'right',
    },
    { assets: fixture.assets, now: TEST_NOW },
  )
  return { ...fixture, project }
}

async function readSaved(file: SavedStudioFile) {
  return readStudioMidiFile(await savedBytes(file))
}

describe('downloadStudioSongMidi', () => {
  it('saves the song as "<title>.mid", every MIDI lane a track of it', async () => {
    // Arrange
    const saved = captureStudioDownloads()
    const { project } = studioMidiFixture()

    // Act
    const name = downloadStudioSongMidi(project)

    // Assert
    expect(name).toBe('First song.mid')
    expect(saved.map((file) => [file.name, file.blob.type])).toEqual([
      ['First song.mid', 'audio/midi'],
    ])
    const read = await readSaved(saved[0])
    expect(read.tracks.map((track) => track.name)).toEqual([
      'First song',
      'Keys',
    ])
    expect(read.tracks[1].notes.map((note) => note.pitch)).toEqual([60, 64])
  })

  it('keeps only the letters, digits, spaces, dots, underscores and hyphens of a title', () => {
    // Arrange
    const saved = captureStudioDownloads()
    const project: StudioProject = {
      ...studioMidiFixture().project,
      title: 'Noć / "Live": take #2?',
    }

    // Act
    downloadStudioSongMidi(project)

    // Assert
    expect(saved.map((file) => file.name)).toEqual(['Noć  Live take 2.mid'])
  })

  it('lets the object URL go ten seconds after the click', () => {
    // Arrange
    vi.useFakeTimers()
    captureStudioDownloads()

    // Act
    downloadStudioSongMidi(studioMidiFixture().project)
    vi.advanceTimersByTime(9_999)
    const early = vi.mocked(URL.revokeObjectURL).mock.calls.length
    vi.advanceTimersByTime(1)

    // Assert
    expect(early).toBe(0)
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      'blob:studio-file-1',
    )
  })
})

describe('downloadStudioClipMidi', () => {
  it('saves a clip alone as "<title> - <take>.mid", its take named as its band names it', async () => {
    // Arrange
    const saved = captureStudioDownloads()
    const { project, assets } = splitSong()
    const named = assets.map((asset) =>
      asset.id === 'asset-midi'
        ? { ...asset, originalName: 'Take 3.wav' }
        : asset,
    )

    // Act
    const name = downloadStudioClipMidi(project, named, 'clip-midi')

    // Assert
    expect(name).toBe('First song - Take 3.mid')
    expect(saved.map((file) => file.name)).toEqual(['First song - Take 3.mid'])
    const read = await readSaved(saved[0])
    expect(
      read.tracks[1].notes.map((note) => [
        note.pitch,
        note.startTick,
        note.endTick,
      ]),
    ).toEqual([
      [60, 1920, 2400],
      [64, 2880, 3360],
    ])
  })

  it('names a clip with no take after its lane', () => {
    // Arrange
    const saved = captureStudioDownloads()
    const { project, assets } = splitSong()

    // Act
    downloadStudioClipMidi(project, assets, 'right')

    // Assert
    expect(saved.map((file) => file.name)).toEqual(['First song - Keys.mid'])
  })

  it('saves nothing for an audio clip', () => {
    // Arrange
    const saved = captureStudioDownloads()
    const { project, assets } = splitSong()

    // Act
    const name = downloadStudioClipMidi(project, assets, 'clip-1')

    // Assert
    expect(name).toBeNull()
    expect(saved).toEqual([])
  })
})
