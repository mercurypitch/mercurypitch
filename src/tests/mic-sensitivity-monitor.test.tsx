// ============================================================
// The live half of the room slider
// ============================================================
//
// "user can adjust easily with the mic calibration showcase beneath, and then
// they put the slider and we auto select preset above, but then they see how
// much noise comes through in this live monitor."
//
// The monitor is the part that makes the slider tunable rather than a guess,
// so it gets its own file: it only exists while the microphone is on, which
// is a different render path from the control itself.

import { render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const quality = {
  observedMs: 10_000,
  lastFrameAtMs: 0,
  blipRuns: 0,
  acceptedFrames: 0,
  rejectedFrames: 0,
  ambientFloorRms: 0,
  crowdedShare: 0,
  gateRms: 0,
}

vi.mock('@/stores/mic-store', () => ({ micActive: () => true }))
vi.mock('@/lib/signal-quality', () => ({
  readSignalQuality: () => quality,
}))
// The meter polls the live input on its own timer and renders a watchdog
// warning; neither is what this file is about.
vi.mock('@/components/MicLevelMeter', () => ({
  MicLevelMeter: (props: { label?: string; compact?: boolean }) => (
    <div data-compact={String(props.compact ?? false)}>{props.label}</div>
  ),
}))

import { MicSensitivitySlider } from '@/components/MicSensitivitySlider'
import { applySensitivityPreset } from '@/stores/settings-store'

const setFrames = (accepted: number, rejected: number): void => {
  quality.acceptedFrames = accepted
  quality.rejectedFrames = rejected
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  applySensitivityPreset('quiet')
  setFrames(0, 0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the live monitor beneath the slider', () => {
  it('shows the meter once the microphone is on', () => {
    render(() => <MicSensitivitySlider />)
    expect(screen.getByText("What we're hearing")).toBeTruthy()
  })

  it('waits for enough frames before quoting a number', () => {
    // A "0% getting through" built from two frames is noise presented as fact.
    setFrames(1, 1)
    render(() => <MicSensitivitySlider />)
    vi.advanceTimersByTime(600)

    expect(screen.getByText('Sing to see how much gets through')).toBeTruthy()
  })

  it('reports the share of the window that cleared the gate', () => {
    setFrames(30, 10)
    render(() => <MicSensitivitySlider />)
    vi.advanceTimersByTime(600)

    expect(screen.getByText('75%')).toBeTruthy()
    expect(screen.getByText('of the last 10s cleared the gate')).toBeTruthy()
  })

  it('keeps following the input as it changes', () => {
    setFrames(30, 10)
    render(() => <MicSensitivitySlider />)
    vi.advanceTimersByTime(600)
    expect(screen.getByText('75%')).toBeTruthy()

    // The room got louder, or the slider moved right: less is getting through.
    setFrames(4, 36)
    vi.advanceTimersByTime(600)
    expect(screen.getByText('10%')).toBeTruthy()
  })

  it('names the gate the current position is using', () => {
    render(() => <MicSensitivitySlider />)
    // Quiet's gate. The hint is how someone reads a between-stops position as
    // a number rather than a word.
    expect(screen.getByText(/The gate sits at/)).toBeTruthy()
    expect(screen.getByText(/1 of 10/)).toBeTruthy()
  })

  it('hands the sidebar a compact meter, and the settings page a full one', () => {
    // The sidebar column is narrow; the Settings section is not.
    const { unmount } = render(() => <MicSensitivitySlider compact />)
    expect(
      screen.getByText("What we're hearing").getAttribute('data-compact'),
    ).toBe('true')
    unmount()

    render(() => <MicSensitivitySlider />)
    expect(
      screen.getByText("What we're hearing").getAttribute('data-compact'),
    ).toBe('false')
  })

  it('stops polling when it goes away', () => {
    const cleared: unknown[] = []
    const realClear = globalThis.clearInterval
    globalThis.clearInterval = ((id: unknown) => {
      cleared.push(id)
      return realClear(id as Parameters<typeof realClear>[0])
    }) as typeof globalThis.clearInterval

    try {
      const { unmount } = render(() => <MicSensitivitySlider />)
      unmount()
      expect(cleared.length).toBeGreaterThan(0)
    } finally {
      globalThis.clearInterval = realClear
    }
  })
})
