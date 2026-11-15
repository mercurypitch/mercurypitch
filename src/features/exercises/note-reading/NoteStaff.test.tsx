import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { G_CLEF_PATH } from '@/features/lessons/kit/glyphs'
import { F_CLEF_PATH } from '@/features/lessons/kit/staff-glyphs'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { NoteStaff, staffWords } from './NoteStaff'

function staff(clef: Clef, place: number, name?: string) {
  const view = render(() => (
    <NoteStaff
      clef={clef}
      place={place}
      tone={name === undefined ? 'ask' : 'right'}
      name={name}
    />
  ))
  const svg = view.getByTestId('note-staff')
  return {
    svg,
    ledgers: () => view.queryAllByTestId('note-staff-ledger').length,
    stem: () => svg.querySelector('[data-stem]')?.getAttribute('data-stem'),
    paths: () =>
      Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d')),
  }
}

describe('the staff of Read the Note', () => {
  afterEach(cleanup)

  it('draws five lines and the clef it is asked for', () => {
    const treble = staff('treble', 4)
    // Five staff lines and the stem.
    expect(treble.svg.querySelectorAll('line')).toHaveLength(6)
    expect(treble.paths()).toContain(G_CLEF_PATH)
    expect(treble.paths()).not.toContain(F_CLEF_PATH)
    cleanup()

    const bass = staff('bass', 4)
    expect(bass.paths()).toContain(F_CLEF_PATH)
    expect(bass.paths()).not.toContain(G_CLEF_PATH)
  })

  it('gives a note the ledger lines it needs, and no more', () => {
    const needs: [number, number][] = [
      [0, 0],
      [8, 0],
      [-1, 0],
      [9, 0],
      [-2, 1],
      [-3, 1],
      [-4, 2],
      [10, 1],
      [11, 1],
      [12, 2],
    ]
    for (const [place, lines] of needs) {
      expect(staff('treble', place).ledgers(), `place ${place}`).toBe(lines)
      cleanup()
    }
  })

  it('turns the stem down from the middle line up', () => {
    expect(staff('treble', 3).stem()).toBe('up')
    cleanup()
    expect(staff('treble', 4).stem()).toBe('down')
    cleanup()
    expect(staff('bass', -4).stem()).toBe('up')
    cleanup()
    expect(staff('bass', 12).stem()).toBe('down')
  })

  it('tells a screen reader the staff and the place, never the name', () => {
    expect(staffWords('treble', 2)).toBe(
      'Treble staff. A note: the second line.',
    )
    expect(staffWords('bass', -2)).toBe(
      'Bass staff. A note: one ledger line below.',
    )
    const { svg } = staff('treble', 2)
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe(
      'Treble staff. A note: the second line.',
    )
    expect(svg.querySelector('text')).toBeNull()
  })

  it('writes the name beside the note once it is given, for the eye alone', () => {
    const { svg } = staff('treble', 2, 'G')
    const text = svg.querySelector('text')
    expect(text?.textContent).toBe('G')
    expect(text?.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('aria-label')).not.toContain('G')
  })
})
