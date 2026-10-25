// ============================================================
// Lesson 9 leaving a step — what the step set sounding stops, by every route
// ============================================================
//
// WEB-SPEC, Tests 14 (Audio): with Step 4's five leaps sounding, a step
// change by each route, Previous, Next, a swipe, the lesson menu's jump, a
// `#step-N` address and a quick-check step link, stops them, and running
// the clock past their end starts no note; a layout switch, the deck's
// `onStep` with the step showing, stops nothing, and the five play on to
// their end. On the page's own markup and deck, through the kit's own runs
// on fake timers, hearing every voice the page starts and whether it was
// stopped (a spy on the kit's `Sound.voice`), with Merc and Tavi's
// renderer left out. Step 5's landing, paused as Step 5 is left, is
// landing.test.ts's.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { createLessonMenu } from '@/features/lessons/kit/lesson-menu'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import { createQuiz } from '@/features/lessons/kit/quiz'
import type { Voice } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { DECK_QUERY } from '@/features/lessons/kit/step-deck'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { el, mountSteps, settle, soundOn } from './page-dom.test-fixtures'
import { QUIZ_QUESTIONS } from './quiz-questions'

vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercSing: vi.fn(),
}))

/** A voice the page started: its MIDI note, and whether it has been stopped. */
interface Heard {
  readonly midi: number
  stopped: boolean
}

let heard: Heard[]

/** Sound on and every voice heard, on fake timers. */
function listen(): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'], now: 0 })
  soundOn()
  // a play left sounding by the test before is stopped by this test's
  // first press (the page's one sound outlives a test): its voices are
  // that test's, never this one's
  const mine: Heard[] = []
  heard = mine
  vi.spyOn(Sound, 'voice').mockImplementation((freq: number) => {
    const h = {
      midi: Math.round(69 + 12 * Math.log2(freq / 440)),
      stopped: false,
    }
    mine.push(h)
    const voice: Voice = {
      alive: true,
      setFreq: () => undefined,
      setGain: () => undefined,
      stop: () => {
        h.stopped = true
      },
    }
    return voice
  })
}

/** The clock run on `ms`, and the promises the page awaits settled. */
async function run(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms)
  await settle()
}

/** The page on Step 4 with its five leaps sounding, on the first leap's so. */
async function fiveSounding(): Promise<StepDeck> {
  const deck = mountSteps()
  deck.show(4)
  el('[data-ladder-play="five"]').click()
  await run(1500)
  return deck
}

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
  createLessonMenu({ lesson: 9, deck, label: el('.mast-ep'), sections: [] })
  el('.lm-btn').click()
  el(`#lessonMenu a[href="#step-${n}"]`).click()
}

/** The quick check answered wrong where its feedback sends the viewer to Step 2, and that link pressed. */
function quizLink(deck: StepDeck): void {
  createQuiz({
    questions: QUIZ_QUESTIONS,
    lesson: 9,
    keys: { seed: 'fyp-l09-seed', record: 'fyp-l09-quiz-v1' },
    deck,
  })
  const wrong = Array.from(document.querySelectorAll('#qs .opt')).find((b) =>
    b.textContent?.includes("They're right: a leap is too quick to aim"),
  )
  ;(wrong as HTMLElement).click()
  el('#qs a[data-goto-step="2"]').click()
}

interface Route {
  readonly name: string
  readonly to: number
  readonly phone?: boolean
  go(deck: StepDeck): void
}

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
  { name: 'a quick-check step link', to: 2, go: quizLink },
]

const { showModal, close } = HTMLDialogElement.prototype
const scrollIntoView = Element.prototype.scrollIntoView

beforeEach(() => {
  localStorage.clear()
  VoiceChoice.set('lower')
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

describe("Lesson 9's steps, left while Step 4's five leaps sound", () => {
  it.each(ROUTES)(
    'stops them when the step changes by $name, and no note of them starts after',
    async (route) => {
      // Arrange: the first leap's so sounding
      listen()
      if (route.phone === true) phoneDeck()
      const deck = await fiveSounding()
      const before = heard.length

      // Act
      route.go(deck)
      await run(30_000)

      // Assert
      expect(deck.current).toBe(route.to)
      expect(before).toBe(2)
      expect(heard.map((h) => h.midi)).toEqual([54, 57])
      expect(heard[1].stopped).toBe(true)
      expect(el('[data-ladder-play="five"]').classList.contains('is-on')).toBe(
        false,
      )
    },
  )

  it('plays on to their end when the step showing is shown again, as a layout switch shows it', async () => {
    // Arrange
    listen()
    const deck = await fiveSounding()

    // Act
    deck.show(4)
    await run(30_000)

    // Assert: all ten notes, none cut short
    expect(heard.map((h) => h.midi)).toEqual([
      54, 57, 50, 54, 50, 57, 57, 62, 50, 62,
    ])
    expect(heard.filter((h) => h.stopped)).toEqual([])
    expect(deck.current).toBe(4)
  })
})
