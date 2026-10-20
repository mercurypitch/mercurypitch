// ============================================================
// Next-lesson card — the Wrap's way on to the lesson after this one
// ============================================================
//
// Every lesson's Wrap ends on the lesson after it: its number and name,
// where the viewer stands with it, its tease, its hook question and one way
// on. The card is drawn from the season (season.ts, its copy from
// lesson-copy.ts) and the viewer's place (lesson-state.ts), in the words
// the explorer's card and the masthead's lesson menu use, so releasing a
// lesson changes no other lesson's page. The tease is one line set on the
// lesson it teases, above its hook: the next opening in miniature, never
// its answer.
//
// A live lesson's card is its main action: "Start lesson" at its page's
// top, "Continue: step N" at a step the viewer reached, or "Read again"
// once it is done. A lesson coming later, as a draft a production build
// hides is, has no page to link: its card says "Coming later" and opens the
// map on it ("See it on the map"), through the explorer's
// `[data-select-lesson]`, which selects the lesson there.
//
// After the season's last lesson there is no lesson to go on to, and the
// card closes the season instead: the trailer's question answered, and two
// ways on, Karaoke Night for a whole song and the season's map. It holds
// two links, so it is no link itself.
//
// A page marks the card's place with `[data-next-card]`, its classes the
// card's; whatever the mark holds, such as Lesson 2's two figures, stays in
// the card after its words. Draw it before `createExplorer`, which binds the
// map link.

import { svg } from './dom'
import { SEASON_END } from './lesson-copy'
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
  /** Its tease, the line above its hook; null for a lesson with none. */
  readonly tease: string | null
  readonly hook: string
  /** Where the viewer stands with it: "Ready · 10 min", "Step 3 of 6", "Done · 10 min" or "Coming later". */
  readonly state: string
  /** "Start lesson", "Continue: step 3" or "Read again"; "See it on the map" for a lesson coming later. */
  readonly label: string
  readonly kind: LessonAction['kind'] | 'map'
  /** Its page, where the action goes; the map, for a lesson coming later. */
  readonly href: string
}

/** A link on the season's closing card. */
export interface EndLink {
  readonly label: string
  readonly href: string
}

/** The card that closes the season, on its last lesson's page. */
export interface SeasonEnd {
  readonly kind: 'end'
  readonly eyebrow: string
  readonly line: string
  /** Karaoke Night, marked with the page's lesson as every practise link is; it opens a tab of its own. */
  readonly song: EndLink
  /** The season's map, on this page. */
  readonly map: EndLink
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** The season's close, as the page of lesson `current` draws it. */
function seasonEnd(current: number): SeasonEnd {
  return {
    kind: 'end',
    eyebrow: SEASON_END.eyebrow,
    line: SEASON_END.line,
    song: {
      label: SEASON_END.song.label,
      href: `${SEASON_END.song.path}?lesson=${pad(current)}`,
    },
    map: { label: SEASON_END.map.label, href: SEASON_END.map.href },
  }
}

/**
 * The card for the lesson after lesson `current`; after the season's last
 * lesson, the season's close; null for a lesson the season does not have.
 */
export function nextCard(
  lessons: readonly Lesson[],
  done: readonly number[],
  steps: StepMarks,
  current: number,
): NextCard | SeasonEnd | null {
  const v = lessonViews(lessons, {
    done: new Set(done),
    steps,
    current,
  }).find((x) => x.lesson.n === current + 1)
  if (v === undefined)
    return lessons.some((L) => L.n === current) ? seasonEnd(current) : null
  const way =
    v.action ??
    ({ label: 'See it on the map', kind: 'map', href: '#explorer' } as const)
  return {
    n: v.lesson.n,
    title: v.lesson.title,
    tease: v.lesson.tease ?? null,
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

/** The card's words: the eyebrow, the tease, the hook and the way on. */
function words(c: NextCard): HTMLElement {
  return el(
    'div',
    'next-words',
    el(
      'p',
      'eyebrow',
      el('span', 'fig', 'Next lesson'),
      ` ${pad(c.n)} · ${c.title} `,
      el('span', 'tempo', c.state),
    ),
    ...(c.tease === null ? [] : [el('p', 'next-tease', c.tease)]),
    el('p', 'q2', c.hook),
    el('span', 'chip', el('i', ''), c.label),
  )
}

/** The season's closing card, in the mark's classes, keeping what the mark held after its words. */
function endCard(c: SeasonEnd, mark: HTMLElement, slot: Node[]): HTMLElement {
  const song = el('a', 'btn primary', c.song.label)
  song.setAttribute('href', c.song.href)
  song.setAttribute('target', '_blank')
  song.setAttribute('rel', 'noopener')
  // the practise links' mark for a tab of its own, after the name
  const out = svg('svg', { class: 'ico', 'aria-hidden': 'true' }, song)
  svg('use', { href: '#i-out' }, out)
  const map = el('a', 'btn', c.map.label)
  map.setAttribute('href', c.map.href)
  const card = el(
    'div',
    mark.className,
    el(
      'div',
      'next-words',
      el('p', 'eyebrow', el('span', 'fig', c.eyebrow)),
      el('p', 'end-line', c.line),
      el('p', 'end-ways', song, map),
    ),
    ...slot,
  )
  card.classList.add('is-end')
  card.dataset.nextCard = 'end'
  return card
}

/**
 * Draws the card for the lesson after `lesson` in the page's
 * `[data-next-card]`, and redraws it as lessons are marked done; after the
 * season's last lesson, the season's close. A page with no mark draws none.
 */
export function createNextCard(lesson: number): void {
  const mark = document.querySelector<HTMLElement>('[data-next-card]')
  if (mark === null) return
  const slot = Array.from(mark.childNodes)
  const read = (): NextCard | SeasonEnd | null =>
    nextCard(LESSONS, Done.list(), Positions.all(), lesson)
  const first = read()
  if (first === null) return
  if (first.kind === 'end') {
    mark.replaceWith(endCard(first, mark, slot))
    return
  }
  const card = document.createElement('a')
  card.className = mark.className
  const paint = (): void => {
    const c = read()
    if (c === null || c.kind === 'end') return
    card.setAttribute('href', c.href)
    card.dataset.nextCard = String(c.n)
    card.classList.toggle('is-again', c.kind === 'again')
    card.classList.toggle('is-later', c.kind === 'map')
    if (c.kind === 'map') card.dataset.selectLesson = String(c.n)
    else delete card.dataset.selectLesson
    card.replaceChildren(words(c), ...slot)
  }
  paint()
  mark.replaceWith(card)
  Done.subscribe(paint)
}
