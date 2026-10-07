// The rail's timeline: a slider a keyboard can drive, a drag that seeks
// once where it lets go, and A/B marks that go through the host's rule.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MixerTimelineProps } from './MixerTimeline'
import { MixerTimeline } from './MixerTimeline'

afterEach(cleanup)

const formatTime = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

function mount(overrides: Partial<MixerTimelineProps> = {}) {
  const onSeek = vi.fn()
  const onMoveLoopPoint = vi.fn()
  render(() => (
    <MixerTimeline
      elapsed={10}
      duration={30}
      formatTime={formatTime}
      onSeek={onSeek}
      loopStart={null}
      loopEnd={null}
      loopEnabled={false}
      minimumLoopGap={0.1}
      onMoveLoopPoint={onMoveLoopPoint}
      {...overrides}
    />
  ))
  const slider = screen.getByRole('slider', { name: 'Song position' })
  return { onSeek, onMoveLoopPoint, slider }
}

/** Set the range input's value the way a dragged thumb does. */
function dragTo(slider: HTMLElement, seconds: number): void {
  ;(slider as HTMLInputElement).value = String(seconds)
  fireEvent.input(slider)
}

describe('MixerTimeline', () => {
  it('reads out where the song is, as "0:10 of 0:30"', () => {
    const { slider } = mount()

    expect(slider).toHaveAttribute('aria-valuetext', '0:10 of 0:30')
    expect(screen.getByTestId('mixer-time-elapsed')).toHaveTextContent('0:10')
    expect(screen.getByTestId('mixer-time-total')).toHaveTextContent('0:30')
  })

  it('steps the song position finer than the marks, so a browser does not round the knob to a tenth', () => {
    // A range input rounds its value to its step: a song 0.45 s in read back
    // as 0.5 s at the tenth the marks move by. jsdom does not round, so the
    // step is what this can hold; stem-mixer-controls.spec.ts reads the value
    // a real browser keeps.
    const { slider } = mount({ elapsed: 0.45, duration: 1 })

    expect(Number(slider.getAttribute('step'))).toBeLessThanOrEqual(0.01)
  })

  it('steps five seconds per arrow and seeks once the key comes up', () => {
    const { slider, onSeek } = mount()

    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    expect(slider).toHaveAttribute('aria-valuetext', '0:15 of 0:30')
    expect(screen.getByTestId('mixer-time-elapsed')).toHaveTextContent('0:15')
    expect(onSeek).not.toHaveBeenCalled()

    fireEvent.keyUp(slider, { key: 'ArrowRight' })

    expect(onSeek).toHaveBeenCalledTimes(1)
    expect(onSeek).toHaveBeenCalledWith(15)
  })

  it('goes to either end on Home and End, and never past them', () => {
    const { slider, onSeek } = mount({ elapsed: 28 })

    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(slider).toHaveAttribute('aria-valuetext', '0:30 of 0:30')
    fireEvent.keyDown(slider, { key: 'Home' })
    fireEvent.keyUp(slider, { key: 'Home' })

    expect(onSeek).toHaveBeenCalledWith(0)
  })

  it('previews a drag and seeks once, where the pointer lets go', () => {
    const { slider, onSeek } = mount()

    fireEvent.pointerDown(slider)
    dragTo(slider, 20)
    dragTo(slider, 22)

    expect(screen.getByTestId('mixer-time-elapsed')).toHaveTextContent('0:22')
    expect(onSeek).not.toHaveBeenCalled()

    fireEvent.pointerUp(slider)

    expect(onSeek).toHaveBeenCalledTimes(1)
    expect(onSeek).toHaveBeenCalledWith(22)
    // Back to the song's own clock once the seek is handed over.
    expect(screen.getByTestId('mixer-time-elapsed')).toHaveTextContent('0:10')
  })

  it('seeks straight away on a change with no drag around it', () => {
    const { slider, onSeek } = mount()

    dragTo(slider, 7)

    expect(onSeek).toHaveBeenCalledWith(7)
  })

  it('shows A on its own, before there is a B', () => {
    mount({ loopStart: 5 })

    expect(
      screen.getByRole('slider', { name: 'Loop start marker' }),
    ).toHaveAttribute('aria-valuenow', '5')
    expect(screen.queryByRole('slider', { name: 'Loop end marker' })).toBeNull()
  })

  it('moves a mark through the host, which keeps or refuses it', () => {
    const [end, setEnd] = createSignal(15)
    const onMoveLoopPoint = vi.fn((which: 'A' | 'B', seconds: number) => {
      if (which === 'B' && seconds < 16) setEnd(seconds)
    })
    render(() => (
      <MixerTimeline
        elapsed={10}
        duration={30}
        formatTime={formatTime}
        onSeek={() => {}}
        loopStart={5}
        loopEnd={end()}
        loopEnabled
        minimumLoopGap={0.1}
        onMoveLoopPoint={onMoveLoopPoint}
      />
    ))
    const markB = screen.getByRole('slider', { name: 'Loop end marker' })

    fireEvent.keyDown(markB, { key: 'ArrowRight' })
    expect(onMoveLoopPoint).toHaveBeenLastCalledWith('B', 15.1)
    expect(markB).toHaveAttribute('aria-valuenow', '15.1')

    fireEvent.keyDown(markB, { key: 'End' })
    expect(onMoveLoopPoint).toHaveBeenLastCalledWith('B', 30)
    // Refused: the mark stays where the loop is.
    expect(markB).toHaveAttribute('aria-valuenow', '15.1')
  })

  it('stops a mark short of the other by more than the loop rule allows', () => {
    const { onMoveLoopPoint } = mount({ loopStart: 5, loopEnd: 15 })
    const markA = screen.getByRole('slider', { name: 'Loop start marker' })

    fireEvent.keyDown(markA, { key: 'End' })

    const [, seconds] = onMoveLoopPoint.mock.calls.at(-1) as ['A', number]
    expect(15 - seconds).toBeGreaterThan(0.1)
  })

  it('draws a loop that is off as off', () => {
    mount({ loopStart: 5, loopEnd: 15, loopEnabled: false })
    expect(screen.getByTestId('mixer-timeline-loop-range')).toHaveAttribute(
      'data-active',
      'false',
    )
    cleanup()

    mount({ loopStart: 5, loopEnd: 15, loopEnabled: true })
    expect(screen.getByTestId('mixer-timeline-loop-range')).toHaveAttribute(
      'data-active',
      'true',
    )
  })
})
