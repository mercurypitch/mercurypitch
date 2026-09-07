// Unified song import tests protect classification without loading an authored-song parser.
// ============================================================

import { describe, expect, it } from 'vitest'
import { classifyUnifiedSongImport, isGuitarProSongFile, isMidiSongFile, referenceAcceptForDevice, songImportAcceptForDevice, UNIFIED_SONG_IMPORT_ACCEPT, } from './song-import'

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

describe('songImportAcceptForDevice', () => {
  it('lists the formats everywhere the Files sheet honours a list', () => {
    const accept = songImportAcceptForDevice({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
      maxTouchPoints: 0,
      platform: 'Linux x86_64',
    })
    expect(accept).toContain('.gp5')
    expect(accept).toContain('audio/mpeg')
  })

  it('sends no list on iPhone and iPad, where it greys out Guitar Pro', () => {
    // iOS has no registered type for .gp5, so any `accept` list makes the
    // Files sheet refuse the very files the page is asking for.
    expect(
      songImportAcceptForDevice({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        maxTouchPoints: 5,
        platform: 'iPhone',
      }),
    ).toBeUndefined()
    expect(
      songImportAcceptForDevice({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        maxTouchPoints: 5,
        platform: 'MacIntel',
      }),
    ).toBeUndefined()
  })
})

describe('referenceAcceptForDevice', () => {
  const IPHONE = {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    maxTouchPoints: 5,
    platform: 'iPhone',
  }
  const LINUX = {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
    maxTouchPoints: 0,
    platform: 'Linux x86_64',
  }

  it('lists MIDI and Guitar Pro where the picker honours a list', () => {
    const accept = referenceAcceptForDevice(LINUX)
    expect(accept).toContain('.gp5')
    expect(accept).toContain('.mid')
  })

  it('sends no list on an Apple touch device', () => {
    // Drum Night's picker is for authored scores, so an accept list there
    // greys out every Guitar Pro file it exists to open — the same defect
    // Guitar Night had.
    expect(referenceAcceptForDevice(IPHONE)).toBeUndefined()
  })
})
