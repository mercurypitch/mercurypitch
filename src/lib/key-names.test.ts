import { describe, expect, it } from 'vitest'
import { isMinorScaleType, keyDisplayName, keyNameFor, keyPitchClass, keysFor, keySpelling, keyUsesFlats, MAJOR_KEYS, MINOR_KEYS, parseKeyName, signatureKeyFor, } from '@/lib/key-names'
import { KEY_OFFSETS, KEY_SIGNATURES } from '@/lib/scale-data'

/** A key's notes as it writes them, from do up: "F# G# A# B C# D# E#". */
function written(key: string, scaleType: string, steps: number[]): string {
  const spelling = keySpelling(key, scaleType)
  const do_ = keyPitchClass(key) ?? 0
  const sign = (alter: number): string =>
    alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter)
  return steps
    .map((step) => spelling[(do_ + step) % 12])
    .map((s) => `${s.letter}${sign(s.alter)}`)
    .join(' ')
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10]
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11]

describe('the twelve keys', () => {
  it('lists the major keys round the circle: seven by sharps, then five by flats', () => {
    expect(MAJOR_KEYS).toEqual('C G D A E B F# F Bb Eb Ab Db'.split(' '))
    expect(MAJOR_KEYS.map((key) => KEY_SIGNATURES[key])).toEqual([
      { sharps: 0, flats: 0 },
      { sharps: 1, flats: 0 },
      { sharps: 2, flats: 0 },
      { sharps: 3, flats: 0 },
      { sharps: 4, flats: 0 },
      { sharps: 5, flats: 0 },
      { sharps: 6, flats: 0 },
      { sharps: 0, flats: 1 },
      { sharps: 0, flats: 2 },
      { sharps: 0, flats: 3 },
      { sharps: 0, flats: 4 },
      { sharps: 0, flats: 5 },
    ])
  })

  it("lists each minor key in its relative major's place, a minor third below it", () => {
    expect(MINOR_KEYS).toEqual('A E B F# C# G# D# D G C F Bb'.split(' '))
    MINOR_KEYS.forEach((minor, i) => {
      expect(((keyPitchClass(minor) ?? 0) + 3) % 12, minor).toBe(
        keyPitchClass(MAJOR_KEYS[i]),
      )
    })
  })

  it('names every pitch once on each list, by a name the offsets table knows', () => {
    for (const keys of [MAJOR_KEYS, MINOR_KEYS]) {
      expect(new Set(keys.map(keyPitchClass)).size).toBe(12)
      for (const key of keys) {
        expect(KEY_OFFSETS[key], key).toBe(keyPitchClass(key))
      }
    }
  })

  it('offers the minor list for the minor scales and the major list for every other', () => {
    for (const minor of [
      'natural-minor',
      'harmonic-minor',
      'melodic-minor',
      'pentatonic-minor',
      'minor',
    ]) {
      expect(isMinorScaleType(minor), minor).toBe(true)
      expect(keysFor(minor)[0]).toBe('A')
    }
    for (const other of [
      'major',
      'dorian',
      'blues',
      'chromatic',
      'custom:x:C,D',
    ]) {
      expect(isMinorScaleType(other), other).toBe(false)
      expect(keysFor(other)[0]).toBe('C')
    }
  })
})

describe('parseKeyName', () => {
  it('reads a letter with an ASCII or a real sign, in any case', () => {
    expect(parseKeyName('Bb')).toEqual({ letter: 'B', alter: -1 })
    expect(parseKeyName('B♭')).toEqual({ letter: 'B', alter: -1 })
    expect(parseKeyName('f#')).toEqual({ letter: 'F', alter: 1 })
    expect(parseKeyName(' F♯ ')).toEqual({ letter: 'F', alter: 1 })
    expect(parseKeyName('G')).toEqual({ letter: 'G', alter: 0 })
  })

  it('reads no key in a word that is not one', () => {
    for (const word of ['', 'H', 'Am', 'B flat', 'C##', 'constructor']) {
      expect(parseKeyName(word), word).toBeNull()
    }
  })
})

describe('keyNameFor', () => {
  it('keeps a name that is on the list of its scale type', () => {
    for (const key of MAJOR_KEYS) expect(keyNameFor(key, 'major')).toBe(key)
    for (const key of MINOR_KEYS) {
      expect(keyNameFor(key, 'harmonic-minor')).toBe(key)
    }
  })

  it("reads an old stored name as the same pitch's name on the list", () => {
    // The library's form stored sharps, and the phone's picker every name
    // in the offsets table.
    expect(keyNameFor('A#', 'major')).toBe('Bb')
    expect(keyNameFor('D#', 'major')).toBe('Eb')
    expect(keyNameFor('G#', 'major')).toBe('Ab')
    expect(keyNameFor('C#', 'major')).toBe('Db')
    expect(keyNameFor('Gb', 'major')).toBe('F#')
    expect(keyNameFor('Cb', 'major')).toBe('B')
    expect(keyNameFor('B#', 'major')).toBe('C')
    expect(keyNameFor('Fb', 'major')).toBe('E')
    expect(keyNameFor('E#', 'major')).toBe('F')
  })

  it('reads every name the offsets table holds as a name at the same offset', () => {
    for (const [name, offset] of Object.entries(KEY_OFFSETS)) {
      for (const scaleType of ['major', 'natural-minor']) {
        expect(KEY_OFFSETS[keyNameFor(name, scaleType)], name).toBe(offset)
      }
    }
  })

  it('names a do from the minor list once the scale is minor', () => {
    expect(keyNameFor('Ab', 'natural-minor')).toBe('G#')
    expect(keyNameFor('Db', 'harmonic-minor')).toBe('C#')
    expect(keyNameFor('Eb', 'melodic-minor')).toBe('D#')
    expect(keyNameFor('G#', 'major')).toBe('Ab')
    // The same do, never the relative key: C under a minor scale is C minor.
    expect(keyNameFor('C', 'natural-minor')).toBe('C')
    expect(keyNameFor('A', 'natural-minor')).toBe('A')
  })

  it('reads a name that is no key as C, as the offsets table always did', () => {
    expect(keyNameFor('', 'major')).toBe('C')
    expect(keyNameFor('H', 'natural-minor')).toBe('C')
  })
})

