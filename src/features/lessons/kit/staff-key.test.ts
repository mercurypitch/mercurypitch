// ============================================================
// Key signature tests — each sign's place in each clef, its spacing, and the notes it covers
// ============================================================
//
// Lesson 21's key signatures (WEB-SPEC, Toys 2; FACTS 15 to 21): the orders
// of sharps and flats, each sign's line or space in the treble and bass
// clefs, the signature drawn just past the clef and spaced as the app's
// notation library spaces it, a note its letter covers written with no sign
// of its own, a sign lit with the note it covers, and the words a reader
// hears.

import { describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import { majorScale } from './major-scale'
import type { Spelled } from './notes'
import type { Mark, Scene } from './staff-draw'
import { drawScene, emptyScene, keySpaces, layoutScene } from './staff-draw'
import { NOTO_GLYPHS } from './staff-glyphs'
import type { KeySig } from './staff-key'
import { covered, FLAT_ORDER, keyAlter, keyLetters, keyOfScale, keyPlaces, keyWords, SHARP_ORDER, } from './staff-key'
import type { Clef } from './staff-places'
import { noteAt, placeRange } from './staff-places'

const SIZE = { w: 356, h: 310 }

const sharps = (count: number): KeySig => ({ sign: 'sharp', count })
const flats = (count: number): KeySig => ({ sign: 'flat', count })

const note = (
  letter: Spelled['letter'],
  alter: number,
  octave: number,
): Spelled => ({
  letter,
  alter,
  octave,
})

function figure(): SVGSVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  document.body.replaceChildren(el)
  return el
}

/** One staff in `clef` with `marks` on it, and whatever else `over` sets. */
function staff(
  clef: Clef,
  marks: readonly Mark[] = [],
  over: Partial<Scene> = {},
): Scene {
  return { ...emptyScene(clef, placeRange(clef)), marks, ...over }
}

/** Each sign's glyph origin, from its transform: "translate(x y) scale(k)". */
function signOrigins(el: Element): { x: number; y: number }[] {
  return Array.from(el.querySelectorAll('.st-keysign'), (s) => {
    const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(
      s.getAttribute('transform') ?? '',
    )
    return { x: Number(m?.[1]), y: Number(m?.[2]) }
  })
}

describe('the orders and the places', () => {
  it('takes the sharps F, C, G, D, A, E, B and the flats the same backwards', () => {
    // Assert: FACTS 17 and 19
    expect(SHARP_ORDER.join('')).toBe('FCGDAEB')
    expect(FLAT_ORDER.join('')).toBe([...SHARP_ORDER].reverse().join(''))
    expect(keyLetters(sharps(3))).toEqual(['F', 'C', 'G'])
    expect(keyLetters(flats(2))).toEqual(['B', 'E'])
  })

  it('puts each sign on its own letter, at FACTS 21 places in the treble clef', () => {
    // Act
    const sharpPlaces = keyPlaces(sharps(3), 'treble')
    const flatPlaces = keyPlaces(flats(3), 'treble')

    // Assert: F sharp on the top line, C sharp in the third space, G sharp in
    // the space above; B flat on the middle line, E flat in the top space, A
    // flat in the second space
    expect(sharpPlaces).toEqual([8, 5, 9])
    expect(flatPlaces).toEqual([4, 7, 3])
    expect(sharpPlaces.map((p) => noteAt(p, 'treble').letter)).toEqual([
      'F',
      'C',
      'G',
    ])
    expect(flatPlaces.map((p) => noteAt(p, 'treble').letter)).toEqual([
      'B',
      'E',
      'A',
    ])
  })

  it('sets every sign of the bass clef a line lower than the treble clef sets it, on the same letter', () => {
    for (const key of [sharps(3), flats(3)]) {
      // Act
      const bass = keyPlaces(key, 'bass')
      const treble = keyPlaces(key, 'treble')

      // Assert: F sharp on the fourth line, C sharp in the second space, G
      // sharp in the top space; B flat on the second line, E flat in the
      // third space, A flat in the bottom space
      expect(bass).toEqual(treble.map((p) => p - 2))
      expect(bass.map((p) => noteAt(p, 'bass').letter)).toEqual(keyLetters(key))
    }
    expect(keyPlaces(sharps(3), 'bass')).toEqual([6, 3, 7])
    expect(keyPlaces(flats(3), 'bass')).toEqual([2, 5, 1])
  })
})

