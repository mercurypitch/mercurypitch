// ============================================================
// Read the Note, through the shell: setup, a run, the result
// ============================================================

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Letter } from '@/features/lessons/kit/notes'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { noteAt, placeWords } from '@/features/lessons/kit/staff-places'
import type { AudioEngine } from '@/lib/audio-engine'
import { clearExerciseHistory, exerciseHistory, flushExerciseHistoryWrites, } from '@/stores/exercise-history-store'
import { EXERCISE_NOTE_READING } from '../types'
import NoteReadingExercise, { clefForRange } from './NoteReadingExercise'
import { RIGHT_MS, WRONG_MS } from './use-note-reading-controller'

// jsdom has no WebGL, so Merc is his still here whatever the gate says; the
// stub only spares the log the probe's "not implemented" notice.
vi.mock('@/lib/merc/gpu-gate', () => ({
  canRunLiveMerc: () => false,
  waitForLiveMerc: () => () => undefined,
}))

function open() {
  const playNote = vi.fn(() => Promise.resolve())
  const audioEngine = { playNote } as unknown as AudioEngine
  const view = render(() => (
    <NoteReadingExercise audioEngine={audioEngine} onBack={() => {}} />
  ))
  const staff = () => view.getByTestId('note-staff')
  /** The letter of the note that is up, read off the staff as a reader would. */
  const letterUp = (): Letter => {
    const clef = staff().getAttribute('data-clef') as Clef
    const place = Number(staff().getAttribute('data-place'))
    return noteAt(place, clef).letter
  }
  const answer = (letter: Letter) =>
    fireEvent.click(view.getByRole('button', { name: letter }))
  const say = () => view.container.querySelector('.exercise-active-phase')
  return { ...view, playNote, staff, letterUp, answer, say }
}

