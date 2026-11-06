// Studio phone mix tests — a lane's chip in the Mix sheet goes grey whenever the lane is silent, as its timeline header does.
import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { createStudioProject, createStudioTrack, } from '@/lib/studio/model/defaults'
import { StudioPhoneMix } from './StudioPhoneMix'

describe('Studio phone mix', () => {
  it('greys the chip of a lane another lane’s solo silences, as well as a muted one', () => {
    const project = {
      ...createStudioProject({ id: 'song' }),
      tracks: [
        {
          ...createStudioTrack({ id: 'vox', name: 'Vox', order: 0 }),
          solo: true,
        },
        createStudioTrack({ id: 'bass', name: 'Bass DI', order: 1 }),
      ],
    }

    const { container } = render(() => (
      <StudioPhoneMix
        project={project}
        writable={true}
        onCommand={() => true}
        onTrackDetails={() => undefined}
      />
    ))
    const chip = (id: string) =>
      container.querySelector(
        `[data-studio-phone-track="${id}"] [data-instrument-chip]`,
      )

    expect(chip('vox')).not.toHaveAttribute('data-silent')
    expect(chip('bass')).toHaveAttribute('data-silent')
  })
})
