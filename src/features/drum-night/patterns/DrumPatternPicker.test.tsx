// ============================================================
// Drum pattern picker tests — style filtering and the destructive-load guard
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DrumPatternPicker } from './DrumPatternPicker'

afterEach(cleanup)

describe('DrumPatternPicker', () => {
  it('opens on rock and switches the listed grooves with the style rail', () => {
    render(() => <DrumPatternPicker onLoad={vi.fn()} />)

    expect(screen.getByText('Straight Backbeat')).toBeVisible()
    expect(screen.queryByText('Bossa Nova')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Latin' }))

    expect(screen.getByText('Bossa Nova')).toBeVisible()
    expect(screen.queryByText('Straight Backbeat')).toBeNull()
  })

  it('confirms before replacing the open variation', () => {
    const onLoad = vi.fn()
    render(() => <DrumPatternPicker onLoad={onLoad} />)

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Start from this' })[0],
    )

    expect(onLoad).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent(
      /replaces every hit in the open variation/i,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Replace hits' }))

    expect(onLoad).toHaveBeenCalledOnce()
    expect(onLoad.mock.calls[0]?.[0]).toMatchObject({
      id: 'rock-straight-backbeat',
      style: 'rock',
    })
  })

  it('backs out of the confirmation without loading', () => {
    const onLoad = vi.fn()
    render(() => <DrumPatternPicker onLoad={onLoad} />)

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Start from this' })[0],
    )
    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }))

    expect(onLoad).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('drops a pending confirmation when the style changes', () => {
    render(() => <DrumPatternPicker onLoad={vi.fn()} />)

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Start from this' })[0],
    )
    fireEvent.click(screen.getByRole('button', { name: 'Jazz' }))

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Replace hits' })).toBeNull()
  })

  it('marks the pattern the open variation was started from', () => {
    render(() => (
      <DrumPatternPicker
        loadedPatternId="rock-half-time-anthem"
        onLoad={vi.fn()}
      />
    ))

    expect(screen.getByText('Loaded')).toBeVisible()
  })

  it('locks every action while disabled', () => {
    render(() => <DrumPatternPicker disabled onLoad={vi.fn()} />)

    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled()
    }
  })
})
