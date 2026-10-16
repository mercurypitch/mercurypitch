// The waveform's right-click menu: what each row does, and that it closes
// by the same rule as every other floating panel.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LoopPoint } from './LoopPointMenu'
import { LoopPointMenu } from './LoopPointMenu'

afterEach(cleanup)

const formatTime = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

function mount(hasLoop = false) {
  const [point, setPoint] = createSignal<LoopPoint | null>({
    x: 120,
    y: 80,
    time: 12,
  })
  const calls = {
    setA: vi.fn(),
    setB: vi.fn(),
    clear: vi.fn(),
    close: vi.fn(() => setPoint(null)),
  }
  render(() => (
    <>
      <p>Lyrics</p>
      <LoopPointMenu
        point={point()}
        formatTime={formatTime}
        hasLoop={hasLoop}
        onSetA={calls.setA}
        onSetB={calls.setB}
        onClear={calls.clear}
        onClose={calls.close}
      />
    </>
  ))
  return calls
}

describe('LoopPointMenu', () => {
  it('sets the loop start at the time clicked, and closes', () => {
    const calls = mount()

    expect(screen.getByRole('menu')).toHaveAccessibleName('Loop point at 0:12')
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Set loop start here' }),
    )

    expect(calls.setA).toHaveBeenCalledWith(12)
    expect(calls.close).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('sets the loop end at the time clicked', () => {
    const calls = mount()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Set loop end here' }))

    expect(calls.setB).toHaveBeenCalledWith(12)
  })

  it('offers Clear loop only when there is a loop to clear', () => {
    mount(false)
    expect(screen.queryByRole('menuitem', { name: 'Clear loop' })).toBeNull()
    cleanup()

    const calls = mount(true)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear loop' }))
    expect(calls.clear).toHaveBeenCalledTimes(1)
  })

  it('closes on a press outside, without setting anything', () => {
    const calls = mount()

    fireEvent.pointerDown(screen.getByText('Lyrics'))

    expect(calls.close).toHaveBeenCalledTimes(1)
    expect(calls.setA).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('takes Escape for itself, so nothing underneath acts on it', () => {
    const calls = mount()

    const unclaimed = fireEvent.keyDown(document.body, { key: 'Escape' })

    expect(unclaimed).toBe(false)
    expect(calls.close).toHaveBeenCalledTimes(1)
  })

  it('moves between its rows with the arrow keys, starting on the first', () => {
    mount(true)
    const rows = screen.getAllByRole('menuitem')
    expect(rows[0]).toHaveFocus()

    fireEvent.keyDown(rows[0]!, { key: 'ArrowDown' })
    expect(rows[1]).toHaveFocus()
    fireEvent.keyDown(rows[1]!, { key: 'End' })
    expect(rows[2]).toHaveFocus()
    fireEvent.keyDown(rows[2]!, { key: 'ArrowDown' })
    expect(rows[0]).toHaveFocus()
  })
})
