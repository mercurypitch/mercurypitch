// ============================================================
// Lesson 13 steps — the vowel figure's five states and their controls
// ============================================================
//
// WEB-SPEC, Toys 1 and Audio, on the page's own markup and deck, its runs
// recorded (kit/run-recorder.test-fixtures.ts): each step shows its own
// rows; Add a harmonic adds the next harmonic and plays the 1st to it, its
// name naming the one it adds, starting again after the 18th; All plays all
// 18; Resonances turns the curves on and off by `aria-pressed`; a vowel
// button plays its vowel on A3 and says its peaks once it ends; Play the
// five vowels lights the names row in turn; the voice switch plays 'ah' in
// the voice it picks. One sound at a time: a new play stops the last, and
// leaving a step by every route stops its play; the step shown again, as a
// layout switch shows it, stops nothing (Tests 15).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { createLessonMenu } from '@/features/lessons/kit/lesson-menu'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { createQuiz } from '@/features/lessons/kit/quiz'
import type * as RunModule from '@/features/lessons/kit/run'
import { live, resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { DECK_QUERY, registerToy } from '@/features/lessons/kit/step-deck'
import { el, mountSteps, said, settle, shown, soundOn, } from './page-dom.test-fixtures'
import { QUIZ_KEYS, QUIZ_QUESTIONS } from './quiz-questions'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

const { showModal, close } = HTMLDialogElement.prototype
const scrollIntoView = Element.prototype.scrollIntoView

beforeEach(() => {
  localStorage.clear()
  resetRuns()
  soundOn()
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

/** The rows of the stage that show now, by their first control's words. */
const rowsShown = (): string[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      '#toyVowels .vowel-row, #toyVowels .vowel-names',
    ),
  )
    .filter((r) => !r.hidden)
    .map((r) => (r.textContent ?? '').replace(/\s+/g, ' ').trim())

/** The vowel each recorded line sings, by the first resonance its first point reaches. */
const firstHz = (i: number): number | undefined =>
  (runs[i]?.points[0] as { res?: { hz: number }[] } | undefined)?.res?.[0]?.hz

/** Moves the deck to step `n` by Next or Previous. */
function goTo(deck: StepDeck, n: number): void {
  deck.show(n)
}

describe("the steps' states (WEB-SPEC, Toys 1)", () => {
  it("shows each step's own rows: Add a harmonic and All; Resonances, 'ee' and 'ah'; 'ee', 'ah' and 'oo'; the five; the voices", () => {
    // Arrange
    const deck = mountSteps()
    const rows: string[][] = []

    // Act
    for (let n = 1; n <= 5; n++) {
      goTo(deck, n)
      rows.push(rowsShown())
    }

    // Assert
    expect(rows).toEqual([
      ['Add a harmonic All'],
      ['Resonances ‘ee’ ‘ah’'],
      ['‘ee’ ‘ah’ ‘oo’'],
      [
        'Play the five vowels',
        '‘ee’ ‘eh’ ‘ah’ ‘oh’ ‘oo’',
        '‘ee’ ‘eh’ ‘ah’ ‘oh’ ‘oo’',
      ],
      ['Lower Higher'],
    ])
  })

  it('adds a harmonic a press, naming the one it adds, and starts again from the 1st after the 18th', async () => {
    // Arrange
    mountSteps()
    const add = shown('[data-act="add"]')

    // Act: two presses, the 2nd and the 3rd, each heard to its end
    add.click()
    runs[0].end(true)
    await settle()
    add.click()
    runs[1].end(true)
    await settle()
    const third = said()
    const name = add.getAttribute('aria-label')
    for (let k = 4; k <= 19; k++) add.click()

    // Assert
    expect(runs[1].points).toHaveLength(2)
    expect(third).toBe(
      'Harmonics 1 to 3 of A 3: 220, 440 and 660 hertz, 220 hertz apart.',
    )
    expect(name).toBe('Add a harmonic: the 4th, 880 hertz')
    expect(el('[data-readout-sub]').textContent).toBe('harmonics: 1 of 18')
    expect(live()).toHaveLength(1)
  })

  it('plays all 18 harmonics with All, and says so once it ends', async () => {
    // Arrange
    mountSteps()

    // Act
    shown('[data-act="all"]').click()
    runs[0].end(true)
    await settle()

    // Assert
    expect(said()).toBe(
      'All 18 harmonics of A 3, 220 hertz apart. The line stayed level.',
    )
    expect(el('[data-readout-sub]').textContent).toBe('harmonics: 18 of 18')
  })

  it("turns the curves on with Resonances and plays 'ah' under them, saying each peak sits under one", async () => {
    // Arrange
    const deck = mountSteps()
    goTo(deck, 2)
    const res = shown('[data-act="res"]')

    // Act
    res.click()
    shown('[data-vowel="ah"]').click()
    runs[0].end(true)
    await settle()

    // Assert
    expect(res.getAttribute('aria-pressed')).toBe('true')
    expect(deck.figure.curves).toBe(true)
    expect(firstHz(0)).toBe(645.4)
    expect(said()).toBe(
      "‘Ah’ on A 3: peaks on the 3rd bar and the 5th. Each peak sits under a resonance's curve.",
    )
  })

  it("plays 'oo' on Step 3, its peaks on the 1st bar and the 5th", async () => {
    // Arrange
    const deck = mountSteps()
    goTo(deck, 3)

    // Act
    shown('[data-vowel="oo"]').click()
    runs[0].end(true)
    await settle()

    // Assert
    expect(said()).toBe('‘Oo’ on A 3: peaks on the 1st bar and the 5th.')
  })

  it('plays the five vowels in turn, 10 s, and names the tallest bar of each once they end', async () => {
    // Arrange
    const deck = mountSteps()
    goTo(deck, 4)

    // Act
    shown('[data-act="five"]').click()
    runs[0].end(true)
    await settle()

    // Assert
    expect(runs[0].points.at(-1)?.t).toBe(10)
    expect(said()).toBe(
      'The five vowels on A 3. The line stayed level. The tallest bar was the 1st, then the 2nd, the 3rd, the 2nd and the 1st.',
    )
  })

  it("switches the voice with Lower and Higher, each playing 'ah' in its voice", async () => {
    // Arrange
    const deck = mountSteps()
    goTo(deck, 5)
    const higher = shown('[data-voice-pick="higher"]')

    // Act
    higher.click()
    runs[0].end(true)
    await settle()

    // Assert
    expect(higher.getAttribute('aria-pressed')).toBe('true')
    expect(
      shown('[data-voice-pick="lower"]').getAttribute('aria-pressed'),
    ).toBe('false')
    expect(firstHz(0)).toBe(909.7)
    expect(runs[0].points[0]?.hz).toBe(440)
    expect(said()).toBe(
      'Higher voice, ‘ah’ on A 4: 9 bars, 440 hertz apart. The tallest is the 2nd.',
    )
  })

  it('stops the last play when a new one starts, and a second press of a play stops it', () => {
    // Arrange
    const deck = mountSteps()
    goTo(deck, 3)

    // Act
    shown('[data-vowel="ee"]').click()
    shown('[data-vowel="ah"]').click()
    shown('[data-vowel="ah"]').click()

    // Assert
    expect(runs.map((r) => r.stopped)).toEqual([true, true])
    expect(live()).toEqual([])
  })
})

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
  createLessonMenu({ lesson: 13, deck, label: el('.mast-ep'), sections: [] })
  el('.lm-btn').click()
  el(`#lessonMenu a[href="#step-${n}"]`).click()
}

/** The quick check's first question answered "330 Hz", whose feedback sends the viewer to Step 1, and that link pressed. */
function quizLink(deck: StepDeck): void {
  createQuiz({ questions: QUIZ_QUESTIONS, lesson: 13, keys: QUIZ_KEYS, deck })
  const option = Array.from(
    document.querySelectorAll<HTMLElement>('#qs .opt'),
  ).find((b) => b.textContent?.includes('330 Hz'))
  if (option === undefined) throw new Error('no option "330 Hz"')
  option.click()
  // the quiz shows the step, then again once its scroll has had time
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  el('#qs a[data-goto-step="1"]').click()
  vi.runOnlyPendingTimers()
}

/** The phone's deck: the step deck's query matches. */
function phoneDeck(): void {
  const matching = window.matchMedia.bind(window)
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    ...matching(query),
    matches: query === DECK_QUERY || matching(query).matches,
  }))
}

