// ============================================================
// Lesson position — the furthest step this viewer has reached in each lesson
// ============================================================
//
// One map in localStorage, `fyp-pos`, beside the done list (progress.ts):
// `{ "2": { "step": 3, "of": 6 } }`. A lesson page writes it as its step
// deck moves (`rememberSteps`), and every list of lessons reads it, so a
// lesson left half way offers "Continue: step 3" from any page.
//
// It keeps the furthest step, not the last one: on a wide screen the deck
// follows the scroll, and scrolling back up to reread the cold open is not
// going back. Marking a lesson done forgets its step, so the lesson reads
// again from the top. Anything unreadable in the map is ignored, never
// trusted, and a browser that refuses storage simply remembers nothing.

import { store } from './dom'
import { Done } from './progress'
import type { StepDeck } from './step-deck'

const KEY = 'fyp-pos'

/** A step of a lesson's deck: `step` of `of`, counted from 1. */
export interface StepMark {
  readonly step: number
  readonly of: number
}

/** Each lesson's remembered step, by lesson number. */
export type StepMarks = Readonly<Partial<Record<number, StepMark>>>

const listeners = new Set<() => void>()

function isMark(value: unknown): value is StepMark {
  if (typeof value !== 'object' || value === null) return false
  const { step, of } = value as Record<string, unknown>
  return (
    typeof step === 'number' &&
    typeof of === 'number' &&
    Number.isInteger(step) &&
    Number.isInteger(of) &&
    step >= 1 &&
    step <= of &&
    of <= 99
  )
}

function read(): Record<number, StepMark> {
  const stored = store.get<unknown>(KEY, {})
  const marks: Record<number, StepMark> = {}
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored))
    return marks
  for (const [key, value] of Object.entries(stored)) {
    const n = Number(key)
    if (Number.isInteger(n) && n >= 0 && isMark(value))
      marks[n] = { step: value.step, of: value.of }
  }
  return marks
}

function write(marks: Record<number, StepMark>): void {
  store.set(KEY, marks)
  listeners.forEach((fn) => fn())
}

export const Positions = {
  /** Every lesson's remembered step. */
  all(): StepMarks {
    return read()
  },
  get(n: number): StepMark | null {
    return read()[n] ?? null
  },
  /**
   * Remembers that the viewer reached `mark` in lesson `n`, unless they had
   * already gone further in the same deck. A deck of another length (the
   * page has changed since) starts again from `mark`.
   */
  reach(n: number, mark: StepMark): void {
    if (!Number.isInteger(n) || n < 0 || !isMark(mark)) return
    const marks = read()
    const had = marks[n]
    if (had !== undefined && had.of === mark.of && had.step >= mark.step) return
    marks[n] = { step: mark.step, of: mark.of }
    write(marks)
  },
  clear(n: number): void {
    const marks = read()
    if (marks[n] === undefined) return
    delete marks[n]
    write(marks)
  },
  /** Calls `fn` after every change (not now); returns the unsubscribe. */
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
}

// a lesson marked done, by its quiz or its card, reads again from the top
Done.subscribe(() => {
  for (const n of Done.list()) Positions.clear(n)
})

/**
 * Remembers how far the viewer gets in this page's lesson: from the deck's
 * first step change on, so opening the page is not progress, and never for
 * a lesson already done.
 */
export function rememberSteps(lesson: number, deck: StepDeck): void {
  deck.subscribe((step) => {
    if (!Done.has(lesson)) Positions.reach(lesson, { step, of: deck.count })
  })
}
