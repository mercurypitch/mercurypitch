// ============================================================
// Guitar Night drum sound preference tests — isolated storage and defaults
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { DRUM_FEEL_STORAGE_KEY } from '@/features/drum-night/groove/drum-feel-preference'
import { DEFAULT_GUITAR_NIGHT_DRUM_SOUND, GUITAR_NIGHT_DRUM_SOUND_STORAGE_KEY, readGuitarNightDrumSound, writeGuitarNightDrumSound, } from './guitar-night-drum-sound'

describe('Guitar Night drum sound preference', () => {
  beforeEach(() => localStorage.clear())

  it('keeps the zero-download kit and generated grid until explicitly changed', () => {
    expect(readGuitarNightDrumSound(localStorage)).toEqual({
      kitId: 'mercury-synth',
      feelId: 'straight',
    })
    expect(DEFAULT_GUITAR_NIGHT_DRUM_SOUND).toEqual({
      kitId: 'mercury-synth',
      feelId: 'straight',
    })
  })

  it('persists Circuit and feel under a Guitar-only key', () => {
    localStorage.setItem('mp.drumNight.kit.v1', 'live')
    writeGuitarNightDrumSound(
      { kitId: 'circuit', feelId: 'electronic' },
      localStorage,
    )

    expect(readGuitarNightDrumSound(localStorage)).toEqual({
      kitId: 'circuit',
      feelId: 'electronic',
    })
    expect(localStorage.getItem(GUITAR_NIGHT_DRUM_SOUND_STORAGE_KEY)).toBe(
      '{"kitId":"circuit","feelId":"electronic"}',
    )
    expect(GUITAR_NIGHT_DRUM_SOUND_STORAGE_KEY).not.toBe(DRUM_FEEL_STORAGE_KEY)
    expect(localStorage.getItem(DRUM_FEEL_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem('mp.drumNight.kit.v1')).toBe('live')
  })

  it('repairs malformed and future fields independently', () => {
    localStorage.setItem(
      GUITAR_NIGHT_DRUM_SOUND_STORAGE_KEY,
      JSON.stringify({ kitId: 'future-kit', feelId: 'funk' }),
    )
    expect(readGuitarNightDrumSound(localStorage)).toEqual({
      kitId: 'mercury-synth',
      feelId: 'funk',
    })

    localStorage.setItem(GUITAR_NIGHT_DRUM_SOUND_STORAGE_KEY, '{bad json')
    expect(readGuitarNightDrumSound(localStorage)).toEqual(
      DEFAULT_GUITAR_NIGHT_DRUM_SOUND,
    )
  })

  it('survives storage access failures', () => {
    const lockedStorage = {
      getItem() {
        throw new DOMException('denied', 'SecurityError')
      },
      setItem() {
        throw new DOMException('denied', 'SecurityError')
      },
    } as unknown as Storage

    expect(readGuitarNightDrumSound(lockedStorage)).toEqual(
      DEFAULT_GUITAR_NIGHT_DRUM_SOUND,
    )
    expect(() =>
      writeGuitarNightDrumSound(
        { kitId: 'studio', feelId: 'jazz' },
        lockedStorage,
      ),
    ).not.toThrow()
  })
})
