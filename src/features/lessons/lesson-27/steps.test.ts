// ============================================================
// Lesson 27 steps tests — one toy in four states, and Step 4's own predict
// ============================================================
//
// On the page's own markup and its own deck (WEB-SPEC, Toys 1 and 3): each
// step shows its own chip row, and every step the steps' line until the
// cold open's choice; the plays in the steps' text sound on the toy in the
// learner's voice; Step 4's predict is held under "Choose an answer at the
// top first." until the cold open's choice, then asks for its own, which
// opens Step 4's chips and Turn over and tells free play; its two plays
// turn C major over and play E minor after it; and its reveal, the text
// after it, waits for both heard, the status line reading the reveal
// alone, then names the positions (FACTS 48 to 50).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { ANNOUNCE_DELAY_MS, spokenText } from '@/features/lessons/kit/announce'
import { signName } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RunNote } from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { writtenOf } from '@/features/lessons/kit/staff-places'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import type { Steps } from './steps'
import { initSteps, STEP4_PREDICT } from './steps'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

let choices4 = 0
let reveals4 = 0

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  resetRuns()
  soundOn()
  choices4 = 0
  reveals4 = 0
})

afterEach(() => {
  // a newer sound stops what the test started, before its timers are real again
  NowPlaying.claim(() => undefined)
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

/** The steps on the page's own markup and deck, as main.ts mounts them. */
function mount(): { deck: StepDeck; steps: Steps } {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  const steps = initSteps(deck, {
    onChoice4: () => {
      choices4 += 1
    },
    onReveal4: () => {
      reveals4 += 1
    },
  })
  deck.start()
  return { deck, steps }
}

/** Whether `e` shows: neither it nor a parent is hidden. */
function shows(e: Element): boolean {
  for (let at: Element | null = e; at !== null; at = at.parentElement)
    if (at instanceof HTMLElement && at.hidden) return false
  return true
}

/** A run's notes as written: "C3 E3 G3". */
const written = (notes: readonly RunNote[]): string =>
  notes.map((n) => signName(writtenOf(n.midi))).join(' ')

const last = () => runs[runs.length - 1]
const card = (): HTMLElement => el('#predict4')
const button = (sel: string): HTMLButtonElement => el<HTMLButtonElement>(sel)

/** Presses a play and lets it run to its end, heard. */
async function hear(sel: string): Promise<void> {
  button(sel).click()
  await settle()
  last().end(true)
  await settle()
}

describe('the stage, step by step', () => {
  it("shows each step's own chip row, Step 1's and Step 4's, none on Steps 2 and 3, and on every step the steps' line", () => {
    // Arrange
    const { deck } = mount()
    const rows: boolean[][] = []

    // Act
    for (const n of [1, 2, 3, 4]) {
      deck.show(n)
      rows.push([
        shows(el('#toyRing .chord-row[data-part="1"]')),
        shows(el('#toyRing .chord-row[data-part="4"]')),
        shows(el('#toyRing [data-lock-line]')),
      ])
    }

    // Assert: V7's room is drawn as V on each step until the choice
    expect(rows).toEqual([
      [true, false, true],
      [false, false, true],
      [false, false, true],
      [false, true, true],
    ])
  })

  it("puts the steps' line away with the cold open's choice, on every step", () => {
    // Arrange
    const { deck, steps } = mount()

    // Act
    steps.unlock()
    const lines: boolean[] = []
    for (const n of [1, 2, 3, 4]) {
      deck.show(n)
      lines.push(shows(el('#toyRing [data-lock-line]')))
    }

    // Assert
    expect(lines).toEqual([false, false, false, false])
    expect(button('#toyRing [data-part="1"] [data-chip="V"]').disabled).toBe(
      false,
    )
  })

  it("plays a step's play from its text on the toy, in the learner's voice: V7, then I", () => {
    // Arrange
    const { steps } = mount()
    steps.unlock()

    // Act
    button('[data-step-play="v7-home"]').click()

    // Assert: G2, B2, D3 and F3, then C3, E3 and G3, on the bass staff
    expect(written(last().notes)).toBe('G2 B2 D3 F3 C3 E3 G3')
    expect(el('#toyRing').querySelectorAll('.st-head').length).toBe(0)
  })

  it('shows a text play’s own step first when the deck has not reached it, so the toy and its heading agree', () => {
    // Arrange: a wide page, Step 3's text on screen while the deck is on Step 2
    const { deck, steps } = mount()
    steps.unlock()
    deck.show(2)

    // Act: Step 3's play
    button('[data-step-play="v7-home"]').click()

    // Assert
    expect([deck.current, el('#stepNow').textContent]).toEqual([3, '3'])
    expect(written(last().notes)).toBe('G2 B2 D3 F3 C3 E3 G3')
  })

  it('shows Step 4 first when its predict plays from Step 3, its own chip row on the stage', () => {
    // Arrange: Step 4's card on screen while the deck is on Step 3
    const { deck, steps } = mount()
    steps.unlock()
    deck.show(3)
    button('#predict4 [data-choice="eminor"]').click()
    const row4 = el('#toyRing .chord-row[data-part="4"]')
    const before = row4.hidden

    // Act
    button('#predict4 [data-play="turn"]').click()

    // Assert
    expect([deck.current, el('#stepNow').textContent]).toEqual([4, '4'])
    expect([before, row4.hidden]).toEqual([true, false])
    expect(written(last().notes)).toBe('C3 E3 G3 E3 G3 C4')
  })

  it('leaves the deck where it stands when a text play is pressed in the step showing', () => {
    // Arrange
    const { deck, steps } = mount()
    steps.unlock()
    deck.show(3)
    const show = vi.spyOn(deck, 'show')

    // Act
    button('[data-step-play="v7-home"]').click()

    // Assert
    expect(show).not.toHaveBeenCalled()
    expect(deck.current).toBe(3)
  })
})

describe("Step 4's predict", () => {
  it("is held under its first line until the cold open's choice, then asks for its own (FACTS 48)", () => {
    // Arrange
    const { steps } = mount()
    const before = {
      hint: words(card().querySelector('.lock-hint')),
      choices: Array.from(
        card().querySelectorAll<HTMLButtonElement>('.choice'),
        (b) => b.disabled,
      ),
    }

    // Act
    steps.unlock()

    // Assert
    expect(before).toEqual({
      hint: 'Choose an answer at the top first.',
      choices: [true, true],
    })
    expect(words(card().querySelector('.lock-hint'))).toBe(STEP4_PREDICT.open)
    expect(
      Array.from(
        card().querySelectorAll<HTMLButtonElement>('.choice'),
        (b) => b.disabled,
      ),
    ).toEqual([false, false])
    expect(button('#predict4 [data-play="turn"]').disabled).toBe(true)
    expect(steps.predict4).not.toBeNull()
  })

  it("opens Step 4's chips and Turn over with its choice, and tells free play (FACTS 1b, 50)", () => {
    // Arrange
    const { deck, steps } = mount()
    steps.unlock()
    deck.show(4)
    const held = [
      button('#toyRing [data-part="4"] [data-chip="V7"]').disabled,
      button('#toyRing [data-turn]').disabled,
    ]

    // Act
    button('#predict4 [data-choice="still"]').click()

    // Assert
    expect(held).toEqual([true, true])
    expect(button('#toyRing [data-part="4"] [data-chip="V7"]').disabled).toBe(
      false,
    )
    expect(button('#toyRing [data-turn]').disabled).toBe(false)
    expect(choices4).toBe(1)
    expect(words(card().querySelector('.lock-hint'))).toBe(
      STEP4_PREDICT.hints.chosen,
    )
  })

  it('plays C major turned over, then E minor after it, in the learner’s voice (FACTS 48, 72)', async () => {
    // Arrange
    const { deck, steps } = mount()
    steps.unlock()
    deck.show(4)
    button('#predict4 [data-choice="eminor"]').click()

    // Act
    button('#predict4 [data-play="turn"]').click()
    await settle()
    const turn = written(last().notes)
    last().end(true)
    await settle()
    button('#predict4 [data-play="eminor"]').click()
    await settle()
    const eminor = written(last().notes)

    // Assert
    expect(turn).toBe('C3 E3 G3 E3 G3 C4')
    expect(eminor).toBe('E3 G3 C4 E3 G3 B3')
  })

  it('reveals after both heard, the text after it with it, and only then names the positions (FACTS 49, 50)', async () => {
    // Arrange
    const { deck, steps } = mount()
    steps.unlock()
    deck.show(4)
    button('#predict4 [data-choice="still"]').click()
    const before = words(el('#toyRing [data-ring-readout]'))

    // Act
    await hear('#predict4 [data-play="eminor"]')
    const half = el('#predict4 .reveal').hidden
    await hear('#predict4 [data-play="turn"]')
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)

    // Assert: the status line reads the reveal, not the text after it
    expect(half).toBe(true)
    expect(el('#predict4 .reveal').hidden).toBe(false)
    expect(el('[data-reveal4]').hidden).toBe(false)
    expect(words(el('[data-announcer]'))).toBe(
      spokenText(el('#predict4 .reveal')),
    )
    expect(words(el('#predict4 .reveal .mono'))).toBe(STEP4_PREDICT.guess.still)
    expect(reveals4).toBe(1)
    expect(before).toBe('')
    expect(words(el('#toyRing [data-ring-readout]'))).toBe('Root position')
  })
})
