// ============================================================
// Score tests — a song on two staffs, laid out, written, lit and marked
// ============================================================
//
// Lesson 28 WEB-SPEC, Look and Toys 2: the treble staff above the bass,
// joined by a brace and a line at each system's left, bar lines through
// both, the key's one sharp after each clef at its own clef's height, 4/4
// on the first system only; eight bars wrapped into two systems of four on
// a phone and kept on one on a desktop, the parts' notes that sound
// together one above the other; the bar numbers over the top staff; the
// tags over their bars and the numerals under the bottom staff, fading in
// the first time only; a word under a note, the breaths over each staff,
// the house under each staff's first note on do and a ring round a note;
// every note hidden until written, then lit while it sounds under a cursor
// in its own system; a tap on a staff naming it; and the pitch-line view's
// bands, each part in its colour and named.

import { describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { Spelled } from './notes'
import type { NoteValue } from './rhythm-model'
import { mountScore } from './score'
import { drawBands } from './score-bands'
import { drawScore, lightScore, writeScore } from './score-draw'
import type { ScoreNote, ScoreScene, ScoreStaff } from './score-layout'
import { layoutScore, rowOf, spaceFor, systemOfBeat, timedNotes, } from './score-layout'

const PHONE = { w: 310, h: 300 }
const DESKTOP = { w: 640, h: 320 }
const G_MAJOR = { sign: 'sharp', count: 1 } as const

/** A spelled note from its name, as "F#4". */
function n(name: string): Spelled {
  const m = /^([A-G])(#?)(\d)$/.exec(name)
  if (m === null) throw new Error(name)
  return {
    letter: m[1] as Spelled['letter'],
    alter: m[2] === '#' ? 1 : 0,
    octave: Number(m[3]),
  }
}

/** Bars from "B4 A4 | G4w": a half note by default, a whole with w, a quarter with q. */
function bars(text: string): ScoreNote[][] {
  return text.split('|').map((bar) =>
    bar
      .trim()
      .split(/\s+/)
      .map((t): ScoreNote => {
        const value: NoteValue = t.endsWith('w') ? 4 : t.endsWith('q') ? 1 : 2
        return { note: n(t.replace(/[wq]$/, '')), value }
      }),
  )
}

const TAVI: ScoreStaff = {
  clef: 'treble',
  tone: 'tavi',
  label: "Tavi's part",
  bars: bars('B4 A4 | G4 B4 | C5 B4 | A4w | B4 C5 | D5 B4 | A4 F#4 | G4w'),
}
const MERC: ScoreStaff = {
  clef: 'bass',
  tone: 'merc',
  label: "Merc's part",
  bars: bars('G3 F#3 | E3 G3 | A3 G3 | D3w | G3 A3 | B3 G3 | D3 D3 | G3w'),
}
const A: ScoreScene = { key: G_MAJOR, staffs: [TAVI, MERC] }

function host(): SVGSVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  document.body.replaceChildren(el)
  return el
}

const classes = (el: Element, cls: string): number =>
  el.querySelectorAll(`.${cls}`).length

describe('the score layout', () => {
  it('times each note from the scene start: halves two beats, wholes four', () => {
    // Act
    const t = timedNotes(TAVI)

    // Assert
    expect(t).toHaveLength(14)
    expect(t.slice(0, 4).map((x) => x.beat)).toEqual([0, 2, 4, 6])
    expect(t[6]).toMatchObject({ bar: 3, beat: 12, beats: 4, index: 6 })
    expect(t[13]).toMatchObject({ bar: 7, beat: 28, beats: 4 })
  })

  it('wraps eight bars into two systems of four on a phone, and keeps them on one on a desktop', () => {
    // Act
    const phone = layoutScore(PHONE.w, PHONE.h, A)
    const desk = layoutScore(DESKTOP.w, DESKTOP.h, A)

    // Assert
    expect(phone.systems.map((s) => [s.from, s.to])).toEqual([
      [0, 4],
      [4, 8],
    ])
    expect(desk.systems.map((s) => [s.from, s.to])).toEqual([[0, 8]])
  })

  it('writes the 4/4 on the first system only, and every system fits the figure, its tags and numerals with it', () => {
    // Act
    const L = layoutScore(PHONE.w, PHONE.h, {
      ...A,
      marks: { tags: [], numerals: [] },
    })

    // Assert
    expect(L.systems.map((s) => s.metre)).toEqual([true, false])
    for (const s of L.systems) {
      expect(s.tagTop).toBeGreaterThanOrEqual(0)
      expect(s.numeralY).toBeLessThanOrEqual(PHONE.h)
    }
  })

  it('puts the treble staff above the bass, both staffs of a system on one time axis', () => {
    // Act
    const [sys] = layoutScore(DESKTOP.w, DESKTOP.h, A).systems

    // Assert
    const [treble, bass] = sys?.rows ?? []
    expect(treble?.y).toBeLessThan(bass?.y ?? 0)
    expect(treble?.x0).toBe(bass?.x0)
    expect(treble?.x1).toBe(bass?.x1)
    expect(treble?.beats).toBe(32)
  })

  it('takes the largest staff space from 10 px down that fits the height', () => {
    // Act
    const roomy = spaceFor(DESKTOP.w, 900, A)
    const tight = spaceFor(PHONE.w, PHONE.h, A)

    // Assert
    expect(roomy).toBe(10)
    expect(tight).toBeLessThan(10)
    expect(tight).toBeGreaterThanOrEqual(5)
  })

  it("keeps a row only for the marks a scene can carry, so Step 4's staffs draw larger than Step 1's", () => {
    // Act
    const plain = layoutScore(PHONE.w, PHONE.h, A)
    const marked = layoutScore(PHONE.w, PHONE.h, {
      ...A,
      marks: { tags: [], numerals: [] },
    })

    // Assert
    expect(plain.space).toBeGreaterThan(marked.space)
    expect(marked.systems[0]?.tagH).toBeGreaterThan(0)
  })

  it("gives the rhythm engraving a staff's bars and notes, a continuing system with no 4/4", () => {
    // Act
    const row = rowOf(TAVI, 4, 8, 72, true)

    // Assert
    expect(row.bars).toHaveLength(4)
    expect(row.notes?.[0]).toEqual(n('B4'))
    expect(row.notes).toHaveLength(7)
    expect(row.continues).toBe(true)
  })

  it('keeps the last beat in the last system', () => {
    // Arrange
    const L = layoutScore(PHONE.w, PHONE.h, A)

    // Act + Assert
    expect(systemOfBeat(L, 0)).toBe(0)
    expect(systemOfBeat(L, 16)).toBe(1)
    expect(systemOfBeat(L, 32)).toBe(1)
  })
})

describe('the score drawing', () => {
  it('draws a brace, a joining line and the bar lines through both staffs in each system', () => {
    // Arrange
    const el = host()

    // Act
    const d = drawScore(el, A, PHONE)

    // Assert: two systems, four bar lines each
    expect(d.layout.systems).toHaveLength(2)
    expect(classes(el, 'sc-brace')).toBe(2)
    expect(classes(el, 'sc-sysline')).toBe(2)
    expect(classes(el, 'sc-barline')).toBe(8)
    const sys = d.layout.systems[0]
    const line = el.querySelector('.sc-barline')
    expect(Number(line?.getAttribute('y1'))).toBeCloseTo(sys?.top ?? 0, 1)
    expect(Number(line?.getAttribute('y2'))).toBeCloseTo(sys?.bottom ?? 0, 1)
    // the engraving's own bar lines, one staff tall, are gone
    expect(classes(el, 'rb-barline')).toBe(0)
  })

  it("writes the key's one sharp after each clef, the treble's on its top line and the bass's on its fourth", () => {
    // Arrange
    const el = host()

    // Act
    const d = drawScore(el, A, DESKTOP)

    // Assert
    const signs = [...el.querySelectorAll('.sc-keysign')]
    expect(signs).toHaveLength(2)
    expect(classes(el, 'rb-clef')).toBe(2)
    const ys = signs.map((s) =>
      Number(
        /translate\([\d.]+ ([\d.]+)\)/.exec(
          s.getAttribute('transform') ?? '',
        )?.[1],
      ),
    )
    const [treble, bass] = d.layout.systems[0]?.rows ?? []
    // F5 on the treble's top line and F3 on the bass's fourth, the glyph's centre set below its line
    expect(ys[0]).toBeGreaterThan((treble?.top ?? 0) - 1)
    expect(ys[0]).toBeLessThan(treble?.y ?? 0)
    expect(ys[1]).toBeGreaterThan((bass?.top ?? 0) + (bass?.space ?? 0) - 1)
    expect(ys[1]).toBeLessThan(bass?.y ?? 0)
  })

  it('writes the 4/4 on the first system only, and every bar number over the top staff', () => {
    // Arrange
    const el = host()

    // Act
    drawScore(el, { ...A, first: 1 }, PHONE)

    // Assert
    expect(classes(el, 'rb-metre')).toBe(2)
    const metres = [...el.querySelectorAll('.rb-metre')].map((m) =>
      m.closest('.sc-system')?.getAttribute('data-system'),
    )
    expect(metres).toEqual(['0', '0'])
    expect(
      [...el.querySelectorAll('.sc-number')].map((t) => t.textContent),
    ).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
  })

  it('stands the notes the parts sound together one above the other', () => {
    // Arrange
    const el = host()

    // Act
    const d = drawScore(el, A, DESKTOP)

    // Assert: every note of Tavi's has Merc's under it at the same beat
    const [tavi, merc] = d.notes
    expect(tavi).toHaveLength(14)
    expect(merc).toHaveLength(14)
    tavi?.forEach((t, i) => {
      expect(merc?.[i]?.beat).toBe(t.beat)
      expect(merc?.[i]?.x).toBeCloseTo(t.x, 6)
      expect(merc?.[i]?.y).toBeGreaterThan(t.y)
    })
  })

  it('hides every note until written, then shows each once its beat comes', () => {
    // Arrange
    const el = host()
    const d = drawScore(el, A, PHONE)
    const shown = (): number =>
      d.notes.flat().filter((x) => !x.el.classList.contains('is-hidden')).length

    // Act + Assert
    expect(shown()).toBe(0)
    writeScore(d, 0)
    expect(shown()).toBe(2)
    writeScore(d, 12)
    expect(shown()).toBe(14)
    writeScore(d, Number.POSITIVE_INFINITY)
    expect(shown()).toBe(28)
  })

  it('lights the notes sounding at a beat, and stands the cursor in their system', () => {
    // Arrange
    const el = host()
    const d = drawScore(el, A, PHONE)

    // Act: bar 5's second half, in the second system
    lightScore(d, 18.5)

    // Assert
    const lit = d.notes.map((s) =>
      s.findIndex((x) => x.el.classList.contains('is-sounding')),
    )
    expect(lit).toEqual([8, 8])
    expect(d.cursors[0]?.classList.contains('is-off')).toBe(true)
    expect(d.cursors[1]?.classList.contains('is-off')).toBe(false)
    const x = Number(d.cursors[1]?.getAttribute('x1'))
    expect(x).toBeGreaterThan(d.notes[0]?.[7]?.x ?? 0)
    expect(x).toBeLessThan(d.notes[0]?.[9]?.x ?? 0)
  })

  it('lights only the staffs named, and clears the lights and the cursor at null', () => {
    // Arrange
    const el = host()
    const d = drawScore(el, A, DESKTOP)

    // Act
    lightScore(d, 0, [1])
    const merc = d.notes[1]?.[0]?.el.classList.contains('is-sounding')
    const tavi = d.notes[0]?.[0]?.el.classList.contains('is-sounding')
    lightScore(d, null)

    // Assert
    expect([tavi, merc]).toEqual([false, true])
    expect(el.querySelectorAll('.is-sounding')).toHaveLength(0)
    expect(d.cursors.every((c) => c.classList.contains('is-off'))).toBe(true)
  })

  it('fades a tag and a numeral in the first time they are drawn, and never again', () => {
    // Arrange
    const el = host()
    const seen = new Set<string>()
    const scene: ScoreScene = {
      ...A,
      marks: {
        tags: [{ bar: 3, text: 'Imperfect: on V' }],
        numerals: [{ bar: 3, text: 'V' }],
      },
    }

    // Act
    drawScore(el, scene, PHONE, { seen })
    const first = [...el.querySelectorAll('.is-fresh')].length
    drawScore(el, scene, PHONE, { seen })
    const again = [...el.querySelectorAll('.is-fresh')].length

    // Assert
    expect(first).toBe(2)
    expect(again).toBe(0)
    expect(el.querySelector('.sc-tag-text')?.textContent).toBe(
      'Imperfect: on V',
    )
    expect(el.querySelector('.sc-numeral')?.textContent).toBe('V')
  })

  it('sets no tag, numeral or bar number under 10.6 px, however small the staff', () => {
    // Arrange
    const el = host()
    const scene: ScoreScene = {
      ...A,
      marks: {
        tags: [{ bar: 3, text: 'Imperfect: on V' }],
        numerals: [{ bar: 3, text: 'V' }],
      },
    }

    // Act
    const d = drawScore(el, scene, { w: 300, h: 240 })

    // Assert
    expect(d.layout.space).toBeLessThan(8.5)
    const sizes = [
      ...el.querySelectorAll('.sc-tag-text, .sc-numeral, .sc-number'),
    ].map((t) => Number(t.getAttribute('font-size')))
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(10.6)
  })

  it("puts a tag over its bar inside its system, and a numeral under the bottom staff at its bar's first note", () => {
    // Arrange
    const el = host()
    const scene: ScoreScene = {
      ...A,
      marks: {
        tags: [{ bar: 7, text: 'Perfect: V to I' }],
        numerals: [
          { bar: 6, text: 'V' },
          { bar: 7, text: 'I' },
        ],
      },
    }

    // Act
    const d = drawScore(el, scene, PHONE)

    // Assert: both in the second system, the numerals under bars 7 and 8's first notes
    const sys = d.layout.systems[1]
    const rect = el.querySelector('.sc-tag rect')
    const x = Number(rect?.getAttribute('x'))
    const w = Number(rect?.getAttribute('width'))
    expect(rect?.closest('.sc-marks')?.getAttribute('data-system')).toBe('1')
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x + w).toBeLessThanOrEqual(sys?.rows[0]?.x1 ?? 0)
    const nums = [...el.querySelectorAll('.sc-numeral')]
    expect(nums.map((t) => Number(t.getAttribute('x')))).toEqual([
      Number((d.notes[1]?.[11]?.x ?? 0).toFixed(2)),
      Number((d.notes[1]?.[13]?.x ?? 0).toFixed(2)),
    ])
    expect(Number(nums[0]?.getAttribute('y'))).toBeGreaterThan(sys?.bottom ?? 0)
  })

  it('writes a breath over each staff, the house under each first note on do, a word under a note and a ring round one', () => {
    // Arrange
    const el = host()
    const scene: ScoreScene = {
      ...A,
      marks: {
        breaths: [1, 3, 5],
        home: [n('G4'), n('G3')],
        words: [{ staff: 0, note: 13, text: 'A-' }],
        rings: [{ staff: 1, note: 13 }],
      },
    }

    // Act
    const d = drawScore(el, scene, DESKTOP)

    // Assert
    expect(classes(el, 'sc-breath')).toBe(6)
    expect(classes(el, 'sc-house')).toBe(2)
    expect(el.querySelector('.sc-word')?.textContent).toBe('A-')
    const ring = el.querySelector('.sc-ring')
    expect(Number(ring?.getAttribute('cx'))).toBeCloseTo(
      d.notes[1]?.[13]?.x ?? 0,
      1,
    )
    // the treble's house under bar 2's G4, its first G; the bass's under bar
    // 1's G3; each below its staff's bottom line
    const at = [...el.querySelectorAll('.sc-house')].map((h) =>
      /translate\(([\d.]+) ([\d.]+)\)/.exec(h.getAttribute('transform') ?? ''),
    )
    const houses = at.map((m) => Number(m?.[1]))
    const rows = d.layout.systems[0]?.rows ?? []
    at.forEach((m, k) => {
      expect(Number(m?.[2])).toBeGreaterThan(rows[k]?.bottom ?? 0)
    })
    const size = d.layout.space * 1.2
    expect(houses[0]).toBeCloseTo((d.notes[0]?.[2]?.x ?? 0) - size / 2, 0)
    expect(houses[1]).toBeCloseTo((d.notes[1]?.[0]?.x ?? 0) - size / 2, 0)
  })
})

