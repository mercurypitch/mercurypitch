// Studio file picks and drops — the picker offers MIDI files beside audio, and a MIDI file is told from audio by its name, or by its type where its name says nothing, so it goes to the MIDI import and never to the audio decoder.
import { describe, expect, it } from 'vitest'
import { isStudioMidiFile, STUDIO_FILE_ACCEPT } from './drop-audio'

describe('the Studio’s file picker', () => {
  it('offers MIDI files beside the audio it took before', () => {
    const accepted = STUDIO_FILE_ACCEPT.split(',')

    expect(accepted).toEqual(
      expect.arrayContaining([
        'audio/*',
        '.wav',
        '.mp3',
        '.m4a',
        '.ogg',
        '.flac',
        '.mid',
        '.midi',
        'audio/midi',
        'audio/x-midi',
      ]),
    )
  })
})

describe('a MIDI file among picked or dropped files', () => {
  it('is told by its name, whatever its case and whatever type the system gave it', () => {
    expect(isStudioMidiFile({ name: 'song.mid', type: '' })).toBe(true)
    expect(isStudioMidiFile({ name: 'Song.MIDI', type: '' })).toBe(true)
    expect(
      isStudioMidiFile({ name: 'take.mid', type: 'application/octet-stream' }),
    ).toBe(true)
  })

  it('is told by its type where its name says nothing', () => {
    expect(isStudioMidiFile({ name: 'download', type: 'audio/midi' })).toBe(
      true,
    )
    expect(isStudioMidiFile({ name: 'download', type: 'audio/x-midi' })).toBe(
      true,
    )
  })

  it('is never an audio file, or a name that only holds the letters', () => {
    expect(isStudioMidiFile({ name: 'take.wav', type: 'audio/wav' })).toBe(
      false,
    )
    expect(isStudioMidiFile({ name: 'mid.mp3', type: 'audio/mpeg' })).toBe(
      false,
    )
    expect(isStudioMidiFile({ name: 'song.mid.wav', type: '' })).toBe(false)
    expect(isStudioMidiFile({ name: 'pyramid', type: '' })).toBe(false)
  })
})
