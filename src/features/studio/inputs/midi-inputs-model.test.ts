// Studio MIDI inputs model tests — each port listed carries the lanes played from it, by its id or else its name, and a lane's port that is not listed follows as not connected, once.
import { describe, expect, it } from 'vitest'
import { FOLLOW_STUDIO_INPUT } from '@/lib/studio/record/lane-inputs'
import { studioMidiInputRows } from './midi-inputs-model'

const keys = { id: 'keys', name: 'Keystation 49', manufacturer: 'M-Audio' }
const pads = { id: 'pads', name: 'MPD218', manufacturer: null }

describe('studioMidiInputRows', () => {
  it("lists each port with its lanes, and a lane's port that is not listed as not connected", () => {
    // Arrange
    const lanes = [
      {
        name: 'Piano',
        input: {
          kind: 'midi' as const,
          portId: 'keys',
          label: 'Keystation 49',
        },
      },
      // Its port came back under a new id: found by its name.
      {
        name: 'Drums',
        input: { kind: 'midi' as const, portId: 'old', label: 'MPD218' },
      },
      {
        name: 'Organ',
        input: { kind: 'midi' as const, portId: 'gone', label: 'Launchkey' },
      },
      {
        name: 'Strings',
        input: { kind: 'midi' as const, portId: 'gone', label: 'Launchkey' },
      },
      { name: 'Vocal', input: FOLLOW_STUDIO_INPUT },
    ]

    // Act
    const rows = studioMidiInputRows([keys, pads], lanes)

    // Assert
    expect(rows).toEqual([
      { ...keys, connected: true, lanes: ['Piano'] },
      { ...pads, connected: true, lanes: ['Drums'] },
      {
        id: 'gone',
        name: 'Launchkey',
        manufacturer: null,
        connected: false,
        lanes: ['Organ', 'Strings'],
      },
    ])
  })
})
