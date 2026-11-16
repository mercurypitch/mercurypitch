// Studio MIDI export tests — Export offers the MIDI file beside the WAV: off, and saying why, while the song has no MIDI clip; with one, it names its tracks and the tempo, saves the song's notes as "<title>.mid" at a press and says so; and a song too long for a MIDI file says it could not be made.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStudioTrack } from '@/lib/studio/model/defaults'
import { studioFixture, studioMidiFixture, } from '@/lib/studio/model/model.test-fixtures'
import type { StudioProject } from '@/lib/studio/model/types'
import { readStudioMidiFile } from '@/tests/utils/studio-midi-file.fixture'
import { captureStudioDownloads, savedBytes } from './export.test-fixtures'
import { StudioExportPanel } from './StudioExportPanel'
import { STUDIO_NO_MIDI, StudioMidiExport } from './StudioMidiExport'
import type { StudioExportController } from './useStudioExport'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** An idle WAV export, never asked to run. */
const idle = {
  busy: () => false,
  cancelling: () => false,
  result: () => null,
  stage: () => 'preparing',
  waitingRenders: () => false,
  error: () => null,
  notice: () => null,
  exportWav: vi.fn(async () => true),
  cancel: vi.fn(),
  download: vi.fn(() => true),
  dispose: vi.fn(),
} satisfies StudioExportController

const exportMidi = () => screen.getByRole('button', { name: 'Export MIDI' })

describe('Export’s MIDI file', () => {
  it('stands beside the WAV, off and saying why, while the song has no MIDI clip', () => {
    // Act
    render(() => (
      <StudioExportPanel
        project={studioFixture().project}
        controller={idle}
        canExport
      />
    ))

    // Assert
    expect(screen.getByRole('button', { name: 'Export WAV' })).toBeEnabled()
    expect(screen.getByText('MIDI file (.mid)')).toBeVisible()
    expect(exportMidi()).toBeDisabled()
    expect(exportMidi()).toHaveAccessibleDescription(STUDIO_NO_MIDI)
  })

  it('names its tracks after the MIDI lanes, in their order, and gives the song’s tempo', () => {
    // Arrange: a drum lane above the Keys lane, playing the same notes.
    const { project, clip } = studioMidiFixture()
    const song: StudioProject = {
      ...project,
      tempoBpm: 96.5,
      tracks: [
        ...project.tracks.map((track) =>
          track.id === 'track-keys' ? { ...track, order: 2 } : track,
        ),
        createStudioTrack({
          id: 'drums',
          name: 'Drums',
          order: 1,
          role: 'drums',
        }),
      ],
      clips: [...project.clips, { ...clip, id: 'drum-clip', trackId: 'drums' }],
    }

    // Act
    render(() => <StudioMidiExport project={song} />)

    // Assert
    expect(screen.getByText('Tracks').nextElementSibling).toHaveTextContent(
      'Drums, Keys',
    )
    expect(screen.getByText('Tempo').nextElementSibling).toHaveTextContent(
      '96.5 bpm · 4/4',
    )
    expect(exportMidi()).toBeEnabled()
    expect(exportMidi()).not.toHaveAccessibleDescription()
  })

  it('saves the song’s notes as "<title>.mid" at a press, and says the download was asked for', async () => {
    // Arrange
    const saved = captureStudioDownloads()
    render(() => <StudioMidiExport project={studioMidiFixture().project} />)

    // Act
    await fireEvent.click(exportMidi())

    // Assert
    expect(saved.map((file) => file.name)).toEqual(['First song.mid'])
    const read = readStudioMidiFile(await savedBytes(saved[0]))
    expect(read.tracks.map((track) => track.name)).toEqual([
      'First song',
      'Keys',
    ])
    expect(read.tracks[1].notes).toHaveLength(2)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Download requested. Your browser handles the file.',
    )
  })

  it('says the file could not be made when the song is too long for one', async () => {
    // Arrange: a MIDI clip 16 hours in at 300 bpm, past a delta time's reach.
    const saved = captureStudioDownloads()
    const { project } = studioMidiFixture()
    const song: StudioProject = {
      ...project,
      tempoBpm: 300,
      clips: project.clips.map((clip) =>
        clip.midi ? { ...clip, startFrame: 16 * 3600 * 48_000 } : clip,
      ),
    }
    render(() => <StudioMidiExport project={song} />)

    // Act
    await fireEvent.click(exportMidi())

    // Assert
    expect(saved).toEqual([])
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The MIDI file could not be made. Try Export MIDI again.',
    )
    expect(screen.queryByRole('status')).toBeNull()
  })
})
