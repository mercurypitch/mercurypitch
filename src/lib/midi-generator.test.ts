import { describe, expect, it } from 'vitest'
import { buildMidiFile } from './midi-generator'
import { parseMidiSongViaProject } from './midi-song-from-project'
describe('buildMidiFile round trip', () => {
  it('writes a track this app can read back', () => {
    // The writer and the importer are both ours, and they disagreed: the End of
    // Track meta event went out without its delta time, so the reader took the
    // 0xff as a variable-length quantity and ran off the chunk. Every file the
    // stem mixer exported carried it.
    const bytes = buildMidiFile(
      [
        { midi: 60, tickOn: 0, tickOff: 480 },
        { midi: 64, tickOn: 480, tickOff: 960 },
      ],
      120,
    )
    expect(bytes).not.toBeNull()
    const song = parseMidiSongViaProject(
      bytes as Uint8Array,
      (program) => `GM ${program}`,
    )
    expect(song).not.toBeNull()
  })

  it('terminates the track with a delta byte before the meta event', () => {
    const bytes = buildMidiFile([{ midi: 60, tickOn: 0, tickOff: 480 }], 120)
    expect([...(bytes as Uint8Array).slice(-4)]).toEqual([0x00, 0xff, 0x2f, 0x00])
  })
})
