// ============================================================
// PlanScreen — the plan, read as a person reads it and tapped as they tap it
// ============================================================
//
// The approved audition plan stands in for a real one: three stops (Start
// here at Sing, Learn at Hear Yourself, Play at Karaoke Night) and the menu
// switch. It comes from buildPlan, so every line on screen is the one a
// person is given, and each case reads its expectation off the plan rather
// than retyping a line. Plans with a Karaoke Night Start here, no reason, or
// one stop only are that plan changed by hand.
//
// Fake timers run Merc's second pose. The host's callbacks are all that is
// faked; the host (Task 7's) owns Merc, the account and the stops' doors.
// jsdom has no layout and applies no stylesheet, so the chips' flight is
// read off an `animate` that writes down what it was asked to play, and
// where things sit on screen (the corners, the height of the scroll region,
// how the ways on stay in view) is for the browser check. What is pinned
// here is the markup that decides it: the cards are in the element that
// scrolls (the one wearing the scroll class, which is how jsdom can tell
// it), the ways on and the exits are outside it, and Not now is the button
// PlanExits gives the questions too (it wears that stylesheet's class, which
// a button of the screen's own would not).
//
// A card's parts (its kind, room, title, reason, chips and credits line) have
// no role to query by, so the markup carries `data-part` hooks, and
// `data-dest` for the stop a card is: they are how these tests reach a part.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CreditCoin } from '@/components/billing/CreditCoin'
import type { MercState } from '@/lib/merc/constants'
import type { Plan, PlanStop } from './build-plan'
import { buildPlan, PLAN_DESTS } from './build-plan'
import type { CreditsLine } from './plan-credits'
import { PlanExits } from './PlanExits'
import type { PlanScreenProps } from './PlanScreen'
import { CELEBRATE_MS, PlanScreen } from './PlanScreen'
import styles from './PlanScreen.module.css'
import { MERC_INTRO } from './questions'

/** Singing, for the audition: the approved plan with all three stops and the switch. */
const AUDITION: Plan = buildPlan({
  q1: 'singing',
  q2: 'audition',
  q3: ['progress', 'tune'],
  q4: ['teacher'],
})
const START = AUDITION.start
const LEARN = AUDITION.learn as PlanStop
const PLAY = AUDITION.play as PlanStop
const SWITCH_LABEL = (AUDITION.scope as { label: string }).label

const CREDITS: CreditsLine = {
  kind: 'balance',
  title: 'You have 12 credits',
  sub: 'One credit splits a song of up to 12 minutes into voice and band.',
}

/** Karaoke Night leading, as a voiceprint that is ready for a song makes it. */
const KARAOKE_FIRST: Plan = {
  ...AUDITION,
  start: {
    kind: 'start',
    dest: 'karaokeNight',
    title: 'Sing along, scored',
    why: "That was solid. You're ready to sing a real song.",
    chips: ['Your voiceprint'],
  },
  play: null,
}

interface Host {
  onScopeChange: Mock<(on: boolean) => void>
  onMercState: Mock<(s: MercState) => void>
  onShowMeAround: Mock<() => void>
  onOpenStop: Mock<(stop: PlanStop) => void>
  onSeeEveryRoom: Mock<() => void>
  onNotNow: Mock<() => void>
}

function open(props: Partial<PlanScreenProps> = {}): Host {
  const host: Host = {
    onScopeChange: vi.fn<(on: boolean) => void>(),
    onMercState: vi.fn<(s: MercState) => void>(),
    onShowMeAround: vi.fn<() => void>(),
    onOpenStop: vi.fn<(stop: PlanStop) => void>(),
    onSeeEveryRoom: vi.fn<() => void>(),
    onNotNow: vi.fn<() => void>(),
  }
  render(() => (
    <PlanScreen
      plan={AUDITION}
      credits={null}
      scopeOn={false}
      {...props}
      {...host}
    />
  ))
  return host
}

