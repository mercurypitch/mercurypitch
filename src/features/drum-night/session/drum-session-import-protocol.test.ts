// Drum session import protocol tests — bounded Worker clone payloads.

import { describe, expect, it } from 'vitest'
import type { GuitarBendPoint } from '@/lib/guitar/guitar-notation'
import type { MidiSong } from '@/lib/midi-song'
import { drumSongFixture, percussionTrackFixture, } from './drum-session.test-fixtures'
import { assertBoundedDrumSessionPayload, MAX_DRUM_SESSION_DETAIL_POINTS, MAX_DRUM_SESSION_TEXT_CHARACTERS, MAX_DRUM_SESSION_TEXT_FIELD_CHARACTERS, } from './drum-session-import-protocol'

describe('assertBoundedDrumSessionPayload', () => {
  it('rejects an oversized authored text field without truncating it', () => {
    const name = 'x'.repeat(MAX_DRUM_SESSION_TEXT_FIELD_CHARACTERS + 1)
    const song = drumSongFixture({
      percussionTracks: [percussionTrackFixture({ name })],
    })

    expect(() => assertBoundedDrumSessionPayload(song)).toThrowError(
      expect.objectContaining({
        name: 'DrumSessionPayloadLimitError',
        kind: 'TEXT_FIELD',
      }),
    )
    expect(song.tracks[0]?.name).toBe(name)
  })

  it('rejects aggregate authored text even when every field is individually safe', () => {
    const name = 'x'.repeat(MAX_DRUM_SESSION_TEXT_FIELD_CHARACTERS)
    const trackCount =
      Math.floor(
        MAX_DRUM_SESSION_TEXT_CHARACTERS /
          MAX_DRUM_SESSION_TEXT_FIELD_CHARACTERS,
      ) + 1
    const song = drumSongFixture({
      percussionTracks: Array.from({ length: trackCount }, (_, index) =>
        percussionTrackFixture({ id: `drums-${index}`, name, hits: [] }),
      ),
    })

    expect(() => assertBoundedDrumSessionPayload(song)).toThrowError(
      expect.objectContaining({
        name: 'DrumSessionPayloadLimitError',
        kind: 'TEXT_TOTAL',
      }),
    )
  })

  it('rejects unbounded bend contours without constructing a partial song', () => {
    const points = {
      length: MAX_DRUM_SESSION_DETAIL_POINTS + 1,
    } as unknown as readonly GuitarBendPoint[]
    const song: MidiSong = {
      bpm: 120,
      tracks: [
        {
          id: 'guitar',
          kind: 'pitched',
          name: 'Guitar',
          instrumentName: 'Electric Guitar',
          noteCount: 1,
          notes: [
            {
              midi: 64,
              startBeat: 0,
              duration: 1,
              notation: {
                techniques: [
                  {
                    kind: 'bend',
                    bendType: 'custom',
                    semitones: 2,
                    points,
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    expect(() => assertBoundedDrumSessionPayload(song)).toThrowError(
      expect.objectContaining({
        name: 'DrumSessionPayloadLimitError',
        kind: 'DETAIL_POINTS',
      }),
    )
    expect(points.length).toBe(MAX_DRUM_SESSION_DETAIL_POINTS + 1)
  })
})
