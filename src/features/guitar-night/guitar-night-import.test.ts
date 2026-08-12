import { describe, expect, it } from 'vitest'
import { classifyGuitarNightImport, GUITAR_NIGHT_IMPORT_ACCEPT, GUITAR_NIGHT_IMPORT_EMPTY_ERROR, GUITAR_NIGHT_IMPORT_ERROR, guitarNightImportValidationError, } from './guitar-night-import'

function file(name: string, type = '', contents = 'music'): File {
  return new File([contents], name, { type })
}

describe('Guitar Night import contract', () => {
  it.each([
    ['song.mp3', '', 'audio'],
    ['song.WAV', '', 'audio'],
    ['recording', 'audio/flac', 'audio'],
    ['exercise.mid', '', 'midi'],
    ['exercise.MIDI', '', 'midi'],
    ['lesson.gp', '', 'guitar-pro'],
    ['lesson.GP5', '', 'guitar-pro'],
    ['lesson.gpx', '', 'guitar-pro'],
  ] as const)('classifies %s as %s', (name, type, kind) => {
    expect(classifyGuitarNightImport(file(name, type))).toBe(kind)
  })

  it.each(['song.m4a', 'lesson.gp7', 'score.pdf'])('rejects %s', (name) => {
    expect(classifyGuitarNightImport(file(name))).toBeNull()
  })

  it('combines the existing audio and reference picker formats', () => {
    expect(GUITAR_NIGHT_IMPORT_ACCEPT).toContain('audio/mpeg')
    expect(GUITAR_NIGHT_IMPORT_ACCEPT).toContain('.flac')
    expect(GUITAR_NIGHT_IMPORT_ACCEPT).toContain('.mid')
    expect(GUITAR_NIGHT_IMPORT_ACCEPT).toContain('.gp')
    expect(GUITAR_NIGHT_IMPORT_ACCEPT).toContain('.gpx')
  })

  it('returns specific recovery copy for empty and unsupported files', () => {
    expect(guitarNightImportValidationError(file('empty.wav', '', ''))).toBe(
      GUITAR_NIGHT_IMPORT_EMPTY_ERROR,
    )
    expect(guitarNightImportValidationError(file('score.pdf'))).toBe(
      GUITAR_NIGHT_IMPORT_ERROR,
    )
    expect(guitarNightImportValidationError(file('song.mp3'))).toBeNull()
  })
})
