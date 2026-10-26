// Studio meter presentation — finite readings, pending windows and reset use actual output state.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, expect, it, vi } from 'vitest'
import type { StudioMeterSnapshot } from '@/lib/studio/metering/stream-meter'
import { StudioOutputMeter } from './StudioOutputMeter'

afterEach(cleanup)

it('updates measured windows, marks clipping and resets held peaks through its explicit action', () => {
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
  expect(screen.getByRole('button', { name: 'Reset peak hold' })).toBeDisabled()
  setSnapshot({
    frames: 19200,
    momentaryLufs: -18.2,
    shortTermLufs: null,
    peakL: 0.5,
    peakR: 0.25,
    holdL: 0.5,
    holdR: 0.25,
    clipL: false,
    clipR: false,
  })
  expect(screen.getByRole('meter')).toHaveAttribute(
    'aria-valuetext',
    '-6.0 dBFS',
  )
  expect(screen.getByLabelText('Live loudness')).toHaveTextContent('-18.2')
  expect(screen.getByLabelText('Live loudness')).toHaveTextContent('—')
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