const ROUTES: readonly {
  readonly name: string
  readonly to: number
  readonly phone?: boolean
  go(deck: StepDeck): void
}[] = [
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
  { name: 'a quick-check step link', to: 1, go: quizLink },
  {
    name: 'a #step-N address',
    to: 2,
    go: () => {
      window.location.hash = '#step-2'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    },
  },
]

describe('leaving a step stops its sound (WEB-SPEC, Audio; Tests 15)', () => {
  for (const route of ROUTES)
    it(`stops Step 4's five vowels by ${route.name}, and opens the next step's state`, () => {
      // Arrange
      if (route.phone === true) phoneDeck()
      const deck = mountSteps()
      goTo(deck, 4)
      shown('[data-act="five"]').click()
      const five = runs[0]

      // Act
      route.go(deck)

      // Assert
      expect(el('#stepNow').textContent).toBe(String(route.to))
      expect(five.stopped).toBe(true)
      expect(live()).toEqual([])
      expect(
        el('#toyVowels [data-names]').querySelector('[aria-current]'),
      ).toBeNull()
    })

  it('stops nothing when the step showing is shown again, as a layout switch shows it', () => {
    // Arrange
    const deck = mountSteps()
    goTo(deck, 4)
    shown('[data-act="five"]').click()
    let heard: [number, number] | null = null
    registerToy({
      onStep: (n, previous) => {
        heard = [n, previous]
      },
    })

    // Act
    deck.show(4)

    // Assert
    expect(heard).toEqual([4, 4])
    expect(runs[0].stopped).toBe(false)
  })
})
