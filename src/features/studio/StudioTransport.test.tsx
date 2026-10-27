// Studio transport tests — the typed clock seeks silently, clamps to the song and refuses non-times.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, expect, it, vi } from 'vitest'
import { StudioTransport } from './StudioTransport'

afterEach(cleanup)

function renderTransport(onSeek = vi.fn(), frame = () => 48000) {
  render(() => (
    <StudioTransport
      playing={false}
      pending={false}
      playheadFrame={frame()}
      endFrame={60 * 48000}
      peakL={0}
      peakR={0}
      meter={null}
      meterReady={false}
      onResetPeakHold={vi.fn()}
      hasAudio={true}
      repeating={false}
      onRepeat={vi.fn()}
      onToggle={vi.fn()}
      onStart={vi.fn()}
      onSeek={onSeek}
    />
  ))
  return {
    onSeek,
    clock: screen.getByRole('spinbutton', { name: 'Playhead in seconds' }),
  }
}

function type(clock: HTMLElement, value: string): void {
  fireEvent.input(clock, { target: { value } })
  fireEvent.change(clock, { target: { value } })
}

it('shows the playhead as a clock and seeks to typed seconds or minutes', () => {
  const { onSeek, clock } = renderTransport()
  expect(clock).toHaveValue('0:01.000')
  expect(screen.getByLabelText('Song position')).toHaveTextContent('0:01.000')
  type(clock, '1.234')
  expect(onSeek).toHaveBeenLastCalledWith(59232)
  type(clock, '0:42.150')
  expect(onSeek).toHaveBeenLastCalledWith(2023200)
  type(clock, '5:00')
  expect(onSeek).toHaveBeenLastCalledWith(60 * 48000)
  expect(onSeek).toHaveBeenCalledTimes(3)
})

it('keeps the playhead for text that is not a time and steps a second with the arrows', () => {
  const { onSeek, clock } = renderTransport()
  type(clock, 'soon')
  expect(onSeek).not.toHaveBeenCalled()
  expect(clock).toHaveValue('0:01.000')
  fireEvent.keyDown(clock, { key: 'ArrowUp' })
  expect(onSeek).toHaveBeenLastCalledWith(96000)
  fireEvent.keyDown(clock, { key: 'ArrowDown', shiftKey: true })
  expect(onSeek).toHaveBeenLastCalledWith(43200)
})

it('holds the focused time while the song plays, so typing replaces it', () => {
  const [frame, setFrame] = createSignal(83.456 * 48000)
  const { onSeek, clock } = renderTransport(vi.fn(), () => frame())
  fireEvent.focus(clock)
  setFrame(84 * 48000)
  expect(clock).toHaveValue('1:23.456')
  fireEvent.keyDown(clock, { key: 'Enter' })
  expect(onSeek).not.toHaveBeenCalled()
  type(clock, '50')
  expect(onSeek).toHaveBeenLastCalledWith(50 * 48000)
  fireEvent.blur(clock)
  expect(clock).toHaveValue('1:24.000')
})
