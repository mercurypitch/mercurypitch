// ============================================================
// BeatPlan: the box the questions and the plan stand in, and the hand-overs out of it
// ============================================================
//
// The screens (PlanQuestions, PlanScreen) and the rulebook
// (usePlanFlowController) have tests of their own. What is pinned here is what
// only this beat decides: that it is one box with one Merc over the screens
// from the first question to the plan, how big he is and which still he wears,
// what each way out hands First Light, and how the beat wires the screens to
// the rulebook: the voiceprint's finding, the menu switch, the pills the chips
// fly from, and the gift First Light hands it for the credits line.
//
// jsdom applies no CSS, so the box's stylesheet is read as text (the box
// PlanExits.tsx asks of its host) and the placement itself is for the browser
// check; the frame's own rule, the bottom padding it gives up on a phone, is
// pinned in BeatMap.test.tsx. The screens are the real ones, tapped the way a
// singer taps them. Only the edges are faked: the browser's media queries, the
// GPU gate (so Merc is his still), and the promo store, which is never asked.
//
// The plan record is a module signal that `localStorage.clear()` does not
// reach, so each case puts it back.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createSignal } from 'solid-js'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GUIDE_FUNNEL_STORAGE_KEY } from '@/lib/guide-funnel'
import { giftTitle } from '@/lib/launch-gift-copy'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import { applyPersistedValue } from '@/lib/storage'
import { resetOnboarding } from '@/stores/onboarding-store'
import { practiceScope, setPracticeScope, setUiMode, } from '@/stores/settings-store'
import type { BeatPlanProps } from './BeatPlan'
import { BeatPlan } from './BeatPlan'
import styles from './BeatPlan.module.css'
import type { PlanStop } from './build-plan'
import { buildPlan } from './build-plan'
import { answeredElsewhere } from './plan-choices.fixture'
import { KICKER } from './plan-copy'
import { PLAN_OPENED_KEY, PLAN_RECORD_KEY } from './plan-keys'
import { planRecord } from './plan-store'
import { PICK_ADVANCE_MS } from './PlanQuestions'
import { mercSays, next, tap, toFourthQuestion, toThirdQuestion, } from './PlanQuestions.fixture'
import { CELEBRATE_MS } from './PlanScreen'
import type { PlanChoices } from './questions'
import { MERC_INTRO, q2Options, q3Options, q4Options } from './questions'

// The gift comes in as a prop, so the server's promo is never read or asked.
vi.mock('@/stores/promo-store', () => ({
  offeredPromo: () => null,
  loadFeaturedPromo: async () => {},
}))

// jsdom has no WebGL: Merc is his still, which is what these cases read.
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof GpuGateModule>()),
  canRunLiveMerc: (): boolean => false,
}))

// ── Fixtures ───────────────────────────────────────────────────────────

const repo = resolve(__dirname, '../../..')

/** The question screens' phone layout: the complement of their own `min-width: 720px`. */
const PHONE_QUERY = '(max-width: 719.98px)'

const STILL_POINT = '/onboarding/coach/merc-point.webp'
const STILL_LISTEN = '/onboarding/coach/merc-listen.webp'
const STILL_CELEBRATE = '/onboarding/coach/merc-celebrate.webp'

/** The window's width as the browser reports it, and who is listening for a turn of the phone. */
const browser = {
  phone: false,
  listeners: new Set<() => void>(),
  asked: [] as string[],
}

/** A browser's media queries: the modern API, or the older WebKit's `addListener` alone. */
function stubMatchMedia(api: 'modern' | 'legacy' = 'modern'): void {
  vi.stubGlobal('matchMedia', (query: string) => {
    browser.asked.push(query)
    const isPhoneQuery = query === PHONE_QUERY
    const add = (listener: () => void): void => {
      if (isPhoneQuery) browser.listeners.add(listener)
    }
    const remove = (listener: () => void): void => {
      browser.listeners.delete(listener)
    }
    return {
      get matches(): boolean {
        return isPhoneQuery && browser.phone
      },
      ...(api === 'legacy'
        ? { addListener: add, removeListener: remove }
        : {
            addEventListener: (_type: string, l: () => void) => add(l),
            removeEventListener: (_type: string, l: () => void) => remove(l),
          }),
    }
  })
}

