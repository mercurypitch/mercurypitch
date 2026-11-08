// Studio lane input chip tests — only a lane with an input or a channel of its own shows a chip in its header, said in full to a screen reader, a press opens that lane's details at its input, and a phone's one-button header stays as it was.
import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStudioProject, createStudioTrack, } from '@/lib/studio/model/defaults'
import { FOLLOW_STUDIO_INPUT } from '@/lib/studio/record/lane-inputs'
import { StudioTimeline } from './StudioTimeline'

afterEach(cleanup)

const project = {
  ...createStudioProject({ id: 'song' }),
  tracks: [
    createStudioTrack({ id: 'gtr', name: 'Guitar', order: 0 }),
    createStudioTrack({ id: 'voice', name: 'Voice', order: 1 }),
  ],
  clips: [],
}

function mount(phone = false) {
  const onTrackDetails = vi.fn()
  const view = render(() => (
    <StudioTimeline
      project={project}
      assets={[]}
      selectedClipId={null}
      playheadFrame={0}
      pixelsPerSecond={20}
      writable
      phone={phone}
      onSelectClip={vi.fn()}
      onSeek={vi.fn()}
      onCommand={vi.fn(() => true)}
      onClipDetails={vi.fn()}
      onTrackDetails={onTrackDetails}
      laneInputs={{
        of: (id) =>
          id === 'gtr'
            ? {
                deviceId: 'scarlett',
                label: 'Scarlett 2i2 USB',
                channel: 1,
                pair: false,
              }
            : FOLLOW_STUDIO_INPUT,
        studioInputName: () => 'Desk mic',
      }}
      readCanonicalAsset={vi.fn(() => Promise.reject(new Error('Missing')))}
    />
  ))
  const header = (id: string) =>
    view.container.querySelector<HTMLElement>(`[data-studio-track="${id}"]`)!
  return { onTrackDetails, header }
}

describe('Studio lane input chip', () => {
  it('shows only on a lane with an input of its own, says it in full, and opens that lane’s details at its input', () => {
    // Arrange
    const { onTrackDetails, header } = mount()
    const chip = within(header('gtr')).getByRole('button', {
      name: 'Guitar records from Scarlett 2i2 USB, Input 2',
    })

    // Act
    fireEvent.click(chip)

    // Assert
    expect(chip).toHaveTextContent('In 2')
    expect(chip).toHaveAttribute(
      'title',
      "Records from Scarlett 2i2 USB, Input 2. Press for this lane's input.",
    )
    expect(onTrackDetails).toHaveBeenCalledExactlyOnceWith('gtr', 'input')
    expect(
      within(header('voice')).queryByRole('button', { name: /records from/ }),
    ).toBeNull()
  })

  it("keeps a phone's one-button header as it was, with no chip", () => {
    // Arrange, Act
    mount(true)

    // Assert
    expect(screen.queryByRole('button', { name: /records from/ })).toBeNull()
  })
})
