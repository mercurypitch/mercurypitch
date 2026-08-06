// ============================================================
// StemMixerStemControls tests — stable asynchronous add-stem controls
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StemMixerStemControls } from '../StemMixerStemControls'

afterEach(cleanup)

const emptyTrack = () => ({
  label: '',
  url: '',
  color: '#ffffff',
  buffer: null,
  gainNode: null,
  analyserNode: null,
  sourceNode: null,
  muted: false,
  soloed: false,
  volume: 1,
})

describe('StemMixerStemControls add-stem state', () => {
  it('keeps every pill mounted and disabled while one stem loads', () => {
    render(() => (
      <StemMixerStemControls
        vocal={emptyTrack}
        midi={emptyTrack}
        instrumental={emptyTrack}
        extras={() => []}
        anySoloed={() => false}
        toggleSolo={vi.fn()}
        toggleMute={vi.fn()}
        setTrackVolume={vi.fn()}
        handleDownload={vi.fn()}
        addableStems={() => [
          { key: 'drums', label: 'Drums', color: '#5eead4' },
          { key: 'guitar', label: 'Guitar', color: '#c084fc' },
        ]}
        addingStem={() => 'drums'}
      />
    ))

    const adding = screen.getByRole('button', { name: 'Adding…' })
    const waiting = screen.getByRole('button', { name: '+ Guitar' })
    expect(adding).toBeDisabled()
    expect(adding).toHaveAttribute('aria-busy', 'true')
    expect(waiting).toBeDisabled()
    expect(waiting).toHaveAttribute('aria-busy', 'false')
  })

  it('keeps the displayed fader value stable while mute or solo suppresses a stem', () => {
    const vocal = () => ({
      ...emptyTrack(),
      label: 'Vocal',
      url: 'blob:vocal',
      color: '#38bdf8',
      volume: 0.67,
      muted: true,
    })

    render(() => (
      <StemMixerStemControls
        vocal={vocal}
        midi={emptyTrack}
        instrumental={emptyTrack}
        extras={() => []}
        anySoloed={() => true}
        toggleSolo={vi.fn()}
        toggleMute={vi.fn()}
        setTrackVolume={vi.fn()}
        handleDownload={vi.fn()}
      />
    ))

    const group = screen.getByRole('group', {
      name: 'Vocal stem controls',
    })
    expect(group).toHaveAttribute('data-audible', 'false')
    expect(screen.getByText('67%')).toBeVisible()

    const slider = screen.getByRole('slider', { name: 'Vocal volume' })
    expect(slider).toHaveValue('67')
    expect(slider).toHaveAttribute(
      'aria-valuetext',
      '67 percent, track not audible',
    )
    expect(screen.getByRole('button', { name: 'Mute Vocal' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Solo Vocal' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('marks full-band mixes for the dense responsive layout', () => {
    const presentTrack = (label: string, color: string) => ({
      ...emptyTrack(),
      label,
      url: `blob:${label.toLowerCase()}`,
      color,
      volume: 0.8,
    })
    const { container } = render(() => (
      <StemMixerStemControls
        vocal={() => presentTrack('Vocal', '#f59e0b')}
        midi={emptyTrack}
        instrumental={() => presentTrack('Instrumental', '#3b82f6')}
        extras={() => [
          presentTrack('Drums', '#14b8a6'),
          presentTrack('Bass', '#a855f7'),
          presentTrack('Guitar', '#f43f5e'),
        ]}
        anySoloed={() => false}
        toggleSolo={vi.fn()}
        toggleMute={vi.fn()}
        setTrackVolume={vi.fn()}
        handleDownload={vi.fn()}
      />
    ))

    const strips = container.querySelector('.sm-strips')
    expect(strips).toHaveClass('sm-strips-many')
    expect(strips).toHaveAttribute('data-stem-count', '5')
    expect(
      screen.getAllByRole('group', { name: /stem controls/ }),
    ).toHaveLength(5)
  })
})
