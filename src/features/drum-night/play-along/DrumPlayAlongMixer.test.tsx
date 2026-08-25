// ============================================================
// Drum Play-Along Mixer tests — presets, source truth, and independent buses
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DrumPlayAlongMixerProps } from './DrumPlayAlongMixer'
import { DrumPlayAlongMixer } from './DrumPlayAlongMixer'

afterEach(cleanup)

function mixerProps(
  overrides: Partial<DrumPlayAlongMixerProps> = {},
): DrumPlayAlongMixerProps {
  return {
    sourceKind: 'separated-audio',
    activePreset: 'full',
    drums: { level: 0.86, muted: false, detail: 'Separated drum audio' },
    backing: { level: 0.74, muted: false, detail: 'Rest of the band' },
    you: { level: 0.8, muted: false, detail: 'Live kit and drum input' },
    click: { level: 0.42, muted: true, detail: 'Count-in and metronome' },
    tracks: [
      {
        id: 'drums-main',
        label: 'Drums',
        bus: 'drums',
        level: 1,
        muted: false,
        detail: 'Separated source',
      },
      {
        id: 'bass',
        label: 'Bass',
        bus: 'backing',
        level: 0.8,
        muted: false,
        detail: 'Separated source',
      },
      {
        id: 'guitar',
        label: 'Guitar',
        bus: 'backing',
        level: 0.7,
        muted: true,
        detail: 'Separated source',
      },
    ],
    onPresetChange: vi.fn(),
    onBusLevelChange: vi.fn(),
    onBusMuteChange: vi.fn(),
    onTrackLevelChange: vi.fn(),
    onTrackMuteChange: vi.fn(),
    ...overrides,
  }
}

function mountMixer(overrides: Partial<DrumPlayAlongMixerProps> = {}) {
  const props = mixerProps(overrides)
  const mounted = render(() => <DrumPlayAlongMixer {...props} />)
  return { props, ...mounted }
}

describe('DrumPlayAlongMixer', () => {
  it('offers all three controlled presets for independently separated audio', () => {
    const onPresetChange = vi.fn()
    mountMixer({ onPresetChange })

    const presets = screen.getByRole('group', { name: 'Mix presets' })
    expect(
      within(presets).getByRole('button', { name: /Full mix/i }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(presets).getByRole('button', { name: /Drum focus/i }),
    ).toBeEnabled()
    expect(
      within(presets).getByRole('button', { name: /Play along/i }),
    ).toBeEnabled()

    fireEvent.click(
      within(presets).getByRole('button', { name: /Play along/i }),
    )
    expect(onPresetChange).toHaveBeenCalledWith('play-along')
  })

  it('disables impossible drum controls and presets for two-stem audio', () => {
    const onPresetChange = vi.fn()
    mountMixer({
      sourceKind: 'two-stem-audio',
      onPresetChange,
      tracks: [
        {
          id: 'instrumental',
          label: 'Instrumental',
          bus: 'backing',
          level: 1,
          muted: false,
        },
      ],
    })

    expect(screen.getByText(/Drums remain inside Backing/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /Drum focus/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Play along/i })).toBeDisabled()
    expect(
      screen.getByRole('slider', { name: 'Source Drums level' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Mute Source Drums' }),
    ).toBeDisabled()
    expect(screen.getByText('Unavailable')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /Play along/i }))
    expect(onPresetChange).not.toHaveBeenCalled()
  })

  it('routes bus and per-track writes without coupling You or Click', () => {
    const onBusLevelChange = vi.fn()
    const onBusMuteChange = vi.fn()
    const onTrackLevelChange = vi.fn()
    const onTrackMuteChange = vi.fn()
    mountMixer({
      onBusLevelChange,
      onBusMuteChange,
      onTrackLevelChange,
      onTrackMuteChange,
    })

    fireEvent.input(screen.getByRole('slider', { name: 'You level' }), {
      target: { value: '63' },
    })
    expect(onBusLevelChange).toHaveBeenCalledWith('you', 0.63)

    fireEvent.click(screen.getByRole('button', { name: 'Unmute Click' }))
    expect(onBusMuteChange).toHaveBeenCalledWith('click', false)

    fireEvent.input(screen.getByRole('slider', { name: 'Bass level' }), {
      target: { value: '55' },
    })
    expect(onTrackLevelChange).toHaveBeenCalledWith('bass', 0.55)

    fireEvent.click(screen.getByRole('button', { name: 'Unmute Guitar' }))
    expect(onTrackMuteChange).toHaveBeenCalledWith('guitar', false)
  })

  it('labels authored backing as a timing and pitch guide without timbre claims', () => {
    mountMixer({ sourceKind: 'authored-arrangement' })

    expect(screen.getByText('Authored arrangement')).toBeVisible()
    expect(screen.getByText(/timing and pitch guides/i)).toBeVisible()
    expect(
      screen.queryByText(/realistic|studio|original timbre/i),
    ).not.toBeInTheDocument()
  })
})