/** The person turns the phone: the window changes width and tells whoever asked. */
function turnPhone(phone: boolean): void {
  browser.phone = phone
  for (const listener of [...browser.listeners]) listener()
}

interface Host {
  onHome: Mock<() => void>
  onRooms: Mock<() => void>
  onEnterStop: Mock<(stop: PlanStop, tour: boolean) => void>
}

/** The beat on its first question, with First Light's three hand-overs faked, and no gift on offer. */
function open(props: Partial<BeatPlanProps> = {}): Host {
  const host: Host = {
    onHome: vi.fn<() => void>(),
    onRooms: vi.fn<() => void>(),
    onEnterStop: vi.fn<(stop: PlanStop, tour: boolean) => void>(),
  }
  render(() => (
    <BeatPlan voiceprint={() => null} gift={() => null} {...props} {...host} />
  ))
  return host
}

/** Which of the hand-overs were made, and how often. */
const handed = (host: Host): [string, number][] =>
  Object.entries(host)
    .map(([name, fn]): [string, number] => [name, fn.mock.calls.length])
    .filter(([, calls]) => calls > 0)

const box = (): HTMLElement =>
  document.querySelector<HTMLElement>('[data-beat="questions"]')!
const merc = (): HTMLElement => screen.getByTestId('plan-merc')
const stillOf = (): string | null =>
  merc().querySelector('img')?.getAttribute('src') ?? null
/** His box's width and height, as MercPresence writes them inline. */
const sizeOf = (): string[] => [merc().style.width, merc().style.height]
const squareOf = (px: number): string[] => [`${px}px`, `${px}px`]
const card = (kind: PlanStop['kind']): HTMLElement =>
  document.querySelector<HTMLElement>(`[data-kind="${kind}"]`)!

/** The label a singer taps for an answer, by its id: the words come from questions.ts. */
const labelOf = (
  options: readonly { id: string; label: string }[],
  id: string,
): string => options.find((o) => o.id === id)!.label

/** The flights the plan's chips are asked to fly: whose chip, and how many frames it has. */
function recordFlights(): { label: string | undefined; frames: number }[] {
  const flights: { label: string | undefined; frames: number }[] = []
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    writable: true,
    value(this: HTMLElement, frames: Keyframe[]) {
      flights.push({ label: this.dataset.chip, frames: frames.length })
      return { finished: Promise.resolve() }
    },
  })
  return flights
}

/** What `toTheAuditionPlan` answers, as the controller keeps it. */
const AUDITION: PlanChoices = {
  q1: 'singing',
  q2: 'audition',
  q3: ['progress', 'tune'],
  q4: ['teacher'],
}

/** A guitar player's four questions, skipping the last two: the plan is up. */
function toThePlan(): void {
  toFourthQuestion()
  next()
}

/** Singing for an audition: Start here Sing, Learn Hear Yourself, Play Karaoke Night. */
function toTheAuditionPlan(): void {
  tap('Singing')
  vi.advanceTimersByTime(PICK_ADVANCE_MS)
  tap(labelOf(q2Options('singing'), 'audition'))
  vi.advanceTimersByTime(PICK_ADVANCE_MS)
  tap(labelOf(q3Options('singing'), 'progress'))
  tap(labelOf(q3Options('singing'), 'tune'))
  next()
  tap(labelOf(q4Options('singing'), 'teacher'))
  next()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  localStorage.clear()
  applyPersistedValue(PLAN_RECORD_KEY, 'null', { persist: false })
  applyPersistedValue(PLAN_OPENED_KEY, '[]', { persist: false })
  resetOnboarding()
  setPracticeScope('all')
  setUiMode('advanced')
  browser.phone = false
  browser.listeners.clear()
  browser.asked = []
  stubMatchMedia()
})

afterEach(() => {
  cleanup()
  delete (Element.prototype as { animate?: unknown }).animate
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resetOnboarding()
})

// ── The box ────────────────────────────────────────────────────────────

