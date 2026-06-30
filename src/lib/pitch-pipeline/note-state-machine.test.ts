import { describe, expect, it } from 'vitest'
import type { NoteStateMachine, NoteUpdate } from './note-state-machine'
import { createNoteStateMachine } from './note-state-machine'

/** Feed a sequence of (fractional MIDI | null) frames at 100 fps, bpm 120. */
function run(sm: NoteStateMachine, frames: (number | null)[]): NoteUpdate[] {
  const out: NoteUpdate[] = []
  frames.forEach((m, i) => {
    out.push(sm.update(m, i * 0.01, i * 0.02))
  })
  return out
}

function completedNotes(results: NoteUpdate[]): number[] {
  return results
    .map((r) => r.completed)
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map((c) => c.midi)
}

describe('createNoteStateMachine', () => {
  it('opens a note only after debounceFrames', () => {
    const sm = createNoteStateMachine()
    const r = run(sm, [60, 60, 60])
    expect(r[0].open).toBeNull()
    expect(r[1].open).toBeNull()
    expect(r[2].open?.midi).toBe(60)
  })

  it('holds the current note through a sub-semitone wobble (deadband)', () => {
    const sm = createNoteStateMachine()
    const r = run(sm, [60, 60, 60, 60.45, 60.45, 59.6])
    expect(completedNotes(r)).toEqual([])
    expect(r[r.length - 1].open?.midi).toBe(60)
  })

  it('does not switch on a brief excursion to a neighbouring note', () => {
    const sm = createNoteStateMachine()
    // Long hold on 60, then 61/60 alternating — never 3 consecutive 61.
    const r = run(sm, [60, 60, 60, 60, 60, 60, 61, 60, 61, 60, 61, 60])
    expect(completedNotes(r)).toEqual([])
    expect(r[r.length - 1].open?.midi).toBe(60)
  })

  it('switches notes after minHold + debounce, closing the previous note', () => {
    const sm = createNoteStateMachine()
    // 60 held well past minHold (0.1 s), then a stable 61.
    const frames = [...Array<number>(14).fill(60), 61, 61, 61, 61]
    const r = run(sm, frames)
    const switched = r.find((u) => u.completed !== null)
    expect(switched?.completed?.midi).toBe(60)
    expect(switched?.open?.midi).toBe(61)
    expect(completedNotes(r)).toEqual([60])
  })

  it('closes the note after offsetFrames of silence', () => {
    const sm = createNoteStateMachine()
    const frames = [...Array<number>(12).fill(60), ...Array<null>(8).fill(null)]
    const r = run(sm, frames)
    const notes = r.map((u) => u.completed).filter((c) => c !== null)
    expect(notes.length).toBe(1)
    expect(notes[0]?.midi).toBe(60)
    // Ends at the last voiced beat (i=11 => beat 0.22), not into the silence.
    expect(notes[0]?.endBeat).toBeCloseTo(0.22, 6)
  })

  it('drops a too-short blip (below minNoteDurationSec)', () => {
    const sm = createNoteStateMachine()
    const frames = [60, 60, 60, ...Array<null>(8).fill(null)]
    const r = run(sm, frames)
    expect(completedNotes(r)).toEqual([])
  })

  it('flush closes an open note at the given beat', () => {
    const sm = createNoteStateMachine()
    run(sm, [60, 60, 60, 60, 60])
    const note = sm.flush(0.5)
    expect(note?.midi).toBe(60)
    expect(note?.startBeat).toBe(0)
    expect(note?.endBeat).toBe(0.5)
  })

  it('reset clears all state', () => {
    const sm = createNoteStateMachine()
    run(sm, [60, 60, 60])
    sm.reset()
    expect(sm.flush(1)).toBeNull()
  })
})