/** Every stop's card, in the order they are read. */
const cards = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>('[data-kind]'),
]
const card = (kind: PlanStop['kind']): HTMLElement =>
  document.querySelector<HTMLElement>(`[data-kind="${kind}"]`)!
/** The words of an element, all of them: toHaveTextContent takes a part for the whole. */
const textOf = (el: HTMLElement | null): string | null =>
  el === null ? null : el.textContent
const part = (from: HTMLElement, name: string): HTMLElement | null =>
  from.querySelector<HTMLElement>(`[data-part="${name}"]`)
const chipsOn = (from: HTMLElement): string[] =>
  [...from.querySelectorAll('[data-chip]')].map((c) => c.textContent ?? '')
const button = (name: string): HTMLElement =>
  screen.getByRole('button', { name })
const heading = (): HTMLElement => screen.getByRole('heading', { level: 1 })
/** What a screen reader skips: the element itself, or what it sits inside. */
const hiddenFrom = (el: Element | null | undefined): Element | null =>
  el?.closest('[aria-hidden="true"]') ?? null
/** The element that scrolls: the one wearing the scroll class (jsdom has no overflow to read). */
const scrollRegion = (): HTMLElement | null =>
  document.querySelector<HTMLElement>(`.${styles.scroll.split(' ').join('.')}`)
/** The credit coin drawn inside an element, if there is one. */
const coinIn = (el: ParentNode | null | undefined): Element | null =>
  el?.querySelector('[data-coin]') ?? null
/** The main button of the ways-on row, named in several cases. */
const SHOW_ME_AROUND = 'Show me around'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete (Element.prototype as { animate?: unknown }).animate
})

