// Studio meter presentation — finite readings, pending windows and reset use actual output state.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, expect, it, vi } from 'vitest'
import type { StudioMeterSnapshot } from '@/lib/studio/metering/stream-meter'
import { STUDIO_METER_TEXT_MS } from './meter-text'
import { StudioOutputMeter } from './StudioOutputMeter'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** The meter's clock, moved by the test: its numbers follow eight times a second. */
function clock() {
  let now = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  return {
    advance(ms: number) {
      now += ms
    },
  }
}

const PLAYING: StudioMeterSnapshot = {
  frames: 19200,
  momentaryLufs: -18.2,
  shortTermLufs: null,
  peakL: 0.5,
  peakR: 0.25,
  holdL: 0.5,
  holdR: 0.25,
  clipL: false,
  clipR: false,
}

it('updates measured windows, marks clipping and resets held peaks through its explicit action', () => {
  const time = clock()
  const [snapshot, setSnapshot] = createSignal<StudioMeterSnapshot | null>(null)
  const reset = vi.fn()
  render(() => (
    <StudioOutputMeter
      snapshot={snapshot()}
      ready={snapshot() !== null}
      onReset={reset}
    />
  ))
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', 'Silent')
  // Nothing is held before playback, so there is nothing to reset yet.
  expect(screen.queryByRole('button', { name: 'Reset peak hold' })).toBeNull()
  expect(screen.getByText('Press play to see live loudness.')).toBeTruthy()
  setSnapshot(PLAYING)
  expect(screen.getByRole('meter')).toHaveAttribute(
    'aria-valuetext',
    '-6.0 dBFS',
  )
  expect(screen.getByLabelText('Live loudness')).toHaveTextContent('-18.2')
  expect(screen.getByLabelText('Live loudness')).toHaveTextContent('—')
  time.advance(STUDIO_METER_TEXT_MS)
  setSnapshot((previous) => ({
    ...previous!,
    frames: 144000,
    shortTermLufs: -16.4,
    holdL: 1.1,
    clipL: true,
  }))
  expect(screen.getByRole('meter')).toHaveTextContent('CLIP')
  expect(screen.getByLabelText('Live loudness')).toHaveTextContent('-16.4')
  fireEvent.click(screen.getByRole('button', { name: 'Reset peak hold' }))
  expect(reset).toHaveBeenCalledTimes(1)
})

it('follows the level with its rails every tick and with its numbers eight times a second, CLIP at once', () => {
  // Arrange
  const time = clock()
  const [snapshot, setSnapshot] = createSignal<StudioMeterSnapshot | null>(
    PLAYING,
  )
  render(() => (
    <StudioOutputMeter snapshot={snapshot()} ready onReset={() => {}} />
  ))
  const meter = screen.getByRole('meter')
  const rail = () =>
    meter.querySelector<HTMLElement>('i + span')!.style.transform
  const before = rail()

  // Act: the next tick, 40 ms on, is louder and clips.
  time.advance(40)
  setSnapshot({ ...PLAYING, peakL: 1.2, holdL: 1.2, clipL: true })
  const tick = {
    rail: rail(),
    reading: meter.getAttribute('aria-valuetext'),
    text: meter.textContent,
  }
  time.advance(STUDIO_METER_TEXT_MS)
  setSnapshot({ ...PLAYING, peakL: 1.2, holdL: 1.2, clipL: true })

  // Assert
  expect(tick.rail).not.toBe(before)
  expect(tick.reading).toBe('-6.0 dBFS')
  expect(tick.text).toContain('CLIP')
  expect(meter).toHaveAttribute('aria-valuetext', '1.6 dBFS')
})

it('makes the upright peak reading the reset, outside the meter it reads', () => {
  const reset = vi.fn()
  render(() => (
    <StudioOutputMeter vertical snapshot={null} ready={false} onReset={reset} />
  ))

  const button = screen.getByRole('button', { name: /^Peak/ })
  fireEvent.click(button)

  expect(button).toHaveAttribute('title', 'Reset peak hold')
  expect(screen.getByRole('meter')).not.toContainElement(button)
  expect(reset).toHaveBeenCalledTimes(1)
})

it('covers the travel past each level, shrunk toward its far end, and paints each held peak on a mark as large as its rail that never moves, out of sight at the floor', () => {
  const snapshot: StudioMeterSnapshot = {
    frames: 48000,
    momentaryLufs: null,
    shortTermLufs: null,
    peakL: 0.1,
    peakR: 0,
    holdL: 0.1,
    holdR: 0,
    clipL: false,
    clipR: false,
  }
  render(() => (
    <>
      <StudioOutputMeter snapshot={snapshot} ready onReset={() => {}} />
      <StudioOutputMeter
        vertical
        snapshot={snapshot}
        ready
        onReset={() => {}}
      />
    </>
  ))
  const [sidewaysL, sidewaysR, uprightL, uprightR] = [
    ...document.querySelectorAll<HTMLElement>('b'),
  ]
  const [sidewaysCoverL, sidewaysCoverR, uprightCoverL, uprightCoverR] = [
    ...document.querySelectorAll<HTMLElement>('i + span'),
  ]
  // -20 dBFS stands two thirds of the way up the -60 to 0 travel: the cover
  // keeps the last third, and the band is painted two thirds along.
  expect(sidewaysCoverL.style.transform).toMatch(/^scaleX\(0\.33\d*\)$/)
  expect(uprightCoverL.style.transform).toMatch(/^scaleY\(0\.33\d*\)$/)
  for (const mark of [sidewaysL, uprightL])
    expect(Number(mark.style.getPropertyValue('--hold'))).toBeCloseTo(2 / 3)
  // Nothing played or held: the cover hides the whole rail, and the band
  // sits just past the floor's edge.
  expect(sidewaysCoverR.style.transform).toBe('scaleX(1)')
  expect(uprightCoverR.style.transform).toBe('scaleY(1)')
  for (const mark of [sidewaysR, uprightR])
    expect(mark.style.getPropertyValue('--hold')).toBe('0')
  // The marks stay where their rails are.
  for (const mark of [sidewaysL, sidewaysR, uprightL, uprightR])
    expect(mark.style.transform).toBe('')
})
