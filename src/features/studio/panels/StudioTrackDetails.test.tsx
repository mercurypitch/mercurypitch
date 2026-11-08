// Studio track details tests — a lane's details open its lines in the arrangement (an overlaid panel stepping aside), hold them while a take runs, and arm the lane where its header cannot.
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStudioTrack } from '@/lib/studio/model/defaults'
import type { StudioRecordPhase } from '@/lib/studio/record/studio-recorder'
import { setStudioTakeRunning } from '../record/take-running'
import { studioLaneLinesRequest } from '../timeline/lane-lines-request'
import { StudioTrackDetails } from './StudioTrackDetails'

afterEach(() => setStudioTakeRunning(false))

const track = createStudioTrack({ id: 'gtr', name: 'Guitar', order: 0 })

function mount(arming?: Parameters<typeof StudioTrackDetails>[0]['arming']) {
  const afterLines = vi.fn()
  render(() => (
    <StudioTrackDetails
      track={track}
      assets={[]}
      writable
      arming={arming}
      onCommand={() => true}
      afterLines={afterLines}
      onRemove={vi.fn()}
    />
  ))
  return { afterLines }
}

describe('Studio track details', () => {
  it('opens the lane’s lines in the arrangement and lets the panel step aside', () => {
    // Arrange
    const { afterLines } = mount()

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Volume and pan lines' }),
    )

    // Assert
    expect(studioLaneLinesRequest()).toEqual({ trackId: 'gtr' })
    expect(afterLines).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /^Arm/ })).toBeNull()
  })

  it('holds the lines while a take runs, and arms the lane where its header cannot', () => {
    // Arrange
    const toggle = vi.fn()
    mount({
      laneState: (): StudioRecordPhase => 'idle',
      phase: (): StudioRecordPhase => 'idle',
      canArm: () => true,
      toggle,
    })

    // Act
    setStudioTakeRunning(true)
    fireEvent.click(
      screen.getByRole('button', { name: 'Arm Guitar for recording' }),
    )

    // Assert
    const lines = screen.getByRole('button', { name: 'Volume and pan lines' })
    expect(lines).toBeDisabled()
    expect(lines).toHaveAttribute('title', 'Stop the take to draw lines')
    expect(toggle).toHaveBeenCalledExactlyOnceWith('gtr')
  })
})
