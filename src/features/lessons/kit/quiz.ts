// ============================================================
// Lesson quiz — the quick check: one try each, then the reason
// ============================================================
//
// Every lesson page runs this engine on its own questions, and on a later
// lesson's page it runs the recall check, which asks an earlier lesson's
// questions under that lesson's ids. The answer order is shuffled per
// viewer and per question from a stored seed, so it stays put between
// visits. The stored record keeps each question's first answer ever (for
// the first-try score) and its latest one. It is never rendered: on a
// return visit the questions are asked afresh, so the page measures delayed
// retrieval (MASTER-PLAN § 9).
//
// Two quizzes can share a page: each takes an id prefix for the elements it
// reads and the ids it writes. A question asked on another lesson's page
// keeps its "Try Step N again" link, but as a plain link to its own
// lesson's page ("Try Lesson 2, Step N again"): `data-goto-step` there
// would move the reusing page's own deck. While that lesson is not live
// here (page-state.ts) the words stay with no link, which would lead to the
// 404 page.
//
// Questions, answers and feedback are markup (feedback may link back into a
// step), so they must come from the lesson's own code, never from a viewer.

import { mulberry32, q, store } from './dom'
import { reducedMotion } from './motion-switch'
import { lessonLive } from './page-state'
import { Done } from './progress'
import type { StepDeck } from './step-deck'

export interface QuizOption {
  /** The answer as shown (markup). */
  readonly text: string
  readonly correct?: true
  /**
   * One line after "Right." or "Not quite." (markup). A link with
   * `data-goto-step="3"` takes the viewer back to Step 3.
   */
  readonly feedback: string
}

export interface QuizQuestion {
  /**
   * The telemetry's question_id, the same on every page that asks it:
   * `l02-q1` is Lesson 2's question 1, and its lesson is read from it.
   */
  readonly id: string
  /** The question (markup). */
  readonly question: string
  /** In authored order; the page shuffles them per viewer. */
  readonly options: readonly QuizOption[]
  /**
   * The question's own controls (markup, such as a play button), placed
   * after its heading and outside it, so they are not part of every
   * answer's name. Built once and kept across answers, so a control keeps
   * its state; handle its events with a listener on the quiz's `host`.
   */
  readonly slot?: string
}

/** One answer, as the telemetry will report it. */
export interface QuizAnswer {
  readonly id: string
  /** The option's index in authored order. */
  readonly option: number
  readonly correct: boolean
  /** The viewer's first answer to this question ever. */
  readonly first: boolean
  /** How many times this viewer has opened this quiz, this visit included. */
  readonly visit: number
}

export interface QuizOptions {
  readonly questions: readonly QuizQuestion[]
  /** The lesson to mark done once every question has an answer; a recall check marks none. */
  readonly lesson?: number
  /** localStorage keys: the answer-order seed, and the first-and-last answer record. */
  readonly keys: { readonly seed: string; readonly record: string }
  /** This page's step deck, for feedback that sends the viewer back to one of its steps. */
  readonly deck?: StepDeck
  /**
   * Prefix for every id the quiz reads and writes: it binds `#${prefix}qs`,
   * `#${prefix}scoreN` and `#${prefix}quizReset` and writes
   * `${prefix}q0` and `${prefix}fb0` onwards. Default '' (Lesson 1's ids).
   */
  readonly prefix?: string
  /**
   * Where a step link goes for a question from another lesson: by default
   * `/learn/0M#lesson`, in a new tab, so the viewer keeps their place here.
   */
  readonly away?: {
    readonly href?: (lesson: number, step: number) => string
    readonly newTab?: boolean
  }
  /** Hears every answer, the telemetry's event once that track exists. */
  readonly onAnswer?: (answer: QuizAnswer) => void
}

export interface Quiz {
  /** The element the questions render into: listen here for a slot's controls. */
  readonly host: HTMLElement
}

/** Question index to option index (in authored order). */
type Answers = Partial<Record<number, number>>

interface AnswerRecord {
  first: Answers
  last: Answers
  visits: number
}