describe('what the plan says', () => {
  it("opens with Merc's line, then the headline, whose last words stand in an element of their own", () => {
    open()
    const line = screen.getByText(MERC_INTRO.plan)

    expect(line.compareDocumentPosition(heading())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(textOf(heading())).toBe('Singing, for the audition')
    expect(
      within(heading()).getByText(AUDITION.headline.lit),
    ).toBeInTheDocument()
  })

  it('shows one card for each stop the plan has', () => {
    open()

    expect(cards().map((c) => c.dataset.kind)).toEqual([
      'start',
      'learn',
      'play',
    ])
    expect(cards().map((c) => c.dataset.dest)).toEqual([
      START.dest,
      LEARN.dest,
      PLAY.dest,
    ])
    cleanup()

    open({ plan: { ...AUDITION, learn: null, play: null, scope: null } })
    expect(cards().map((c) => c.dataset.kind)).toEqual(['start'])
    cleanup()

    open({ plan: { ...AUDITION, learn: null } })
    expect(cards().map((c) => c.dataset.kind)).toEqual(['start', 'play'])
  })

  it('names the cards as a group by the headline over them', () => {
    open()

    expect(
      screen.getByRole('group', { name: 'Singing, for the audition' }),
    ).toContainElement(card('start'))
  })

  it('lays a lone Start here card out on its own, and no other plan', () => {
    const laidOut = (plan: Plan): string | null => {
      open({ plan })
      const group = screen.getByRole('group')
      const solo = group.getAttribute('data-solo')
      cleanup()
      return solo
    }

    expect(laidOut({ ...AUDITION, learn: null, play: null, scope: null })).toBe(
      '',
    )
    expect(laidOut(AUDITION)).toBeNull()
    expect(laidOut({ ...AUDITION, learn: null, play: null })).toBeNull()
    expect(laidOut({ ...AUDITION, scope: null, play: null })).toBeNull()
  })

  it.each([
    ['start', START, 'Start here'],
    ['learn', LEARN, 'Learn'],
    ['play', PLAY, 'Play'],
  ] as const)(
    "shows the %s card's place, job, reason and the answers behind it",
    (kind, stop, kicker) => {
      open()
      const on = card(kind)

      expect(textOf(part(on, 'kind'))).toBe(kicker)
      expect(textOf(part(on, 'room'))).toBe(PLAN_DESTS[stop.dest].room)
      expect(textOf(part(on, 'title'))).toBe(stop.title)
      expect(textOf(part(on, 'why'))).toBe(stop.why)
      expect(chipsOn(on)).toEqual(stop.chips)
    },
  )

  it("keeps the spaces of a card's kicker outside its hidden dot", () => {
    open()
    const kicker = part(card('start'), 'kind')?.parentElement
    const dot = kicker?.querySelector('[aria-hidden="true"]')

    // A reader skips the dot. Its spaces must stay in the kicker, or the
    // browser's name for the card reads "Start hereSing" as one word (jsdom
    // puts a space round every child, so only the markup can be checked).
    expect(kicker?.textContent).toBe('Start here · Sing')
    expect(dot?.textContent).toBe('·')
  })

  it("wears each room's own picture", () => {
    open()

    for (const stop of [START, LEARN, PLAY]) {
      const picture = card(stop.kind).querySelector('img')
      expect(picture).toHaveAttribute('src', PLAN_DESTS[stop.dest].cover)
      expect(picture).toHaveAttribute('alt', '')
    }
  })

  it('draws no reason line for a stop that has none', () => {
    // A plan rebuilt from the stored record has no voiceprint reason, so a
    // voiceprint-led Start here can have nothing to say under its title.
    open({ plan: { ...AUDITION, start: { ...START, why: '' } } })

    expect(part(card('start'), 'why')).toBeNull()
    expect(part(card('start'), 'title')).toHaveTextContent(START.title)
    expect(part(card('learn'), 'why')).toHaveTextContent(LEARN.why)
  })

  it('draws no chips for a stop that carries none', () => {
    open({ plan: { ...AUDITION, start: { ...START, chips: [] } } })

    expect(part(card('start'), 'chips')).toBeNull()
    expect(chipsOn(card('learn'))).toEqual(LEARN.chips)
  })
})

describe('the credits line', () => {
  it('puts the credits line on the Karaoke Night card only', () => {
    open({ credits: CREDITS })

    expect(within(card('play')).getByText(CREDITS.title)).toBeInTheDocument()
    expect(within(card('play')).getByText(CREDITS.sub)).toBeInTheDocument()
    expect(screen.getAllByText(CREDITS.title)).toHaveLength(1)
    expect(part(card('start'), 'credits')).toBeNull()
    expect(part(card('learn'), 'credits')).toBeNull()
  })

  it('puts it on Start here when Karaoke Night is the Start-here card', () => {
    open({ plan: KARAOKE_FIRST, credits: CREDITS })

    expect(within(card('start')).getByText(CREDITS.title)).toBeInTheDocument()
    expect(screen.getAllByText(CREDITS.title)).toHaveLength(1)
    expect(part(card('learn'), 'credits')).toBeNull()
  })

  it('shows no line when there is none to show', () => {
    open({ credits: null })

    expect(document.querySelector('[data-part="credits"]')).toBeNull()
  })

  it('shows no line when Karaoke Night is not on the plan', () => {
    const noNight: Plan = { ...AUDITION, play: null }
    open({ plan: noNight, credits: CREDITS })

    expect(screen.queryByText(CREDITS.title)).toBeNull()
  })

  it('keeps the card one tap, with the line inside it', () => {
    const host = open({ credits: CREDITS })

    fireEvent.click(screen.getByText(CREDITS.sub))

    expect(host.onOpenStop).toHaveBeenCalledWith(PLAY)
  })

  it('dresses a gift in the gift icon and no coin, hidden from a screen reader', () => {
    open({ credits: { ...CREDITS, kind: 'gift' } })
    const line = part(card('play'), 'credits')
    const icon = line?.querySelector('svg')

    expect(icon?.getAttribute('data-icon')).toBe('gift')
    expect(coinIn(line)).toBeNull()
    expect(hiddenFrom(icon)).not.toBeNull()
  })

  it.each(['balance', 'price'] as const)(
    'dresses a %s line in the credit coin, not the gift, hidden from a screen reader',
    (kind) => {
      const coin = render(() => <CreditCoin size={18} />)
      open({ credits: { ...CREDITS, kind } })
      const line = part(card('play'), 'credits')
      const icon = coinIn(line)

      expect(icon?.outerHTML).toBe(coinIn(coin.container)?.outerHTML)
      expect(line?.querySelector('svg')).toBeNull()
      expect(hiddenFrom(icon)).not.toBeNull()
    },
  )
})

describe('the menu switch', () => {
  it('leaves the scope switch off until tapped', () => {
    const host = open()
    const toggle = screen.getByRole('switch', { name: SWITCH_LABEL })

    expect(toggle).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(toggle)

    expect(host.onScopeChange).toHaveBeenCalledTimes(1)
    expect(host.onScopeChange).toHaveBeenCalledWith(true)
  })

  it('shows the switch on when the host says so, and turns it off on a tap', () => {
    const host = open({ scopeOn: true })
    const toggle = screen.getByRole('switch', { name: SWITCH_LABEL })

    expect(toggle).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(toggle)

    expect(host.onScopeChange).toHaveBeenCalledWith(false)
  })

  it('says it can be changed any time', () => {
    const note = 'You can change it any time in Settings, App Mode.'
    open()

    expect(screen.getByText(note).textContent).toBe(note)
    expect(screen.getByRole('switch')).toHaveAccessibleDescription(note)
  })

  it('turns from its words as well as from the switch', () => {
    const host = open()

    fireEvent.click(screen.getByText(SWITCH_LABEL))

    expect(host.onScopeChange).toHaveBeenCalledWith(true)
  })

  it('hides the switch when the plan offers none', () => {
    open({ plan: { ...AUDITION, scope: null } })

    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByText(/Settings, App Mode/u)).toBeNull()
  })

  it('keeps the switch when Start here is the only card', () => {
    open({ plan: { ...AUDITION, learn: null, play: null } })

    expect(cards().map((c) => c.dataset.kind)).toEqual(['start'])
    expect(
      screen.getByRole('switch', { name: SWITCH_LABEL }),
    ).toBeInTheDocument()
  })

  it('does not open a stop when the switch is tapped', () => {
    const host = open()

    fireEvent.click(screen.getByRole('switch'))

    expect(host.onOpenStop).not.toHaveBeenCalled()
  })
})

