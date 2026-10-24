// ============================================================
// PlanLayer: the four questions and the plan, as a layer of the app
// ============================================================
//
// The screens (PlanQuestions, PlanScreen) and the rulebook
// (usePlanFlowController) have tests of their own, and BeatPlan.test.tsx pins
// the first host of them. What is pinned here is what only the layer decides:
// that it is one dialog with one box and one Merc over the screens, that keys
// stay inside it (and that a press on its words leaves the focus there, so the
// keys after it do too), which greeting each mode gets, what each mode tells
// the funnel as it opens, and how it opens an answered plan and lets the
// person change the answers. What each way out hands the app is in
// PlanLayer.ways.test.tsx, and the stylesheet is read as text in
// PlanLayer.css.test.ts, since jsdom applies no CSS. The screens are the real
// ones, tapped the way a singer taps them. Only the edges are faked: the
// browser's media queries, the GPU gate (so Merc is his still), the promo
// store, which is never asked, and enterStop (enter-stop.test.ts has cases of
// its own). What the files share is in PlanLayer.fixture.tsx.

import { fireEvent, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import { APP_KEYS, overheard, press, stopOverhearing, } from '@/tests/utils/trap-keys'
import type * as EnterStopModule from './enter-stop'
import { planRecord } from './plan-store'
import { answered, box, card, changeAnswers, dialog, fresh, open, opened, sent, setUp, tearDown, toThePlan, } from './PlanLayer.fixture'
import styles from './PlanLayer.module.css'
import { button, isOn, isPressed, mercSays, OTHER_FIELD, SOMETHING_ELSE, tap, toThirdQuestion, } from './PlanQuestions.fixture'
import { EMPTY_CHOICES, MERC_INTRO } from './questions'

// enterStop is the fake: what each way out hands the app is in
// PlanLayer.ways.test.tsx. The rest of the module stays real, since the
// controller imports widenMenuFor from it.
vi.mock('./enter-stop', async (importOriginal) => ({
  ...(await importOriginal<typeof EnterStopModule>()),
  enterStop: vi.fn(),
}))

// The server's promo is never asked.
vi.mock('@/stores/promo-store', () => ({
  offeredPromo: () => null,
  loadFeaturedPromo: async () => {},
}))

// jsdom has no WebGL: Merc is his still.
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof GpuGateModule>()),
  canRunLiveMerc: (): boolean => false,
}))

// ── Fixtures ───────────────────────────────────────────────────────────

/** The question screens' phone layout: the complement of their own `min-width: 720px`. */
const PHONE_QUERY = '(max-width: 719.98px)'

const merc = (): HTMLElement => screen.getByTestId('plan-merc')
/** His box's width and height, as MercPresence writes them inline. */
const sizeOf = (): string[] => [merc().style.width, merc().style.height]
const squareOf = (px: number): string[] => [`${px}px`, `${px}px`]