const CHECK =
  '<svg class="ico" style="width:15px;height:15px" aria-hidden="true"><use href="#i-check"/></svg>'
const CROSS =
  '<svg class="ico" style="width:14px;height:14px" aria-hidden="true"><use href="#i-x"/></svg>'

/** The lesson a question belongs to, read from its id (`l02-q1` is Lesson 2's); null if the id says none. */
export function lessonOfQuestion(id: string): number | null {
  const m = /^l(\d+)-/.exec(id)
  return m === null ? null : Number(m[1])
}

/** A lesson page's address, at its steps: `/learn/02#lesson`. */
export const lessonPageHref = (lesson: number): string =>
  `/learn/${String(lesson).padStart(2, '0')}#lesson`

function storedSeed(key: string): number {
  const stored = store.get<unknown>(key, null)
  if (typeof stored === 'number') return stored
  const seed = Math.floor(Math.random() * 1e9)
  store.set(key, seed)
  return seed
}

/** Each question's options in display order (a Fisher-Yates shuffle seeded per question). */
function answerOrder(
  questions: readonly QuizQuestion[],
  seed: number,
): number[][] {
  return questions.map((question, i) => {
    const random = mulberry32(seed + i * 7919)
    const idx = question.options.map((_, j) => j)
    for (let j = idx.length - 1; j > 0; j--) {
      const k = Math.floor(random() * (j + 1))
      ;[idx[j], idx[k]] = [idx[k], idx[j]]
    }
    return idx
  })
}

const isAnswers = (v: unknown): v is Answers =>
  typeof v === 'object' && v !== null

function loadRecord(key: string): AnswerRecord {
  const stored = store.get<Partial<Record<keyof AnswerRecord, unknown>> | null>(
    key,
    null,
  )
  if (stored === null || typeof stored !== 'object' || !isAnswers(stored.first))
    return { first: {}, last: {}, visits: 0 }
  return {
    first: stored.first,
    last: isAnswers(stored.last) ? stored.last : {},
    visits: typeof stored.visits === 'number' ? stored.visits | 0 : 0,
  }
}

/**
 * A question from another lesson: each step link becomes a plain link to
 * that lesson's page, "Try Step 3 again" reading "Try Lesson 2, Step 3
 * again". Where that lesson is not live, the words stay and the link goes.
 */
export function linkAway(
  box: ParentNode,
  lesson: number,
  away: QuizOptions['away'] = {},
): void {
  const href = away.href ?? lessonPageHref
  const live = lessonLive(lesson)
  for (const a of Array.from(
    box.querySelectorAll<HTMLAnchorElement>('a[data-goto-step]'),
  )) {
    const step = Number(a.dataset.gotoStep)
    a.removeAttribute('data-goto-step')
    const text = /^Try Step (\d+) again$/.exec(a.textContent ?? '')
    if (text !== null)
      a.textContent = `Try Lesson ${lesson}, Step ${text[1]} again`
    if (!live) {
      a.replaceWith(...Array.from(a.childNodes))
      continue
    }
    a.href = href(lesson, step)
    if (away.newTab !== false) {
      a.target = '_blank'
      a.rel = 'noopener'
    }
  }
}

