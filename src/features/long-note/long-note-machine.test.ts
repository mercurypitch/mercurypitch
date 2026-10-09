import { describe, expect, it } from 'vitest'
import type { LongNoteEvent, LongNoteState } from './long-note-machine'
import { initialLongNoteState, longNoteReducer } from './long-note-machine'

function run(
  events: LongNoteEvent[],
  from = initialLongNoteState(57),
): LongNoteState {
  return events.reduce(longNoteReducer, from)
}

describe('long-note-machine', () => {
  it('walks intro, starting, listen, hold and result in order', () => {
    const states = [
      { type: 'start' },
      { type: 'mic-ready', run: 1 },
      { type: 'voice' },
      { type: 'end' },
    ].reduce<LongNoteState[]>(
      (seen, event) => [
        ...seen,
        longNoteReducer(seen[seen.length - 1], event as LongNoteEvent),
      ],
      [initialLongNoteState(57)],
    )
    expect(states.map((s) => s.phase)).toEqual([
      'intro',
      'starting',
      'listen',
      'hold',
      'result',
    ])
  })

  it('drops a microphone answer for a start the singer abandoned', () => {
    const state = run([{ type: 'start' }, { type: 'mic-ready', run: 0 }])
    expect(state.phase).toBe('starting')
  })

  it('blocks on a refused microphone and starts again from there', () => {
    const blocked = run([
      { type: 'start' },
      { type: 'mic-failed', run: 1, block: 'denied' },
    ])
    expect(blocked).toMatchObject({ phase: 'blocked', block: 'denied' })
    const retried = longNoteReducer(blocked, { type: 'start' })
    expect(retried).toMatchObject({ phase: 'starting', run: 2, block: null })
  })

  it('changes the note in the intro only', () => {
    expect(run([{ type: 'target', midi: 59 }]).targetMidi).toBe(59)
    const listening = run([
      { type: 'start' },
      { type: 'mic-ready', run: 1 },
      { type: 'target', midi: 59 },
    ])
    expect(listening.targetMidi).toBe(57)
  })

  it('goes again on the same note, opening the microphone again', () => {
    const again = run([
      { type: 'start' },
      { type: 'mic-ready', run: 1 },
      { type: 'voice' },
      { type: 'end' },
      { type: 'again' },
    ])
    expect(again).toMatchObject({ phase: 'starting', targetMidi: 57, run: 2 })
  })

  it('listens again after a false start, with no result', () => {
    const state = run([
      { type: 'start' },
      { type: 'mic-ready', run: 1 },
      { type: 'voice' },
      { type: 'false-start' },
    ])
    expect(state).toMatchObject({ phase: 'listen', run: 1 })
  })

  it('stops listening before a note, back to the intro', () => {
    const state = run([
      { type: 'start' },
      { type: 'mic-ready', run: 1 },
      { type: 'cancel' },
    ])
    expect(state.phase).toBe('intro')
    expect(longNoteReducer(state, { type: 'start' }).run).toBe(2)
  })

  it('returns to the intro to pick another note', () => {
    const intro = run([
      { type: 'start' },
      { type: 'mic-ready', run: 1 },
      { type: 'voice' },
      { type: 'end' },
      { type: 'change-note' },
    ])
    expect(intro.phase).toBe('intro')
  })

  it("takes the singer's own note when there is none yet", () => {
    const listening = run(
      [{ type: 'start' }, { type: 'mic-ready', run: 1 }],
      initialLongNoteState(null),
    )
    // No note to hold yet, so a voice alone does not start the hold.
    expect(longNoteReducer(listening, { type: 'voice' })).toBe(listening)
    const settled = run(
      [{ type: 'settle', midi: 60 }, { type: 'voice' }],
      listening,
    )
    expect(settled).toMatchObject({ phase: 'hold', targetMidi: 60 })
  })

  it('never lets a settle replace a note already chosen', () => {
    const listening = run([{ type: 'start' }, { type: 'mic-ready', run: 1 }])
    expect(longNoteReducer(listening, { type: 'settle', midi: 60 })).toBe(
      listening,
    )
    const intro = initialLongNoteState(null)
    expect(longNoteReducer(intro, { type: 'settle', midi: 60 })).toBe(intro)
  })

  it('ignores events that do not belong to the phase', () => {
    const intro = initialLongNoteState(57)
    for (const event of [
      { type: 'voice' },
      { type: 'end' },
      { type: 'again' },
      { type: 'change-note' },
    ] as LongNoteEvent[]) {
      expect(longNoteReducer(intro, event)).toBe(intro)
    }
  })
})
