// The roll's geometry and the scoring arithmetic have their own tests. This
// covers what neither can see: that the component mounts at all, that its
// canvas draw effect survives a first paint with nothing loaded, and that the
// controls it promises are actually reachable.
//
// A bench that throws on mount is the failure mode worth catching here — every
// other bug in it is visible the moment a stem is loaded, and this one hides
// behind an empty panel.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { TranscriptionBench } from '@/features/lab/TranscriptionBench'

describe('TranscriptionBench', () => {
  afterEach(cleanup)

  it('mounts with nothing loaded', () => {
    const { container } = render(() => <TranscriptionBench />)
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('will not transcribe until a stem is chosen', () => {
    render(() => <TranscriptionBench />)
    const run = screen.getByRole('button', { name: 'Transcribe' })
    expect(run).toHaveProperty('disabled', true)
  })

  it('offers both pitch sources', () => {
    render(() => <TranscriptionBench />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect([...select.options].map((option) => option.value)).toEqual([
      'yin',
      'swift',
    ])
  })

  it('shows each source its own confidence floor', () => {
    render(() => <TranscriptionBench />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    // YIN's tuned floor and SwiftF0's differ by a lot, and the difference is
    // the point: the two numbers do not mean the same thing.
    expect(screen.getByText(/Confidence floor 0\.50/)).toBeTruthy()
    fireEvent.change(select, { target: { value: 'swift' } })
    expect(screen.getByText(/Confidence floor 0\.20/)).toBeTruthy()
  })

  it('keeps the export and edit tools out of reach until there is a result', () => {
    render(() => <TranscriptionBench />)
    for (const name of ['Export MIDI', 'Export JSON', 'Fit']) {
      expect(screen.getByRole('button', { name })).toHaveProperty(
        'disabled',
        true,
      )
    }
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('turns edit mode on and off', () => {
    render(() => <TranscriptionBench />)
    const toggle = screen.getByRole('button', { name: 'Edit mode' })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)
    expect(
      screen
        .getByRole('button', { name: 'Editing' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })
})
