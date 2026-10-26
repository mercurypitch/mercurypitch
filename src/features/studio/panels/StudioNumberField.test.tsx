// Studio numeric editing tests — exact limits, cancellation and one command per finished edit.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StudioNumberField } from './StudioNumberField'

afterEach(cleanup)

describe('Studio number field', () => {
  it('shows the accepted frame-quantized value after a command', () => {
    const [value, setValue] = createSignal(0)
    render(() => (
      <StudioNumberField
        label="Start"
        value={value()}
        min={0}
        max={10}
        onCommit={(next) => {
          setValue(Math.round(next * 48000) / 48000)
          return true
        }}
      />
    ))
    const input = screen.getByRole('spinbutton', { name: 'Start' })
    fireEvent.input(input, { target: { value: '1.234567' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveValue(59259 / 48000)
  })
  it('commits once on Enter followed by change and blur, or once on blur alone', () => {
    const [value, setValue] = createSignal(1)
    const commit = vi.fn((next: number) => {
      setValue(next)
      return true
    })
    render(() => (
      <StudioNumberField
        label="Start"
        value={value()}
        min={0}
        max={10}
        onCommit={commit}
      />
    ))
    const input = screen.getByRole('spinbutton', { name: 'Start' })
    fireEvent.input(input, { target: { value: '2.5' } })
    expect(commit).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.change(input)
    fireEvent.blur(input)
    expect(commit).toHaveBeenCalledExactlyOnceWith(2.5)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(commit).toHaveBeenCalledTimes(1)
    fireEvent.input(input, { target: { value: '3' } })
    fireEvent.blur(input)
    expect(commit).toHaveBeenCalledTimes(2)
    expect(commit).toHaveBeenLastCalledWith(3)
  })

  it.each(['', '-1', '11', '1e999'])(
    'rejects invalid input %s and retains the previous value',
    (draft) => {
      const commit = vi.fn(() => true)
      render(() => (
        <StudioNumberField
          label="Start"
          value={2}
          min={0}
          max={10}
          onCommit={commit}
        />
      ))
      const input = screen.getByRole('spinbutton', { name: 'Start' })
      fireEvent.input(input, { target: { value: draft } })
      fireEvent.blur(input)
      expect(input).toHaveValue(2)
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveAccessibleDescription('Use 0 to 10.')
      expect(commit).not.toHaveBeenCalled()
    },
  )

  it('retains a rejected edit, cancels drafts, and drops a draft on lost write access', () => {
    const [disabled, setDisabled] = createSignal(false)
    const commit = vi.fn(() => false)
    render(() => (
      <StudioNumberField
        label="Start"
        value={2}
        min={0}
        max={10}
        disabled={disabled()}
        onCommit={commit}
      />
    ))
    const input = screen.getByRole('spinbutton', { name: 'Start' })
    fireEvent.input(input, { target: { value: '3' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveValue(2)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveAttribute('aria-invalid', 'false')
    fireEvent.input(input, { target: { value: '4' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.blur(input)
    expect(commit).toHaveBeenCalledTimes(1)
    fireEvent.input(input, { target: { value: '5' } })
    setDisabled(true)
    fireEvent.blur(input)
    expect(input).toHaveValue(2)
    expect(commit).toHaveBeenCalledTimes(1)
  })
})
