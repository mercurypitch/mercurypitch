// ============================================================
// The HUD, as the room draws it
// ============================================================
//
// The signals themselves are proved in `hud-signals.test.ts`; what is here is
// the half a pure function cannot answer — that the kit's variant really
// reaches the chip, that the state chip is the ONE microphone control the
// room has, and that a chip nobody can name is not a chip anybody can use.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PitchResult } from '@/types'
import { noteChipSignal } from './hud-signals'
import { SingRoomHud } from './SingRoomHud'

afterEach(cleanup)

function pitch(cents: number): PitchResult {
  return {
    freq: 220,
    midi: 57,
    note: 'A3',
    noteName: 'A',
    targetMidi: 0,
    targetNote: '',
    cents,
    frequency: 220,
    clarity: 0.9,
    octave: 3,
  }
}

function mount(over: Partial<Parameters<typeof SingRoomHud>[0]> = {}) {
  const handlers = {
    onOpenKey: vi.fn(),
    onToggleMic: vi.fn(),
    onOpenSong: vi.fn(),
  }
  render(() => (
    <SingRoomHud
      note={() => noteChipSignal(pitch(2))}
      keyLabel={() => 'C major'}
      micState={() => 'listening'}
      songName={() => null}
      {...handlers}
      {...over}
    />
  ))
  return handlers
}

describe('the note chip', () => {
  it('carries the kit variant the signal chose', () => {
    mount({ note: () => noteChipSignal(pitch(2)) })
    expect(screen.getByTestId('sing-note-chip').dataset.variant).toBe('in')
  })

  it('draws each of the four variants', () => {
    for (const [cents, variant] of [
      [2, 'in'],
      [-60, 'flat'],
      [60, 'sharp'],
    ] as const) {
      mount({ note: () => noteChipSignal(pitch(cents)) })
      expect(screen.getByTestId('sing-note-chip').dataset.variant).toBe(variant)
      cleanup()
    }
    mount({ note: () => noteChipSignal(null) })
    expect(screen.getByTestId('sing-note-chip').dataset.variant).toBe('quiet')
  })

  it('says the note, its octave and the cents', () => {
    mount()
    const chip = screen.getByTestId('sing-note-chip')
    expect(chip.textContent).toContain('A')
    expect(chip.querySelector('sub')?.textContent).toBe('3')
    expect(chip.textContent).toContain('+2 cents')
  })

  it('shows no percentage anywhere — numbers come at the end', () => {
    mount()
    expect(screen.getByTestId('sing-hud').textContent).not.toContain('%')
  })
})

describe('the state chip', () => {
  it('is the microphone control, and says which way it will go', () => {
    const handlers = mount({ micState: () => 'listening' })
    const chip = screen.getByTestId('sing-state-chip')
    expect(chip.textContent).toContain('Listening')
    expect(chip.getAttribute('aria-label')).toBe(
      'Listening. Tap to mute the microphone',
    )
    expect(chip.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(chip)
    expect(handlers.onToggleMic).toHaveBeenCalledTimes(1)
  })

  it('says Mic off for a mute and for a mic that never started', () => {
    mount({ micState: () => 'muted' })
    expect(screen.getByTestId('sing-state-chip').textContent).toContain(
      'Mic off',
    )
    cleanup()
    mount({ micState: () => 'off' })
    expect(screen.getByTestId('sing-state-chip').textContent).toContain(
      'Mic off',
    )
  })

  it('says Paused while the run is', () => {
    mount({ micState: () => 'paused' })
    expect(screen.getByTestId('sing-state-chip').textContent).toContain(
      'Paused',
    )
  })
})

describe('the key and song chips', () => {
  it('opens the sheet at the Key group', () => {
    const handlers = mount()
    const chip = screen.getByTestId('sing-key-chip')
    expect(chip.textContent).toContain('C major')
    expect(chip.getAttribute('aria-label')).toBe(
      'Key: C major. Tap to change it',
    )
    fireEvent.click(chip)
    expect(handlers.onOpenKey).toHaveBeenCalledTimes(1)
  })

  it('has no song chip until a melody is loaded', () => {
    mount()
    expect(screen.queryByTestId('sing-song-chip')).toBeNull()
  })

  it('names the melody once there is one', () => {
    const handlers = mount({ songName: () => 'Twinkle' })
    const chip = screen.getByTestId('sing-song-chip')
    expect(chip.textContent).toContain('Twinkle')
    fireEvent.click(chip)
    expect(handlers.onOpenSong).toHaveBeenCalledTimes(1)
  })
})
