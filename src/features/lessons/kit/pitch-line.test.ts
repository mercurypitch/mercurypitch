// ============================================================
// Pitch line tests — a take drawn over its written notes
// ============================================================
//
// The chart a take's pitch line is drawn on after the take (Lesson 16
// WEB-SPEC, Toys 6, state 7; FACTS 46): the phrase's bands, a lane a
// semitone, the line over them, the octave tag where most of the voice sat
// an octave away, the rows named by syllable and note, and the words the
// canvas says.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { PitchLine } from './pitch-line'
import { drawPitchLine, rowsOf, summaryOf } from './pitch-line'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.textContent = ''
})

/** Do, re, mi, re, do in G for the lower voice: G3 A3 B3 A3 G3. */
const PHRASE = [55, 57, 59, 57, 55] as const
const LABELS = ['Do', 'Re', 'Mi', 'Re', 'Do'] as const

describe('the chart after the take', () => {
  const PITCH: PitchLine = {
    seconds: 3,
    rungs: [
      { c: 0, from: 0, to: 0.6 },
      { c: 200, from: 0.6, to: 1.5 },
      { c: 400, from: 1.5, to: 3 },
    ],
    line: [
      { t: 0, c: 4 },
      { t: 1, c: 210 },
    ],
    octaves: -1,
  }

  /** Sing it's chart frame, as the page has it. */
  function frame(): HTMLElement {
    document.body.innerHTML = `
      <div class="sing-chart band-chart" id="singChart">
        <canvas role="img" aria-label="Your pitch line"></canvas>
        <span class="octave-tag" data-octave-tag hidden></span>
      </div>`
    return document.getElementById('singChart') as HTMLElement
  }

  it('draws the take over the phrase’s bands, a lane a semitone, with the octave tag', () => {
    // Arrange
    const root = frame()

    // Act
    const chart = drawPitchLine(root, PITCH, PHRASE, LABELS)

    // Assert: FACTS 46
    expect(chart.scene.rungs).toEqual(PITCH.rungs)
    expect(chart.scene.line).toEqual(PITCH.line)
    expect([chart.target, chart.lo, chart.hi, chart.window]).toEqual([
      55, -100, 500, 3,
    ])
    const tag = root.querySelector<HTMLElement>('[data-octave-tag]')
    expect([tag?.hidden, tag?.textContent]).toEqual([false, 'octave lower'])
    expect(root.querySelector('canvas')?.getAttribute('aria-label')).toBe(
      "Your pitch line over the written notes' bands: do, re, mi, re, do. You sang it an octave lower: same notes. It is drawn in their octave.",
    )
  })

  it('draws the next take on the same chart, its axis the new phrase’s, with no tag in the written octave', () => {
    // Arrange
    const root = frame()
    const first = drawPitchLine(root, PITCH, PHRASE, LABELS)

    // Act: phrase 2 in the treble, do, so, mi, re, do
    const next = drawPitchLine(
      root,
      { ...PITCH, seconds: 5, octaves: 0 },
      [67, 74, 71, 69, 67],
      ['Do', 'So', 'Mi', 'Re', 'Do'],
    )

    // Assert
    expect(next).toBe(first)
    expect([next.target, next.lo, next.hi, next.window]).toEqual([
      67, -100, 800, 5,
    ])
    expect(root.querySelector<HTMLElement>('[data-octave-tag]')?.hidden).toBe(
      true,
    )
  })

  it('names each row of the phrase once, low to high, by its syllable and note', () => {
    // Act
    const rows = rowsOf([67, 74, 71, 69, 67], ['Do', 'So', 'Mi', 'Re', 'Do'])

    // Assert
    expect(rows).toEqual([
      [67, 'do · G4'],
      [69, 're · A4'],
      [71, 'mi · B4'],
      [74, 'so · D5'],
    ])
  })

  it('says the notes in order, and nothing of an octave in their own', () => {
    // Act
    const said = summaryOf(LABELS, 0)

    // Assert
    expect(said).toBe(
      "Your pitch line over the written notes' bands: do, re, mi, re, do.",
    )
  })
})
