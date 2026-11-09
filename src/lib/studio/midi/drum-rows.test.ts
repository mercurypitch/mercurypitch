// Studio MIDI drum rows tests — a drum editor shows the usual kit, cymbals on top and the kick at the foot, named by General MIDI; a key the sequence plays joins it in its place; and a key outside General MIDI gets a row below the kick.
import { describe, expect, it } from 'vitest'
import { STUDIO_DRUM_KIT, studioDrumKeyName, studioDrumRows } from './drum-rows'

describe('studioDrumRows', () => {
  it('shows the usual kit with no notes, from the crash down to the kick, by its General MIDI names', () => {
    expect(studioDrumRows([])).toEqual([
      { key: 49, name: 'Crash Cymbal 1' },
      { key: 51, name: 'Ride Cymbal 1' },
      { key: 46, name: 'Open Hi-Hat' },
      { key: 42, name: 'Closed Hi-Hat' },
      { key: 50, name: 'High Tom' },
      { key: 45, name: 'Low Tom' },
      { key: 38, name: 'Acoustic Snare' },
      { key: 36, name: 'Bass Drum 1' },
    ])
  })

  it('adds a key the notes play in its place in the kit: a clap after the snare, a cowbell after the hi-hats', () => {
    const keys = studioDrumRows([
      { pitch: 39 },
      { pitch: 56 },
      { pitch: 36 },
    ]).map((row) => row.key)

    expect(keys).toEqual([49, 51, 46, 42, 56, 50, 45, 38, 39, 36])
  })

  it('puts a key outside General MIDI below the kick, the higher first', () => {
    const rows = studioDrumRows([{ pitch: 20 }, { pitch: 100 }])

    expect(rows.slice(STUDIO_DRUM_KIT.length)).toEqual([
      { key: 100, name: 'Key 100' },
      { key: 20, name: 'Key 20' },
    ])
  })
})

describe('studioDrumKeyName', () => {
  it('names a General MIDI key as General MIDI does, and any other by its number', () => {
    expect(studioDrumKeyName(44)).toBe('Pedal Hi-Hat')
    expect(studioDrumKeyName(34)).toBe('Key 34')
  })
})
