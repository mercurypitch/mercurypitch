// ============================================================
// Lesson quiz tests — two quizzes on one page, and a question asked away from home
// ============================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import { Done } from './progress'
import type { QuizAnswer, QuizQuestion } from './quiz'
import { createQuiz, lessonOfQuestion, linkAway } from './quiz'

const STEP_LINK = '<a href="#lesson" data-goto-step="3">Try Step 3 again</a>'
const KEYS = { seed: 'test-seed', record: 'test-record' }
const RECALL_KEYS = { seed: 'test-recall-seed', record: 'test-recall-record' }

const question = (id: string, slot?: string): QuizQuestion => ({
  id,
  question: `Question ${id}`,
  options: [
    { text: 'The right answer', correct: true, feedback: 'Because it is.' },
    { text: 'A wrong answer', feedback: `Not this one. ${STEP_LINK}` },
  ],
  ...(slot === undefined ? {} : { slot }),
})

/** A quiz's markup, its ids under `prefix`. */
function quizBox(prefix = ''): void {
  const box = document.createElement('section')
  box.innerHTML = `<div id="${prefix}qs"></div><p><b id="${prefix}scoreN">0</b></p><button type="button" id="${prefix}quizReset" hidden>Reset</button>`
  document.body.appendChild(box)
}

/** Clicks the option of question `i` whose text includes `text`. */
function answer(host: HTMLElement, i: number, text: string): void {
  const box = host.querySelectorAll('.q')[i]
  const option = Array.from(
    box.querySelectorAll<HTMLButtonElement>('.opt'),
  ).find((b) => (b.textContent ?? '').includes(text))
  if (option === undefined) throw new Error(`no option "${text}"`)
  option.click()
}

const text = (id: string): string | null =>
  document.getElementById(id)?.textContent ?? null

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  document.body.textContent = ''
})

