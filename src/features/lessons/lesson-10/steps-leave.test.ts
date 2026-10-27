// ============================================================
// Lesson 10 leaving a step — what the steps set sounding stops, by every route
// ============================================================
//
// WEB-SPEC, Tests 7's last clause and Toys 1's states: leaving a step by
// each route, Previous, Next, a swipe, the lesson menu's jump, a `#step-N`
// address and a quick-check step link, stops the stage's run, Step 4's
// pattern among them, and cancels a game's replay still to come, so
// running the clock on starts nothing new; a layout switch, the deck's
// `onStep` with the step showing, stops nothing, and the pattern plays on.
// On the page's own markup and deck, its runs recorded (kit/run-recorder.
// test-fixtures.ts) on fake timers. Step 5's scale, cut short as the step
// changes, is steps-scale.test.ts's.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { mulberry32 } from '@/features/lessons/kit/dom'
import { freshSeed } from '@/features/lessons/kit/ear-game'
import { createLessonMenu } from '@/features/lessons/kit/lesson-menu'
import { createQuiz } from '@/features/lessons/kit/quiz'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { DECK_QUERY } from '@/features/lessons/kit/step-deck'
import { dealChords } from './game-rounds'
import { el, mountSteps, settle, soundOn } from './page-dom.test-fixtures'
import { QUIZ_QUESTIONS } from './quiz-questions'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

/** A finger across the step's text, from `from` to `to` px. */
function swipe(from: number, to: number): void {
  for (const [type, list, x] of [
    ['touchstart', 'touches', from],
    ['touchend', 'changedTouches', to],
  ] as const) {
    const e = new Event(type)
    Object.defineProperty(e, list, { value: [{ clientX: x, clientY: 200 }] })
    el('#stepsText').dispatchEvent(e)
  }
}

/** The phone's deck: the step deck's query matches, as reduced motion does under the kit's doubles. */
function phoneDeck(): void {
  const matching = window.matchMedia.bind(window)
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    ...matching(query),
    matches: query === DECK_QUERY || matching(query).matches,
  }))
}

/** The lesson menu opened, and its row for step `n` pressed (jsdom's dialog neither opens nor closes). */
function menuJump(deck: StepDeck, n: number): void {
  HTMLDialogElement.prototype.showModal = function open(
    this: HTMLDialogElement,
  ) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
  createLessonMenu({ lesson: 10, deck, label: el('.mast-ep'), sections: [] })
  el('.lm-btn').click()
  el(`#lessonMenu a[href="#step-${n}"]`).click()
}

/** The quick check answered with `wrong`, whose feedback sends the viewer to step `n`, and that link pressed. */
function quizLink(deck: StepDeck, wrong: string, n: number): void {
  createQuiz({
    questions: QUIZ_QUESTIONS,
    lesson: 10,
    keys: { seed: 'fyp-l10-seed', record: 'fyp-l10-quiz-v1' },
    deck,
  })
  const option = Array.from(
    document.querySelectorAll<HTMLElement>('#qs .opt'),
  ).find((b) => b.textContent?.includes(wrong))
  if (option === undefined) throw new Error(`no option "${wrong}"`)
  option.click()
  el(`#qs a[data-goto-step="${n}"]`).click()
}

interface Route {
  readonly name: string
  readonly to: number
  readonly phone?: boolean
  go(deck: StepDeck): void
}

/** Every route out of step `from`, each to the step it lands on. */
function routesFrom(from: number): readonly Route[] {
  // the quick check's links: question 3 sends the viewer to Step 4, and
  // question 4 to Step 5
  const quiz =
    from === 4
      ? { wrong: 'Only E: mi becomes me', to: 5 }
      : { wrong: "They're right: minor sounds sad to everyone", to: 4 }
  const away = from === 2 ? 1 : 2
  return [
    {
      name: 'Previous',
      to: from - 1,
      go: () => el('.stage-nav [data-step-go="-1"]').click(),
    },
    {
      name: 'Next',
      to: from + 1,
      go: () => el('.stage-nav [data-step-go="1"]').click(),
    },
    { name: 'a swipe', to: from + 1, phone: true, go: () => swipe(300, 100) },
    {
      name: "the lesson menu's jump",
      to: away,
      go: (deck) => menuJump(deck, away),
    },
    {
      name: 'a #step-N address',
      to: away,
      go: () => {
        window.location.hash = `#step-${away}`
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      },
    },
    {
      name: 'a quick-check step link',
      to: quiz.to,
      go: (deck) => quizLink(deck, quiz.wrong, quiz.to),
    },
  ]
}

const { showModal, close } = HTMLDialogElement.prototype
const scrollIntoView = Element.prototype.scrollIntoView

beforeEach(() => {
  localStorage.clear()
  resetRuns()
  soundOn()
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'performance'],
    now: 0,
  })
  // jsdom scrolls nothing: the quiz's link and the phone deck scroll the stage
  Element.prototype.scrollIntoView = () => undefined
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  HTMLDialogElement.prototype.showModal = showModal
  HTMLDialogElement.prototype.close = close
  Element.prototype.scrollIntoView = scrollIntoView
  window.location.hash = ''
  document.body.textContent = ''
  document.getElementById('lessonMenu')?.remove()
})

/** The page on Step 4 with its pattern sounding, its third quaver begun. */
function patternSounding(): StepDeck {
  const deck = mountSteps()
  deck.show(4)
  el('#toyChord [data-chord-play="pattern"]').click()
  vi.advanceTimersByTime(1000)
  return deck
}

describe("Lesson 10's steps, left while Step 4's pattern plays", () => {
  it.each(routesFrom(4))(
    'stops it when the step changes by $name, and no quaver of it starts after',
    async (route) => {
      // Arrange
      if (route.phone === true) phoneDeck()
      const deck = patternSounding()
      const before = runs.length

      // Act
      route.go(deck)
      vi.advanceTimersByTime(30_000)
      await settle()

      // Assert
      expect(deck.current).toBe(route.to)
      expect(before).toBe(3)
      expect(runs).toHaveLength(3)
      expect(runs.at(-1)?.stopped).toBe(true)
      expect(
        el('#toyChord [data-chord-play="pattern"]').classList.contains('is-on'),
      ).toBe(false)
    },
  )

  it('plays on when the step showing is shown again, as a layout switch shows it', () => {
    // Arrange
    const deck = patternSounding()

    // Act
    deck.show(4)
    vi.advanceTimersByTime(10_000)

    // Assert: all sixteen quavers and the chord, none stopped
    expect(runs).toHaveLength(17)
    expect(runs.filter((r) => r.stopped)).toEqual([])
    expect(deck.current).toBe(4)
  })
})

describe("Lesson 10's steps, left while a missed chords round waits to play again", () => {
  it.each(routesFrom(3))(
    'cancels the replay when the step changes by $name, so nothing new plays',
    async (route) => {
      // Arrange: Step 3's first round heard and missed, its replay 700 ms off
      if (route.phone === true) phoneDeck()
      vi.spyOn(Math, 'random').mockReturnValue(0.25)
      const round = dealChords(mulberry32(freshSeed()))[0]
      const deck = mountSteps()
      deck.show(3)
      el('#chordsGame [data-eg-play]').click()
      runs[0].end(true)
      await settle()
      const wrong = round.answer === 'major' ? 'minor' : 'major'
      el(`#chordsGame [data-eg-answer="${wrong}"]`).click()

      // Act
      route.go(deck)
      vi.advanceTimersByTime(3000)

      // Assert
      expect(deck.current).toBe(route.to)
      expect(runs).toHaveLength(1)
    },
  )
})
