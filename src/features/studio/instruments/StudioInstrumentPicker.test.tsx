// Studio instrument picker tests — automatic says what the lane's name and role draw, a search finds an instrument by any of its names, and a pick or a return to automatic is one edit.
import { fireEvent, render, screen, within } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import type { StudioCommand } from '@/lib/studio/model/commands'
import { createStudioTrack } from '@/lib/studio/model/defaults'
import type { StudioTrack } from '@/lib/studio/model/types'
import { StudioInstrumentPicker } from './StudioInstrumentPicker'

function mount(track: StudioTrack, writable = true) {
  const onCommand = vi.fn((_: StudioCommand) => true)
  render(() => (
    <StudioInstrumentPicker
      track={track}
      writable={writable}
      onCommand={onCommand}
    />
  ))
  const current = screen.getByRole('button', { name: /^Instrument/ })
  return { onCommand, current }
}

const bass = createStudioTrack({ id: 'bass', name: 'Bass DI', order: 0 })

describe('Studio instrument picker', () => {
  it('starts on automatic, naming what the lane’s name draws, and opens the grid by family', () => {
    // Arrange
    const { current } = mount(bass)

    // Act
    fireEvent.click(current)

    // Assert
    expect(current).toHaveAccessibleName('Instrument Bass guitar Automatic')
    expect(current).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('button', { name: /^Automatic: Bass guitar/ }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent),
    ).toHaveLength(13)
  })

  it('finds an instrument by another of its names and picks it as one edit', () => {
    // Arrange
    const { current, onCommand } = mount(bass)
    fireEvent.click(current)

    // Act
    fireEvent.input(
      screen.getByRole('searchbox', { name: 'Find an instrument' }),
      {
        target: { value: 'Sitar' },
      },
    )
    const family = screen.getByRole('heading', { level: 4 }).parentElement!
    fireEvent.click(within(family).getByRole('button', { name: 'Lute' }))

    // Assert
    expect(family).toHaveTextContent('Plucked strings')
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({
      type: 'set-track-instrument',
      trackId: 'bass',
      instrument: 'lute',
    })
    expect(current).toHaveAttribute('aria-expanded', 'false')
  })

  it('goes back to automatic from a pick', () => {
    // Arrange
    const { current, onCommand } = mount({ ...bass, instrument: 'trumpet' })
    fireEvent.click(current)

    // Act
    fireEvent.click(screen.getByRole('button', { name: /^Automatic/ }))

    // Assert
    expect(current).toHaveAccessibleName(
      'Instrument Trumpet Chosen for this track',
    )
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({
      type: 'set-track-instrument',
      trackId: 'bass',
      instrument: null,
    })
  })

  it('says when no instrument matches, and holds a read-only song’s pick', () => {
    // Arrange
    const { current } = mount(bass, false)
    fireEvent.click(current)

    // Act
    const trumpet = screen.getByRole('button', { name: 'Trumpet' })
    fireEvent.input(
      screen.getByRole('searchbox', { name: 'Find an instrument' }),
      {
        target: { value: 'kazoo' },
      },
    )

    // Assert
    expect(trumpet).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(
      'No instrument matches “kazoo”.',
    )
  })
})
