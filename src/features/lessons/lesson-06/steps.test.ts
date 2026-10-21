// ============================================================
// Lesson 6 steps tests — a step left behind keeps nothing sounding
// ============================================================
//
// On the page's own markup and its own deck: a game's pair, the slower
// replay a miss still has to come and an anchor's tune all end when the
// viewer leaves their step, by Next or by a jump straight to another step
// (the lesson menu, an address and the quiz's links all jump through the
// deck's show), and leaving never cuts off what the viewer starts on the
// new step. Step 4's predict reveals nothing after a play cut short.

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { createModeStore } from '@/features/lessons/kit/names'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { classify } from './melody'
import type { HeardVoice } from './page-dom.test-fixtures'
import { el, listen, loadPage } from './page-dom.test-fixtures'
import { initSteps } from './steps'
import type { NamesMode } from './tune-words'
import { NAMES_MODES } from './tune-words'

/** The page's deck with its steps mounted, opened on step 1 as the page opens it. */
function mountSteps(): StepDeck {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  initSteps(deck, createModeStore<NamesMode>(NAMES_MODES, 'letters'))
  deck.start()
  return deck
}

/** Plays Step or leap?'s round to its end, listening, and answers it wrong. */
function missARound(heard: HeardVoice[]): void {
  el('#stepLeapGame [data-eg-play]').click()
  vi.advanceTimersByTime(1600)
  const [a, b] = heard.slice(-2).map((v) => v.midi)
  const wrong = classify(b - a) === 'step' ? 'leap' : 'step'
  el(`#stepLeapGame [data-eg-answer="${wrong}"]`).click()
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 6's steps: leaving one", () => {
  it("plays no miss's replay once the viewer has pressed Next", () => {
    // Arrange: a missed round on Step 2, 300 ms before its replay is due
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    const deck = mountSteps()
    deck.show(2)
    missARound(heard)
    const pair = heard.length
    vi.advanceTimersByTime(400)

    // Act
    el('.stage-nav [data-step-go="1"]').click()
    vi.advanceTimersByTime(5000)

    // Assert
    expect(deck.current).toBe(3)
    expect(pair).toBe(2)
    expect(heard).toHaveLength(2)
  })

  it("plays no miss's replay after a jump straight from Step 2 to Step 5", () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    const deck = mountSteps()
    deck.show(2)
    missARound(heard)

    // Act: the lesson menu's jump, the quiz's step links' too
    deck.jump(5)
    vi.advanceTimersByTime(5000)

    // Assert
    expect(deck.current).toBe(5)
    expect(heard).toHaveLength(2)
  })

  it("never cuts off a Name it pair the viewer starts after leaving Step 2's miss", () => {
    // Arrange: a miss on Step 2, then Step 5 before its replay is due
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    const deck = mountSteps()
    deck.show(2)
    missARound(heard)
    deck.jump(5)

    // Act: Name it's pair, which plays on past the moment the replay was due
    el('#nameItGame [data-eg-play]').click()
    vi.advanceTimersByTime(1600)

    // Assert: both of Name it's notes, neither stopped, and nothing else
    const nameIt = heard.slice(2)
    expect(nameIt).toHaveLength(2)
    expect(nameIt.map((v) => v.stopped)).toEqual([false, false])
  })

  it("stops an anchor's tune when the viewer goes back from Step 5", () => {
    // Arrange: "Should auld"'s tune, its first note sounding
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    const deck = mountSteps()
    deck.show(5)
    el('[data-anchor="P4"] [data-anchor-play="tune"]').click()
    vi.advanceTimersByTime(100)

    // Act
    deck.show(4)
    vi.advanceTimersByTime(5000)

    // Assert
    expect(heard).toHaveLength(1)
    expect(heard[0].stopped).toBe(true)
    expect(el('[data-anchor="P4"]').classList.contains('is-on')).toBe(false)
  })
})

describe("Lesson 6's Step 4: the predict", () => {
  /** Whether each part that answers the predict is hidden: its reveal, then the three after it. */
  const answers = (): boolean[] =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        '#predictSwap .reveal, #step-4 [data-swap-reveal]',
      ),
      (r) => r.hidden,
    )

  it('reveals nothing when the swapped version is stopped 300 ms in, and reveals once it is heard to its end', async () => {
    // Arrange: a guess, and the first line played to its end
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    listen()
    const deck = mountSteps()
    deck.show(4)
    el('#predictSwap [data-choice="same"]').click()
    el('#predictSwap [data-play="line"]').click()
    await vi.advanceTimersByTimeAsync(4100)
    el('#predictSwap [data-play="swapped"]').click()
    await vi.advanceTimersByTimeAsync(300)

    // Act: a bead on the stage, tapped while the swapped version plays
    el('#toyTune .tune-hit-note').click()
    await vi.advanceTimersByTimeAsync(5000)
    const cut = answers()
    const hint = el('#predictSwap .lock-hint').textContent
    el('#predictSwap [data-play="swapped"]').click()
    await vi.advanceTimersByTimeAsync(4100)

    // Assert
    expect(cut).toEqual([true, true, true, true])
    expect(hint).toBe('Now play the other one.')
    expect(answers()).toEqual([false, false, false, false])
  })
})
