import { describe, expect, it } from 'vitest'
import { DISPLAY_NAME_MAX, foldedWords, hasFilteredWord, hasSlur, nameProblem, providerName, } from './name-filter'

/** Letters written as Unicode escapes: the look-alikes look like letters. */
const chars = (...codes: number[]): string => String.fromCodePoint(...codes)

describe('foldedWords', () => {
  it('reads a name as the words a reader sees', () => {
    expect(foldedWords('BigWord')).toEqual(['big', 'word'])
    expect(foldedWords('f.u.c.k')).toEqual(['fuck'])
    expect(foldedWords('a55')).toEqual(['ass'])
    expect(foldedWords('Ｃａｔ')).toEqual(['cat'])
  })

  it('leaves a number a number', () => {
    expect(foldedWords('Class of 1955')).toEqual(['class', 'of'])
    expect(foldedWords('455')).toEqual([])
    expect(foldedWords('Class of 2 0 2 6')).toEqual(['class', 'of'])
  })

  it('folds look-alike letters, accents and hidden characters', () => {
    expect(foldedWords('аss')).toEqual(['ass'])
    expect(foldedWords('fúck')).toEqual(['fuck'])
    expect(foldedWords('fu​ck')).toEqual(['fuck'])
    expect(foldedWords("don't")).toEqual(['dont'])
  })

  it('keeps a word written in alternating case whole', () => {
    expect(foldedWords('FuCk')).toEqual(['fuck'])
    expect(foldedWords('KissMyAss')).toEqual(['kiss', 'my', 'ass'])
  })

  it('cuts a stretched letter to three', () => {
    expect(foldedWords('fuuuuuuck')).toEqual(['fuuuck'])
  })
})

describe('hasFilteredWord', () => {
  it.each([
    'fuck',
    'FuCk',
    'BiTcH',
    'F.U.C.K',
    'f u c k',
    'ｆｕｃｋ',
    'fμck',
    'fúck',
    'phuck',
    'fvck',
    'fuuuuck',
    'f*ck',
    'Fuckface',
    'a55hole',
    '$h1t',
    'sh!t',
    'Sh1t Singer',
    'BigAss',
    'KissMyAss',
    'a s s',
    'Kiss my ass',
    'аss',
    'fu​ck',
    's.l.u.t',
    's1ut',
    'slutty',
    'raped',
    'cunts',
    'Porn Star',
    'n1gg3r',
    'nígger',
    'niqqa',
    'KKK',
    'Sieg Heil',
    'Singer 1488',
    'kill yourself',
    'K1ll Y0urs3lf',
  ])('refuses %s', (name) => {
    expect(hasFilteredWord(name)).toBe(true)
  })

  it('reads look-alike alphabets as the letters they look like', () => {
    // Small capitals, Cherokee, hooked Latin, negative squared letters.
    const smallCapitals = chars(0xa730, 0x1d1c, 0x1d04, 0x1d0b)
    const cherokee = `${chars(0xabaa)}hit`
    const hooked = `${chars(0x0192)}uck ${chars(0x0282)}hit`
    const squared = chars(0x1f175, 0x1f184, 0x1f172, 0x1f17a)
    for (const name of [smallCapitals, cherokee, hooked, squared]) {
      expect(hasFilteredWord(name)).toBe(true)
    }
  })

  it.each([
    'Maff',
    'Ana-Lucía',
    'Anaïs Dupont',
    'Anais Mitchell',
    'Ana L.',
    'Anna1',
    'Annals of Song',
    'Glass Bass',
    'Scunthorpe Singer',
    'Pakistan Choir',
    'The Therapist',
    'Arsenal fan',
    "Assassin's Creed",
    'Cocky',
    'Joe Cocker',
    'Moby Dick',
    'Dickens',
    'Who Killed Cock Robin',
    'Pussy Cat, Pussy Cat',
    'Peacock',
    'Grape Escape',
    'Analyst',
    'Cumin',
    'Alan Cumming',
    'Magna Cum Laude',
    'Nazir',
    'Spice Girls',
    'Spiced Rum',
    'Class of 2026',
    'Singer 455',
    'Cumberbatch',
    'Shellfish',
    'Yamashita',
    'Kinoshita',
    'Matsushita',
    'Harshita',
    'Kshitij',
    'Siriporn',
    'Pornchai',
    'Aishiteru',
    'Ashita',
    'Shiitake',
    'Push It',
    'Finish It',
    'Josh Ito',
    'Hiroshi Ito',
    'Chris Hitchcock',
    'Christmas Hits',
    'Smash Hits',
    'Who Really Cares',
    'WhoReallyCares',
    'Rabbit Chase',
    'RabbitChase',
    'Coons',
    'Dykes',
    'Van Dyke',
    'Kike Garcia',
    'Fukuoka',
    'Spick and Span',
    'Hello',
  ])('lets %s through', (name) => {
    expect(hasFilteredWord(name)).toBe(false)
  })
})

