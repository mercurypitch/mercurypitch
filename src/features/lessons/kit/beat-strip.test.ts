// The beat machine's compact state: rows of beat cells with their numbers,
// the claps as dots under their beats, nothing gold or larger until the
// page marks it, and the cell under a beat lit as it is heard.

import { beforeEach, describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import type { StripRow } from './beat-strip'
import { emptyRow, mountBeatStrip, rowBeats } from './beat-strip'

const LINE: StripRow = {
  cells: [
    { text: 'Twin', span: 1 },
    { text: 'kle', span: 1 },
    { text: 'twin', span: 1 },
    { text: 'kle', span: 1 },
    { text: 'lit', span: 1 },
    { text: 'tle', span: 1 },
    { text: 'star', span: 2 },
  ],
}

let root: HTMLElement
beforeEach(() => {
  document.body.innerHTML = '<div id="strip"></div>'
  root = document.getElementById('strip') as HTMLElement
})

const claps = () =>
  [...root.querySelectorAll<HTMLElement>('i.clap:not(.ghost)')].map((d) => ({
    at: Number(d.style.getPropertyValue('--at')),
    gold: d.classList.contains('gold'),
  }))

describe('mountBeatStrip', () => {
  it('draws a row of cells under the beat numbers of each bar, a held syllable across two', () => {
    // Act
    mountBeatStrip(root, { rows: [LINE], beatsPerBar: 4, metronome: 'mt-test' })

    // Assert
    expect(root.getAttribute('aria-hidden')).toBe('true')
    const nums = [...root.querySelectorAll('.strip-nums span')].map(
      (s) => s.textContent,
    )
    expect(nums).toEqual(['1', '2', '3', '4', '1', '2', '3', '4'])
    const star = [...root.querySelectorAll<HTMLElement>('.sc')].at(-1)
    expect(star?.textContent).toBe('star')
    expect(star?.style.gridColumn).toBe('span 2')
    expect(star?.dataset.from).toBe('6')
    expect(star?.dataset.to).toBe('7')
    // the small metronome, with its own gradient id, at the left of the first row
    expect(root.querySelector('.strip-row .strip-metro svg')).not.toBeNull()
    expect(root.innerHTML).toContain('mt-test')
  })

  it('puts the claps under their beats in every bar, plain until the page marks the backbeat', () => {
    // Arrange
    const strip = mountBeatStrip(root, { rows: [LINE], beatsPerBar: 4 })

    // Act
    strip.claps([0, 2])

    // Assert: one size and no gold, as before the cold open's reveal
    expect(claps()).toEqual([
      { at: 0, gold: false },
      { at: 2, gold: false },
      { at: 4, gold: false },
      { at: 6, gold: false },
    ])
    expect(root.classList.contains('accented')).toBe(false)
    expect(root.classList.contains('backbeat')).toBe(false)

    // Act
    strip.claps([1, 3])
    strip.marks({ accent: true, backbeat: true })

    // Assert
    expect(claps().map((c) => c.at)).toEqual([1, 3, 5, 7])
    expect(claps().every((c) => c.gold)).toBe(true)
    expect(root.classList.contains('accented')).toBe(true)
    expect(root.querySelectorAll('.strip-nums .bb')).toHaveLength(4)
  })

  it('draws a ghost of the old claps beside the new ones, and takes it away', () => {
    // Arrange
    const strip = mountBeatStrip(root, { rows: [LINE, LINE], beatsPerBar: 4 })
    strip.claps([1, 3])

    // Act
    strip.ghost([0, 2])

    // Assert
    expect(root.querySelectorAll('i.ghost')).toHaveLength(8)
    expect(claps()).toHaveLength(8)

    // Act
    strip.ghost(null)

    // Assert
    expect(root.querySelectorAll('i.ghost')).toHaveLength(0)
  })

  it('lights the cell under a beat counted from the strip’s first, the held one for both its beats', () => {
    // Arrange
    const strip = mountBeatStrip(root, { rows: [LINE, LINE], beatsPerBar: 4 })
    const lit = () =>
      [...root.querySelectorAll<HTMLElement>('.sc.is-lit')].map(
        (s) => s.textContent,
      )

    // Act, Assert
    strip.light(7, 'blue')
    expect(lit()).toEqual(['star'])
    strip.light(9)
    expect(lit()).toEqual(['kle'])
    strip.light(null)
    expect(lit()).toEqual([])
  })

  it("outlines the take's targets and draws its taps as ticks, gold on the backbeat", () => {
    // Arrange
    const strip = mountBeatStrip(root, { rows: [emptyRow(4)], beatsPerBar: 4 })

    // Act
    strip.outline([1, 3])
    strip.setRows([emptyRow(4), emptyRow(4)])
    strip.ticks(1, [
      { beat: 1.05, gold: true },
      { beat: 2, gold: false },
    ])

    // Assert: the outline survives a rebuild
    const targets = [...root.querySelectorAll<HTMLElement>('.sc.target')].map(
      (s) => s.dataset.from,
    )
    expect(targets).toEqual(['1', '3', '1', '3'])
    const ticks = root.querySelectorAll<HTMLElement>(
      '.strip-row:nth-child(2) i.tick',
    )
    expect(
      [...ticks].map((t) => [
        t.style.getPropertyValue('--at'),
        t.classList.contains('gold'),
      ]),
    ).toEqual([
      ['1.05', true],
      ['2', false],
    ])
    expect(root.querySelectorAll('.strip-row:first-child i.tick')).toHaveLength(
      0,
    )
  })

  it('counts a row by its cells’ spans', () => {
    // Assert
    expect(rowBeats(LINE)).toBe(8)
    expect(rowBeats(emptyRow(3))).toBe(3)
  })
})
