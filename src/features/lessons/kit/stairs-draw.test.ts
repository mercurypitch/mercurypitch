// ============================================================
// Staircase painter tests — another scale's risers, names, keys and houses
// ============================================================
//
// What Lesson 20's staircase prints (its WEB-SPEC, Toys 1): each riser's
// size in semitones, 2, 2, 3, 2 and 3 for the major five, where Lesson 4's
// say T and S; each stair's sung name over its letter; the keys named as
// the scale spells them, E♭ and B♭ in the minor five on C; and do's house
// on both do stairs. And Lesson 25's (its WEB-SPEC, Look): le named on
// natural minor's sixth; a stair sliding a semitone keeps its name and its
// riser's size until it lands; the le-to-ti riser outlined with "3" beside
// it. A context that keeps every call stands in for the canvas.

import { describe, expect, it, vi } from 'vitest'
import { HARMONIC_MINOR_DEGREES, NATURAL_MINOR_DEGREES } from './chords'
import { MAJOR_DEGREES } from './major-scale'
import type { StairsScene } from './stairs-draw'
import { paintStairs } from './stairs-draw'
import type { StairsLayout } from './stairs-geometry'
import { stairsLayout } from './stairs-geometry'
import { MAJOR_FIVE, MINOR_FIVE } from './stairs-scales'

const homes = vi.hoisted(() => ({ at: [] as number[] }))

vi.mock('./home-glyph', () => ({
  drawHome: (_ctx: unknown, cx: number) => {
    homes.at.push(cx)
  },
}))

const C3 = 48

interface Text {
  readonly text: string
  readonly x: number
  readonly y: number
  readonly font: string
}