describe('hasSlur', () => {
  it('lets a crude lyric through, as songs carry them', () => {
    expect(hasSlur('What the fuck is going on\nshit happens')).toBe(false)
  })

  it('refuses one of the worst slurs on any line', () => {
    expect(hasSlur('la la la\nyou n1gger')).toBe(true)
    expect(hasSlur('first line\nsieg heil')).toBe(true)
  })

  it('reads a slur split over two notes as one word', () => {
    expect(hasSlur('you nig ger')).toBe(true)
    expect(hasSlur('fag got')).toBe(true)
  })

  it('lets innocent words and other languages through', () => {
    for (const lyric of [
      'je suis en retard',
      'kys mig',
      'a chink of light',
      'finger in the dyke',
      'snigger',
      'wet back',
      'spick and span',
      'snig\nger',
      'snig ger',
    ]) {
      expect(hasSlur(lyric)).toBe(false)
    }
  })

  it('reads a very long word in time', () => {
    const started = performance.now()
    expect(hasSlur('n'.repeat(250_000))).toBe(false)
    expect(hasSlur('ni'.repeat(125_000))).toBe(false)
    expect(hasSlur('n '.repeat(125_000))).toBe(false)
    expect(performance.now() - started).toBeLessThan(2_000)
  })
})

describe('nameProblem', () => {
  const name = { max: DISPLAY_NAME_MAX }

  it('passes an ordinary name', () => {
    expect(nameProblem('Maff', name)).toBeNull()
  })

  it('asks for something visible', () => {
    expect(nameProblem('', name)).toBe('empty')
    expect(nameProblem('   ', name)).toBe('empty')
    expect(nameProblem('​', name)).toBe('empty')
    expect(nameProblem('', { ...name, optional: true })).toBeNull()
    expect(nameProblem('​​', { ...name, optional: true })).toBe('empty')
  })

  it('caps the length', () => {
    expect(nameProblem('a'.repeat(DISPLAY_NAME_MAX), name)).toBeNull()
    expect(nameProblem('a'.repeat(DISPLAY_NAME_MAX + 1), name)).toBe('too-long')
  })

  it('refuses control characters and direction overrides, optional or not', () => {
    const optional = { ...name, optional: true }
    expect(nameProblem('Ma\nff', name)).toBe('unreadable')
    expect(nameProblem('Ma‮ff', name)).toBe('unreadable')
    expect(nameProblem('‮', optional)).toBe('unreadable')
    expect(nameProblem('\u0000', optional)).toBe('unreadable')
    expect(nameProblem('\r\n', optional)).toBe('unreadable')
    expect(
      nameProblem('Line one\nLine two', { max: 300, multiline: true }),
    ).toBeNull()
  })

  it('refuses a word on the list, in each line of a longer text', () => {
    expect(nameProblem('Fuckface', name)).toBe('words')
    expect(nameProblem('Hello\nshit', { max: 300, multiline: true })).toBe(
      'words',
    )
  })
})

describe('providerName', () => {
  it('keeps a fitting name, clips a long one, and drops a refused one', () => {
    expect(providerName('  Ada Lovelace ')).toBe('Ada Lovelace')
    expect(providerName('Anaïs Dupont')).toBe('Anaïs Dupont')
    expect(providerName('A'.repeat(50))).toBe('A'.repeat(DISPLAY_NAME_MAX))
    expect(providerName('Shit Head')).toBeNull()
    expect(providerName('')).toBeNull()
    expect(providerName(null)).toBeNull()
  })
})
