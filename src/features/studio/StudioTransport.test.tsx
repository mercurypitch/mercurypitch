// Studio transport tests — the typed clock seeks silently, clamps to the song and refuses non-times, the wheel and the arrows scrub it; Repeat and Punch follow the range.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setStudioTakeRunning } from './record/take-running'
import { StudioTransport } from './StudioTransport'
import { publishStudioScrubGrid } from './timeline/scrub-step'

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

it('scrubs a second a notch with the wheel over the clock, no click needed', () => {
  const { onSeek, clock } = renderTransport()
  fireEvent.wheel(clock, { deltaY: -100 })
  expect(onSeek).toHaveBeenLastCalledWith(96000)
  expect(clock).not.toHaveFocus()
})

it("steps along the timeline's grid with the arrows while Snap is on", () => {
  // At 80 px/s and 120 bpm the timeline draws a line every half second.
  publishStudioScrubGrid({ snap: true, pixelsPerSecond: 80, tempoBpm: 120 })
  try {
    const { onSeek, clock } = renderTransport()
    fireEvent.keyDown(clock, { key: 'ArrowUp' })
    expect(onSeek).toHaveBeenLastCalledWith(72000)
  } finally {
    publishStudioScrubGrid(null)
  }
})

it('leaves the playhead alone with the arrows, and says why, while a take runs', () => {
  const { onSeek, clock } = renderTransport()
  setStudioTakeRunning(true)
  try {
    fireEvent.keyDown(clock, { key: 'ArrowUp' })
    fireEvent.wheel(clock, { deltaY: -100 })
    expect(onSeek).not.toHaveBeenCalled()
    expect(clock).toHaveAttribute(
      'title',
      'Stop the take to scrub the playhead',
    )
  } finally {
    setStudioTakeRunning(false)
  }
  expect(clock.getAttribute('title')).toMatch(/^Type a time/)
})

it('says the playhead to the millisecond', () => {
  const { clock } = renderTransport(vi.fn(), () => 16000)
  expect(clock).toHaveAttribute('aria-valuenow', '0.333')
})

it('holds the focused time while the song plays, so typing replaces it', () => {
  const [frame, setFrame] = createSignal(83.456 * 48000)
  // The accessor is read inside renderTransport's JSX, a tracked scope.
  // eslint-disable-next-line solid/reactivity
  const { onSeek, clock } = renderTransport(vi.fn(), frame)
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

describe('Repeat and Punch with a range', () => {
  afterEach(() => setStudioTakeRunning(false))

  function renderRanged(ranged: boolean) {
    const [on, setOn] = createSignal(false)
    const toggle = vi.fn(() => setOn((now) => !now))
    render(() => (
      <StudioTransport
        playing={false}
        pending={false}
        playheadFrame={0}
        endFrame={60 * 48000}
        peakL={0}
        peakR={0}
        meter={null}
        meterReady={false}
        onResetPeakHold={vi.fn()}
        hasAudio={true}
        repeating={false}
        onRepeat={vi.fn()}
        ranged={ranged}
        punch={{ on, toggle }}
        onToggle={vi.fn()}
        onStart={vi.fn()}
        onSeek={vi.fn()}
      />
    ))
    return { toggle }
  }

  it('repeats the song, with no Punch, until a range is set', () => {
    renderRanged(false)
    expect(screen.getByRole('button', { name: 'Repeat song' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Punch in' })).toBeNull()
  })

  it('names Repeat for the range and toggles Punch beside it', async () => {
    const { toggle } = renderRanged(true)
    expect(screen.getByRole('button', { name: 'Repeat range' })).toBeEnabled()
    const punch = screen.getByRole('button', { name: 'Punch in' })
    expect(punch).toHaveAttribute('aria-pressed', 'false')
    await fireEvent.click(punch)
    expect(toggle).toHaveBeenCalledOnce()
    expect(punch).toHaveAttribute('aria-pressed', 'true')
  })

  it('holds Repeat and Punch while a take runs: the take keeps what they said when it started', () => {
    renderRanged(true)
    setStudioTakeRunning(true)
    expect(screen.getByRole('button', { name: 'Repeat range' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Punch in' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Punch in' })).toHaveAttribute(
      'title',
      'Stop the take to change Punch',
    )
  })
})