describe('the ways on', () => {
  it('opens a stop from its card', () => {
    const host = open()

    fireEvent.click(within(card('learn')).getByText(LEARN.title))

    expect(host.onOpenStop).toHaveBeenCalledTimes(1)
    expect(host.onOpenStop).toHaveBeenCalledWith(LEARN)
  })

  it.each([
    ['start', START],
    ['learn', LEARN],
    ['play', PLAY],
  ] as const)(
    'opens the %s stop from its own card and no other',
    (kind, stop) => {
      const host = open()

      fireEvent.click(card(kind))

      expect(host.onOpenStop.mock.calls).toEqual([[stop]])
    },
  )

  it('makes every card a button, so a keyboard opens it too', () => {
    open()

    for (const on of cards()) expect(on.tagName).toBe('BUTTON')
  })

  it('offers every room and a way out, and no way back', () => {
    const host = open()
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()

    fireEvent.click(button('See every room'))
    expect(host.onSeeEveryRoom).toHaveBeenCalledTimes(1)

    fireEvent.click(button('Not now'))
    expect(host.onNotNow).toHaveBeenCalledTimes(1)

    fireEvent.click(button(SHOW_ME_AROUND))
    expect(host.onShowMeAround).toHaveBeenCalledTimes(1)

    expect(host.onOpenStop).not.toHaveBeenCalled()
  })

  it('has the Not now button the questions have, so it stays in their corner', () => {
    open()
    const mine = button('Not now').className
    const theirs = render(() => <PlanExits onNotNow={vi.fn()} />)

    expect(mine).toBe(
      within(theirs.container).getByRole('button', { name: 'Not now' })
        .className,
    )
  })

  it('puts the way out after the answers, so Tab meets the plan first', () => {
    open()

    const order = screen.getAllByRole('button')
    expect(order.at(-1)).toBe(button('Not now'))
    expect(order.indexOf(button(SHOW_ME_AROUND))).toBeGreaterThan(
      order.indexOf(card('play')),
    )
    // Not now sits in the top corner on screen, and after every card in the DOM.
    for (const on of cards()) {
      expect(on.compareDocumentPosition(button('Not now'))).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
    }
  })

  it('moves focus to the headline, so a screen reader says where the person landed', () => {
    open()

    expect(heading()).toHaveFocus()
  })

  it('keeps the cards in the element that scrolls and the ways on out of it', () => {
    open()
    const region = scrollRegion()

    expect(region).not.toBeNull()
    for (const on of cards()) expect(region).toContainElement(on)
    expect(region).toContainElement(screen.getByRole('switch'))
    for (const name of [SHOW_ME_AROUND, 'See every room', 'Not now']) {
      expect(region).not.toContainElement(button(name))
    }
  })
})

