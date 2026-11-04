// ============================================================
// MidiMelodyViewToggle — Roll and Notes in the MIDI Melody header
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MidiMelodyViewToggle } from './MidiMelodyViewToggle'

afterEach(cleanup)

describe('MidiMelodyViewToggle', () => {
  it('marks the view on show as pressed', () => {
    render(() => <MidiMelodyViewToggle view="notes" onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Roll' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('asks for the view that was clicked', () => {
    const onChange = vi.fn()
    render(() => <MidiMelodyViewToggle view="roll" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Notes' }))

    expect(onChange).toHaveBeenCalledWith('notes')
  })

  it('keeps a press from starting the header drag around it', () => {
    const onHeaderPointerDown = vi.fn()
    render(() => (
      <div onPointerDown={onHeaderPointerDown}>
        <MidiMelodyViewToggle view="roll" onChange={vi.fn()} />
      </div>
    ))

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Notes' }))

    expect(onHeaderPointerDown).not.toHaveBeenCalled()
  })
})
