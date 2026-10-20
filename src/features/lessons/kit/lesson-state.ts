// ============================================================
// Lesson states — where each lesson stands for this viewer, and its one action
// ============================================================
//
// Every surface that lists lessons asks this one function: the explorer's
// card, the masthead's lesson menu and the Wrap's next-lesson card. A
// lesson is done (the viewer marked it), here (this page's own lesson), in
// progress (a step remembered from its page, position.ts), up next (the
// first live lesson not done whose prerequisites are), ready (live), or
// coming later (no page live: the caller hands in the season as the page's
// state shows it, page-state.ts, where a lesson held back has no page, so
// it reads exactly like a lesson not made yet).
//
// Each live lesson has one main action: "Start lesson" at its page's top
// (not at the steps, which would skip the cold open), "Continue: step N" at
// a remembered step, or "Read again" once it is done. Within its own page
// the action stays on the page. A remembered step for a lesson with no page
// is ignored, since its link would lead nowhere.
//
// Pure: the caller hands in the done list and the remembered steps, so a
// test needs neither storage nor a page.

import type { StepMark, StepMarks } from './position'
import type { Lesson } from './season'
import { PREREQ } from './season'

export type LessonState =
  | 'done'
  | 'here'
  | 'progress'
  | 'next'
  | 'ready'
  | 'later'

/** What the page knows of this viewer. */
export interface Viewer {
  /** The lessons they marked done. */
  readonly done: ReadonlySet<number>
  /** The furthest step they reached in each lesson (position.ts). */
  readonly steps: StepMarks
  /** This page's own lesson. */
  readonly current: number
}

export interface LessonAction {
  readonly kind: 'start' | 'continue' | 'again'
  readonly label: string
  readonly href: string
}

export interface LessonView {
  readonly lesson: Lesson
  readonly state: LessonState
  /** Marked done; true of this page's lesson too, whose state stays 'here'. */
  readonly done: boolean
  /** The step to go back to, for a live lesson begun and not done; null otherwise. */
  readonly step: StepMark | null
  /** The main action; null for a lesson coming later. */
  readonly action: LessonAction | null
}

/** A remembered step worth going back to: past the first. */
const begun = (mark: StepMark | undefined): mark is StepMark =>
  mark !== undefined && mark.step >= 2 && mark.step <= mark.of

/**
 * The lesson to recommend next: the first live lesson, other than this
 * page's, that is not done and whose direct prerequisites are all done.
 */
export function upNext(
  lessons: readonly Lesson[],
  viewer: Viewer,
): number | null {
  for (const L of lessons) {
    if (L.page === undefined || L.n === viewer.current) continue
    if (viewer.done.has(L.n)) continue
    if ((PREREQ[L.n] ?? []).every((p) => viewer.done.has(p))) return L.n
  }
  return null
}

function actionFor(
  L: Lesson,
  done: boolean,
  step: StepMark | null,
  current: number,
): LessonAction | null {
  if (L.page === undefined) return null
  const page = L.n === current ? '' : L.page
  const top = page === '' ? '#top' : page
  if (done) return { kind: 'again', label: 'Read again', href: top }
  if (step !== null)
    return {
      kind: 'continue',
      label: `Continue: step ${step.step}`,
      href: `${page}#step-${step.step}`,
    }
  return { kind: 'start', label: 'Start lesson', href: top }
}

/** The first that holds: coming later, here, done, in progress, up next, ready. */
function stateOf(
  L: Lesson,
  done: boolean,
  step: StepMark | null,
  current: number,
  next: number | null,
): LessonState {
  if (L.page === undefined) return 'later'
  if (L.n === current) return 'here'
  if (done) return 'done'
  if (step !== null) return 'progress'
  return L.n === next ? 'next' : 'ready'
}

/** Every lesson as this viewer stands with it, in season order. */
export function lessonViews(
  lessons: readonly Lesson[],
  viewer: Viewer,
): LessonView[] {
  const next = upNext(lessons, viewer)
  return lessons.map((L) => {
    const done = viewer.done.has(L.n)
    const kept = viewer.steps[L.n]
    const step = L.page !== undefined && !done && begun(kept) ? kept : null
    return {
      lesson: L,
      state: stateOf(L, done, step, viewer.current, next),
      done,
      step,
      action: actionFor(L, done, step, viewer.current),
    }
  })
}

const minutes = (L: Lesson): string =>
  L.minutes === undefined ? '' : ` · ${L.minutes} min`

/**
 * Where the viewer stands with a lesson other than this page's, in the
 * words a list row or a card says it: "Ready · 10 min", "Step 3 of 6",
 * "Done · 10 min" or "Coming later".
 */
export function stateWords(v: LessonView): string {
  if (v.state === 'later') return 'Coming later'
  if (v.done) return `Done${minutes(v.lesson)}`
  if (v.step !== null) return `Step ${v.step.step} of ${v.step.of}`
  return `Ready${minutes(v.lesson)}`
}
