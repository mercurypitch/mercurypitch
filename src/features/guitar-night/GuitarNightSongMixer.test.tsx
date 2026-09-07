// ============================================================
// Recorded-song mixer — stable controls and honest retained mix state
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarBackingTrackState } from '@/features/guitar/backing/guitar-backing-transport'
import { GuitarNightSongMixer } from './GuitarNightSongMixer'

function mix() {
  const [tracks, setTracks] = createSignal<readonly GuitarBackingTrackState[]>([
    {
      id: 'vocals',
      label: 'Vocals',
      muted: true,
      effectiveMuted: true,
      level: 1,
      levelDb: 0,
      available: true,
    },
    {
      id: 'drums',
      label: 'Drums',
      muted: false,
      effectiveMuted: false,
      level: 1,
      levelDb: 0,
      available: true,
    },
    {
      id: 'bass',
      label: 'Bass',
      muted: false,
      effectiveMuted: false,
      level: 1,
      levelDb: 0,
      available: false,
    },
  ])
  const [soloedTrackId, setSoloedTrackId] = createSignal<string | null>(null)
  const setTrackMuted = vi.fn((id: string, muted: boolean) => {
    setTracks((items) =>
      items.map((track) => ({
        ...track,
        ...(track.id === id ? { muted, effectiveMuted: muted } : {}),
      })),
    )
  })
  const setTrackLevelDb = vi.fn((id: string, levelDb: number) => {
    setTracks((items) =>
      items.map((track) => ({
        ...track,
        ...(track.id === id ? { levelDb } : {}),
      })),
    )
  })
  const toggleTrackSolo = vi.fn()
  const resetTrackLevels = vi.fn()
  return {
    tracks,
    soloedTrackId,
    setSoloedTrackId,
    setTracks,
    setTrackMuted,
    setTrackLevelDb,
    toggleTrackSolo,
    resetTrackLevels,
  }
}

