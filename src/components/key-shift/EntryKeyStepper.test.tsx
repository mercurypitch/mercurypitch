// A playlist entry's key: unset by default, stepped in semitones, clearable.
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { EntryKeyStepper } from './EntryKeyStepper'

describe('EntryKeyStepper', () => {
  it('reads "default" until the entry has a key, and steps from the original key', () => {
    const onChange = vi.fn()
    render(() => <EntryKeyStepper value={undefined} onChange={onChange} />)

    expect(screen.getByTestId('entry-key-value').textContent).toBe('default')
    expect(
      screen.queryByRole('button', { name: /each song's own key/i }),
    ).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /raise/i }))
    fireEvent.click(screen.getByRole('button', { name: /lower/i }))
    expect(onChange.mock.calls).toEqual([[1], [-1]])
  })

  it('shows a set key with its sign and steps from it', () => {
    const onChange = vi.fn()
    render(() => <EntryKeyStepper value={-2} onChange={onChange} />)

    expect(screen.getByTestId('entry-key-value').textContent).toBe('−2')
    fireEvent.click(screen.getByRole('button', { name: /raise/i }))
    expect(onChange).toHaveBeenLastCalledWith(-1)
  })

  it('stops at ±6', () => {
    const onChange = vi.fn()
    render(() => <EntryKeyStepper value={6} onChange={onChange} />)

    const raise = screen.getByRole('button', { name: /raise/i })
    expect(raise).toHaveProperty('disabled', true)
    fireEvent.click(raise)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('goes back to each song’s own key when cleared', () => {
    const onChange = vi.fn()
    render(() => <EntryKeyStepper value={0} onChange={onChange} />)

    expect(screen.getByTestId('entry-key-value').textContent).toBe('0')
    fireEvent.click(
      screen.getByRole('button', { name: /each song's own key/i }),
    )
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })
})