describe('the box', () => {
  it('wears its own two classes: the box that holds, and the place Merc takes in it', () => {
    open()

    expect(styles.host).toBeTruthy()
    expect(styles.merc).toBeTruthy()
    expect(box().classList.contains(styles.host)).toBe(true)
    expect(merc().classList.contains(styles.merc)).toBe(true)
  })

  it('is the beat First Light looks for, and keeps one box and one Merc from the first question to the plan', () => {
    open()
    const host = box()
    expect(host.dataset.beat).toBe('questions')
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
})

describe("Merc's line", () => {
  it("greets someone new with the first line, not the returning singer's", () => {
    open()

    expect(mercSays()).toHaveTextContent(MERC_INTRO.q1)
    expect(mercSays()).not.toHaveTextContent(MERC_INTRO.q1Returning)
  })
})

describe("Merc's size", () => {
  it.each<[string, boolean, number, number]>([
    ['a wide window', false, 136, 92],
    ['a phone', true, 96, 84],
  ])(
    'on %s is %d px over the questions and %d px over the plan',
    (_where, phone, onQuestions, onPlan) => {
      browser.phone = phone
      open()
      expect(sizeOf()).toEqual(squareOf(onQuestions))

      toThePlan()

      expect(sizeOf()).toEqual(squareOf(onPlan))
    },
  )

  it("asks the window the complement of the question screens' own breakpoint", () => {
    const screens = readFileSync(
      resolve(repo, 'src/features/plan/PlanQuestions.module.css'),
      'utf8',
    )
    expect(screens).toContain('@media (min-width: 720px)')

    open()

    expect(browser.asked).toContain(PHONE_QUERY)
  })

  // An older WebKit has `addListener` alone, and must not lose the turn.
  it.each<['modern' | 'legacy']>([['modern'], ['legacy']])(
    'follows a turn of the phone on whichever screen he stands, and stops listening when the beat goes: %s API',
    (api) => {
      stubMatchMedia(api)
      open()
      expect(sizeOf()).toEqual(squareOf(136))
      expect(browser.listeners.size).toBe(1)

      turnPhone(true)
      expect(sizeOf()).toEqual(squareOf(96))

      toThePlan()
      expect(sizeOf()).toEqual(squareOf(84))

      turnPhone(false)
      expect(sizeOf()).toEqual(squareOf(92))

      cleanup()
      expect(browser.listeners.size).toBe(0)
    },
  )

  it('stands wide where the window cannot say how wide it is', () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('matchMedia', undefined)

    open()

    expect(sizeOf()).toEqual(squareOf(136))
  })
})

describe('his still', () => {
  it('points the way on the first question, listens on the third, and cheers on the plan', () => {
    open()
    expect(stillOf()).toBe(STILL_POINT)

    toThirdQuestion()
    expect(stillOf()).toBe(STILL_LISTEN)

    next()
    expect(stillOf()).toBe(STILL_POINT)

    next()
    expect(stillOf()).toBe(STILL_CELEBRATE)
  })

  it('points at Start here once the cheer is over', () => {
    open()
    toThePlan()
    expect(stillOf()).toBe(STILL_CELEBRATE)

    vi.advanceTimersByTime(CELEBRATE_MS)

    expect(stillOf()).toBe(STILL_POINT)
  })

  it('wears pictures that are shipped', () => {
    for (const src of [STILL_POINT, STILL_LISTEN, STILL_CELEBRATE]) {
      expect(existsSync(resolve(repo, `public${src}`)), src).toBe(true)
    }
  })

  it('hides him from a screen reader: he is decoration', () => {
    open()

    expect(merc().querySelector('img')).toHaveAttribute('alt', '')
  })
})

// ── The ways out ───────────────────────────────────────────────────────

describe('the ways out', () => {
  it('hands Home to First Light from Not now on a question, and turns the plan down', () => {
    const host = open()

    tap('Not now')

    expect(handed(host)).toEqual([['onHome', 1]])
    expect(planRecord()?.status).toBe('declined')
  })

  it('asks First Light first when it wants to, and turns the plan down only once it says so', () => {
    let held: (() => void) | undefined
    const host = open({
      askBeforeDecline: (decline) => {
        held = decline
      },
    })

    tap('Not now')

    expect(held).toBeTypeOf('function')
    expect(handed(host)).toEqual([])
    expect(planRecord()?.status).not.toBe('declined')
    held?.()
    expect(handed(host)).toEqual([['onHome', 1]])
    expect(planRecord()?.status).toBe('declined')
  })

  it('stays on the question Not now was tapped on, with its answer picked, while First Light asks', () => {
    let held: (() => void) | undefined
    open({
      askBeforeDecline: (decline) => {
        held = decline
      },
    })
    tap('Guitar')

    tap('Not now')
    vi.advanceTimersByTime(PICK_ADVANCE_MS * 2)

    // The pick's move on to Q2 stopped, so staying leaves the person here.
    expect(screen.getByText('Question 1 of 4')).toBeTruthy()
    expect(screen.queryByText('Question 2 of 4')).toBeNull()
    expect(
      screen
        .getByRole('button', { name: 'Guitar' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    held?.()

    const sent = (
      JSON.parse(localStorage.getItem(GUIDE_FUNNEL_STORAGE_KEY) ?? '[]') as {
        event: string
      }[]
    ).map((entry) => entry.event)
    expect(sent).toContain('plan_declined_q1')
    expect(sent).not.toContain('plan_declined_q2')
  })

  it("hands Home from the plan's Not now, with the answers kept", () => {
    const host = open()
    toThePlan()

    tap('Not now')

    expect(handed(host)).toEqual([['onHome', 1]])
    expect(planRecord()?.status).toBe('answered')
  })

  it('opens the Map from See every room', () => {
    const host = open()
    toThePlan()

    tap('See every room')

    expect(handed(host)).toEqual([['onRooms', 1]])
  })

  it('hands Start here on as its card does, without the tour, from the main button', () => {
    // Arrange
    const host = open()
    toTheAuditionPlan()
    const start = card('start').dataset.dest

    // Act
    tap(KICKER.start)

    // Assert: the card's stop, no tour, and the card's own count.
    expect(handed(host)).toEqual([['onEnterStop', 1]])
    expect(host.onEnterStop).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'start', dest: start }),
      false,
    )
    const sent = (
      JSON.parse(localStorage.getItem(GUIDE_FUNNEL_STORAGE_KEY) ?? '[]') as {
        event: string
      }[]
    ).map((entry) => entry.event)
    expect(sent).toContain('plan_stop_start')
  })

  it('hands Start here on, with its tour, from Show me around', () => {
    const host = open()
    toTheAuditionPlan()
    const start = card('start').dataset.dest

    tap('Show me around')

    expect(handed(host)).toEqual([['onEnterStop', 1]])
    expect(host.onEnterStop).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'start', dest: start }),
      true,
    )
  })

  it.each<PlanStop['kind']>(['start', 'learn', 'play'])(
    'hands the %s card on without a tour when it is tapped',
    (kind) => {
      const host = open()
      toTheAuditionPlan()
      const dest = card(kind).dataset.dest

      fireEvent.click(card(kind))

      expect(handed(host)).toEqual([['onEnterStop', 1]])
      expect(host.onEnterStop).toHaveBeenCalledWith(
        expect.objectContaining({ kind, dest }),
        false,
      )
    },
  )
})

