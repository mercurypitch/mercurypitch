// ============================================================
// Lesson 12 leaving a step — what the ring plays stops, by every route
// ============================================================
//
// WEB-SPEC, Toys 1's states and Edge cases ("Leaving a step stops the
// stage's sound"): leaving a step by each route, Previous, Next, a swipe,
// the lesson menu's jump, a `#step-N` address and a quick-check step link,
// stops Step 4's loop where it stands, its chip goes out and no bar of it
// lights after; the step showing, shown again as a layout switch shows it,
// stops nothing. On the page's own markup and deck, its runs recorded
// (kit/run-recorder.test-fixtures.ts). That the kit's own run leaves no
// timer behind is steps.test.ts's.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { createLessonMenu } from '@/features/lessons/kit/lesson-menu'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { createQuiz } from '@/features/lessons/kit/quiz'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { DECK_QUERY } from '@/features/lessons/kit/step-deck'
import { chips, el, mountSteps, settle, soundOn, } from './page-dom.test-fixtures'
import { QUIZ_KEYS, QUIZ_QUESTIONS } from './quiz-questions'

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

/** The phone's deck: the step deck's query matches. */
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
  createLessonMenu({ lesson: 12, deck, label: el('.mast-ep'), sections: [] })
  el('.lm-btn').click()
  el(`#lessonMenu a[href="#step-${n}"]`).click()
}

/** The quick check's first question answered "F, A and C", whose feedback sends the viewer to Step 1, and that link pressed. */
function quizLink(deck: StepDeck): void {
  createQuiz({ questions: QUIZ_QUESTIONS, lesson: 12, keys: QUIZ_KEYS, deck })
  const option = Array.from(
    document.querySelectorAll<HTMLElement>('#qs .opt'),
  ).find((b) => b.textContent?.includes('F, A and C'))
  if (option === undefined) throw new Error('no option "F, A and C"')
  option.click()
  el('#qs a[data-goto-step="1"]').click()
}

interface Route {
  readonly name: string
  readonly to: number
  readonly phone?: boolean
  go(deck: StepDeck): void
}

/** Every route out of Step 4, each to the step it lands on. */
const ROUTES: readonly Route[] = [
  {
    name: 'Previous',
    to: 3,
    go: () => el('.stage-nav [data-step-go="-1"]').click(),
  },
  {
    name: 'Next',
    to: 5,
    go: () => el('.stage-nav [data-step-go="1"]').click(),
  },
  { name: 'a swipe', to: 5, phone: true, go: () => swipe(300, 100) },
  { name: "the lesson menu's jump", to: 2, go: (deck) => menuJump(deck, 2) },
  {
    name: 'a #step-N address',
    to: 2,
    go: () => {
      window.location.hash = '#step-2'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    },
  },
  { name: 'a quick-check step link', to: 1, go: quizLink },
]

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
  NowPlaying.claim(() => undefined)
  vi.useRealTimers()
  vi.restoreAllMocks()
  HTMLDialogElement.prototype.showModal = showModal
  HTMLDialogElement.prototype.close = close
  Element.prototype.scrollIntoView = scrollIntoView
  window.location.hash = ''
  document.body.textContent = ''
  document.getElementById('lessonMenu')?.remove()
})

/** The page on Step 4 with its loop sounding, in its second bar, V. */
function loopSounding(): ReturnType<typeof mountSteps> {
  const deck = mountSteps()
  deck.show(4)
  el('#toyRooms [data-rooms-play="loop"]').click()
  runs[0].notes.forEach((n, i) => {
    if (n.t <= 2) runs[0].note(i)
  })
  return deck
}

describe("Lesson 12's steps, left while Step 4's loop plays", () => {
  it.each(ROUTES)(
    'stops it when the step changes by $name, its chip out and no bar lit after',
    async (route) => {
      // Arrange
      if (route.phone === true) phoneDeck()
      const deck = loopSounding()
      const before = { lit: deck.rooms.lit, sounding: deck.rooms.sounding }

      // Act
      route.go(deck)
      runs[0].notes.forEach((_, i) => {
        runs[0].note(i)
      })
      await settle()

      // Assert
      expect(before).toEqual({ lit: 4, sounding: 4 })
      expect(deck.current).toBe(route.to)
      expect(runs).toHaveLength(1)
      expect(runs[0].stopped).toBe(true)
      expect(deck.rooms.lit).toBeNull()
      expect(deck.rooms.sounding).toBeNull()
      expect(chips().filter((b) => b.classList.contains('is-on'))).toEqual([])
    },
  )

  it('plays on when the step showing is shown again, as a layout switch shows it', () => {
    // Arrange
    const deck = loopSounding()

    // Act
    deck.show(4)
    runs[0].notes.forEach((n, i) => {
      if (n.t === 4) runs[0].note(i)
    })

    // Assert: the third bar, vi, lights
    expect(runs[0].stopped).toBe(false)
    expect(deck.rooms.lit).toBe(5)
    expect(deck.current).toBe(4)
  })
})
