// ============================================================
// Lesson quiz tests — two quizzes on one page, and a question asked away from home
// ============================================================

import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { Done } from './progress'
import type { QuizAnswer, QuizQuestion } from './quiz'
import { createQuiz, lessonOfQuestion, linkAway, recallStepHref } from './quiz'

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

afterEach(async () => {
  // every answer's beacon settles in its own test's page, not the next one's
  await vi.dynamicImportSettled()
  document.body.textContent = ''
  document.getElementById('lesson-state')?.remove()
  window.history.replaceState(null, '', '/')
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** A page the site worker served, with an API base: where the beacon sends. */
function servedPage(): Mock<typeof fetch> {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.test')
  window.history.replaceState(null, '', '/learn/01')
  // A clock outside the consent regions, where a reader never asked is sent
  // (telemetry.ts lessonConsent).
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
    () =>
      ({
        resolvedOptions: () => ({ timeZone: 'America/New_York' }),
      }) as unknown as Intl.DateTimeFormat,
  )
  const tag = document.createElement('script')
  tag.type = 'application/json'
  tag.id = 'lesson-state'
  tag.textContent = '{"version":1,"updatedAt":null,"lessons":{},"drafts":true}'
  document.head.append(tag)
  const fetchMock = vi.fn<typeof fetch>(
    async () => new Response(null, { status: 201 }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** The metrics of each event the beacon posted. */
const sentMetrics = (fetchMock: Mock<typeof fetch>): unknown[] =>
  fetchMock.mock.calls.map(
    ([, init]) =>
      (JSON.parse(String(init?.body)) as { metrics: unknown }).metrics,
  )

describe('createQuiz', () => {
  it("names the learner's pick and the right answer in words, with no markup in any name", () => {
    // Arrange: an option that writes its sharp as a sign and a spoken word
    quizBox()
    const quiz = createQuiz({
      questions: [
        {
          id: 'l04-q9',
          question: 'Which note?',
          options: [
            {
              text: 'F<span aria-hidden="true">♯</span><span class="sr"> sharp</span>',
              correct: true,
              feedback: 'Because it is.',
            },
            { text: 'F', feedback: 'Not this one.' },
            { text: 'G', feedback: 'Not this one either.' },
          ],
        },
      ],
      keys: KEYS,
    })

    // Act: a miss
    answer(quiz.host, 0, 'G')

    // Assert
    const options = Array.from(
      quiz.host.querySelectorAll<HTMLButtonElement>('.opt'),
    )
    const tagOf = (b: HTMLButtonElement): string =>
      b.querySelector('.opt-tag')?.textContent ?? ''
    const pick = options.find((b) => b.classList.contains('wrong'))
    const right = options.find((b) => b.classList.contains('right'))
    const other = options.find((b) => b.classList.contains('dim'))
    expect(pick === undefined ? '' : tagOf(pick)).toBe(', Your answer')
    expect(right === undefined ? '' : tagOf(right)).toBe(', Right answer')
    expect(other?.querySelector('.opt-tag')).toBeNull()
    expect(options.some((b) => b.hasAttribute('aria-label'))).toBe(false)
  })

  it('tells a learner who picked the right answer that it was theirs and right', () => {
    // Arrange
    quizBox()
    const quiz = createQuiz({ questions: [question('l02-q1')], keys: KEYS })

    // Act
    answer(quiz.host, 0, 'The right answer')

    // Assert
    const right = quiz.host.querySelector('.opt.right')
    expect(right?.querySelector('.opt-tag')?.textContent).toBe(
      ', Your answer: right',
    )
    expect(right?.getAttribute('aria-pressed')).toBe('true')
  })

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

  it('says firstThisVisit once per question per visit, across a Reset, and again in the next visit', () => {
    // Arrange: one visit's answers, one of them again after Reset
    quizBox()
    const heard: QuizAnswer[] = []
    const opts = {
      questions: [question('l01-q1'), question('l01-q2')],
      lesson: 1,
      keys: KEYS,
      onAnswer: (a: QuizAnswer) => heard.push(a),
    }
    const quiz = createQuiz(opts)
    answer(quiz.host, 0, 'A wrong answer')
    document.getElementById('quizReset')?.click()
    answer(quiz.host, 0, 'The right answer')
    answer(quiz.host, 1, 'The right answer')
    document.body.textContent = ''
    quizBox()

    // Act: the next visit
    const next = createQuiz(opts)
    answer(next.host, 0, 'The right answer')

    // Assert
    expect(heard.map((a) => [a.id, a.firstThisVisit, a.visit])).toEqual([
      ['l01-q1', true, 1],
      ['l01-q1', false, 1],
      ['l01-q2', true, 1],
      ['l01-q1', true, 2],
    ])
  })

  it("tells onAnswer each question's number of options", () => {
    // Arrange: a two-option question and a three-option one
    quizBox()
    const heard: QuizAnswer[] = []
    const three: QuizQuestion = {
      ...question('l01-q2'),
      options: [
        ...question('l01-q2').options,
        { text: 'Another wrong answer', feedback: 'Nor this one.' },
      ],
    }
    const quiz = createQuiz({
      questions: [question('l01-q1'), three],
      lesson: 1,
      keys: KEYS,
      onAnswer: (a) => heard.push(a),
    })

    // Act
    answer(quiz.host, 0, 'The right answer')
    answer(quiz.host, 1, 'Another wrong answer')

    // Assert
    expect(heard.map((a) => a.k)).toEqual([2, 3])
  })

  it('sends the beacon once per question per visit, never for a re-answer after Reset', async () => {
    // Arrange
    const fetchMock = servedPage()
    quizBox()
    const opts = {
      questions: [question('l01-q1'), question('l01-q2')],
      lesson: 1,
      keys: KEYS,
    }
    const quiz = createQuiz(opts)
    answer(quiz.host, 0, 'A wrong answer')
    document.getElementById('quizReset')?.click()
    answer(quiz.host, 0, 'The right answer')
    answer(quiz.host, 1, 'The right answer')
    document.body.textContent = ''
    quizBox()

    // Act: the next visit answers the first again
    const next = createQuiz(opts)
    answer(next.host, 0, 'The right answer')
    await vi.dynamicImportSettled()

    // Assert: the first answer of each, in each visit
    expect(sentMetrics(fetchMock)).toMatchObject([
      { q: 1, firstTry: 0, visit: 1 },
      { q: 2, firstTry: 1, visit: 1 },
      { q: 1, firstTry: 1, visit: 2 },
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

describe('recallStepHref', () => {
  it("opens a lesson's own page at the step, for a recall's step links", () => {
    expect(recallStepHref(6, 3)).toBe('/learn/06#step-3')
    expect(recallStepHref(2, 6)).toBe('/learn/02#step-6')
    expect(recallStepHref(12, 1)).toBe('/learn/12#step-1')
  })
})
