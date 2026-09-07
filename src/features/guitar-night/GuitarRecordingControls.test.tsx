// Live-note preview retains native checkbox semantics inside its full-size touch target.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuitarRecordingLiveNotesToggle } from './GuitarRecordingControls'

afterEach(cleanup)

describe('live-note preview toggle', () => {
  it('reports one native checkbox change and follows external preference updates', () => {
    const [enabled, setEnabled] = createSignal(true)
    const changed = vi.fn((next: boolean) => setEnabled(next))
    render(() => (
      <GuitarRecordingLiveNotesToggle enabled={enabled()} onChange={changed} />
    ))
    const input = screen.getByRole('checkbox', { name: 'Live notes' })
    expect(input).toBeChecked()
    input.focus()
    expect(input).toHaveFocus()
    fireEvent.click(input)
    expect(changed).toHaveBeenCalledExactlyOnceWith(false)
    expect(input).not.toBeChecked()
    setEnabled(true)
    expect(input).toBeChecked()
    expect(changed).toHaveBeenCalledOnce()
  })
})