/** The window's width as the browser reports it. */
function stubWidth(phone: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === PHONE_QUERY && phone,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

beforeEach(() => {
  setUp()
})
afterEach(() => {
  stopOverhearing()
  tearDown()
})

// ── The box ────────────────────────────────────────────────────────────

describe('the layer', () => {
  it('is one dialog, and its box keeps one Merc over the screens from the first question to the plan', () => {
    open('skipper')
    const host = box()
    expect(dialog()).toHaveAttribute('aria-modal', 'true')
    expect(dialog()).toContainElement(host)
    const him = merc()
    const holdsStill = (): void => {
      expect(box()).toBe(host)
      expect(host.children).toHaveLength(2)
      expect(host.children[0]).toBe(him)
      expect(host.children[1]).toContainElement(
        screen.getByRole('button', { name: 'Not now' }),
      )
      expect(screen.getAllByTestId('plan-merc')).toHaveLength(1)
      // The screens mount no Merc of their own: one of his stills, not two.
      expect(
        document.querySelectorAll('img[src^="/onboarding/coach/"]'),
      ).toHaveLength(1)
    }
    holdsStill()
    expect(host).toHaveAttribute('data-phase', 'questions')

    toThePlan()

    expect(host).toHaveAttribute('data-phase', 'plan')
    holdsStill()
  })

  it('takes the focus on its heading, so a screen reader says where the person landed', async () => {
    open('skipper')

    await Promise.resolve()

    const heading = dialog().querySelector('h1')
    expect(heading).not.toBeNull()
    expect(document.activeElement).toBe(heading)
  })

  it('is left by Not now alone: Escape does not close it', () => {
    const host = open('skipper')

    fireEvent.keyDown(dialog(), { key: 'Escape' })

    expect(host.onClose).not.toHaveBeenCalled()
    expect(planRecord()?.status).toBe('shown')
  })

  it('wears its three classes: the layer, the box that holds, and the place Merc takes in it', () => {
    expect(styles.layer).toBeTruthy()
    expect(styles.box).toBeTruthy()
    expect(styles.merc).toBeTruthy()

    open('skipper')

    expect(dialog().classList.contains(styles.layer)).toBe(true)
    expect(box().classList.contains(styles.box)).toBe(true)
    expect(merc().classList.contains(styles.merc)).toBe(true)
  })
})

describe('the keyboard', () => {
  it('keeps keys inside it: the app behind never hears a Space, an M or an Escape from a button', () => {
    open('skipper')
    const heard = overheard('key')
    // The control: the app does hear a key that comes from outside the layer.
    fireEvent.keyDown(document.body, { key: ' ' })
    expect(heard).toEqual([' '])
    heard.length = 0

    const pressOn = (target: HTMLElement): void => {
      for (const key of APP_KEYS) fireEvent.keyDown(target, key)
    }
    pressOn(button('Singing'))
    pressOn(button('Not now'))
    toThePlan()
    pressOn(card('start'))
    pressOn(screen.getByRole('switch'))

    expect(heard).toEqual([])
  })

  it("leaves the screens' own Enter working: it still puts the keyboard away in a typed line", () => {
    open('skipper')
    toThirdQuestion()
    tap(SOMETHING_ELSE)
    const field = screen.getByRole('textbox', { name: OTHER_FIELD })
    const heard = overheard('key')
    expect(field).toHaveFocus()

    expect(fireEvent.keyDown(field, { key: 'Enter' })).toBe(false)

    expect(field).not.toHaveFocus()
    expect(heard).toEqual([])
  })

  // isolateKeyboard stops a key only when it is sent from inside the layer. A
  // press on content that cannot take focus drops focus to the page, and the
  // keys sent there reach the app's shortcuts (ruling R68), so the layer takes
  // that focus itself.
  it('takes focus from a press on its words, never from Tab, and still opens on its heading', async () => {
    open('skipper')

    await Promise.resolve()

    expect(dialog()).toHaveAttribute('tabindex', '-1')
    expect(dialog()).not.toHaveFocus()
    expect(document.activeElement).toBe(dialog().querySelector('h1'))
  })

  it('keeps a Space, an M and an Escape sent at the layer itself from the app behind', () => {
    open('skipper')
    const heard = overheard('key')

    for (const key of APP_KEYS) fireEvent.keyDown(dialog(), key)

    expect(heard).toEqual([])
  })

  it('keeps the focus in it when a press lands on its words, so the keys after the press are still stopped', async () => {
    open('skipper')
    await Promise.resolve()
    // Merc's box: in the layer and no control, so nothing under it can take
    // the focus but the layer.
    const heard = overheard('key')

    press(merc())

    // Soft, so a miss reports the keys it let through as well.
    expect.soft(dialog()).toHaveFocus()
    for (const key of APP_KEYS) {
      fireEvent.keyDown(document.activeElement ?? document.body, key)
    }
    expect(heard).toEqual([])
  })

  it('still cycles Tab from the layer itself: forward to its first control, back to its last', async () => {
    open('skipper')
    await Promise.resolve()
    const stops = [
      ...dialog().querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]',
      ),
    ].filter((stop) => stop.tabIndex >= 0 && !stop.matches(':disabled'))
    const [first, last] = [stops[0], stops[stops.length - 1]]
    const heard = overheard('key')

    dialog().focus()
    expect(dialog()).toHaveFocus()
    expect(fireEvent.keyDown(dialog(), { key: 'Tab' })).toBe(false)
    expect(first).toHaveFocus()

    dialog().focus()
    expect(fireEvent.keyDown(dialog(), { key: 'Tab', shiftKey: true })).toBe(
      false,
    )
    expect(last).toHaveFocus()
    expect(heard).toEqual([])
  })
})

