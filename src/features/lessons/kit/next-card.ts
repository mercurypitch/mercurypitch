// ============================================================
// Next-lesson card — the Wrap's way on to the lesson after this one
// ============================================================
//
// Every lesson's Wrap ends on the lesson after it: its number and name,
// where the viewer stands with it, its hook question and one way on. The
// card is drawn from the season (season.ts) and the viewer's place
// (lesson-state.ts), in the words the explorer's card and the masthead's
// lesson menu use, so releasing a lesson changes no other lesson's page.
//
// A live lesson's card is its main action: "Start lesson" at its page's
// top, "Continue: step N" at a step the viewer reached, or "Read again"
// once it is done. A lesson coming later, as a draft a production build
// hides is, has no page to link: its card says "Coming later" and opens the
// map on it ("See it on the map"), through the explorer's
// `[data-select-lesson]`, which selects the lesson there.
//
// A page marks the card's place with `[data-next-card]`, its classes the
// card's; whatever the mark holds, such as Lesson 2's two figures, stays in
// the card after its words. Draw it before `createExplorer`, which binds the
// map link.

import type { LessonAction } from './lesson-state'
import { lessonViews, stateWords } from './lesson-state'
import type { StepMarks } from './position'
import { Positions } from './position'
import { Done } from './progress'
import type { Lesson } from './season'
import { LESSONS } from './season'

/** The lesson after this page's, as its card shows it. */
export interface NextCard {
  readonly n: number
  readonly title: string
  readonly hook: string
  /** Where the viewer stands with it: "Ready · 10 min", "Step 3 of 6", "Done · 10 min" or "Coming later". */
  readonly state: string
  /** "Start lesson", "Continue: step 3" or "Read again"; "See it on the map" for a lesson coming later. */
  readonly label: string
  readonly kind: LessonAction['kind'] | 'map'
  /** Its page, where the action goes; the map, for a lesson coming later. */
  readonly href: string
}

/** The card for the lesson after lesson `current`, or null after the season's last. */
export function nextCard(
  lessons: readonly Lesson[],
  done: readonly number[],
  steps: StepMarks,
  current: number,
): NextCard | null {
  const v = lessonViews(lessons, {
    done: new Set(done),
    steps,
    current,
  }).find((x) => x.lesson.n === current + 1)
  if (v === undefined) return null
  const way =
    v.action ??
    ({ label: 'See it on the map', kind: 'map', href: '#explorer' } as const)
  return {
    n: v.lesson.n,
    title: v.lesson.title,
    hook: v.lesson.hook,
    state: stateWords(v),
    label: way.label,
    kind: way.kind,
    href: way.href,
  }
}

function el(tag: string, cls: string, ...kids: (Node | string)[]): HTMLElement {
  const e = document.createElement(tag)
  if (cls !== '') e.className = cls
  e.append(...kids)
  return e
}

/** The card's words: the eyebrow, the hook and the way on. */
function words(c: NextCard): HTMLElement {
  return el(
    'div',
    'next-words',
    el(
      'p',
      'eyebrow',
      el('span', 'fig', 'Next lesson'),
      ` ${String(c.n).padStart(2, '0')} · ${c.title} `,
      el('span', 'tempo', c.state),
    ),
    el('p', 'q2', c.hook),
    el('span', 'chip', el('i', ''), c.label),
  )
}

/**
 * Draws the card for the lesson after `lesson` in the page's
 * `[data-next-card]`, and redraws it as lessons are marked done. A page with
 * no mark, or the season's last lesson, draws none.
 */
export function createNextCard(lesson: number): void {
  const mark = document.querySelector<HTMLElement>('[data-next-card]')
  if (mark === null) return
  const slot = Array.from(mark.childNodes)
  const card = document.createElement('a')
  card.className = mark.className
  const paint = (): void => {
    const c = nextCard(LESSONS, Done.list(), Positions.all(), lesson)
    if (c === null) return
    card.setAttribute('href', c.href)
    card.dataset.nextCard = String(c.n)
    card.classList.toggle('is-again', c.kind === 'again')
    card.classList.toggle('is-later', c.kind === 'map')
    if (c.kind === 'map') card.dataset.selectLesson = String(c.n)
    else delete card.dataset.selectLesson
    card.replaceChildren(words(c), ...slot)
  }
  paint()
  if (!card.hasAttribute('href')) return
  mark.replaceWith(card)
  Done.subscribe(paint)
}