describe('the mounted score', () => {
  it('names the staff a tap lands on', () => {
    // Arrange
    const fig = document.createElement('div')
    document.body.replaceChildren(fig)
    const onStaff = vi.fn()
    const score = mountScore(fig, { onStaff })
    score.show(A)

    // Act
    fig
      .querySelector('.sc-hit[data-staff="1"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    // Assert
    expect(onStaff).toHaveBeenCalledWith(1)
  })

  it('keeps what is written and lit when it draws the bands, and back', () => {
    // Arrange
    const fig = document.createElement('div')
    document.body.replaceChildren(fig)
    const score = mountScore(fig)
    score.show(A, 8)
    score.at(4)

    // Act
    score.setView('bands')
    const bands = score.drawing
    score.setView('staffs')

    // Assert
    expect(fig.dataset.view).toBe('staffs')
    const shown = bands?.notes
      .flat()
      .filter((x) => !x.el.classList.contains('is-hidden'))
    expect(shown).toHaveLength(10)
    expect(
      bands?.notes.flat().filter((x) => x.el.classList.contains('is-sounding')),
    ).toHaveLength(2)
  })
})

describe('the pitch-line view', () => {
  it("draws each part's notes as bands in its colour, named over its highest band, Tavi's above Merc's", () => {
    // Arrange
    const el = host()

    // Act
    const d = drawBands(el, A, PHONE)

    // Assert
    const parts = [...el.querySelectorAll('.sc-part')]
    expect(parts.map((p) => p.getAttribute('data-tone'))).toEqual([
      'tavi',
      'merc',
    ])
    expect(
      parts.map((p) => p.querySelector('.sc-part-name')?.textContent),
    ).toEqual(["Tavi's part", "Merc's part"])
    expect(classes(el, 'sc-band')).toBe(28)
    const lowestTavi = Math.max(...(d.notes[0] ?? []).map((x) => x.y))
    const highestMerc = Math.min(...(d.notes[1] ?? []).map((x) => x.y))
    expect(lowestTavi).toBeLessThan(highestMerc)
  })

  it('lights the band sounding and stands the cursor at its beat', () => {
    // Arrange
    const el = host()
    const d = drawBands(el, A, PHONE)

    // Act
    lightScore(d, 2)

    // Assert
    const lit = d.notes.map((s) =>
      s.findIndex((x) => x.el.classList.contains('is-sounding')),
    )
    expect(lit).toEqual([1, 1])
    expect(Number(d.cursors[0]?.getAttribute('x1'))).toBeCloseTo(
      d.notes[0]?.[1]?.x ?? 0,
      1,
    )
  })
})
