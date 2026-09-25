// The karaoke key control: steps in semitones, marks the stretch past ±4,
// offers "find my key", and shows read-only to a Jam guest.
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { KeyShiftControl } from './KeyShiftControl'

const raise = () => screen.getByRole('button', { name: 'Raise the key' })
const lower = () => screen.getByRole('button', { name: 'Lower the key' })
const readout = () => screen.getByTestId('key-shift-value')
const control = () => screen.getByTestId('key-shift-control')

describe('KeyShiftControl', () => {
  it('stops at +6 and at −6', () => {
    const onChange = vi.fn<(value: number) => void>()
    const top = render(() => <KeyShiftControl value={6} onChange={onChange} />)
    fireEvent.click(raise())
    fireEvent.click(lower())
    top.unmount()

    render(() => <KeyShiftControl value={-6} onChange={onChange} />)
    fireEvent.click(lower())
    fireEvent.click(raise())

    expect(onChange.mock.calls).toEqual([[5], [-5]])
  })

  it('shows the shift with its sign and the key it lands on', () => {
    render(() => (
      <KeyShiftControl value={2} onChange={vi.fn()} keyLabel="A major" />
    ))

    expect(readout().textContent).toBe('+2')
    expect(screen.getByTestId('key-shift-label').textContent).toBe('A major')
  })

  it('goes back to the original key from the readout', () => {
    const onChange = vi.fn<(value: number) => void>()
    render(() => <KeyShiftControl value={-3} onChange={onChange} />)

    fireEvent.click(readout())

    expect(onChange.mock.calls).toEqual([[0]])
  })

  it('marks a shift past ±4 as a stretch, and says what it costs', () => {
    const [value, setValue] = createSignal(4)
    render(() => <KeyShiftControl value={value()} onChange={setValue} />)
    expect(control().dataset.quality).toBe('clean')
    expect(control().title).toBe('')

    fireEvent.click(raise())

    expect(screen.getByTestId('key-shift-value').textContent).toBe('+5')
    expect(control().dataset.quality).toBe('stretch')
    expect(control().title).toBe(
      'Beyond ±4 semitones the backing can sound processed',
    )

    setValue(-5)
    expect(control().dataset.quality).toBe('stretch')
    setValue(-4)
    expect(control().dataset.quality).toBe('clean')
  })

  it('renders only the readout when read-only', () => {
    render(() => (
      <KeyShiftControl
        value={-2}
        onChange={vi.fn()}
        onFindKey={vi.fn()}
        readOnly
      />
    ))

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(readout().textContent).toBe('−2')
  })

  it('offers the suggestion and asks for it on "find my key"', () => {
    const onFindKey = vi.fn<() => void>()
    render(() => (
      <KeyShiftControl
        value={0}
        onChange={vi.fn()}
        onFindKey={onFindKey}
        suggestion={{ keyShift: -3, octave: -12, inRange: 1 }}
      />
    ))

    const find = screen.getByRole('button', { name: /find my key/i })
    expect(find.textContent).toBe('Try −3')
    expect(find.title).toContain('an octave lower than written')

    fireEvent.click(find)

    expect(onFindKey).toHaveBeenCalledTimes(1)
  })

  it('says "find my key" once the song is already in the suggested key', () => {
    render(() => (
      <KeyShiftControl
        value={-3}
        onChange={vi.fn()}
        onFindKey={vi.fn()}
        suggestion={{ keyShift: -3, octave: 0, inRange: 1 }}
      />
    ))

    expect(
      screen.getByRole('button', { name: /find my key/i }).textContent,
    ).toBe('Find my key')
  })

  it('disables every button and says why', () => {
    const onChange = vi.fn<(value: number) => void>()
    const reason = 'Changing the key is not available on this device'
    render(() => (
      <KeyShiftControl
        value={1}
        onChange={onChange}
        onFindKey={vi.fn()}
        disabledReason={reason}
      />
    ))

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(4)
    for (const button of buttons) {
      expect(button).toHaveProperty('disabled', true)
      expect(button.title).toBe(reason)
    }
    expect(control().title).toBe(reason)
    fireEvent.click(raise())
    expect(onChange).not.toHaveBeenCalled()
  })
})
