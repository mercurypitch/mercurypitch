// Studio track details tests — a lane's details open its lines in the arrangement (an overlaid panel stepping aside), hold them while a take runs, arm the lane where its header cannot, and comp its loop takes on a phone only.
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStudioProject, createStudioTrack, } from '@/lib/studio/model/defaults'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioClip } from '@/lib/studio/model/types'
import type { StudioRecordPhase } from '@/lib/studio/record/studio-recorder'
import { setStudioTakeRunning } from '../record/take-running'
import { studioLaneLinesRequest } from '../timeline/lane-lines-request'
import { StudioTrackDetails } from './StudioTrackDetails'

afterEach(() => setStudioTakeRunning(false))

const track = createStudioTrack({ id: 'gtr', name: 'Guitar', order: 0 })
const project = {
  ...createStudioProject({
    id: 'song',
    title: 'Song',
    now: '2026-11-15T12:00:00.000Z',
  }),
  tracks: [track],
}

/** A loop take of three passes on the lane, its clip on the newest over bars 2 and 3. */
const take: StudioClip = {
  ...studioFixture().clip,
  trackId: 'gtr',
  startFrame: 96_000,
  sourceInFrame: 4 * 96_000,
  sourceOutFrame: 6 * 96_000,
  fades: { curve: 'linear-amplitude' },
  passes: { firstFrame: 0, frames: 2 * 96_000, count: 3 },
}

function mount(
  arming?: Parameters<typeof StudioTrackDetails>[0]['arming'],
  phone?: boolean,
) {
  const afterLines = vi.fn()
  render(() => (
    <StudioTrackDetails
      track={track}
      project={{ ...project, clips: [take] }}
      assets={[studioFixture().asset]}
      writable
      phone={phone}
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

  it('comps the lane’s loop takes bar by bar on a phone, which has no rows under its lanes', () => {
    mount(undefined, true)

    expect(screen.getByRole('group', { name: /^Comp of / })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Bar / })).toHaveLength(6)
  })

  it('leaves comping to the rows under the lane on a computer or a tablet', () => {
    mount()

    expect(screen.queryByRole('group', { name: /^Comp of / })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Bar / })).toBeNull()
  })
})
