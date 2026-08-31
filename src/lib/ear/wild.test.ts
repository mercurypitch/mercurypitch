import { describe, expect, it } from 'vitest'
import type { WildChord, WildKey, WildNote } from './wild'
import { basslineItems, buildWildBook, degreeOfPitchClass, echoItems, homeItems, numeralOf, pitchClassOfName, solfegeOfDegree, spreadAcross, WILD_DRILLS, WILD_LIMITS, wildBankItem, } from './wild'

const C_MAJOR: WildKey = { tonicPc: 0, mode: 'major', keyName: 'C' }
const A_MINOR: WildKey = { tonicPc: 9, mode: 'minor', keyName: 'A' }

function note(midi: number, startS: number, lengthS: number): WildNote {
  return { midi, startS, endS: startS + lengthS }
}

describe('degrees in the song key', () => {
  it('names the scale and refuses what is off it', () => {
    expect(degreeOfPitchClass(0, C_MAJOR)).toBe(1)
    expect(degreeOfPitchClass(11, C_MAJOR)).toBe(7)
    expect(degreeOfPitchClass(1, C_MAJOR)).toBeNull()
    // A minor: C is the third (Me), G the seventh (Te), G# off the scale.
    expect(degreeOfPitchClass(0, A_MINOR)).toBe(3)
    expect(degreeOfPitchClass(7, A_MINOR)).toBe(7)
    expect(degreeOfPitchClass(8, A_MINOR)).toBeNull()
  })

  it('spells numerals and solfège per mode', () => {
    expect(numeralOf(4, 'major')).toBe('IV')
    expect(numeralOf(6, 'minor')).toBe('VI')
    expect(solfegeOfDegree(3, 'minor')).toBe('Me')
    expect(solfegeOfDegree(7, 'major')).toBe('Ti')
    expect(pitchClassOfName('F#')).toBe(6)
    expect(pitchClassOfName('Bb')).toBe(10)
    expect(pitchClassOfName('H')).toBeNull()
  })

  it('spreads a long list evenly, keeping order', () => {
    const picked = spreadAcross([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 4)
    expect(picked).toEqual([0, 2, 5, 7])
    expect(spreadAcross([1, 2], 4)).toEqual([1, 2])
  })
})

describe('items from a song', () => {
  it('landings are held on-scale notes with a lead-in ending on them', () => {
    const notes = [
      note(60, 0, 0.2), // too short
      note(64, 1, 0.6), // Mi, held
      note(61, 2, 0.8), // Db — off the scale
      note(67, 4, 0.5), // Sol, held
    ]
    const items = homeItems(notes, C_MAJOR, 's1')
    expect(items.map((item) => item.degree)).toEqual([3, 5])
    expect(items[0].startS).toBe(0)
    expect(items[0].endS).toBeCloseTo(1.6 + WILD_LIMITS.homeTailS, 3)
    expect(items[1].startS).toBeCloseTo(4.5 - WILD_LIMITS.homeLeadS, 3)
    expect(items[0].itemId).toBe('wild:s1:home:0')
  })

  it('phrases are runs of close on-scale notes, three to six long', () => {
    const notes = [
      note(60, 0, 0.3),
      note(62, 0.35, 0.3),
      note(64, 0.7, 0.3), // Do Re Mi
      note(65, 2, 0.3), // a gap of over half a second starts a new run
      note(67, 2.35, 0.3),
      note(61, 2.7, 0.3), // off the scale: ends the run at two notes
      note(69, 3.1, 0.3),
    ]
    const items = echoItems(notes, C_MAJOR, 's1')
    expect(items).toHaveLength(1)
    expect(items[0].degrees).toEqual([1, 2, 3])
    expect(items[0].startS).toBe(0)
    expect(items[0].endS).toBeCloseTo(1 + WILD_LIMITS.phraseTailS, 3)
    expect(items[0].onsetsS).toEqual([0, 0.35, 0.7])
  })

  it('a long run is cut into pieces of at most six', () => {
    const notes = Array.from({ length: 9 }, (_, i) =>
      note(60 + [0, 2, 4, 5, 7, 9, 11, 12, 14][i], i * 0.4, 0.3),
    )
    const items = echoItems(notes, C_MAJOR, 's1')
    expect(items.map((item) => item.degrees.length)).toEqual([6, 3])
    expect(items[1].degrees).toEqual([7, 1, 2])
  })

  it('root motions need two held on-scale roots that differ', () => {
    const chords: WildChord[] = [
      { rootPc: 0, startS: 0, endS: 4 }, // C
      { rootPc: 5, startS: 4, endS: 8 }, // F
      { rootPc: 5, startS: 8, endS: 9 }, // F again — no motion
      { rootPc: 7, startS: 9, endS: 9.3 }, // G, too short
      { rootPc: 9, startS: 9.3, endS: 12 }, // A
    ]
    const items = basslineItems(chords, C_MAJOR, 's1')
    expect(items.map((item) => [item.fromDegree, item.toDegree])).toEqual([
      [1, 4],
    ])
    expect(items[0].startS).toBe(2)
    expect(items[0].endS).toBe(6)
    expect(items[0].switchS).toBe(2)
  })

  it('the book sorts the notes and names the bank items', () => {
    const book = buildWildBook(
      's1',
      [note(64, 1, 0.6), note(60, 0, 0.6)],
      [
        { rootPc: 0, startS: 0, endS: 2 },
        { rootPc: 7, startS: 2, endS: 4 },
      ],
      C_MAJOR,
    )
    expect(book.home.map((item) => item.degree)).toEqual([1, 3])
    expect(book.bassline[0]).toMatchObject({ fromDegree: 1, toDegree: 5 })
    const bass = wildBankItem(book.bassline[0], 'major')
    expect(bass.label).toBe('I–V')
    expect(bass.name).toBe('I to V')
    const home = wildBankItem(book.home[1], 'major')
    expect(home).toMatchObject({ label: '3', name: 'Mi', payload: [3] })
    const echo = wildBankItem(
      {
        kind: 'echo',
        itemId: 'e',
        startS: 0,
        endS: 1,
        degrees: [1, 5, 3],
        midis: [],
        onsetsS: [],
      },
      'minor',
    )
    expect(echo.name).toBe('Do Sol Me')
    expect(echo.seed).toBe(850 + 40 * 4)
  })
})

describe('the Field Book drills', () => {
  it('borrow the catalogue engines under their own ids and faculty', () => {
    expect(WILD_DRILLS['wild-home']).toMatchObject({
      id: 'wild-home',
      faculty: 'wild',
      choices: 7,
    })
    expect(WILD_DRILLS['wild-echo'].scale).toEqual(
      WILD_DRILLS['wild-home'].scale,
    )
    expect(WILD_DRILLS['wild-bassline'].name).toBe('Bassline in the Wild')
  })
})