describe('createQuiz', () => {
  it('keeps two quizzes on one page apart, each reading and writing its own ids', () => {
    // Arrange
    quizBox()
    quizBox('recall-')
    const own = createQuiz({
      questions: [question('l02-q1')],
      lesson: 2,
      keys: KEYS,
    })
    const recall = createQuiz({
      questions: [question('l01-q1')],
      prefix: 'recall-',
      keys: RECALL_KEYS,
    })

    // Act
    answer(recall.host, 0, 'The right answer')

    // Assert
    const ids = Array.from(document.querySelectorAll('[id]')).map((e) => e.id)
    expect(text('recall-scoreN')).toBe('1')
    expect(text('scoreN')).toBe('0')
    expect(recall.host.querySelector('.fb')?.id).toBe('recall-fb0')
    expect(own.host.querySelector('.fb')).toBeNull()
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("sends a reused question's step link to its own lesson's page, in a new tab", () => {
    // Arrange: Lesson 2's page asks Lesson 1's question
    quizBox('recall-')
    const quiz = createQuiz({
      questions: [question('l01-q1')],
      lesson: 2,
      prefix: 'recall-',
      keys: RECALL_KEYS,
    })

    // Act
    answer(quiz.host, 0, 'A wrong answer')

    // Assert
    const link = quiz.host.querySelector<HTMLAnchorElement>('.fb a')
    expect(link?.getAttribute('href')).toBe('/learn/01#lesson')
    expect(link?.target).toBe('_blank')
    expect(link?.rel).toBe('noopener')
    expect(link?.textContent).toBe('Try Lesson 1, Step 3 again')
    expect(link?.hasAttribute('data-goto-step')).toBe(false)
  })

  it("leaves its own question's step link moving this page's deck", () => {
    // Arrange
    quizBox()
    const quiz = createQuiz({
      questions: [question('l01-q1')],
      lesson: 1,
      keys: KEYS,
    })

    // Act
    answer(quiz.host, 0, 'A wrong answer')

    // Assert
    const link = quiz.host.querySelector<HTMLAnchorElement>('.fb a')
    expect(link?.dataset.gotoStep).toBe('3')
    expect(link?.textContent).toBe('Try Step 3 again')
    expect(link?.target).toBe('')
  })

  it('marks its own lesson done once every question has an answer', () => {
    // Arrange
    quizBox()
    const quiz = createQuiz({
      questions: [question('l01-q1'), question('l01-q2')],
      lesson: 1,
      keys: KEYS,
    })
    answer(quiz.host, 0, 'A wrong answer')

    // Act
    answer(quiz.host, 1, 'The right answer')

    // Assert
    expect(Done.list()).toEqual([1])
  })

  it('marks no lesson done for a recall check, however many it answers', () => {
    // Arrange
    quizBox('recall-')
    const quiz = createQuiz({
      questions: [question('l01-q1'), question('l01-q2')],
      prefix: 'recall-',
      keys: RECALL_KEYS,
    })
    answer(quiz.host, 0, 'The right answer')

    // Act
    answer(quiz.host, 1, 'The right answer')

    // Assert
    expect(Done.list()).toEqual([])
  })

  it("tells onAnswer each answer's question id, and whether it was the viewer's first", () => {
    // Arrange: a wrong first answer, then Reset
    quizBox()
    const heard: QuizAnswer[] = []
    const quiz = createQuiz({
      questions: [question('l01-q1')],
      lesson: 1,
      keys: KEYS,
      onAnswer: (a) => heard.push(a),
    })
    answer(quiz.host, 0, 'A wrong answer')
    document.getElementById('quizReset')?.click()

    // Act
    answer(quiz.host, 0, 'The right answer')

    // Assert
    expect(heard.map((a) => [a.id, a.option, a.correct, a.first])).toEqual([
      ['l01-q1', 1, false, true],
      ['l01-q1', 0, true, false],
    ])
  })

  it("keeps a question's own controls after its heading, the same element across answers", () => {
    // Arrange
    quizBox()
    const quiz = createQuiz({
      questions: [
        question(
          'l02-q2',
          '<button type="button" class="hear">Hear it</button>',
        ),
      ],
      lesson: 2,
      keys: KEYS,
    })
    const slot = quiz.host.querySelector('.q-slot')

    // Act
    answer(quiz.host, 0, 'The right answer')

    // Assert: kept, outside the heading, so no answer's name includes it
    const after = quiz.host.querySelector('.q-slot')
    expect(after).not.toBeNull()
    expect(after).toBe(slot)
    expect(after?.closest('h3')).toBeNull()
    expect(after?.nextElementSibling?.classList.contains('opts')).toBe(true)
    expect(quiz.host.querySelector('h3')?.textContent).toBe('Question l02-q2')
  })
})

describe('linkAway', () => {
  it('lets a page send a step link elsewhere, in the same tab', () => {
    // Arrange
    const box = document.createElement('p')
    box.innerHTML = STEP_LINK

    // Act
    linkAway(box, 1, {
      href: (lesson, step) => `/learn/0${lesson}#step-${step}`,
      newTab: false,
    })

    // Assert
    const link = box.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/learn/01#step-3')
    expect(link?.target).toBe('')
    expect(link?.textContent).toBe('Try Lesson 1, Step 3 again')
  })

  it("keeps a step link's words and drops its link where that lesson is not live", () => {
    // Arrange: the page's state holds Lesson 2 back
    const tag = document.createElement('script')
    tag.type = 'application/json'
    tag.id = 'lesson-state'
    tag.textContent = JSON.stringify({
      version: 1,
      updatedAt: null,
      lessons: { 2: { published: false } },
      drafts: true,
    })
    document.head.append(tag)
    const box = document.createElement('p')
    box.innerHTML = STEP_LINK

    // Act
    linkAway(box, 2)
    tag.remove()

    // Assert
    expect(box.querySelector('a')).toBeNull()
    expect(box.textContent).toBe('Try Lesson 2, Step 3 again')
  })
})

describe('lessonOfQuestion', () => {
  it("reads a question's lesson from its id, and none from an id without one", () => {
    // Act
    const lessons = ['l02-q3', 'l14-q1', 'q3'].map((id) => lessonOfQuestion(id))

    // Assert
    expect(lessons).toEqual([2, 14, null])
  })
})
