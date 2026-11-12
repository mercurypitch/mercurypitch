// ============================================================
// Staircase painter tests — another scale's risers, names, keys and houses
// ============================================================
//
// What Lesson 20's staircase prints (its WEB-SPEC, Toys 1): each riser's
// size in semitones, 2, 2, 3, 2 and 3 for the major five, where Lesson 4's
// say T and S; each stair's sung name over its letter; the keys named as
// the scale spells them, E♭ and B♭ in the minor five on C; and do's house
// on both do stairs. A context that keeps every call stands in for the
// canvas.

import { describe, expect, it, vi } from 'vitest'
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

/** A context that keeps the words it is asked to write, with their font. */
function wordsContext(texts: Text[]): CanvasRenderingContext2D {
  const props: Record<PropertyKey, unknown> = {}
  return new Proxy(props, {
    get: (target, key) =>
      key in target
        ? target[key]
        : (...args: unknown[]): unknown => {
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
