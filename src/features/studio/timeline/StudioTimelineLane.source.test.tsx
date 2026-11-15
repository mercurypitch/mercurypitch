// Studio lane source tests — a lane's header says where its take came from, and a lane of MIDI says it plays MIDI and as what, the piano or the kit, rather than where its render's file came from.
import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioMidiFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioAsset, StudioProject } from '@/lib/studio/model/types'
import { studioSourcePresentation } from './source-presentation'
import { StudioTimeline } from './StudioTimeline'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** The song's lanes; returns what a lane's header says it plays from. */
function mount(project: StudioProject, assets: StudioAsset[]) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const view = render(() => (
    <StudioTimeline
      project={project}
      assets={assets}
      selectedClipId={null}
      playheadFrame={0}
      pixelsPerSecond={20}
      writable
      phone={false}
      onSelectClip={vi.fn()}
      onSeek={vi.fn()}
      onCommand={vi.fn(() => true)}
      onClipDetails={vi.fn()}
      onTrackDetails={vi.fn()}
      readCanonicalAsset={vi.fn(() => Promise.reject(new Error('Missing')))}
    />
  ))
  return (trackId: string) =>
    view.container.querySelector(
      `[data-studio-track-header="${trackId}"] [data-studio-track-source]`,
    )?.textContent
}

describe("a lane's header", () => {
  it('says a lane of MIDI plays it as the piano, and an audio lane where its take came from', () => {
    // Arrange: Guitar's take came from Guitar Night; Keys plays MIDI.
    const { project, assets } = studioMidiFixture()

    // Act
    const source = mount(project, assets)

    // Assert
    expect(source('track-keys')).toBe('MIDI · Piano')
    expect(source('track-1')).toBe(studioSourcePresentation(assets[0]).label)
  })

  it('says a drum lane’s MIDI plays as the kit', () => {
    const { project, assets } = studioMidiFixture()
    const drums = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === 'track-keys'
          ? { ...track, name: 'Drums', role: 'drums' as const }
          : track,
      ),
    }

    const source = mount(drums, assets)

    expect(source('track-keys')).toBe('MIDI · Kit')
  })
})
