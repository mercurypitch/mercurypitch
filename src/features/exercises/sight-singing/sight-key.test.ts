import { describe, expect, it } from 'vitest'
import { signName } from '../note-reading/staff-kit'
import { keyForPhrase, keyLabel, scaleSteps, sightKey, spellIn, syllableIn, triadOf, } from './sight-key'

/** A note's name as the staff writes it, in a key: "G♯4". */
const written = (keyName: string, scale: string, midi: number): string =>
  signName(spellIn(sightKey(keyName, scale), midi))

/** The syllables of `midis` in a key, each as the staff spells it. */
const syllables = (
  keyName: string,
  scale: string,
  midis: readonly number[],
): string[] => {
  const key = sightKey(keyName, scale)
  return midis.map((m) => syllableIn(key, spellIn(key, m)))
}

describe("Sight-Singing's key", () => {
  it('spells A harmonic minor a letter a step, its seventh G sharp and never A flat', () => {
    // Arrange
    const notes = [57, 59, 60, 62, 64, 65, 68]

    // Act
    const names = notes.map((m) => written('A', 'harmonic-minor', m))

    // Assert
    expect(names).toEqual(['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G♯4'])
    expect(sightKey('A', 'harmonic-minor').sig.count).toBe(0)
  })

  it('sings minor do-based, as the lessons do: A harmonic minor is do re me fa so le ti', () => {
    expect(
      syllables('A', 'harmonic-minor', [57, 59, 60, 62, 64, 65, 68]),
    ).toEqual(['do', 're', 'me', 'fa', 'so', 'le', 'ti'])
    expect(syllables('A', 'natural-minor', [65, 67])).toEqual(['le', 'te'])
    expect(syllables('A', 'melodic-minor', [66, 68])).toEqual(['la', 'ti'])
  })

  it('writes a minor key with its relative major signature: C minor has three flats and a harmonic B natural', () => {
    const key = sightKey('C', 'harmonic-minor')

    expect(key.sig).toEqual({ sign: 'flat', count: 3 })
    expect(written('C', 'harmonic-minor', 63)).toBe('E♭4')
    expect(written('C', 'harmonic-minor', 68)).toBe('A♭4')
    expect(written('C', 'harmonic-minor', 71)).toBe('B4')
  })

  it('spells the black keys by the key: B flat in F, F sharp in G, E flat in B flat', () => {
    expect(written('F', 'major', 70)).toBe('B♭4')
    expect(written('G', 'major', 66)).toBe('F♯4')
    expect(written('Bb', 'major', 63)).toBe('E♭4')
    expect(written('Db', 'major', 66)).toBe('G♭4')
    expect(sightKey('Bb', 'major').sig).toEqual({ sign: 'flat', count: 2 })
  })

  it('writes a do its signature would need a double sign for under the pitch’s other name', () => {
    // D sharp major would need F double sharp and C double sharp; G flat
    // minor B double flat.
    expect(sightKey('D#', 'major').name).toBe('E♭')
    expect(sightKey('D#', 'major').sig).toEqual({ sign: 'flat', count: 3 })
    expect(sightKey('Gb', 'natural-minor').name).toBe('F♯')
    expect(sightKey('Gb', 'natural-minor').sig).toEqual({
      sign: 'sharp',
      count: 3,
    })
  })

  it('keeps a key of seven signs, a real one: C sharp major and A flat minor', () => {
    expect(sightKey('C#', 'major').sig).toEqual({ sign: 'sharp', count: 7 })
    expect(sightKey('Ab', 'natural-minor').sig).toEqual({
      sign: 'flat',
      count: 7,
    })
  })

  it('takes a sharp for a note outside a key with sharps or none, and a flat in a key with flats', () => {
    expect(written('C', 'major', 61)).toBe('C♯4')
    expect(written('G', 'major', 63)).toBe('D♯4')
    expect(written('F', 'major', 66)).toBe('G♭4')
    // The blues' flat fifth in C, a minor key of three flats.
    expect(written('C', 'blues', 66)).toBe('G♭4')
  })

  it("names a note outside the key by its letter's raised or lowered syllable", () => {
    // Arrange: C major's F sharp, B flat, D flat and G sharp
    const notes = [66, 70, 61, 68]

    // Act
    const sung = syllables('C', 'chromatic', notes)

    // Assert: chromatic in C spells each black key by its sharp
    expect(sung).toEqual(['fi', 'li', 'di', 'si'])
    // B natural in F major: fa raised, never C flat
    expect(syllables('F', 'major', [70, 71])).toEqual(['fa', 'fi'])
    expect(written('F', 'major', 71)).toBe('B4')
    expect(syllables('C', 'major', [70])).toEqual(['li'])
    expect(syllables('Bb', 'major', [68])).toEqual(['te'])
  })

  it('reads the app’s scale types, Scale Runner’s names and a scale the singer built', () => {
    expect(scaleSteps('minor')).toEqual([0, 2, 3, 5, 7, 8, 10])
    expect(scaleSteps('pentatonic')).toEqual([0, 2, 4, 7, 9])
    expect(scaleSteps('custom:Triad:C,E,G')).toEqual([0, 4, 7])
    expect(scaleSteps('no-such-scale')).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(keyLabel(sightKey('A', 'minor'))).toBe('A minor')
    expect(keyLabel(sightKey('Bb', 'pentatonic'))).toBe('B♭ major pentatonic')
    expect(keyLabel(sightKey('D', 'custom:Triad:C,E,G'))).toBe('D Triad')
  })

  it('reads a key name it cannot make out as C', () => {
    expect(keyLabel(sightKey('H', 'major'))).toBe('C major')
  })

  it("plays do's triad with the scale's own third and fifth", () => {
    expect(triadOf(sightKey('G', 'major'))).toEqual([0, 4, 7])
    expect(triadOf(sightKey('A', 'harmonic-minor'))).toEqual([0, 3, 7])
    expect(triadOf(sightKey('B', 'locrian'))).toEqual([0, 3, 6])
  })
})

describe('the key of a phrase a launch names no key for', () => {
  it("is the app's key where it holds every note", () => {
    const app = sightKey('C', 'major')

    expect(keyForPhrase([64, 64, 65, 67, 67, 65, 64, 62], app)).toBe(app)
  })

  it('is otherwise the major key that holds them, do on the last note first', () => {
    // Ode to Joy's opening, in C, while the Singing tab is set to D major
    const app = sightKey('D', 'major')

    const key = keyForPhrase([64, 64, 65, 67, 67, 65, 64, 62, 60], app)

    expect(keyLabel(key)).toBe('C major')
    // A line with an F sharp ending on G is in G.
    expect(
      keyLabel(keyForPhrase([67, 69, 71, 66, 67], sightKey('C', 'major'))),
    ).toBe('G major')
  })

  it("is the app's key where no major key holds the phrase, its strangers signed", () => {
    const app = sightKey('C', 'major')

    expect(keyForPhrase([60, 61, 62, 63, 64], app)).toBe(app)
  })
})