describe('Read the Note', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    clearExerciseHistory()
  })

  afterEach(async () => {
    cleanup()
    // A finished run's save is in flight on the faked clock: run it out
    // before the clock is handed back, or the flush below never settles.
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    await flushExerciseHistoryWrites()
    clearExerciseHistory()
    localStorage.clear()
  })

  it('opens on its brief, with a Start that carries no microphone', () => {
    const drill = open()
    expect(drill.container.querySelector('.idle-hint')?.textContent).toBe(
      '10 notes · Treble staff · lines and spaces',
    )
    const start = drill.getByRole('button', { name: 'Start' })
    expect(start.querySelector('svg')).toBeNull()
  })

  it('asks for a note without naming it', () => {
    const drill = open()
    fireEvent.click(drill.getByRole('button', { name: 'Start' }))

    expect(drill.say()?.textContent).toBe('Which note is this?')
    const label = drill.staff().getAttribute('aria-label') ?? ''
    expect(label).toMatch(/^Treble staff\. A note: /)
    // What follows "A note:" is a place on the staff, with no letter name in
    // it. (The words before it hold a capital A of their own, so the whole
    // label cannot be searched for the note's letter: one run in nine, the
    // note is an A.)
    expect(label.replace(/^Treble staff\. A note: /, '')).not.toMatch(
      /\b[A-G]\b/,
    )
    // Seven answers, a keyboard's order from C.
    const answers = drill.getByRole('group', { name: 'Name the note' })
    expect(
      Array.from(answers.querySelectorAll('button')).map((b) =>
        b.getAttribute('aria-label'),
      ),
    ).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B'])
  })

  it('says yes to a right answer, sounds the note and moves on', () => {
    const drill = open()
    fireEvent.click(drill.getByRole('button', { name: 'Start' }))
    const letter = drill.letterUp()
    const place = drill.staff().getAttribute('data-place')

    drill.answer(letter)
    expect(drill.say()?.textContent).toBe(`Yes, ${letter}.`)
    expect(drill.staff().querySelector('text')?.textContent).toBe(letter)
    expect(drill.playNote).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(RIGHT_MS)
    expect(drill.say()?.textContent).toBe('Which note is this?')
    expect(drill.staff().getAttribute('data-place')).not.toBe(place)
  })

  it('after a miss, gives the answer and says where it sits', () => {
    const drill = open()
    fireEvent.click(drill.getByRole('button', { name: 'Start' }))
    const letter = drill.letterUp()
    const place = Number(drill.staff().getAttribute('data-place'))
    const wrong: Letter = letter === 'C' ? 'D' : 'C'

    drill.answer(wrong)
    expect(drill.say()?.textContent).toBe(
      `That is ${letter}: ${placeWords(place, 'treble')}.`,
    )
    // The note's own key is marked, and so is the one that was tapped.
    expect(drill.getByRole('button', { name: letter }).className).toMatch(
      /answerRight/,
    )
    expect(drill.getByRole('button', { name: wrong }).className).toMatch(
      /answerWrong/,
    )

    vi.advanceTimersByTime(WRONG_MS)
    expect(drill.say()?.textContent).toBe('Which note is this?')
  })

  it('takes a typed letter as an answer', () => {
    const drill = open()
    fireEvent.click(drill.getByRole('button', { name: 'Start' }))
    const letter = drill.letterUp()
    fireEvent.keyDown(window, { key: letter.toLowerCase() })
    expect(drill.say()?.textContent).toBe(`Yes, ${letter}.`)
  })

  it('reads on the bass staff when the bass clef is picked, and remembers it', () => {
    const drill = open()
    fireEvent.click(drill.getByRole('button', { name: 'Bass' }))
    expect(drill.container.querySelector('.idle-hint')?.textContent).toBe(
      '10 notes · Bass staff · lines and spaces',
    )
    fireEvent.click(drill.getByRole('button', { name: 'Start' }))
    expect(drill.staff().getAttribute('data-clef')).toBe('bass')
    cleanup()

    const again = open()
    expect(
      again.getByRole('button', { name: 'Bass' }).getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('offers the answers as piano keys, still named by their letters', () => {
    const drill = open()
    fireEvent.click(drill.getByRole('button', { name: 'Piano keys' }))
    fireEvent.click(drill.getByRole('button', { name: 'Start' }))
    const answers = drill.getByRole('group', { name: 'Name the note' })
    expect(answers.className).toMatch(/keys/)
    const letter = drill.letterUp()
    drill.answer(letter)
    expect(drill.say()?.textContent).toBe(`Yes, ${letter}.`)
  })

  it('ends after ten notes with the count read right, and files the run', async () => {
    const drill = open()
    fireEvent.click(drill.getByRole('button', { name: 'Start' }))
    for (let i = 0; i < 10; i++) {
      drill.answer(drill.letterUp())
      vi.advanceTimersByTime(RIGHT_MS)
    }

    const card = drill.container.querySelector('.exercise-result-card')
    expect(card?.textContent).toContain('100%')
    expect(card?.textContent).toContain('Read right: 10 of 10')
    expect(drill.getByRole('button', { name: 'Try Again' })).toBeTruthy()

    const filed = exerciseHistory().filter(
      (entry) => entry.type === EXERCISE_NOTE_READING,
    )
    expect(filed).toHaveLength(1)
    expect(filed[0].score).toBe(100)
  })

  it('stopped part way, says so in place of a score', () => {
    const drill = open()
    fireEvent.click(drill.getByRole('button', { name: 'Start' }))
    drill.answer(drill.letterUp())
    vi.advanceTimersByTime(RIGHT_MS)
    fireEvent.click(drill.getByRole('button', { name: 'Stop' }))

    const card = drill.container.querySelector('.exercise-result-card')
    expect(card?.textContent).toContain('Read right: 1 of 1')
    expect(card?.querySelector('.exercise-result-grade')).toBeNull()
  })
})

describe('the clef a voice starts on', () => {
  it('is the bass clef for a bass and a baritone, the treble clef for the rest', () => {
    expect(clefForRange('bass')).toBe('bass')
    expect(clefForRange('baritone')).toBe('bass')
    expect(clefForRange('tenor')).toBe('treble')
    expect(clefForRange('alto')).toBe('treble')
    expect(clefForRange('soprano')).toBe('treble')
  })
})