describe('Merc', () => {
  it('celebrates as the plan opens, points CELEBRATE_MS later, and then says nothing more', () => {
    const host = open()

    expect(host.onMercState.mock.calls).toEqual([['celebrate']])
    vi.advanceTimersByTime(CELEBRATE_MS - 1)
    expect(host.onMercState.mock.calls).toEqual([['celebrate']])
    vi.advanceTimersByTime(1)
    expect(host.onMercState.mock.calls).toEqual([['celebrate'], ['point']])

    vi.advanceTimersByTime(60_000)
    expect(host.onMercState).toHaveBeenCalledTimes(2)
  })

  it('does not point once the screen has gone', () => {
    const host = open()

    cleanup()
    vi.advanceTimersByTime(CELEBRATE_MS * 2)

    expect(host.onMercState.mock.calls).toEqual([['celebrate']])
  })

  it('mounts no Merc of its own', () => {
    open()

    expect(document.querySelector('[data-presence]')).toBeNull()
  })
})

describe('the chips', () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
    }) as DOMRect

  /** Puts an `animate` on every element, writing down what each plays. */
  function allowAnimation(): { chip: HTMLElement; frames: Keyframe[] }[] {
    const played: { chip: HTMLElement; frames: Keyframe[] }[] = []
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      writable: true,
      value(this: HTMLElement, frames: Keyframe[]) {
        played.push({ chip: this, frames })
        return { finished: Promise.resolve() }
      },
    })
    return played
  }

  it('flies a chip from the pill that made it, and lets the rest rise in', () => {
    const played = allowAnimation()
    // jsdom lays nothing out: every chip stands at (0, 0), so a pill 100 by 40
    // at (200, 400) is 250 right of and 420 under where each chip lands.
    open({ fromPills: new Map([['A teacher', rect(200, 400, 100, 40)]]) })

    expect(played.map(({ chip }) => chip.dataset.chip)).toEqual([
      ...START.chips,
      ...LEARN.chips,
      ...PLAY.chips,
    ])
    const [first, teacher, last] = played
    expect(String(teacher.frames[0].transform)).toMatch(
      /^translate\(250px, 420px\)/u,
    )
    for (const risen of [first, last]) {
      expect(String(risen.frames[0].transform)).not.toMatch(/translate\(/u)
    }
  })

  it('rises every chip in when no pills are given', () => {
    const played = allowAnimation()
    open()

    expect(played).toHaveLength(3)
    for (const { frames } of played) {
      expect(String(frames[0].transform)).not.toMatch(/translate\(/u)
    }
  })

  it('plays nothing under reduced motion', () => {
    const played = allowAnimation()
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
    }))
    open({ fromPills: new Map([['A teacher', rect(200, 400, 100, 40)]]) })

    expect(played).toHaveLength(0)
    expect(chipsOn(card('learn'))).toEqual(LEARN.chips)
  })
})