// ── What it is told ────────────────────────────────────────────────────

describe('what First Light tells it', () => {
  it("leads the plan with the voiceprint's finding", () => {
    const finding = { room: 'exercises', detail: 'Long Note' } as const
    const led = buildPlan(AUDITION, { voiceprint: finding })
    const unled = buildPlan(AUDITION)
    // The finding must change the plan, or this case reads nothing.
    expect(led.start.dest).not.toBe(unled.start.dest)

    open({ voiceprint: () => finding })
    toTheAuditionPlan()

    expect(card('start').dataset.dest).toBe(led.start.dest)
    expect(within(card('start')).getByText(led.start.title)).toBeInTheDocument()
  })
})

describe('a plan answered on another device', () => {
  it('is shown in place of the questions when the account sends it before the first pick', () => {
    open()

    answeredElsewhere(AUDITION)

    expect(box().dataset.phase).toBe('plan')
    expect(card('start').dataset.dest).toBe(buildPlan(AUDITION).start.dest)
  })

  it('leaves the questions to a singer who has started answering', () => {
    open()
    tap('Guitar')

    answeredElsewhere(AUDITION)

    expect(box().dataset.phase).toBe('questions')
  })
})

describe('the menu switch', () => {
  const toggle = (): HTMLElement => screen.getByRole('switch')

  it("narrows the menu to the plan's instrument when turned on, and widens it again when turned off", () => {
    const offer = buildPlan(AUDITION).scope!
    // The switch must change the menu, or this case reads nothing.
    expect(offer.scope).not.toBe('all')
    open()
    toTheAuditionPlan()
    expect(toggle()).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(toggle())

    expect(practiceScope()).toBe(offer.scope)
    expect(toggle()).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(toggle())

    expect(practiceScope()).toBe('all')
    expect(toggle()).toHaveAttribute('aria-checked', 'false')
  })
})

