import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { F_CLEF_PATH, G_CLEF_PATH } from '../note-reading/staff-kit'
import { sightKey } from './sight-key'
import type { SightNames } from './sight-line'
import { writeLine } from './sight-line'
import type { SightMark, SightStaffProps } from './SightStaff'
import { SightStaff } from './SightStaff'

/** A, G sharp, A, G in A harmonic minor, then E: for a soprano on the treble staff. */
const LINE = writeLine(
  [69, 68, 69, 67, 76],
  sightKey('A', 'harmonic-minor'),
  'treble',
  'soprano',
)

function staff(props: Partial<SightStaffProps> = {}) {
  const view = render(() => (
    <SightStaff line={LINE} names={'letters' as SightNames} {...props} />
  ))
  const svg = view.getByTestId('sight-staff')
  return {
    view,
    svg,
    notes: () => view.queryAllByTestId('sight-note'),
    tones: () =>
      view
        .queryAllByTestId('sight-note')
        .map((n) => n.getAttribute('data-tone')),
    paths: () =>
      Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d')),
  }
}

describe("Sight-Singing's staff", () => {
  afterEach(cleanup)

  it('draws the clef and the key, and a sign before each note that differs from the key and no other', () => {
    const s = staff()

    expect(s.paths()).toContain(G_CLEF_PATH)
    expect(s.view.queryAllByTestId('sight-key-sign')).toHaveLength(0)
    expect(s.notes().map((n) => n.getAttribute('data-sign'))).toEqual([
      '',
      '1',
      '',
      '0',
      '',
    ])
    // the G sharp's sharp and the G's natural
    expect(s.view.queryAllByTestId('sight-sign')).toHaveLength(2)
  })

  it("writes a flat key's signature on the bass staff", () => {
    const bass = writeLine(
      [46, 48, 50],
      sightKey('Bb', 'major'),
      'bass',
      'bass',
    )

    const s = staff({ line: bass })

    expect(s.paths()).toContain(F_CLEF_PATH)
    expect(s.paths()).not.toContain(G_CLEF_PATH)
    expect(s.view.queryAllByTestId('sight-key-sign')).toHaveLength(2)
    expect(s.svg.getAttribute('aria-label')).toContain(
      'Bass staff in B♭ major, key signature: two flats, B flat and E flat.',
    )
  })

  it('prints the names chosen under the notes, and none with the names off', () => {
    expect(staff().svg.textContent).toBe('AG♯AGE')
    cleanup()
    expect(staff({ names: 'solfege' }).svg.textContent).toBe('dotidoteso')
    cleanup()
    expect(staff({ names: 'off' }).svg.textContent).toBe('')
  })

  it('lights the note to sing, marks the ones passed and dims the ones ahead', () => {
    const marks: (SightMark | undefined)[] = [
      { held: true, heard: true },
      { held: false, heard: true },
      { held: false, heard: false },
    ]

    const s = staff({ current: 3, marks })

    expect(s.tones()).toEqual(['held', 'moved', 'not-heard', 'now', 'next'])
  })

  it('rides the voice beside the lit note, on its height when it is in tune an octave under', () => {
    // Arrange: the lit note is E5; the voice sings E4
    const s = staff({ current: 4, voiceHz: 440 * 2 ** ((64 - 69) / 12) })
    const head = s.notes()[4].querySelector('path:last-of-type')

    // Act
    const voice = s.view.getByTestId('sight-voice')

    // Assert: on the head's line, and lit as in tune
    const headY = Number(
      /translate\([\d.]+ ([\d.]+)\)/.exec(head!.getAttribute('transform')!)![1],
    )
    expect(Number(voice.getAttribute('cy'))).toBeCloseTo(headY - 6.04, 1)
    expect(voice.getAttribute('class')).toMatch(/voiceOn/)
  })
})
