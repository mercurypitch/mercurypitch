// Unified song import tests protect classification without loading an authored-song parser.
// ============================================================

import { describe, expect, it } from 'vitest'
import { classifyUnifiedSongImport, isGuitarProSongFile, isMidiSongFile, UNIFIED_SONG_IMPORT_ACCEPT, } from './song-import'

function file(name: string, type = ''): File {
  return new File(['music'], name, { type })
}

describe('unified song import classification', () => {
  it.each([
    ['take.mp3', '', 'audio'],
    ['take.WAV', '', 'audio'],
    ['recording', 'audio/flac', 'audio'],
    ['arrangement.mid', '', 'midi'],
    ['arrangement.MIDI', '', 'midi'],
    ['score.gp', '', 'guitar-pro'],
    ['score.GP5', '', 'guitar-pro'],
    ['score.gpx', '', 'guitar-pro'],
  ] as const)('classifies %s as %s', (name, type, kind) => {
    expect(classifyUnifiedSongImport(file(name, type))).toBe(kind)
  })

  it('stays a classifier rather than guessing unsupported formats', () => {
    expect(classifyUnifiedSongImport(file('score.pdf'))).toBeNull()
    expect(classifyUnifiedSongImport(file('song.m4a'))).toBeNull()
    expect(isMidiSongFile('score.mp3')).toBe(false)
    expect(isGuitarProSongFile('score.gp7')).toBe(false)
  })

  it('provides the complete lightweight picker contract', () => {
    expect(UNIFIED_SONG_IMPORT_ACCEPT).toContain('audio/mpeg')
    expect(UNIFIED_SONG_IMPORT_ACCEPT).toContain('.flac')
    expect(UNIFIED_SONG_IMPORT_ACCEPT).toContain('.mid')
    expect(UNIFIED_SONG_IMPORT_ACCEPT).toContain('.gpx')
  })
})
