// Runner ribbon tests — active-note charge and automatic phrase windows follow the judged score.
import { describe, expect, it } from 'vitest'
import type { RunnerNotationNote } from '../runner/notation'
import { runnerRibbon } from './runner-ribbon'

const notes = (count: number): RunnerNotationNote[] =>
  Array.from({ length: count }, (_, index) => ({
    index,
    startBeat: index,
    endBeat: index + 1,
    startMidi: 57 + index,
    endMidi: 57 + index,
    connection: 'separate',
    fillProgress: index === 0 ? 1 : index === 3 ? 0.4 : 0,
    state: index === 0 ? 'filled' : index === 3 ? 'filling' : 'hollow',
  }))

describe('runner ribbon', () => {
  it('uses the active note fill rather than the already completed first note', () => {
    const ribbon = runnerRibbon(notes(7), 3)
    expect(ribbon.activeProgress).toBe(0.4)
    expect(ribbon.visible.map((note) => note.index)).toEqual([3, 4, 5])
    expect(ribbon.remaining).toBe(1)
    expect(ribbon.position).toBe('4/7')
    expect(ribbon.all).toHaveLength(7)
  })
  it('retains exact displayed hold durations and both glide pitches', () => {
    const score = notes(2)
    score[1] = { ...score[1]!, endMidi: 62, connection: 'glide' }
    const ribbon = runnerRibbon(score, 1, ['0.6s', '1.2s'])
    expect(ribbon.visible[0]).toMatchObject({
      pitch: 'A#3 → D4',
      duration: '1.2s',
      active: true,
    })
    expect(ribbon.activeProgress).toBe(0)
    expect(ribbon.remaining).toBe(0)
  })
  it('clamps malformed fill and active indexes without inventing a duration', () => {
    const score = [{ ...notes(1)[0]!, fillProgress: NaN }]
    expect(runnerRibbon(score, 99)).toMatchObject({
      activeProgress: 0,
      position: '1/1',
      remaining: 0,
    })
    expect(runnerRibbon(score, -1).visible[0]).toMatchObject({
      duration: null,
      active: true,
    })
    expect(runnerRibbon([], null)).toMatchObject({
      visible: [],
      all: [],
      activeProgress: 0,
      position: '0/0',
    })
  })
})
