// ============================================================
// PlanQuestions — the four question screens, tapped through as a person does
// ============================================================
//
// Fake timers run the one-second move on after a single pick and Merc's
// poses; the host's three callbacks are all that is faked. Each test opens
// the screens on the first question and taps what a singer would tap, by the
// name a screen reader gives the control. The helpers are shared with
// PlanQuestions.lines.test.tsx through PlanQuestions.fixture.tsx; this file
// takes the four questions one by one, and checks that the way out comes
// after the answers in the DOM, so Tab meets them first. That one takes the
// typed lines, Not now, Merc and the answers the screens open on.
//
// The lines the brief spells out are written out: they are what the screens
// must say. Everything else is read from questions.ts.

import { cleanup, render, screen, within } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Ear, Guitar, Mic, PianoKeys } from '@/components/icons'
import { PICK_ADVANCE_MS } from './PlanQuestions'
import { ANOTHER_APP, APP_FIELD, button, isLocked, isOn, isPressed, later, mercSays, next, nextButton, NOTHING_YET, open, OTHER_FIELD, q2Label, q3Label, q3Line, q4Label, quiet, SKIP_THIS_ONE, SKIP_TO_PLAN, SOMETHING_ELSE, tap, toFourthQuestion, toThirdQuestion, } from './PlanQuestions.fixture'
import { EVERYTHING, INSTRUMENTS, MERC_INTRO } from './questions'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the four questions', () => {
  it('asks them in order, with Merc opening each one', () => {
    open()
    const asked = (): string | null =>
      screen.getByRole('heading', { level: 1 }).textContent

    expect(asked()).toBe('What do you want to work on most?')
    expect(mercSays()).toHaveTextContent(MERC_INTRO.q1)
    tap('Skip')
    expect(asked()).toBe('What are you working toward?')
    expect(mercSays()).toHaveTextContent(MERC_INTRO.q2)
    tap('Skip')
    expect(asked()).toBe("What's the hardest part right now?")
    expect(mercSays()).toHaveTextContent(MERC_INTRO.q3)
    next()
    expect(asked()).toBe('The last time you practiced, what did you use?')
    expect(mercSays()).toHaveTextContent(MERC_INTRO.q4)
  })

  it('puts the way out after the answers, so Tab meets the question first', () => {
    open()

    // Not now sits in the top corner on screen, and after the answers in the DOM.
    expect(button('Guitar').compareDocumentPosition(button('Not now'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })
})

describe('the first question', () => {
  it("draws each instrument's own icon on its card", () => {
    open()
    const icons = { singing: Mic, guitar: Guitar, piano: PianoKeys, ear: Ear }

    for (const [id, Icon] of Object.entries(icons)) {
      const alone = render(() => <Icon />).container.querySelector('svg')
      const card = document.querySelector(`[data-option="${id}"]`)
      expect(
        card?.querySelector('span[aria-hidden="true"] svg')?.outerHTML,
      ).toBe(alone?.outerHTML)
    }
  })

  it('moves on a second after a single pick', () => {
    open()
    expect(PICK_ADVANCE_MS).toBe(1000)

    tap('Guitar')
    later(999)

    expect(isOn(1)).toBe(true)
    later(1)
    expect(isOn(2)).toBe(true)
  })

  it('keeps the last of two quick taps', () => {
    open()

    tap('Singing')
    later(400)
    tap('Guitar')
    later(999)

    // Assert: the second tap started the second over, so nothing moved yet
    expect(isOn(1)).toBe(true)
    later(1)
    expect(isOn(2)).toBe(true)
    expect(button('Playing with other people')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Singing with other people' }),
    ).toBeNull()
    later(PICK_ADVANCE_MS * 5)
    expect(isOn(2)).toBe(true)
  })

  it('greets a returning singer with their own line', () => {
    open({ returning: true })

    expect(mercSays()).toHaveTextContent(
      "New in Mercury Pitch: four taps and I'll show you what fits.",
    )
  })

  it('greets a new singer with the first line', () => {
    open()

    expect(mercSays()).toHaveTextContent(
      "Four quick questions, then I'll make you a plan.",
    )
  })

  it('keeps the returning greeting for the first question', () => {
    open({ returning: true })

    tap('Skip')

    expect(mercSays()).toHaveTextContent(MERC_INTRO.q2)
  })

  it("pops Merc's line on each reply, in turn, so the next pick pops again", () => {
    open()
    expect(mercSays()).not.toHaveAttribute('data-pop')

    tap('Singing')
    const first = mercSays().getAttribute('data-pop')
    tap('Guitar')

    expect(first).not.toBeNull()
    expect(mercSays().getAttribute('data-pop')).not.toBe(first)
  })

  it('answers a pick with its own line, in the one polite live region', () => {
    open()
    const line = screen.getByText(MERC_INTRO.q1)

    tap('Guitar')

    expect(line).toHaveAttribute('aria-live', 'polite')
    expect(line).toHaveAttribute('aria-atomic', 'true')
    expect(line).toHaveTextContent(INSTRUMENTS[1].line)
  })

  it('takes A bit of everything as a first answer', () => {
    open()

    tap(EVERYTHING.label)

    expect(isPressed(EVERYTHING.label)).toBe(true)
    expect(quiet()).toHaveAccessibleName('Next')
    expect(screen.getByText(EVERYTHING.line)).toBeInTheDocument()
    later(PICK_ADVANCE_MS)
    expect(button('Singing with other people')).toBeInTheDocument()

    // Assert: going back to it, Merc says its line again
    tap('Back')
    expect(mercSays()).toHaveTextContent(EVERYTHING.line)
  })

  it('holds A bit of everything in the one group, and says to pick one', () => {
    open()

    const group = screen.getByRole('group', { name: /work on most/ })

    expect(group).toHaveAccessibleDescription('Pick one')
    expect(
      within(group).getByRole('button', { name: EVERYTHING.label }),
    ).toHaveAttribute('data-option', 'everything')
    expect(within(group).getAllByRole('button')).toHaveLength(5)
  })

  it('offers Skip on the first two questions and Back from the second on', () => {
    open()

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
    expect(button('Skip')).toBeInTheDocument()
    tap('Skip')
    expect(isOn(2)).toBe(true)
    expect(button('Back')).toBeInTheDocument()
    expect(button('Skip')).toBeInTheDocument()
    tap('Skip')
    expect(isOn(3)).toBe(true)
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()
  })

  it('hands back no first or second answer when both were skipped', () => {
    const host = open()

    tap('Skip')
    tap('Skip')
    next()
    next()

    expect(host.onDone.mock.calls[0][0]).toEqual({
      q1: null,
      q2: null,
      q3: [],
      q4: [],
    })
  })

  it('reads Skip until an answer stands, and Next once one does', () => {
    open()
    expect(quiet()).toHaveAccessibleName('Skip')

    tap('Guitar')

    expect(quiet()).toHaveAccessibleName('Next')
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()
  })

  it('moves on at once on Next, keeping the pick and cancelling the wait', () => {
    const host = open()
    tap('Guitar')

    tap('Next')
    later(PICK_ADVANCE_MS * 3)

    // Assert: Q2 is open and the wait that Next cut short did not go on to Q3
    expect(isOn(2)).toBe(true)
    tap('Skip')
    next()
    next()
    expect(host.onDone.mock.calls[0][0].q1).toBe('guitar')
  })
})

describe('the second question', () => {
  it('stays on the first question when Back lands inside the wait after a pick', () => {
    open()
    tap('Guitar')
    later(PICK_ADVANCE_MS)
    tap(q2Label('song'))

    tap('Back')
    later(PICK_ADVANCE_MS * 3)

    // Assert: the wait that Back cut short does not carry on to Q3
    expect(isOn(1)).toBe(true)
  })

  it('moves on a second after a pick, and answers it', () => {
    open()
    tap('Guitar')
    later(PICK_ADVANCE_MS)

    tap(q2Label('song'))

    expect(isPressed(q2Label('song'))).toBe(true)
    expect(
      screen.getByText("Then we'll work toward that song."),
    ).toBeInTheDocument()
    later(999)
    expect(isOn(2)).toBe(true)
    later(1)
    expect(isOn(3)).toBe(true)
  })

  it('says to pick one, and keeps a pick when Next is tapped', () => {
    const host = open()
    tap('Guitar')
    later(PICK_ADVANCE_MS)
    expect(
      screen.getByRole('group', { name: /working toward/ }),
    ).toHaveAccessibleDescription('Pick one')
    expect(quiet()).toHaveAccessibleName('Skip')

    tap(q2Label('song'))
    expect(quiet()).toHaveAccessibleName('Next')
    tap('Next')
    next()
    next()

    expect(host.onDone.mock.calls[0][0]).toEqual({
      q1: 'guitar',
      q2: 'song',
      q3: [],
      q4: [],
    })
  })

  it('goes back with the earlier answer still picked', () => {
    open()
    toThirdQuestion()

    tap('Back')

    expect(isOn(2)).toBe(true)
    expect(isPressed(q2Label('song'))).toBe(true)
    expect(
      screen.getByText("Then we'll work toward that song."),
    ).toBeInTheDocument()
    tap('Back')
    expect(isOn(1)).toBe(true)
    expect(isPressed('Guitar')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })

  it('hands the answer on when Next is tapped after going back to it', () => {
    const host = open()
    toThirdQuestion()

    tap('Back')
    expect(quiet()).toHaveAccessibleName('Next')
    tap('Next')
    next()
    next()

    expect(host.onDone.mock.calls[0][0].q2).toBe('song')
  })

  it('drops a hard part the new first answer does not offer', () => {
    // Arrange: a singer picks the singing-only "Hearing if I'm in tune"
    const host = open()
    tap('Singing')
    later(PICK_ADVANCE_MS)
    tap('A song I love')
    later(PICK_ADVANCE_MS)
    tap("Hearing if I'm in tune")
    tap('Back')
    tap('Back')

    // Act: then they are a guitarist after all, and keep the goal they gave
    tap('Guitar')
    later(PICK_ADVANCE_MS)
    tap('Next')

    expect(
      screen.queryByRole('button', { name: "Hearing if I'm in tune" }),
    ).toBeNull()
    next()
    next()
    expect(host.onDone.mock.calls[0][0].q3).toEqual([])
  })
})

describe('the third question', () => {
  it('takes at most two hardest parts', () => {
    const host = open()
    toThirdQuestion()
    tap(q3Label('time'))
    tap(q3Label('what'))
    const said = screen.getByText(q3Line('what'))
    host.onMercState.mockClear()

    tap(q3Label('tempo'))
    tap(SOMETHING_ELSE)

    // Assert: a third tap changes nothing, Merc included
    expect(said).toHaveTextContent(q3Line('what'))
    expect(host.onMercState).not.toHaveBeenCalled()
    expect(isPressed(q3Label('time'))).toBe(true)
    expect(isPressed(q3Label('what'))).toBe(true)
    expect(isLocked(q3Label('time'))).toBe(false)
    expect(isLocked(q3Label('what'))).toBe(false)
    expect(
      screen.getByRole('group', { name: /hardest part/ }),
    ).toHaveAccessibleDescription("That's two. Tap one again to change it.")
    for (const id of [
      'progress',
      'tempo',
      'setup',
      'alone',
      'other',
    ] as const) {
      expect(isLocked(q3Label(id))).toBe(true)
      expect(isPressed(q3Label(id))).toBe(false)
    }
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('gives a spot back when a picked part is tapped off', () => {
    open()
    toThirdQuestion()
    tap(q3Label('time'))
    tap(q3Label('what'))

    tap(q3Label('time'))

    expect(isPressed(q3Label('time'))).toBe(false)
    expect(
      screen.getByRole('group', { name: /hardest part/ }),
    ).toHaveAccessibleDescription('Pick up to two.')
    expect(isLocked(q3Label('tempo'))).toBe(false)
    tap(q3Label('tempo'))
    expect(isPressed(q3Label('tempo'))).toBe(true)
  })

  it('takes Merc back to his opening line when the only pick is tapped off', () => {
    open()
    toThirdQuestion()
    tap(q3Label('what'))

    tap(q3Label('what'))

    expect(mercSays()).toHaveTextContent(MERC_INTRO.q3)
  })

  it('opens a 140-character line for Something else', () => {
    open()
    toThirdQuestion()
    expect(screen.queryByRole('textbox')).toBeNull()

    tap(SOMETHING_ELSE)

    const field = screen.getByRole('textbox', { name: OTHER_FIELD })
    expect(field).toHaveAttribute('maxlength', '140')
    expect(field).toHaveAttribute('enterkeyhint', 'done')
    expect(field).toHaveFocus()
    tap(SOMETHING_ELSE)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('answers a hard part with its own line and listens', () => {
    const host = open()
    toThirdQuestion()
    host.onMercState.mockClear()

    tap(q3Label('what'))

    expect(screen.getByText(q3Line('what'))).toBeInTheDocument()
    expect(host.onMercState).toHaveBeenCalledWith('hop')
    // Assert: a hop here is short, so the next tap can hop again
    later(699)
    expect(host.onMercState).toHaveBeenLastCalledWith('hop')
    later(1)
    expect(host.onMercState).toHaveBeenLastCalledWith('listen')
  })

  it('keeps the row it was tapped on, so the finger and the focus stay on it', () => {
    open()
    toThirdQuestion()
    const row = button(q3Label('time'))
    row.focus()

    tap(q3Label('time'))

    expect(button(q3Label('time'))).toBe(row)
    expect(row).toHaveFocus()
  })

  it('passes a question when Next is tapped with nothing picked', () => {
    const host = open()
    toThirdQuestion()

    // The control is the one Next, and with nothing picked it says what it does.
    expect(nextButton()).toHaveAccessibleName(SKIP_THIS_ONE)
    next()
    expect(isOn(4)).toBe(true)
    expect(nextButton()).toHaveAccessibleName(SKIP_TO_PLAN)
    next()

    expect(host.onDone).toHaveBeenCalledOnce()
    const [choices, texts] = host.onDone.mock.calls[0]
    expect(choices).toEqual({ q1: 'guitar', q2: 'song', q3: [], q4: [] })
    expect(texts).toEqual({ q3other: '', q4app: '' })
  })

  it('names its button for what the tap does', () => {
    open()
    toThirdQuestion()
    expect(nextButton()).toHaveAccessibleName(SKIP_THIS_ONE)
    expect(nextButton().querySelector('svg')).toBeNull()

    tap(q3Label('time'))
    expect(nextButton()).toHaveAccessibleName('Next')
    expect(
      nextButton().querySelector('[aria-hidden="true"] svg'),
    ).not.toBeNull()

    tap(q3Label('time'))
    expect(nextButton()).toHaveAccessibleName(SKIP_THIS_ONE)
    expect(nextButton().querySelector('svg')).toBeNull()
  })

  it('hands back the hard parts in the order they were tapped', () => {
    const host = open()
    toThirdQuestion()

    tap(q3Label('what'))
    tap(q3Label('time'))
    next()
    next()

    expect(host.onDone.mock.calls[0][0].q3).toEqual(['what', 'time'])
  })

  it('squares the ticks for several answers and rounds them for one', () => {
    open()
    tap('Guitar')
    later(PICK_ADVANCE_MS)
    expect(
      screen.getByRole('group', { name: /working toward/ }),
    ).toHaveAttribute('data-pick', 'one')
    tap(q2Label('song'))
    later(PICK_ADVANCE_MS)

    expect(screen.getByRole('group', { name: /hardest part/ })).toHaveAttribute(
      'data-pick',
      'many',
    )
  })
})

describe('the fourth question', () => {
  it('lets Nothing yet stand alone', () => {
    const host = open()
    toFourthQuestion()
    tap(q4Label('video'))
    tap(q4Label('teacher'))

    tap(NOTHING_YET)

    expect(isPressed(NOTHING_YET)).toBe(true)
    expect(isPressed(q4Label('video'))).toBe(false)
    expect(isPressed(q4Label('teacher'))).toBe(false)
    tap(q4Label('teacher'))
    expect(isPressed(NOTHING_YET)).toBe(false)
    expect(isPressed(q4Label('teacher'))).toBe(true)
    next()
    expect(host.onDone.mock.calls[0][0].q4).toEqual(['teacher'])
  })

  it('opens a 60-character line for Another app', () => {
    open()
    toFourthQuestion()
    expect(screen.queryByRole('textbox')).toBeNull()

    tap(ANOTHER_APP)

    const field = screen.getByRole('textbox', { name: APP_FIELD })
    expect(field).toHaveAttribute('maxlength', '60')
    expect(field).toHaveAttribute('enterkeyhint', 'done')
    expect(field).toHaveFocus()
  })

  it('says to pick any, and names its button for what the tap does', () => {
    open()
    toFourthQuestion()
    expect(
      screen.getByRole('group', { name: /what did you use/ }),
    ).toHaveAccessibleDescription('Pick any.')
    expect(nextButton()).toHaveAccessibleName(SKIP_TO_PLAN)

    tap(q4Label('video'))
    expect(nextButton()).toHaveAccessibleName('Show my plan')

    tap(q4Label('video'))
    expect(nextButton()).toHaveAccessibleName(SKIP_TO_PLAN)
  })

  it('hands back where the picks sit on screen, by their labels', () => {
    const host = open()
    toFourthQuestion()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        const top = this.textContent === q4Label('teacher') ? 200 : 100
        return { left: 20, top, width: 300, height: 46 } as DOMRect
      },
    )
    tap(q4Label('video'))
    tap(q4Label('teacher'))

    next()

    const pills = host.onDone.mock.calls[0][2]
    expect([...pills.keys()]).toEqual([q4Label('video'), q4Label('teacher')])
    expect(pills.get(q4Label('teacher'))?.top).toBe(200)
    expect(pills.get(q4Label('video'))?.top).toBe(100)
  })
})
