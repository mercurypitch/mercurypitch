import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { G_CLEF_PATH } from '@/features/lessons/kit/glyphs'
import { F_CLEF_PATH } from '@/features/lessons/kit/staff-glyphs'
import type { Letter } from '../note-reading/staff-kit'
import type { NoteVerdict } from './take-judge'
import type { Tune, TuneNote } from './tune-plan'
import { KEYS } from './tune-plan'
import { TuneStaff, tuneWords } from './TuneStaff'

const note = (
  syllable: string,
  letter: Letter,
  beat: number,
  beats: number,
  place: number,
  midi: number,
): TuneNote => ({
  beat,
  beats,
  degree: 0,
  written: { letter, alter: letter === 'B' ? -1 : 0, octave: 4 },
  place,
  midi,
  syllable,
})

/** In F: an eighth pair, a quarter, a half; then a quarter, a quarter, a half. */
const TUNE: Tune = {
  key: KEYS[2],
  clef: 'treble',
  bpm: 60,
  doMidi: 65,
  notes: [
    note('do', 'F', 0, 0.5, 1, 65),
    note('re', 'G', 0.5, 0.5, 2, 67),
    note('mi', 'A', 1, 1, 3, 69),
    note('fa', 'B', 2, 2, 4, 70),
    note('mi', 'A', 4, 1, 3, 69),
    note('re', 'G', 5, 1, 2, 67),
    note('do', 'F', 6, 2, 1, 65),
  ],
}

const IN: NoteVerdict = {
  pitch: 'in-tune',
  cents: 0,
  offset: 0,
  timing: 'on-time',
}
const LATE: NoteVerdict = {
  pitch: 'in-tune',
  cents: 0,
  offset: 0.4,
  timing: 'late',
}
const OFF: NoteVerdict = { pitch: 'off', cents: 80, offset: null, timing: null }

function staff(props: Partial<Parameters<typeof TuneStaff>[0]> = {}) {
  const view = render(() => <TuneStaff tune={TUNE} names {...props} />)
  const svg = view.getByTestId('tune-staff')
  return {
    view,
    svg,
    notes: () => view.queryAllByTestId('tune-note'),
    beats: () => view.queryAllByTestId('tune-beat'),
    tones: () =>
      view
        .queryAllByTestId('tune-note')
        .map((n) => n.getAttribute('data-tone')),
    paths: () =>
      Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d')),
  }
}

describe("Sing It in Time's staff", () => {
  afterEach(cleanup)

  it('draws the clef, the key and every note of its tune, each by its value', () => {
    const s = staff()
    expect(s.paths()).toContain(G_CLEF_PATH)
    expect(s.view.queryAllByTestId('tune-key-sign')).toHaveLength(1)
    expect(s.notes().map((n) => n.getAttribute('data-value'))).toEqual([
      'eighth',
      'eighth',
      'quarter',
      'half',
      'quarter',
      'quarter',
      'half',
    ])
    expect(s.notes().map((n) => Number(n.getAttribute('data-place')))).toEqual([
      1, 2, 3, 4, 3, 2, 1,
    ])
    // the eighths are beamed as a pair
    expect(s.view.queryAllByTestId('tune-beam')).toHaveLength(1)
    cleanup()
    const bass = staff({ tune: { ...TUNE, clef: 'bass' } })
    expect(bass.paths()).toContain(F_CLEF_PATH)
    expect(bass.paths()).not.toContain(G_CLEF_PATH)
  })

  it('counts every beat under the bars, a held beat in brackets and a split one with its and', () => {
    const s = staff()
    expect(s.beats().map((b) => b.textContent)).toEqual([
      '1&',
      '2',
      '3',
      '(4)',
      '1',
      '2',
      '3',
      '(4)',
    ])
  })

  it('names the notes under the staff only while the names are on', () => {
    expect(staff().svg.textContent).toContain('fa')
    cleanup()
    expect(staff({ names: false }).svg.textContent).not.toContain('fa')
  })

  it('lights the note under the cursor, the beats passed and the one come, and dims what is ahead', () => {
    const s = staff({ beat: 2.4, running: true })
    expect(s.tones()).toEqual([
      'ink',
      'ink',
      'ink',
      'now',
      'next',
      'next',
      'next',
    ])
    expect(s.beats().map((b) => b.getAttribute('data-state'))).toEqual([
      'past',
      'past',
      'now',
      'ahead',
      'ahead',
      'ahead',
      'ahead',
      'ahead',
    ])
    expect(s.view.getByTestId('tune-cursor')).toBeTruthy()
  })

  it('marks each judged note in tune, off or not heard, and ticks when it arrived', () => {
    const marks = [IN, IN, LATE, OFF, null, null, null]
    const s = staff({ beat: 4.2, running: true, marks })
    expect(s.tones()).toEqual([
      'in-tune',
      'in-tune',
      'in-tune',
      'off',
      'now',
      'next',
      'next',
    ])
    const ticks = s.svg.querySelectorAll('[data-timing]')
    // a tick under each beat a timed note starts on: the pair's first, then mi
    expect(Array.from(ticks).map((t) => t.getAttribute('data-timing'))).toEqual(
      ['on-time', 'late'],
    )
  })

  it('shows the voice on the cursor only while there is one', () => {
    expect(
      staff({ beat: 1.2, running: true }).view.queryByTestId('tune-voice'),
    ).toBeNull()
    cleanup()
    const s = staff({ beat: 1.2, running: true, voiceHz: 440 })
    expect(s.view.getByTestId('tune-voice')).toBeTruthy()
    cleanup()
    expect(staff({ voiceHz: 440 }).view.queryByTestId('tune-voice')).toBeNull()
  })

  it('says the whole tune to a screen reader', () => {
    expect(staff().svg.getAttribute('aria-label')).toBe(tuneWords(TUNE, true))
    expect(tuneWords(TUNE, true)).toBe(
      'Treble staff in F major, key signature: one flat, b flat, four four time. Bar 1: do short, re short, mi, fa held. Bar 2: mi, re, do held.',
    )
    expect(tuneWords(TUNE, false)).toContain(
      'Bar 1: F short, G short, A, B flat held.',
    )
  })
})
