// Native range edits preview locally and commit exactly once without reviving canceled seeks.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuitarRecordingTimeline } from './GuitarRecordingTimeline'

afterEach(cleanup)

function mount() {
  const [position, setPosition] = createSignal(1)
  const [disabled, setDisabled] = createSignal(false)
  const seek = vi.fn((seconds: number) => setPosition(seconds))
  const playback = {
    position,
    duration: () => 10,
    seek,
  }
  render(() => (
    <GuitarRecordingTimeline playback={playback} disabled={disabled()} />
  ))
  const input = screen.getByRole('slider', { name: 'Take position' })
  const move = (seconds: number) =>
    fireEvent.input(input, { target: { value: String(seconds) } })
  return { input, move, seek, setPosition, setDisabled }
}

describe('recording timeline', () => {
  it('retains the pointer preview through release, then commits one native change', () => {
    const h = mount()
    fireEvent.pointerDown(h.input)
    h.move(3.12)
    h.move(5.67)
    h.setPosition(1.4)
    expect(h.input).toHaveValue('5.67')
    expect(h.seek).not.toHaveBeenCalled()
    fireEvent.pointerUp(h.input)
    expect(h.input).toHaveValue('5.67')
    expect(h.seek).not.toHaveBeenCalled()
    fireEvent.change(h.input)
    expect(h.seek).toHaveBeenCalledExactlyOnceWith(5.67)
    expect(h.input).toHaveValue('5.67')
    fireEvent.change(h.input)
    expect(h.seek).toHaveBeenCalledOnce()
  })

  it('also commits once when change precedes pointerup', () => {
    const h = mount()
    fireEvent.pointerDown(h.input)
    h.move(3.21)
    fireEvent.change(h.input)
    fireEvent.pointerUp(h.input)
    expect(h.seek).toHaveBeenCalledExactlyOnceWith(3.21)
    expect(h.input).toHaveValue('3.21')
  })

  it('commits each keyboard input/change pair once', () => {
    const h = mount()
    fireEvent.keyDown(h.input, { key: 'ArrowRight' })
    h.move(1.01)
    expect(h.seek).not.toHaveBeenCalled()
    fireEvent.change(h.input)
    expect(h.seek).toHaveBeenCalledExactlyOnceWith(1.01)
    fireEvent.keyDown(h.input, { key: 'End' })
    h.move(10)
    fireEvent.change(h.input)
    expect(h.seek).toHaveBeenCalledTimes(2)
    expect(h.seek).toHaveBeenLastCalledWith(10)
  })

  it('rejoins the playback clock after a pointer gesture with no value change', () => {
    const h = mount()
    fireEvent.pointerDown(h.input)
    h.setPosition(1.5)
    expect(h.input).toHaveValue('1')
    fireEvent.pointerUp(h.input)
    expect(h.input).toHaveValue('1.5')
    expect(h.seek).not.toHaveBeenCalled()
  })

  it.each(['pointercancel', 'blur', 'disabled'] as const)(
    'ignores a trailing change after %s and accepts the next gesture',
    (reason) => {
      const h = mount()
      fireEvent.pointerDown(h.input)
      h.move(7.25)
      if (reason === 'disabled') h.setDisabled(true)
      else if (reason === 'blur') fireEvent.blur(h.input)
      else fireEvent.pointerCancel(h.input)
      expect(h.input).toHaveValue('1')
      fireEvent.change(h.input, { target: { value: '7.25' } })
      expect(h.seek).not.toHaveBeenCalled()
      h.setDisabled(false)
      fireEvent.pointerDown(h.input)
      h.move(4.25)
      fireEvent.pointerUp(h.input)
      fireEvent.change(h.input)
      expect(h.seek).toHaveBeenCalledExactlyOnceWith(4.25)
    },
  )
})
