// Guitar input profile tests keep route choices explicit and safely persisted.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { GUITAR_AUDIO_INPUT_STORAGE_KEY, GUITAR_INPUT_PROFILE_STORAGE_KEY, GUITAR_MIDI_INPUT_STORAGE_KEY, guitarInputProfileLabel, loadGuitarAudioInputId, loadGuitarInputProfile, loadGuitarMidiInputId, saveGuitarAudioInputId, saveGuitarInputProfile, saveGuitarMidiInputId, } from './guitar-input-profile'

describe('guitar input profile persistence', () => {
  beforeEach(() => localStorage.clear())

  it('defaults invalid or missing profiles to the room microphone', () => {
    expect(loadGuitarInputProfile(localStorage)).toBe('microphone')
    localStorage.setItem(GUITAR_INPUT_PROFILE_STORAGE_KEY, 'telepathy')
    expect(loadGuitarInputProfile(localStorage)).toBe('microphone')
  })

  it('remembers the route and its independently selected devices', () => {
    saveGuitarInputProfile('interface', localStorage)
    saveGuitarAudioInputId('interface-2', localStorage)
    saveGuitarMidiInputId('midi-7', localStorage)

    expect(loadGuitarInputProfile(localStorage)).toBe('interface')
    expect(loadGuitarAudioInputId(localStorage)).toBe('interface-2')
    expect(loadGuitarMidiInputId(localStorage)).toBe('midi-7')
    expect(localStorage.getItem(GUITAR_AUDIO_INPUT_STORAGE_KEY)).toBe(
      'interface-2',
    )
    expect(localStorage.getItem(GUITAR_MIDI_INPUT_STORAGE_KEY)).toBe('midi-7')
  })

  it('clears a device choice without clearing the selected route', () => {
    saveGuitarInputProfile('interface', localStorage)
    saveGuitarAudioInputId('interface-2', localStorage)
    saveGuitarAudioInputId(null, localStorage)

    expect(loadGuitarInputProfile(localStorage)).toBe('interface')
    expect(loadGuitarAudioInputId(localStorage)).toBeNull()
  })
})

describe('guitarInputProfileLabel', () => {
  it('uses player-facing route names', () => {
    expect(guitarInputProfileLabel('microphone')).toBe('Room mic')
    expect(guitarInputProfileLabel('interface')).toBe('Plugged in')
    expect(guitarInputProfileLabel('midi')).toBe('MIDI')
  })
})