describe("Merc's line", () => {
  it('greets an existing user with their own line', () => {
    open('existing')

    expect(mercSays()).toHaveTextContent(MERC_INTRO.q1Returning)
  })

  it('greets a skipper, who has the app and not the plan, with the plain line', () => {
    // The returning line says the plan is new in Mercury Pitch, which is true
    // of an existing user. A skipper is a new visitor who closed First Light
    // at the welcome, so the plain line is the one that is true for everyone
    // who reaches this mode.
    open('skipper')

    expect(mercSays()).toHaveTextContent(MERC_INTRO.q1)
    expect(mercSays()).not.toHaveTextContent(MERC_INTRO.q1Returning)
  })

  it('does not call the plan new to someone who is changing the answers they gave', () => {
    // A review of a plan whose first question was passed: nothing picked to
    // reply to, so Merc's opening line is the plain one.
    answered(EMPTY_CHOICES)
    open('review')

    fireEvent.click(changeAnswers()!)

    expect(mercSays()).toHaveTextContent(MERC_INTRO.q1)
    expect(mercSays()).not.toHaveTextContent(MERC_INTRO.q1Returning)
  })
})

describe("Merc's size", () => {
  it.each<[string, number, number, boolean]>([
    ['a wide window', 136, 92, false],
    ['a phone', 96, 84, true],
  ])(
    'on %s is %d px over the questions and %d px over the plan',
    (_where, onQuestions, onPlan, phone) => {
      stubWidth(phone)
      open('skipper')
      expect(sizeOf()).toEqual(squareOf(onQuestions))

      toThePlan()

      expect(sizeOf()).toEqual(squareOf(onPlan))
    },
  )
})

// ── What it is told as it opens ────────────────────────────────────────

describe('the shown event', () => {
  it('sends the shown event its mode names', () => {
    // An existing user's takeover is counted once, as a new visitor is: the
    // record the first opening writes is there for the second.
    opened('existing', 2)
    expect(sent()).toEqual(['plan_shown_existing'])

    // A skipper's every opening is a tap, and every one is counted.
    fresh()
    opened('skipper', 2)
    expect(sent()).toEqual(['plan_shown_skipper', 'plan_shown_skipper'])

    // A review was counted when the plan was first answered.
    fresh()
    answered()
    opened('review', 2)
    expect(sent()).toEqual([])
  })
})

// ── Reviewing an answered plan ─────────────────────────────────────────

describe('a review', () => {
  it('opens an answered plan with a way to change the answers', () => {
    answered()

    open('review')

    expect(box()).toHaveAttribute('data-phase', 'plan')
    expect(card('start')).toBeInTheDocument()
    expect(changeAnswers()).toBeInTheDocument()

    fireEvent.click(changeAnswers()!)

    // Back on the first question, with the answer given before picked.
    expect(box()).toHaveAttribute('data-phase', 'questions')
    expect(isOn(1)).toBe(true)
    expect(isPressed('Singing')).toBe(true)
  })

  it('offers no way to change the answers in a run that has only just answered them', () => {
    open('skipper')

    toThePlan()

    expect(box()).toHaveAttribute('data-phase', 'plan')
    expect(changeAnswers()).toBeNull()
  })

  it('stands after the cards and the switch and before the ways on, so Tab meets it between them', () => {
    answered()
    open('review')
    const change = changeAnswers()!
    const before = [
      ...document.querySelectorAll<HTMLElement>('[data-kind]'),
      screen.getByRole('switch'),
    ]
    const after = ['Show me around', 'See every room', 'Not now'].map((name) =>
      screen.getByRole('button', { name }),
    )

    expect(before.length).toBeGreaterThan(1)
    for (const earlier of before) {
      expect(earlier.compareDocumentPosition(change)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
    }
    for (const later of after) {
      expect(change.compareDocumentPosition(later)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
    }
  })

  it('goes back to the plan as it was from Not now on a changed answer, and the layer stays', () => {
    answered()
    const host = open('review')
    fireEvent.click(changeAnswers()!)

    tap('Not now')

    expect(box()).toHaveAttribute('data-phase', 'plan')
    expect(host.onClose).not.toHaveBeenCalled()
    expect(planRecord()?.status).toBe('answered')
  })
})
