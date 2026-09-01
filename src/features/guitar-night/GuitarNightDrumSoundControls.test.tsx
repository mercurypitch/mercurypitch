// ============================================================
// Guitar Night drum sound control tests — inert selection and persistence
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GUITAR_NIGHT_DRUM_SOUND_STORAGE_KEY } from './guitar-night-drum-sound'
import { GuitarNightDrumSoundControls } from './GuitarNightDrumSoundControls'

describe('GuitarNightDrumSoundControls', () => {
  beforeEach(() => localStorage.clear())

  it('starts on the inert zero-download and straight defaults', () => {
    render(() => <GuitarNightDrumSoundControls />)

    expect(
      screen.getByRole('combobox', { name: 'Guitar Night drum kit' }),
    ).toHaveValue('mercury-synth')
    expect(
      screen.getByRole('combobox', {
        name: 'Guitar Night generated drum feel',
      }),
    ).toHaveValue('straight')
    expect(localStorage.getItem(GUITAR_NIGHT_DRUM_SOUND_STORAGE_KEY)).toBeNull()
  })

  it('persists choices without starting audio or loading kit capabilities', () => {
    render(() => <GuitarNightDrumSoundControls />)

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Guitar Night drum kit' }),
      { target: { value: 'studio' } },
    )
    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Guitar Night generated drum feel',
      }),
      { target: { value: 'funk' } },
    )

    expect(
      JSON.parse(
        localStorage.getItem(GUITAR_NIGHT_DRUM_SOUND_STORAGE_KEY) ?? '{}',
      ),
    ).toEqual({ kitId: 'studio', feelId: 'funk' })
  })

  it('reports a live Kit choice while keeping Feel explicitly next-Play', () => {
    const onKitChange = vi.fn()
    const onFeelChange = vi.fn()
    render(() => (
      <GuitarNightDrumSoundControls
        liveKit
        onKitChange={onKitChange}
        onFeelChange={onFeelChange}
      />
    ))

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Guitar Night drum kit' }),
      { target: { value: 'live' } },
    )
    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Guitar Night generated drum feel',
      }),
      { target: { value: 'jazz' } },
    )

    expect(onKitChange).toHaveBeenCalledWith('live')
    expect(onFeelChange).toHaveBeenCalledWith('jazz')
    expect(
      screen.getByText(/Kit changes live after audio starts/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Feel starts on next Play/)).toBeInTheDocument()
  })

  it('states sampled-core readiness and bounded routing truth without claiming audibility', () => {
    render(() => (
      <GuitarNightDrumSoundControls
        liveKit
        playback={() => ({
          status: 'ready',
          playerCount: 2,
          fallbackReady: true,
          sampledReady: true,
          sampleStatus: 'ready',
          selectedFormat: 'opus',
          routingCounts: {
            sampled: 10,
            synthesized: 0,
            synthFallback: 2,
            unmapped: 1,
            dropped: 0,
            unreported: 0,
            choked: 1,
            idle: 0,
            unsupported: 0,
          },
        })}
      />
    ))

    expect(screen.getByText(/Sampled core ready \(OPUS\)/)).toBeInTheDocument()
    expect(screen.getByText(/2 fallback, 1 unmapped/)).toBeInTheDocument()
    expect(screen.queryByText(/audible/i)).not.toBeInTheDocument()
  })

  it('keeps degraded auxiliary-sample truth visible when the sampled core is ready', () => {
    render(() => (
      <GuitarNightDrumSoundControls
        liveKit
        playback={() => ({
          status: 'ready',
          playerCount: 1,
          fallbackReady: true,
          sampledReady: true,
          sampleStatus: 'fallback',
          selectedFormat: 'mp3',
          routingCounts: {
            sampled: 0,
            synthesized: 0,
            synthFallback: 0,
            unmapped: 0,
            dropped: 0,
            unreported: 0,
            choked: 0,
            idle: 0,
            unsupported: 0,
          },
        })}
      />
    ))

    expect(screen.getByText(/Sampled core ready \(MP3\)/)).toHaveTextContent(
      'did not pass the sample quality check',
    )
    expect(screen.getByText(/Mercury Synth covers them/)).toBeInTheDocument()
  })
})
