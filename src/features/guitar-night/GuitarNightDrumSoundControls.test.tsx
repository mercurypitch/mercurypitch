// ============================================================
// Guitar Night drum sound control tests — inert selection and persistence
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it } from 'vitest'
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
})
