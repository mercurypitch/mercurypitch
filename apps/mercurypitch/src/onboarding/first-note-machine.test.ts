// ============================================================
// The first note's machine: starts, answers, takes and lines
// ============================================================

import { describe, expect, it } from 'vitest'
import type { SettledNote } from '@/features/onboarding/settled-note'
import type { NoteEvent, NoteState } from './first-note-machine'
import { FIRST_NOTE_START, firstNoteLine, firstNoteReducer, MAX_AUTO_TAKES, } from './first-note-machine'

const A3: SettledNote = { midi: 57, note: 'A3', hz: 220, voicedSeconds: 2.6 }

function run(...events: NoteEvent[]): NoteState {
  return events.reduce(firstNoteReducer, FIRST_NOTE_START)
}

describe('firstNoteReducer', () => {
  it('opens one numbered start from a tap, and listens once the mic is open', () => {
    const starting = run({ type: 'start' })
    expect(starting).toMatchObject({ phase: 'starting', run: 1 })
    expect(firstNoteReducer(starting, { type: 'start' })).toBe(starting)
    expect(run({ type: 'start' }, { type: 'mic-ready', run: 1 }).phase).toBe(
      'listen',
    )
  })

  it('drops an answer to a start that no longer stands', () => {
    const again = run(
      { type: 'start' },
      { type: 'stop' },
      { type: 'start' },
      { type: 'mic-ready', run: 1 },
    )
    expect(again).toMatchObject({ phase: 'starting', run: 2 })
    expect(
      run(
        { type: 'start' },
        { type: 'stop' },
        { type: 'mic-failed', run: 1, block: 'denied' },
      ).phase,
    ).toBe('hello')
  })

  it('names the note it heard', () => {
    expect(
      run(
        { type: 'start' },
        { type: 'mic-ready', run: 1 },
        { type: 'heard', note: A3 },
      ),
    ).toMatchObject({ phase: 'heard', note: A3 })
  })

  it('listens again by itself after a miss, then waits for a tap', () => {
    const open: NoteEvent[] = [{ type: 'start' }, { type: 'mic-ready', run: 1 }]
    const once = run(...open, { type: 'missed' })
    expect(once).toMatchObject({ phase: 'listen', misses: 1 })
    const misses = Array.from(
      { length: MAX_AUTO_TAKES },
      (): NoteEvent => ({ type: 'missed' }),
    )
    const out = run(...open, ...misses)
    expect(out).toMatchObject({ phase: 'missed', misses: MAX_AUTO_TAKES })
    // A tap tries again, with its allowance back.
    expect(firstNoteReducer(out, { type: 'start' })).toMatchObject({
      phase: 'starting',
      misses: 0,
      run: 2,
    })
  })

  it('says why the mic did not open, and a tap tries again', () => {
    const blocked = run(
      { type: 'start' },
      { type: 'mic-failed', run: 1, block: 'denied' },
    )
    expect(blocked).toMatchObject({ phase: 'blocked', block: 'denied' })
    expect(firstNoteReducer(blocked, { type: 'start' })).toMatchObject({
      phase: 'starting',
      block: null,
    })
  })

  it('goes back to hello on a stop, from an opening or a take', () => {
    expect(run({ type: 'start' }, { type: 'stop' }).phase).toBe('hello')
    expect(
      run({ type: 'start' }, { type: 'mic-ready', run: 1 }, { type: 'stop' })
        .phase,
    ).toBe('hello')
    // Nothing to stop once the note is named.
    const heard = run(
      { type: 'start' },
      { type: 'mic-ready', run: 1 },
      { type: 'heard', note: A3 },
    )
    expect(firstNoteReducer(heard, { type: 'stop' })).toBe(heard)
  })
})

describe('firstNoteLine', () => {
  const listening = run({ type: 'start' }, { type: 'mic-ready', run: 1 })

  it('says hello, then asks', () => {
    expect(firstNoteLine(FIRST_NOTE_START, null, false)).toBe('hello')
    expect(firstNoteLine(FIRST_NOTE_START, null, true)).toBe('ask')
  })

  it('follows the take', () => {
    expect(firstNoteLine(listening, { kind: 'floor' }, true)).toBe('ask')
    expect(
      firstNoteLine(listening, { kind: 'waiting', nudge: true }, true),
    ).toBe('nudge')
    expect(
      firstNoteLine(
        listening,
        { kind: 'taking', onset: 1, progress: 0.4 },
        true,
      ),
    ).toBe('hold')
    expect(
      firstNoteLine(
        firstNoteReducer(listening, { type: 'missed' }),
        { kind: 'waiting', nudge: false },
        true,
      ),
    ).toBe('wandered')
  })

  it('names the note, says a miss, and says why the mic did not open', () => {
    expect(
      firstNoteLine(
        firstNoteReducer(listening, { type: 'heard', note: A3 }),
        null,
        true,
      ),
    ).toBe('heard')
    expect(
      firstNoteLine(
        run(
          { type: 'start' },
          { type: 'mic-ready', run: 1 },
          { type: 'missed' },
          { type: 'missed' },
        ),
        null,
        true,
      ),
    ).toBe('missed')
    // A refusal is Merc's to explain; one that a retry left as it was,
    // still his, and he says it is still off.
    const refused = run(
      { type: 'start' },
      { type: 'mic-failed', run: 1, block: 'denied' },
    )
    expect(firstNoteLine(refused, null, true)).toBe('blocked')
    const again = firstNoteReducer(
      firstNoteReducer(refused, { type: 'start' }),
      { type: 'mic-failed', run: 2, block: 'denied' },
    )
    expect(again.blocks).toBe(2)
    expect(firstNoteLine(again, null, true)).toBe('still-blocked')
    // The mic opening at last: the count starts over.
    const opened = firstNoteReducer(
      firstNoteReducer(again, { type: 'start' }),
      { type: 'mic-ready', run: 3 },
    )
    expect(opened.blocks).toBe(0)
  })
})