describe('keyDisplayName', () => {
  it('shows a flat or a sharp with its real sign', () => {
    expect(MAJOR_KEYS.map(keyDisplayName).join(' ')).toBe(
      'C G D A E B F♯ F B♭ E♭ A♭ D♭',
    )
    expect(MINOR_KEYS.map(keyDisplayName).join(' ')).toBe(
      'A E B F♯ C♯ G♯ D♯ D G C F B♭',
    )
  })

  it('leaves a word that is no key as it stands', () => {
    expect(keyDisplayName('rest')).toBe('rest')
  })
})

describe('signatureKeyFor', () => {
  it("gives a major key its own signature and a minor key its relative major's", () => {
    expect(signatureKeyFor('F#', 'major')).toBe('F#')
    expect(signatureKeyFor('Db', 'major')).toBe('Db')
    expect(
      MINOR_KEYS.map((key) => signatureKeyFor(key, 'natural-minor')),
    ).toEqual(MAJOR_KEYS)
  })

  it('never asks for more than six signs, whatever name the key came by', () => {
    for (const name of Object.keys(KEY_OFFSETS)) {
      for (const scaleType of ['major', 'harmonic-minor', 'dorian']) {
        const sig = KEY_SIGNATURES[signatureKeyFor(name, scaleType)]
        expect(sig.sharps + sig.flats, `${name} ${scaleType}`).toBeLessThan(7)
      }
    }
    // D sharp minor is F sharp major's relative, six sharps, where the old
    // table fell through to E flat major's three flats.
    expect(signatureKeyFor('D#', 'natural-minor')).toBe('F#')
    expect(signatureKeyFor('G#', 'natural-minor')).toBe('B')
  })

  it('says which keys are written in flats', () => {
    expect(MAJOR_KEYS.filter((key) => keyUsesFlats(key, 'major'))).toEqual([
      'F',
      'Bb',
      'Eb',
      'Ab',
      'Db',
    ])
    expect(
      MINOR_KEYS.filter((key) => keyUsesFlats(key, 'natural-minor')),
    ).toEqual(['D', 'G', 'C', 'F', 'Bb'])
  })
})

describe('keySpelling', () => {
  it("writes each major key's notes a letter apart", () => {
    expect(written('C', 'major', MAJOR)).toBe('C D E F G A B')
    expect(written('F#', 'major', MAJOR)).toBe('F# G# A# B C# D# E#')
    expect(written('B', 'major', MAJOR)).toBe('B C# D# E F# G# A#')
    expect(written('F', 'major', MAJOR)).toBe('F G A Bb C D E')
    expect(written('Db', 'major', MAJOR)).toBe('Db Eb F Gb Ab Bb C')
  })

  it("writes each minor key's notes a letter apart", () => {
    expect(written('A', 'natural-minor', NATURAL_MINOR)).toBe('A B C D E F G')
    expect(written('D#', 'natural-minor', NATURAL_MINOR)).toBe(
      'D# E# F# G# A# B C#',
    )
    expect(written('Bb', 'natural-minor', NATURAL_MINOR)).toBe(
      'Bb C Db Eb F Gb Ab',
    )
  })

  it("keeps a minor key's leading note on its seventh letter", () => {
    expect(written('A', 'harmonic-minor', HARMONIC_MINOR)).toBe(
      'A B C D E F G#',
    )
    // A sharp in a key of flats, and a double sharp.
    expect(written('D', 'harmonic-minor', HARMONIC_MINOR)).toBe(
      'D E F G A Bb C#',
    )
    expect(written('G#', 'harmonic-minor', HARMONIC_MINOR)).toBe(
      'G# A# B C# D# E F##',
    )
  })

  it('uses every letter once for the seven notes of all twenty-four keys', () => {
    for (const [keys, scaleType, steps] of [
      [MAJOR_KEYS, 'major', MAJOR],
      [MINOR_KEYS, 'natural-minor', NATURAL_MINOR],
    ] as const) {
      for (const key of keys) {
        const letters = written(key, scaleType, [...steps])
          .split(' ')
          .map((note) => note[0])
        expect(new Set(letters).size, `${key} ${scaleType}`).toBe(7)
      }
    }
  })

  it('writes a note outside the key as a flat in a key of flats and a sharp otherwise', () => {
    const outside = (key: string): string => written(key, 'major', [1, 3, 6])
    expect(outside('C')).toBe('C# D# F#')
    expect(outside('F')).toBe('Gb Ab B')
    expect(outside('G')).toBe('G# A# C#')
  })
})