export function createQuiz(opts: QuizOptions): Quiz {
  const { questions, lesson, keys, deck } = opts
  const prefix = opts.prefix ?? ''
  const order = answerOrder(questions, storedSeed(keys.seed))
  const host = q(`#${prefix}qs`)
  const scoreEl = q(`#${prefix}scoreN`)
  const resetBtn = q<HTMLButtonElement>(`#${prefix}quizReset`)
  const rec = loadRecord(keys.record)
  rec.visits += 1
  store.set(keys.record, rec)
  let answers: Answers = {}
  // a question asked on another lesson's page links to that lesson's page
  const owners = questions.map((question) => lessonOfQuestion(question.id))
  const awayLesson = (i: number): number | null => {
    const owner = owners[i]
    return owner !== null && owner !== lesson ? owner : null
  }
  // each slot is built once, so its controls keep their state across answers
  const slots = questions.map((question) => {
    if (question.slot === undefined) return null
    const el = document.createElement('div')
    el.className = 'q-slot'
    el.innerHTML = question.slot
    return el
  })

  function record(i: number, j: number): void {
    const first = rec.first[i] == null
    if (first) rec.first[i] = j
    rec.last[i] = j
    store.set(keys.record, rec)
    opts.onAnswer?.({
      id: questions[i].id,
      option: j,
      correct: questions[i].options[j].correct === true,
      first,
      visit: rec.visits,
    })
  }

  function optionButton(i: number, j: number, pos: number): HTMLElement {
    const option = questions[i].options[j]
    const chosen = answers[i]
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'opt'
    b.innerHTML = `<span class="mk" aria-hidden="true">${String.fromCharCode(65 + pos)}</span><span>${option.text}</span>`
    if (chosen !== undefined) {
      b.disabled = true
      if (option.correct === true) {
        b.classList.add('right')
        q('.mk', b).innerHTML = CHECK
        b.setAttribute('aria-label', `${option.text} (the right answer)`)
      } else if (chosen === j) {
        b.classList.add('wrong')
        q('.mk', b).innerHTML = CROSS
      } else b.classList.add('dim')
      if (chosen === j) b.setAttribute('aria-pressed', 'true')
    }
    b.addEventListener('click', () => {
      answers[i] = j
      record(i, j)
      render()
      document.getElementById(`${prefix}fb${i}`)?.focus({ preventScroll: true })
    })
    return b
  }

  function feedback(i: number, option: QuizOption): HTMLElement {
    const fb = document.createElement('p')
    fb.className = option.correct === true ? 'fb' : 'fb no'
    fb.id = `${prefix}fb${i}`
    fb.tabIndex = -1
    fb.innerHTML = `<b>${option.correct === true ? 'Right.' : 'Not quite.'}</b> ${option.feedback}`
    const owner = awayLesson(i)
    if (owner !== null) linkAway(fb, owner, opts.away)
    return fb
  }

  function render(): void {
    host.textContent = ''
    let score = 0
    let answered = 0
    questions.forEach((question, i) => {
      const box = document.createElement('div')
      box.className = 'q'
      box.innerHTML = `<span class="qn" aria-hidden="true">${i + 1}</span><div><h3 id="${prefix}q${i}">${question.question}</h3><div class="opts" role="group" aria-labelledby="${prefix}q${i}"></div></div>`
      const group = q('.opts', box)
      const slot = slots[i]
      if (slot !== null) group.before(slot)
      order[i].forEach((j, pos) => group.appendChild(optionButton(i, j, pos)))
      const chosen = answers[i]
      const option = chosen === undefined ? undefined : question.options[chosen]
      if (option !== undefined) {
        answered++
        if (option.correct === true) score++
        box.appendChild(feedback(i, option))
      }
      host.appendChild(box)
    })
    scoreEl.textContent = String(score)
    resetBtn.hidden = answered === 0
    if (
      lesson !== undefined &&
      answered === questions.length &&
      !Done.has(lesson)
    )
      Done.set(lesson, true)
  }

  // "Try Step 3 again": the step first, then the scroll to it
  host.addEventListener('click', (e) => {
    const link =
      e.target instanceof Element
        ? e.target.closest<HTMLElement>('[data-goto-step]')
        : null
    if (!link || deck === undefined) return
    e.preventDefault()
    const step = Number(link.dataset.gotoStep)
    deck.show(step)
    q('#lesson').scrollIntoView({
      behavior: reducedMotion() ? 'auto' : 'smooth',
    })
    window.setTimeout(
      () => deck.show(step, { scroll: true }),
      reducedMotion() ? 0 : 700,
    )
  })
  resetBtn.addEventListener('click', () => {
    answers = {}
    render()
    host.querySelector<HTMLElement>('.opt')?.focus({ preventScroll: true })
  })
  render()
  return { host }
}