/** A context that keeps the words it is asked to write, with their font, and the rectangles it outlines. */
function wordsContext(
  texts: Text[],
  rects: number[][] = [],
): CanvasRenderingContext2D {
  const props: Record<PropertyKey, unknown> = {}
  return new Proxy(props, {
    get: (target, key) =>
      key in target
        ? target[key]
        : (...args: unknown[]): unknown => {
            if (key === 'strokeRect') rects.push(args.map(Number))
            if (key === 'fillText')
              texts.push({
                text: String(args[0]),
                x: Number(args[1]),
                y: Number(args[2]),
                font: String(target.font),
              })
            if (key === 'measureText') return { width: 0 }
            if (
              key === 'createRadialGradient' ||
              key === 'createLinearGradient'
            )
              return { addColorStop: () => undefined }
            return undefined
          },
    set: (target, key, value: unknown) => {
      target[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

const scene = (o: Partial<StairsScene> = {}): StairsScene => ({
  tonic: C3,
  degrees: MAJOR_FIVE,
  both: true,
  numbers: true,
  names: 'letters',
  steps: true,
  gold: false,
  group: 0,
  groupFlash: [0, 0],
  white: 0,
  whiteFrom: null,
  whiteLit: () => 0,
  light: () => null,
  keyPulse: () => 0,
  waiting: false,
  arrow: 0,
  home: 0,
  ...o,
})

/** One frame on a phone's figure: the layout and the words written. */
function paint(s: StairsScene): { L: StairsLayout; texts: Text[] } {
  const texts: Text[] = []
  homes.at = []
  const L = stairsLayout('narrow', 356, 424, s.tonic, C3, s.degrees)
  paintStairs(wordsContext(texts), L, s, s.tonic)
  return { L, texts }
}

/** The risers' labels, low to high: a size or T or S in the monospaced face (the ruler's note names aside). */
const riserLabels = (texts: readonly Text[]): string[] =>
  texts
    .filter(
      (t) => t.font.includes('JetBrains Mono') && /^[0-9TS]$/.test(t.text),
    )
    .map((t) => t.text)

/** The words written above stair `i`'s tread, top to bottom. */
function namesOver(L: StairsLayout, texts: readonly Text[], i: number) {
  const st = L.stairs[i]
  return texts
    .filter(
      (t) =>
        t.font.includes('Outfit') && t.x === st.x + st.w / 2 && t.y < st.top,
    )
    .sort((a, b) => a.y - b.y)
    .map((t) => t.text)
}

describe("another scale's staircase", () => {
  it.each([
    ['the major five', MAJOR_FIVE, ['2', '2', '3', '2', '3']],
    ['the minor five', MINOR_FIVE, ['3', '2', '2', '3', '2']],
  ] as const)(
    'labels each riser of %s with its size in semitones',
    (_name, degrees, labels) => {
      // Act
      const { texts } = paint(scene({ degrees }))

      // Assert
      expect(riserLabels(texts)).toEqual(labels)
    },
  )

  it("labels Lesson 4's risers T and S, as before", () => {
    // Act
    const { texts } = paint(
      scene({ degrees: MAJOR_DEGREES, numbers: false, both: false }),
    )

    // Assert
    expect(riserLabels(texts)).toEqual(['T', 'T', 'S', 'T', 'T', 'T', 'S'])
  })

  it("prints each stair's sung name over its letter, the minor five on C with its flats", () => {
    // Act
    const { L, texts } = paint(scene({ degrees: MINOR_FIVE }))

    // Assert
    expect(L.stairs.map((_, i) => namesOver(L, texts, i))).toEqual([
      ['do', 'C'],
      ['me', 'E♭'],
      ['fa', 'F'],
      ['so', 'G'],
      ['te', 'B♭'],
      ['do', 'C'],
    ])
  })

  it('names the keys under the stairs as the scale spells them', () => {
    // Act
    const { L, texts } = paint(scene({ degrees: MINOR_FIVE }))
    const strip = L.strip?.spec.top ?? Infinity
    const keyNames = texts.filter((t) => t.y > strip).map((t) => t.text)

    // Assert
    expect(keyNames).toEqual(expect.arrayContaining(['E♭', 'B♭']))
    expect(keyNames).not.toContain('D♯')
  })

  it("draws do's house on both do stairs of a pentatonic, and only there", () => {
    // Act
    const { L } = paint(scene({ degrees: MAJOR_FIVE }))

    // Assert
    expect(homes.at).toEqual(
      [0, 5].map((i) => L.stairs[i].x + L.stairs[i].w / 2),
    )
  })

  it("prints each stair's one name from the scale's own degrees: the minor five on A, sung from do (Lesson 20's words)", () => {
    // Act
    const s = scene({
      tonic: 57,
      degrees: MINOR_FIVE,
      both: false,
      names: 'solfege',
    })
    const { L, texts } = paint(s)

    // Assert
    expect(L.stairs.map((_st, i) => namesOver(L, texts, i))).toEqual([
      ['do'],
      ['me'],
      ['fa'],
      ['so'],
      ['te'],
      ['do'],
    ])
  })

  it("reads the degrees it is given: Lesson 16's five, do to so, keep one house", () => {
    // Act
    const { L } = paint(
      scene({ degrees: MAJOR_DEGREES.slice(0, 5), both: false }),
    )

    // Assert
    expect(homes.at).toEqual([L.stairs[0].x + L.stairs[0].w / 2])
  })
})

describe('a stair that slides, and an outlined riser (Lesson 25)', () => {
  /** One frame of Lesson 25's figure: A minor on A2, over rows A2 to C4, the chord column's room kept. */
  function paintMinor(s: StairsScene): {
    L: StairsLayout
    texts: Text[]
    rects: number[][]
  } {
    const texts: Text[] = []
    const rects: number[][] = []
    homes.at = []
    const L = stairsLayout('compact', 420, 280, s.tonic, 36, s.degrees, {
      right: 104,
      rows: { lo: 45, hi: 60 },
    })
    paintStairs(wordsContext(texts, rects), L, s, s.tonic)
    return { L, texts, rects }
  }

  /** Lesson 25's names: one syllable a stair, each riser's size in semitones. */
  const sung = {
    tonic: 45,
    both: false,
    names: 'solfege',
    numbers: true,
  } as const

  /** Bold, as an outline's label is: the risers' own sizes are not. */
  const bold = (texts: readonly Text[]): Text[] =>
    texts.filter((t) => t.font.startsWith('700'))

  /** The rectangles outlined other than the blocks' own edges, each drawn from its tread. */
  const outlines = (L: StairsLayout, rects: number[][]): number[][] =>
    rects.filter(([, y]) => !L.stairs.some((st) => st.top + 0.5 === y))

  it("names natural minor's sixth le, and sizes its risers 2, 1, 2, 2, 1, 2, 2", () => {
    // Act
    const { L, texts } = paintMinor(
      scene({ ...sung, degrees: NATURAL_MINOR_DEGREES }),
    )

    // Assert
    expect(L.stairs.map((_st, i) => namesOver(L, texts, i))).toEqual([
      ['do'],
      ['re'],
      ['me'],
      ['fa'],
      ['so'],
      ['le'],
      ['te'],
      ['do'],
    ])
    expect(riserLabels(texts)).toEqual(['2', '1', '2', '2', '1', '2', '2'])
  })

  it('names a sliding stair, and sizes its risers, from the stairs it left until it lands', () => {
    // Act: te halfway up to ti
    const { L, texts } = paintMinor(
      scene({
        ...sung,
        degrees: [0, 2, 3, 5, 7, 8, 10.5, 12],
        named: NATURAL_MINOR_DEGREES,
      }),
    )

    // Assert: its tread between the rows, its name and its risers as they were
    expect(L.stairs[6].top).toBeCloseTo(L.yOfRow(55.5) - L.rowH / 2, 9)
    expect(namesOver(L, texts, 6)).toEqual(['te'])
    expect(riserLabels(texts)).toEqual(['2', '1', '2', '2', '1', '2', '2'])
  })

  it('outlines the riser it is given, the higher block from tread to tread, and labels it in bold: harmonic minor\'s le to ti, "3"', () => {
    // Act
    const { L, texts, rects } = paintMinor(
      scene({
        ...sung,
        degrees: HARMONIC_MINOR_DEGREES,
        outline: { riser: 5, label: '3' },
      }),
    )
    const drawn = outlines(L, rects)
    const [, y, w, h] = drawn[0] ?? []

    // Assert
    expect(drawn).toHaveLength(1)
    expect(y).toBeCloseTo(L.stairs[6].top + 0.75, 9)
    expect(y + h).toBeCloseTo(L.stairs[5].top - 0.75, 9)
    expect(w).toBeGreaterThan(0)
    expect(bold(texts).map((t) => t.text)).toEqual(['3'])
    expect(riserLabels(texts.filter((t) => !t.font.startsWith('700')))).toEqual(
      ['2', '1', '2', '2', '1', '3', '1'],
    )
  })

  it('outlines nothing when given no outline', () => {
    // Act
    const { L, texts, rects } = paintMinor(
      scene({ ...sung, degrees: HARMONIC_MINOR_DEGREES, outline: null }),
    )

    // Assert
    expect(rects).toHaveLength(8)
    expect(outlines(L, rects)).toEqual([])
    expect(bold(texts)).toEqual([])
  })
})