describe('the notes a signature covers', () => {
  it('gives its letters their sign, in every octave, and leaves the rest plain', () => {
    // Assert: FACTS 15
    expect(keyAlter(sharps(2), 'C')).toBe(1)
    expect(keyAlter(sharps(2), 'G')).toBe(0)
    expect(keyAlter(flats(1), 'B')).toBe(-1)
    expect(covered(note('F', 1, 2), sharps(1))).toBe(true)
    expect(covered(note('F', 1, 5), sharps(1))).toBe(true)
    expect(covered(note('A', 1, 4), flats(1))).toBe(false)
    expect(covered(note('B', -1, 4), sharps(3))).toBe(false)
    expect(covered(note('G', 0, 4), sharps(1))).toBe(false)
  })

  it('reads each key the page shows from its scale: G, D and A major one to three sharps, F, B flat and E flat major one to three flats', () => {
    // Arrange: MIDI tonics
    const keys: readonly [number, KeySig][] = [
      [60, sharps(0)],
      [67, sharps(1)],
      [62, sharps(2)],
      [69, sharps(3)],
      [65, flats(1)],
      [70, flats(2)],
      [63, flats(3)],
    ]

    for (const [tonic, key] of keys) {
      // Act
      const got = keyOfScale(majorScale(tonic))

      // Assert: FACTS 25
      expect(got).toEqual(key)
    }
  })

  it('says a signature in words, every sign named', () => {
    // Assert: WEB-SPEC, Toys 2
    expect(keyWords(sharps(2))).toBe(
      'Key signature: two sharps, F sharp and C sharp',
    )
    expect(keyWords(sharps(1))).toBe('Key signature: one sharp, F sharp')
    expect(keyWords(flats(3))).toBe(
      'Key signature: three flats, B flat, E flat and A flat',
    )
    expect(keyWords(sharps(0))).toBe('No key signature')
  })
})