describe('GuitarNightSongMixer', () => {
  afterEach(cleanup)

  it('keeps the dragged input and focus when the transport replaces every track object', () => {
    const transport = mix()
    render(() => (
      <GuitarNightSongMixer
        title="Velvet study"
        detail="Guitar remains inside this mix."
        transport={transport}
        isOpen={true}
        onClose={vi.fn()}
      />
    ))
    const slider = screen.getByRole('slider', { name: 'Drums level' })
    const row = screen.getByRole('group', { name: 'Drums track' })
    slider.focus()
    fireEvent.input(slider, { target: { value: '4.5' } })
    expect(transport.setTrackLevelDb).toHaveBeenCalledWith('drums', 4.5)
    expect(screen.getByRole('slider', { name: 'Drums level' })).toBe(slider)
    expect(screen.getByRole('group', { name: 'Drums track' })).toBe(row)
    expect(slider).toHaveFocus()
    expect(slider).toHaveValue('4.5')
    expect(slider).toHaveAttribute('aria-valuetext', '+4.5 dB')
    expect(slider).toHaveAttribute('min', '-30')
    expect(slider).toHaveAttribute('max', '6')
  })

  it('shows explicit mute separately from Solo masking and relays each action', () => {
    const transport = mix()
    transport.setSoloedTrackId('bass')
    transport.setTracks((items) =>
      items.map((track) => ({ ...track, effectiveMuted: track.id !== 'bass' })),
    )
    render(() => (
      <GuitarNightSongMixer
        title="Study"
        detail="Prepared song"
        transport={transport}
        isOpen={true}
        onClose={vi.fn()}
      />
    ))
    const vocals = screen.getByRole('button', { name: 'Unmute Vocals' })
    const drums = screen.getByRole('button', { name: 'Mute Drums' })
    expect(vocals).toHaveAttribute('aria-pressed', 'true')
    expect(drums).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Quiet while Bass is soloed')).toBeInTheDocument()
    fireEvent.click(drums)
    expect(transport.setTrackMuted).toHaveBeenCalledWith('drums', true)
    fireEvent.click(screen.getByRole('button', { name: 'Solo Drums' }))
    expect(transport.toggleTrackSolo).toHaveBeenCalledWith('drums')
  })

  it('disables all mix controls for an unavailable stem and says why', () => {
    const transport = mix()
    render(() => (
      <GuitarNightSongMixer
        title="Study"
        detail="Prepared song"
        transport={transport}
        isOpen={true}
        onClose={vi.fn()}
      />
    ))
    const bass = within(screen.getByRole('group', { name: 'Bass track' }))
    expect(bass.getByText('Unavailable')).toBeInTheDocument()
    expect(bass.getByRole('slider')).toBeDisabled()
    expect(bass.getByRole('button', { name: 'Mute Bass' })).toBeDisabled()
    expect(bass.getByRole('button', { name: 'Solo Bass' })).toBeDisabled()
    expect(bass.getByRole('button', { name: 'Mute Bass' })).toHaveAttribute(
      'title',
      'Bass has no playable audio available',
    )
  })

  it.each([-40, -30])(
    'distinguishes a retained finite %s dB level from the silent fader floor',
    (levelDb) => {
      const transport = mix()
      transport.setTracks((items) =>
        items.map((track) => ({
          ...track,
          ...(track.id === 'drums' ? { levelDb } : {}),
        })),
      )
      render(() => (
        <GuitarNightSongMixer
          title="Study"
          detail="Prepared song"
          transport={transport}
          isOpen={true}
          onClose={vi.fn()}
        />
      ))
      const drums = within(screen.getByRole('group', { name: 'Drums track' }))
      const slider = drums.getByRole('slider', { name: 'Drums level' })
      expect(drums.getByText(`${levelDb} dB`)).toBeInTheDocument()
      expect(drums.getByText('Below fader range')).toBeInTheDocument()
      expect(slider).toHaveValue('-30')
      expect(slider).toHaveAttribute(
        'aria-valuetext',
        `${levelDb} dB saved level, below the adjustable fader range. The fader is at its minimum.`,
      )
      expect(drums.queryByText('−∞ dB')).not.toBeInTheDocument()
      expect(transport.setTrackLevelDb).not.toHaveBeenCalled()

      transport.setTracks((items) =>
        items.map((track) => ({
          ...track,
          ...(track.id === 'drums'
            ? { levelDb: Number.NEGATIVE_INFINITY }
            : {}),
        })),
      )
      expect(drums.getByText('−∞ dB')).toBeInTheDocument()
      expect(drums.getByText('Fader is silent')).toBeInTheDocument()
      expect(slider).toHaveAttribute('aria-valuetext', '−∞ dB')
      expect(drums.queryByText('Below fader range')).not.toBeInTheDocument()
    },
  )

  it('resets only levels and keeps source separation an explicit credited action', () => {
    const transport = mix()
    const onSeparateGuitar = vi.fn()
    render(() => (
      <GuitarNightSongMixer
        title="Study"
        detail="Guitar remains inside this mix."
        transport={transport}
        isOpen={true}
        onClose={vi.fn()}
        onSeparateGuitar={onSeparateGuitar}
      />
    ))
    expect(
      screen.getByText('Guitar remains inside this mix.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/cloud GPU and uses credits/)).toBeInTheDocument()
    expect(onSeparateGuitar).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reset levels' }))
    expect(transport.resetTrackLevels).toHaveBeenCalledOnce()
    expect(transport.setTrackMuted).not.toHaveBeenCalled()
    expect(transport.toggleTrackSolo).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Separate guitar' }))
    expect(onSeparateGuitar).toHaveBeenCalledOnce()
  })

  it('has an honest empty state without offering absent source actions', () => {
    const transport = mix()
    transport.setTracks([])
    render(() => (
      <GuitarNightSongMixer
        title="Study"
        detail="Prepared song"
        transport={transport}
        isOpen={true}
        onClose={vi.fn()}
      />
    ))
    expect(
      screen.getByText('No recorded tracks are available for this song.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset levels' })).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: 'Separate guitar' }),
    ).not.toBeInTheDocument()
  })
})
