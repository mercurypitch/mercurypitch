import { describe, expect, it } from 'vitest'
import { EXERCISE_SING_IN_TIME, runStoppedEarly } from '../types'
import { meanScore, noteScore, runResult, tallyOf } from './run-result'
import { seeded } from './take-frames.fixture'
import type { NoteVerdict } from './take-judge'
import { planRun } from './tune-plan'

const IN: NoteVerdict = {
  pitch: 'in-tune',
  cents: 0,
  offset: 0,
  timing: 'on-time',
}
const NOT_HEARD: NoteVerdict = {
  pitch: 'not-heard',
  cents: null,
  offset: null,
  timing: null,
}
const inTune = (
  cents: number,
  timing: NoteVerdict['timing'] = 'on-time',
): NoteVerdict => ({
  pitch: 'in-tune',
  cents,
  offset: timing === 'on-time' ? 0 : timing === 'late' ? 0.4 : -0.4,
  timing,
})
const off = (cents: number): NoteVerdict => ({
  pitch: 'off',
  cents,
  offset: null,
  timing: null,
})

describe("a note's score", () => {
  it("is its distance on the Mirror's ruler", () => {
    expect(noteScore(IN)).toBe(100)
    expect(noteScore(inTune(12))).toBe(100)
    expect(noteScore(inTune(-35))).toBe(70)
    expect(noteScore(inTune(60))).toBe(40)
    expect(noteScore(off(130))).toBe(0)
  })

  it('is nothing for a note not heard, or not reached', () => {
    expect(noteScore(NOT_HEARD)).toBe(0)
    expect(noteScore(null)).toBe(0)
  })

  it('never counts timing: a late note in tune scores as one on time', () => {
    expect(noteScore(inTune(0, 'late'))).toBe(noteScore(IN))
  })
})

describe("a run's tally", () => {
  it('counts pitch over every note judged, and timing over the notes timed', () => {
    const t = tallyOf([
      [IN, inTune(20, 'late'), off(80)],
      [inTune(-10, 'early'), NOT_HEARD, null],
    ])
    expect(t).toEqual({
      notes: 6,
      judged: 5,
      inTune: 3,
      off: 1,
      notHeard: 1,
      onTime: 1,
      early: 1,
      late: 1,
    })
  })

  it('means its scores over every note planned, or over those judged so far', () => {
    const marks = [
      [IN, IN],
      [null, null],
    ]
    expect(meanScore(marks, 'judged')).toBe(100)
    expect(meanScore(marks, 'planned')).toBe(50)
    expect(meanScore([], 'planned')).toBe(0)
  })
})

describe("a run's result", () => {
  const tunes = planRun({
    level: 5,
    clef: 'treble',
    voice: 'alto',
    random: seeded(11),
  })
  const all = (v: NoteVerdict) => tunes.map((t) => t.notes.map(() => v))
  const notes = tunes.reduce((n, t) => n + t.notes.length, 0)

  it('scores a clean run whole, and records what it was', () => {
    const r = runResult(
      { tunes, marks: all(IN), tunesDone: 3, tunesStarted: 3, level: 5 },
      42,
    )
    expect(r.type).toBe(EXERCISE_SING_IN_TIME)
    expect(r.score).toBe(100)
    expect(r.completedAt).toBe(42)
    expect(runStoppedEarly(r.metrics)).toBe(false)
    expect(r.metrics).toMatchObject({
      tunes: 3,
      tunesDone: 3,
      notesPlanned: notes,
      inTune: notes,
      onTime: notes,
      bpm: 60,
      level: 5,
      notesHit: notes,
      notesTotal: notes,
    })
  })

  it('marks a stopped run, scores its unreached notes as nothing, and tallies only the tunes it reached', () => {
    const marks = all(IN).map((t, i) => (i === 0 ? t : t.map(() => null)))
    const r = runResult(
      { tunes, marks, tunesDone: 1, tunesStarted: 2, level: 5 },
      42,
    )
    expect(runStoppedEarly(r.metrics)).toBe(true)
    expect(r.score).toBe(Math.round((tunes[0].notes.length * 100) / notes))
    expect(r.metrics.notesHit).toBe(tunes[0].notes.length)
    expect(r.metrics.notesTotal).toBe(
      tunes[0].notes.length + tunes[1].notes.length,
    )
  })

  it('counts a note not heard among the notes put up, as a miss', () => {
    const marks = all(IN)
    marks[1][0] = NOT_HEARD
    const r = runResult(
      { tunes, marks, tunesDone: 3, tunesStarted: 3, level: 5 },
      42,
    )
    expect(r.metrics.notHeard).toBe(1)
    expect(r.metrics.notesHit).toBe(notes - 1)
    expect(r.metrics.notesTotal).toBe(notes)
  })
})
