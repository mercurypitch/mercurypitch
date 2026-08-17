// ============================================================
// The room slider writes one choice, not three that must agree
// ============================================================
//
// The slider position, the four thresholds and the preset label are three
// halves of one decision. They used to be written by two different functions
// on two different surfaces (a sidebar segmented control and a Settings
// select), which is exactly how a panel ends up showing a preset the numbers
// do not reflect — the risk the store's own comment has been flagging.

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/stores/mic-store', () => ({ micActive: () => false }))
vi.mock('@/lib/signal-quality', () => ({
  readSignalQuality: () => ({
    observedMs: 0,
    lastFrameAtMs: 0,
    blipRuns: 0,
    acceptedFrames: 0,
    rejectedFrames: 0,
    ambientFloorRms: 0,
    crowdedShare: 0,
    gateRms: 0,
  }),
}))

import { MicSensitivitySlider } from '@/components/MicSensitivitySlider'
import { SENSITIVITY_PRESETS } from '@/lib/sensitivity-scale'
import { applySensitivityPreset, sensitivityPosition, sensitivityPreset, settings, } from '@/stores/settings-store'

const slider = (): HTMLInputElement =>
  screen.getByLabelText('Room noise') as HTMLInputElement

beforeEach(() => {
  localStorage.clear()
  applySensitivityPreset('quiet')
})

describe('the room slider', () => {
  it('shows where it stands, by name', () => {
    render(() => <MicSensitivitySlider />)
    expect(slider().value).toBe('0')
    expect(screen.getByTestId('sensitivity-reading').textContent).toBe('Quiet')
  })

  it('reaches the setting that had no preset', () => {
    // The report: Noisy too restrictive, Home not enough. 75 is the middle
    // that did not exist before.
    render(() => <MicSensitivitySlider />)
    fireEvent.input(slider(), { target: { value: '75' } })

    expect(sensitivityPosition()).toBe(75)
    expect(screen.getByTestId('sensitivity-reading').textContent).toBe(
      'Between Home and Noisy',
    )

    const gate = settings().minAmplitude
    expect(gate).toBeGreaterThan(SENSITIVITY_PRESETS.home.minAmplitude)
    expect(gate).toBeLessThan(SENSITIVITY_PRESETS.noisy.minAmplitude)
  })

  it('keeps position, thresholds and label describing the same choice', () => {
    render(() => <MicSensitivitySlider />)
    fireEvent.input(slider(), { target: { value: '100' } })

    expect(sensitivityPosition()).toBe(100)
    expect(sensitivityPreset()).toBe('noisy')
    expect(settings()).toMatchObject(SENSITIVITY_PRESETS.noisy)
  })

  it('leaves the named rooms exactly as they were', () => {
    // Anyone who never touches the slider must keep the mic they had.
    render(() => <MicSensitivitySlider />)
    fireEvent.input(slider(), { target: { value: '50' } })
    expect(settings()).toMatchObject(SENSITIVITY_PRESETS.home)
    expect(sensitivityPreset()).toBe('home')
  })

  it('still offers the named rooms as one tap', () => {
    render(() => <MicSensitivitySlider />)
    fireEvent.click(screen.getByText('Noisy'))
    expect(sensitivityPosition()).toBe(100)
    expect(settings()).toMatchObject(SENSITIVITY_PRESETS.noisy)
  })

  it('follows the old three-way control, so both entry points agree', () => {
    render(() => <MicSensitivitySlider />)
    applySensitivityPreset('noisy')
    expect(slider().value).toBe('100')
    expect(sensitivityPosition()).toBe(100)
  })
})