describe('the chips on the plan', () => {
  it('fly in from the pills of the last question, and the rest rise in', () => {
    const flights = recordFlights()
    open()

    toTheAuditionPlan()

    const fromPills = flights.filter((f) => f.frames === 3)
    const rising = flights.filter((f) => f.frames === 2)
    expect(fromPills.length).toBeGreaterThan(0)
    expect(rising.length).toBeGreaterThan(0)
    expect(fromPills.length + rising.length).toBe(flights.length)
    expect(new Set(fromPills.map((f) => f.label))).toEqual(
      new Set([labelOf(q4Options('singing'), 'teacher')]),
    )
  })
})

describe('the gift on the credits line', () => {
  const credits = (): HTMLElement | null =>
    card('play').querySelector<HTMLElement>('[data-part="credits"]')

  it('names the gift First Light hands it on the Karaoke Night card', () => {
    open({ gift: () => ({ credits: 5 }) })

    toTheAuditionPlan()

    expect(card('play').dataset.dest).toBe('karaokeNight')
    expect(credits()?.textContent).toContain(giftTitle(5))
  })

  it('names no gift when First Light hands it none, as for a refused microphone', () => {
    open({ gift: () => null })

    toTheAuditionPlan()

    expect(card('play').dataset.dest).toBe('karaokeNight')
    expect(credits()).toBeNull()
    expect(document.body.textContent).not.toContain(giftTitle(5))
  })

  it("follows the gift as First Light's rule changes it", () => {
    const [gift, setGift] = createSignal<{ credits: number } | null>(null)
    open({ gift })
    toTheAuditionPlan()
    expect(credits()).toBeNull()

    setGift({ credits: 3 })

    expect(credits()?.textContent).toContain(giftTitle(3))
  })
})

// ── The stylesheets ────────────────────────────────────────────────────

/** A sheet's text, comments gone: a rule is named in the prose too. */
const sheet = (file: string): string =>
  readFileSync(resolve(repo, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** What a rule with exactly this selector declares, by property. */
function declarations(
  source: string,
  selector: string,
): Record<string, string> {
  const body = new RegExp(`${selector} \\{([^}]*)\\}`).exec(source)?.[1] ?? ''
  return Object.fromEntries(
    body.split(';').flatMap((line) => {
      const [property, ...value] = line.split(':')
      return value.length > 0
        ? [[property.trim(), value.join(':').replace(/\s+/g, ' ').trim()]]
        : []
    }),
  )
}

/** Anything that would make the box a containing block, scroll it, move it or pad it. */
const TRAPS =
  /^(transform|translate|rotate|scale|perspective|filter|backdrop-filter|will-change|contain|animation|transition|overflow(-x|-y)?|padding(-.+)?)$/

describe("the box's stylesheet", () => {
  const css = sheet('src/features/plan/BeatPlan.module.css')

  it('is a positioned, height-bounded flex column the screens can stand in', () => {
    expect(declarations(css, '.host')).toMatchObject({
      position: 'relative',
      display: 'flex',
      'flex-direction': 'column',
      flex: '1 1 0',
      'min-height': '0',
    })
  })

  it('does not scroll, move, filter or pad the box, or the screens lose their corners and their room', () => {
    const declared = Object.keys(declarations(css, '.host'))

    expect(declared.length).toBeGreaterThan(0)
    expect(declared.filter((property) => TRAPS.test(property))).toEqual([])
  })

  it('places Merc without touching his display, which his still and his canvas share', () => {
    expect(declarations(css, '.merc')).toEqual({ flex: 'none' })
  })
})
