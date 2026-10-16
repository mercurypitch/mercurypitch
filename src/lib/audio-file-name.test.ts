// A song's name loses its audio file extension and nothing else: the dot in
// "Mr. Brightside" is part of the title.
import { describe, expect, it } from 'vitest'
import { stripAudioExtension } from './audio-file-name'

describe('stripAudioExtension', () => {
  it.each([
    ['Mr. Brightside', 'Mr. Brightside'],
    ['Song.mp3', 'Song'],
    ['A.B.C', 'A.B.C'],
    ['track.final.wav', 'track.final'],
    ['Mr. Brightside.m4a', 'Mr. Brightside'],
    ['LOUD.FLAC', 'LOUD'],
    ['take.Opus', 'take'],
    ['St. Elmo’s Fire.ogg', 'St. Elmo’s Fire'],
    ['live.webm', 'live'],
    ['notes.txt', 'notes.txt'],
    ['.mp3', ''],
  ])('%s reads as %s', (name, title) => {
    expect(stripAudioExtension(name)).toBe(title)
  })
})
