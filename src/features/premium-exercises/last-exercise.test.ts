// ============================================================
// The last exercise opened, and what stands in before the first
// ============================================================
//
// The record and the exercise history are both read from storage when
// their modules load, so each case seeds storage and loads them fresh.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const run = (type: string, completedAt: number) => ({
  type,
  score: 80,
  metrics: {},
  completedAt,
})

interface Seed {
  last?: string
  history?: ReturnType<typeof run>[]
}

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

async function load(seed: Seed = {}) {
  if (seed.last !== undefined) {
    localStorage.setItem('mp_last_exercise', seed.last)
  }
  if (seed.history !== undefined) {
    localStorage.setItem(
      'mercurypitch_exercise_history',
      JSON.stringify(seed.history),
    )
  }
  return import('./last-exercise')
}

describe('the last exercise opened', () => {
  it('is none on a phone that never opened or ran one', async () => {
    const { lastExercise } = await load()

    expect(lastExercise()).toBeNull()
  })

  it('is the one remembered, kept under mp_last_exercise as its bare id', async () => {
    const { lastExercise, rememberLastExercise } = await load()

    rememberLastExercise('long-note-lantern')

    expect(lastExercise()).toBe('long-note-lantern')
    expect(localStorage.getItem('mp_last_exercise')).toBe('long-note-lantern')
  })

  it('reads an id it does not know as none', async () => {
    const { lastExercise } = await load({ last: 'karaoke-night' })

    expect(lastExercise()).toBeNull()
  })

  it('is read again after a reload', async () => {
    const { lastExercise } = await load({ last: 'long-note-lantern' })

    expect(lastExercise()).toBe('long-note-lantern')
  })

  it('reads storage afresh after the reset tests use', async () => {
    const { lastExercise, rememberLastExercise, resetLastExerciseForTests } =
      await load()
    rememberLastExercise('long-note-lantern')

    localStorage.removeItem('mp_last_exercise')
    resetLastExerciseForTests()

    expect(lastExercise()).toBeNull()
  })
})

describe('before the first open: the exercise history stands in', () => {
  it('takes the newest premium run, and skips the web Long Note above it', async () => {
    const { lastExercise } = await load({
      history: [
        run('long-note', 3),
        run('long-note-lantern', 2),
        run('vibrato', 1),
      ],
    })

    expect(lastExercise()).toBe('long-note-lantern')
  })

  it('finds nothing in a history of web exercises only', async () => {
    const { lastExercise } = await load({
      history: [run('long-note', 2), run('vibrato', 1)],
    })

    expect(lastExercise()).toBeNull()
  })

  it('stands in for an unknown record too', async () => {
    const { lastExercise } = await load({
      last: 'karaoke-night',
      history: [run('long-note-lantern', 1)],
    })

    expect(lastExercise()).toBe('long-note-lantern')
  })
})

describe('the record and the history, side by side', () => {
  // One premium exercise exists today, so both sources can only name it.
  // The rule is checked with two ids of its own.
  const twoKnown = (value: unknown): value is 'a' | 'b' =>
    value === 'a' || value === 'b'

  it('lets the record beat a newer run of another exercise', async () => {
    const { chooseLastExercise } = await load()

    expect(chooseLastExercise('b', ['a', 'b'], twoKnown)).toBe('b')
  })

  it('falls back to the newest known run when the record is empty', async () => {
    const { chooseLastExercise } = await load()

    expect(chooseLastExercise('', ['x', 'a', 'b'], twoKnown)).toBe('a')
  })
})

describe('where it is kept', () => {
  it('stays on this device: no pitchperfect_ prefix, so the settings sync passes it by', async () => {
    const { LAST_EXERCISE_KEY } = await load()

    expect(LAST_EXERCISE_KEY).toBe('mp_last_exercise')
    expect(LAST_EXERCISE_KEY.startsWith('pitchperfect_')).toBe(false)
  })
})
