// ============================================================
// Lesson 4 sing it tests — thirteen rows, do to do, in the scale's spelling
// ============================================================

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { guideLabel, scaleRows } from './sing'

/** A label as the eye reads it: the signs shown, the spoken words dropped. */
const seen = (html: string): string =>
  html.replace(/<span class="sr">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '')

describe('scaleRows', () => {
  it("runs thirteen rows from Merc's do, D3, up to D4, the eight of the scale named do to do", () => {
    // Act
    const rows = scaleRows(50)

    // Assert
    expect(rows.map((r) => r.midi)).toEqual(
      Array.from({ length: 13 }, (_, k) => 50 + k),
    )
    expect(
      rows.filter((r) => r.faint !== true).map((r) => seen(r.label)),
    ).toEqual([
      'do D3',
      're E3',
      'mi F♯3',
      'fa G3',
      'so A3',
      'la B3',
      'ti C♯4',
      'do D4',
    ])
  })

  it("leaves the five rows between the scale's notes faint and unnamed", () => {
    const faint = scaleRows(50).filter((r) => r.faint === true)
    expect(faint.map((r) => r.midi)).toEqual([51, 53, 56, 58, 60])
    expect(faint.every((r) => r.label === '')).toBe(true)
  })

  it("relabels the rows when do moves, in the new scale's spelling", () => {
    expect(seen(scaleRows(46)[0].label)).toBe('do B♭2')
    expect(seen(scaleRows(54)[11].label)).toBe('ti E♯4')
  })
})

describe('guideLabel', () => {
  it('says the rows and the path in words', () => {
    // Act
    const label = guideLabel(50)

    // Assert
    expect(label).toContain('Thirteen rows, D3 to D4')
    expect(label).toContain('climbs to ti and holds it')
    expect(guideLabel(54)).toContain('F sharp 3 to F sharp 4')
  })
})
