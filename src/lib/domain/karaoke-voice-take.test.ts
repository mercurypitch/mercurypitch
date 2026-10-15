// A kept karaoke take is filed under the song's name, dots and all.
import { describe, expect, it } from 'vitest'
import { karaokeThreadTitle } from './karaoke-voice-take'

describe('karaokeThreadTitle', () => {
  it('keeps a dot that belongs to the title', () => {
    expect(karaokeThreadTitle('Mr. Brightside')).toBe('Mr. Brightside')
    expect(karaokeThreadTitle('A.B.C')).toBe('A.B.C')
  })

  it('drops the audio file extension', () => {
    expect(karaokeThreadTitle('Song.mp3')).toBe('Song')
    expect(karaokeThreadTitle('track.final.wav')).toBe('track.final')
  })

  it('names a take with no title', () => {
    expect(karaokeThreadTitle('  ')).toBe('Karaoke take')
    expect(karaokeThreadTitle('.mp3')).toBe('Karaoke take')
  })
})