describe('a signature drawn', () => {
  it('draws one sign a letter, each at its place, just past the clef', () => {
    for (const clef of ['treble', 'bass'] as const) {
      for (const key of [sharps(3), flats(3)]) {
        // Arrange
        const el = figure()

        // Act
        const L = drawScene(el, staff(clef, [], { key }), SIZE)

        // Assert: an accidental's optical centre sits on its line or space
        const k = L.space / NOTO_GLYPHS.space
        const ys = signOrigins(el).map((o) => o.y - NOTO_GLYPHS.head.cy * k)
        expect(ys).toHaveLength(3)
        keyPlaces(key, clef).forEach((place, i) =>
          expect(ys[i]).toBeCloseTo(L.yOf(place), 1),
        )
      }
    }
  })

  it('spaces the signs as the notation library does: each its own width and a tenth of a space after the last', () => {
    for (const [key, width] of [
      [sharps(3), NOTO_GLYPHS.sharp],
      [flats(3), NOTO_GLYPHS.flat],
    ] as const) {
      // Arrange
      const el = figure()

      // Act
      const L = drawScene(el, staff('treble', [], { key }), SIZE)

      // Assert
      const xs = signOrigins(el).map((o) => o.x)
      const step = ((width - 50) / NOTO_GLYPHS.space + 0.1) * L.space
      expect(xs[1] - xs[0]).toBeCloseTo(step, 1)
      expect(xs[2] - xs[1]).toBeCloseTo(step, 1)
      // the first sign's left edge is where a note would start with none
      const left = xs[0] + 50 * (L.space / NOTO_GLYPHS.space)
      expect(left).toBeCloseTo(L.x0 + 3.6 * L.space, 1)
    }
  })

  it('writes a note its signature covers with no sign, and one it does not with its own', () => {
    // Arrange: G major's F sharp, and an A sharp under one flat
    const fSharp: Mark = { note: note('F', 1, 5), col: 0, tone: 'rest' }
    const aSharp: Mark = { note: note('A', 1, 4), col: 1, tone: 'rest' }
    const plain = figure()
    drawScene(plain, staff('treble', [fSharp], { cols: 2 }), SIZE)
    const keyed = figure()
    drawScene(
      keyed,
      staff('treble', [fSharp], { cols: 2, key: sharps(1) }),
      SIZE,
    )
    const flat = figure()

    // Act
    drawScene(flat, staff('treble', [aSharp], { cols: 2, key: flats(1) }), SIZE)

    // Assert: the signature's own signs carry `st-keysign`
    expect(plain.querySelectorAll('.st-sign').length).toBe(1)
    expect(keyed.querySelectorAll('.st-sign:not(.st-keysign)').length).toBe(0)
    expect(flat.querySelectorAll('.st-sign:not(.st-keysign)').length).toBe(1)
  })

  it("lights the sign a sounding note takes from the signature, in that note's tone, and no other", () => {
    // Arrange: D major's two sharps, its C sharp sounding
    const cSharp: Mark = { note: note('C', 1, 5), col: 0, tone: 'orange' }
    const el = figure()

    // Act
    drawScene(
      el,
      staff('treble', [cSharp], {
        key: sharps(2),
        keyLit: { sign: 1, tone: 'orange' },
      }),
      SIZE,
    )

    // Assert
    const lit = Array.from(el.querySelectorAll('.st-keysign'), (s) =>
      s.classList.contains('is-orange'),
    )
    expect(lit).toEqual([false, true])
  })

  it('starts the notes past the signature, and keeps them put as it grows within the room asked for', () => {
    // Arrange
    const bare = layoutScene(SIZE.w, SIZE.h, staff('treble', [], { cols: 8 }))
    const one = layoutScene(
      SIZE.w,
      SIZE.h,
      staff('treble', [], { cols: 8, key: sharps(1), keyRoom: 3 }),
    )

    // Act
    const three = layoutScene(
      SIZE.w,
      SIZE.h,
      staff('treble', [], { cols: 8, key: sharps(3), keyRoom: 3 }),
    )

    // Assert
    expect(one.colX(0) / one.space).toBeGreaterThan(bare.colX(0) / bare.space)
    expect(three.colX(0)).toBeCloseTo(one.colX(0), 5)
    expect(three.space).toBeCloseTo(one.space, 5)
    expect(keySpaces(staff('treble'))).toBe(0)
    expect(keySpaces(staff('treble', [], { keyRoom: 3 }))).toBeGreaterThan(3)
  })

  it('draws no signature on the grand staff, or with no clef', () => {
    // Arrange
    const grand = figure()
    drawScene(
      grand,
      { ...emptyScene('grand', placeRange('grand')), key: sharps(2) },
      SIZE,
    )
    const bare = figure()

    // Act
    drawScene(bare, staff('treble', [], { key: sharps(2), noClef: true }), SIZE)

    // Assert
    expect(grand.querySelectorAll('.st-keysign').length).toBe(0)
    expect(bare.querySelectorAll('.st-keysign').length).toBe(0)
  })

  it('fades in the signs that have just joined, or moves the one a note carried', () => {
    // Arrange
    const fading = figure()
    drawScene(
      fading,
      staff('treble', [], { key: sharps(3), keyFresh: 2 }),
      SIZE,
    )
    const fSharp: Mark = { note: note('F', 1, 5), col: 6, tone: 'rest' }
    const moving = figure()

    // Act: Step 1's F sharp, from the seventh note into G major's signature
    drawScene(
      moving,
      staff('treble', [fSharp], {
        cols: 8,
        key: sharps(1),
        keyFresh: 0,
        keyFrom: 6,
      }),
      SIZE,
    )

    // Assert
    const fresh = Array.from(fading.querySelectorAll('.st-keysign'), (s) =>
      s.classList.contains('is-fresh'),
    )
    expect(fresh).toEqual([false, false, true])
    expect(moving.querySelectorAll('.st-keysign-move .st-keysign').length).toBe(
      1,
    )
    expect(moving.querySelectorAll('.st-keysign.is-fresh').length).toBe(0)
  })

  it('rings an outlined note, its sign inside the ring', () => {
    // Arrange
    const el = figure()

    // Act: Spell it's A sharp
    drawScene(
      el,
      staff('treble', [
        { note: note('A', 1, 4), col: 0, tone: 'rest', outline: true },
      ]),
      SIZE,
    )

    // Assert
    const ring = el.querySelector('.st-outline')
    const sign = el.querySelector('.st-sign')
    expect(ring).not.toBeNull()
    expect(sign).not.toBeNull()
    const m = /translate\(([-\d.]+) /.exec(
      sign?.getAttribute('transform') ?? '',
    )
    expect(Number(m?.[1])).toBeGreaterThan(Number(ring?.getAttribute('x')))
  })
})
