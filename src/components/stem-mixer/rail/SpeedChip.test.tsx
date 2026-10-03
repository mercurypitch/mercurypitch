// The speed chip: what it says, and that a row in its list sets the speed.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SpeedChip } from './SpeedChip'

afterEach(cleanup)

describe('SpeedChip', () => {
  it('sets the speed chosen from its list, and says the new one', () => {
    const [speed, setSpeed] = createSignal(1)
    const onSpeedChange = vi.fn(setSpeed)
    render(() => <SpeedChip speed={speed()} onSpeedChange={onSpeedChange} />)

    const chip = screen.getByRole('button', { name: 'Playback speed 1x' })
    expect(chip).toHaveTextContent('1x')
    fireEvent.click(chip)
    const playing = screen.getByRole('menuitemradio', { name: '1x' })
    expect(playing).toHaveAttribute('aria-checked', 'true')
    // The tick is on the speed the song plays at, and only there.
    expect(playing.querySelector('svg')).not.toBeNull()
    expect(
      screen.getByRole('menuitemradio', { name: '0.75x' }).querySelector('svg'),
    ).toBeNull()

    fireEvent.click(screen.getByRole('menuitemradio', { name: '0.75x' }))

    expect(onSpeedChange).toHaveBeenCalledWith(0.75)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Playback speed 0.75x' }),
    ).toHaveTextContent('0.75x')
    fireEvent.click(
      screen.getByRole('button', { name: 'Playback speed 0.75x' }),
    )
    expect(
      screen.getByRole('menuitemradio', { name: '0.75x' }).querySelector('svg'),
    ).not.toBeNull()
  })

  it('offers every speed from half to double', () => {
    render(() => <SpeedChip speed={1} onSpeedChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Playback speed 1x' }))

    const speeds = screen
      .getAllByRole('menuitemradio')
      .map((row) => row.textContent?.trim())
    expect(speeds).toEqual([
      '0.5x',
      '0.75x',
      '0.85x',
      '1x',
      '1.2x',
      '1.5x',
      '1.75x',
      '2x',
    ])
  })

  it('closes its list on Escape and hands focus back to the chip', () => {
    render(() => <SpeedChip speed={1} onSpeedChange={() => {}} />)
    const chip = screen.getByRole('button', { name: 'Playback speed 1x' })
    fireEvent.click(chip)

    fireEvent.keyDown(document.body, { key: 'Escape' })

    expect(screen.queryByRole('menu')).toBeNull()
    expect(chip).toHaveFocus()
  })
})
