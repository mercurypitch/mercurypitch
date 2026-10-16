// ============================================================
// Lesson quiz — the quick check: one try each, then the reason
// ============================================================
//
// Every lesson page runs this engine on its own questions. The answer order
// is shuffled per viewer and per question from a stored seed, so it stays
// put between visits. The stored record keeps each question's first answer
// ever (for the first-try score) and its latest one. It is never rendered:
// on a return visit the questions are asked afresh, so the page measures
// delayed retrieval (MASTER-PLAN § 9).
//
// Questions, answers and feedback are markup (feedback may link back into a
// step), so they must come from the lesson's own code, never from a viewer.

import { mulberry32, q, store } from './dom'
import { reducedMotion } from './motion-switch'
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
  /** The question (markup). */
  readonly question: string
  /** In authored order; the page shuffles them per viewer. */
  readonly options: readonly QuizOption[]
}

export interface QuizOptions {
  readonly questions: readonly QuizQuestion[]
  /** The lesson to mark done once every question has an answer. */
  readonly lesson: number
  /** localStorage keys: the answer-order seed, and the first-and-last answer record. */
  readonly keys: { readonly seed: string; readonly record: string }
  /** The lesson's step deck, for feedback that sends the viewer back to a step. */
  readonly deck: StepDeck
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

export function createQuiz(opts: QuizOptions): void {
  const { questions, lesson, keys, deck } = opts
  const order = answerOrder(questions, storedSeed(keys.seed))
  const host = q('#qs')
  const scoreEl = q('#scoreN')
  const resetBtn = q<HTMLButtonElement>('#quizReset')
  const rec = loadRecord(keys.record)
  rec.visits += 1
  store.set(keys.record, rec)
  let answers: Answers = {}

  function record(i: number, j: number): void {
    if (rec.first[i] == null) rec.first[i] = j
    rec.last[i] = j
    store.set(keys.record, rec)
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
      document.getElementById(`fb${i}`)?.focus({ preventScroll: true })
    })
    return b
  }

  function render(): void {
    host.textContent = ''
    let score = 0
    let answered = 0
    questions.forEach((question, i) => {
      const box = document.createElement('div')
      box.className = 'q'
      box.innerHTML = `<span class="qn" aria-hidden="true">${i + 1}</span><div><h3 id="q${i}">${question.question}</h3><div class="opts" role="group" aria-labelledby="q${i}"></div></div>`
      const group = q('.opts', box)
      order[i].forEach((j, pos) => group.appendChild(optionButton(i, j, pos)))
      const chosen = answers[i]
      const option = chosen === undefined ? undefined : question.options[chosen]
      if (option !== undefined) {
        answered++
        if (option.correct === true) score++
        const fb = document.createElement('p')
        fb.className = option.correct === true ? 'fb' : 'fb no'
        fb.id = `fb${i}`
        fb.tabIndex = -1
        fb.innerHTML = `<b>${option.correct === true ? 'Right.' : 'Not quite.'}</b> ${option.feedback}`
        box.appendChild(fb)
      }
      host.appendChild(box)
    })
    scoreEl.textContent = String(score)
    resetBtn.hidden = answered === 0
    if (answered === questions.length && !Done.has(lesson))
      Done.set(lesson, true)
  }

  // "Try Step 3 again": the step first, then the scroll to it
  host.addEventListener('click', (e) => {
    const link =
      e.target instanceof Element
        ? e.target.closest<HTMLElement>('[data-goto-step]')
        : null
    if (!link) return
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
}
