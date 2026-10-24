// ============================================================
// PlanQuestions — the typed lines, Not now, Merc, and where the screens open
// ============================================================
//
// The second half of PlanQuestions' tests. PlanQuestions.test.tsx takes the
// four questions one by one; this file takes what runs across them: the two
// lines a person can type, the way out, the poses Merc is asked for, and the
// answers the screens open on and hand back. The helpers are shared through
// PlanQuestions.fixture.tsx, and the same rules hold: fake timers, the host's
// three callbacks faked, controls found by the name a screen reader gives
// them.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PICK_ADVANCE_MS, PlanQuestions } from './PlanQuestions'
import { ANOTHER_APP, APP_FIELD, isOn, isPressed, later, mercSays, next, open, OTHER_FIELD, passTo, q2Label, q3Label, q3Line, q4Label, q4Line, quiet, SOMETHING_ELSE, tap, toThirdQuestion, TYPED_LINE, typeInto, } from './PlanQuestions.fixture'
import type { PlanChoices, QuestionId } from './questions'
import { EMPTY_CHOICES, INSTRUMENTS } from './questions'

/** Two lines a returning singer typed last time. */
const WRISTS = 'Hard on my wrists'
const PIANO_APP = 'Simply Piano'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the lines a person types', () => {
  it('hands back each line whose option is picked', () => {
    const host = open()
    toThirdQuestion()
    tap(SOMETHING_ELSE)
    typeInto(OTHER_FIELD, TYPED_LINE)
    next()
    tap(ANOTHER_APP)
    typeInto(APP_FIELD, 'Yousician')

    next()

    expect(host.onDone.mock.calls[0][1]).toEqual({
      q3other: TYPED_LINE,
      q4app: 'Yousician',
    })
  })

  it('hands back an empty line for an option that is no longer picked', () => {
    // Arrange: both lines typed, then both options tapped off
    const host = open()
    toThirdQuestion()
    tap(SOMETHING_ELSE)
    typeInto(OTHER_FIELD, TYPED_LINE)
    tap(SOMETHING_ELSE)
    next()
    tap(ANOTHER_APP)
    typeInto(APP_FIELD, 'Yousician')
    tap(ANOTHER_APP)

    next()

    expect(host.onDone.mock.calls[0][1]).toEqual({ q3other: '', q4app: '' })
    expect(host.onDone.mock.calls[0][0].q3).toEqual([])
    expect(host.onDone.mock.calls[0][0].q4).toEqual([])
  })

  it('keeps a line while the screen is left and come back to', () => {
    open()
    toThirdQuestion()
    tap(SOMETHING_ELSE)
    typeInto(OTHER_FIELD, TYPED_LINE)

    next()
    tap('Back')

    expect(screen.getByRole('textbox', { name: OTHER_FIELD })).toHaveValue(
      TYPED_LINE,
    )
  })

  it('cuts a line that is longer than its field', () => {
    const host = open()
    toThirdQuestion()
    tap(SOMETHING_ELSE)
    typeInto(OTHER_FIELD, 'x'.repeat(200))
    next()
    tap(ANOTHER_APP)

    typeInto(APP_FIELD, 'y'.repeat(100))
    next()

    expect(host.onDone.mock.calls[0][1].q3other).toHaveLength(140)
    expect(host.onDone.mock.calls[0][1].q4app).toHaveLength(60)
  })

  it('counts what is left of a line', () => {
    open()
    toThirdQuestion()
    tap(SOMETHING_ELSE)
    const field = screen.getByRole('textbox', { name: OTHER_FIELD })
    expect(field).toHaveAccessibleDescription('140 left')

    typeInto(OTHER_FIELD, TYPED_LINE)

    expect(field).toHaveAccessibleDescription('122 left')
  })

  it('puts the keyboard away when Enter is pressed in a line', () => {
    open()
    toThirdQuestion()
    tap(SOMETHING_ELSE)
    const field = screen.getByRole('textbox', { name: OTHER_FIELD })
    expect(field).toHaveFocus()

    // Assert: another key leaves the keyboard up; Enter puts it away
    expect(fireEvent.keyDown(field, { key: 'a' })).toBe(true)
    expect(field).toHaveFocus()
    expect(fireEvent.keyDown(field, { key: 'Enter' })).toBe(false)
    expect(field).not.toHaveFocus()
  })

  it('puts the keyboard away on Enter even where a host stops key events', () => {
    // Arrange: a host whose box stops keydown before it reaches the document
    render(() => (
      <div
        on:keydown={(e) => {
          e.stopPropagation()
        }}
      >
        <PlanQuestions
          returning={false}
          onMercState={vi.fn()}
          onDone={vi.fn()}
          onDecline={vi.fn()}
        />
      </div>
    ))
    toThirdQuestion()
    tap(SOMETHING_ELSE)
    const field = screen.getByRole('textbox', { name: OTHER_FIELD })
    expect(field).toHaveFocus()

    fireEvent.keyDown(field, { key: 'Enter' })

    expect(field).not.toHaveFocus()
  })
})

describe('Not now', () => {
  it('hands back Not now with the question it came on', () => {
    const host = open()
    toThirdQuestion()

    tap('Not now')

    expect(host.onDecline).toHaveBeenCalledOnce()
    expect(host.onDecline).toHaveBeenCalledWith('q3', {
      q1: 'guitar',
      q2: 'song',
      q3: [],
      q4: [],
    })
    expect(host.onDone).not.toHaveBeenCalled()
  })

  it.each<[QuestionId, number]>([
    ['q1', 1],
    ['q2', 2],
    ['q3', 3],
    ['q4', 4],
  ])('names %s when it comes on question %i', (on, n) => {
    const host = open()
    passTo(n)

    tap('Not now')

    expect(host.onDecline).toHaveBeenCalledWith(on, expect.any(Object))
  })

  it('keeps its own answers when the host changes the ones Not now handed back', () => {
    const host = open()
    toThirdQuestion()
    tap(q3Label('time'))
    tap('Not now')

    // Act: a store on the host's side writes into what it was given
    host.onDecline.mock.calls[0][1].q3.push('what')
    tap(q3Label('time'))

    expect(isPressed(q3Label('what'))).toBe(false)
  })

  it('stops a move on that was waiting', () => {
    const host = open()
    tap('Guitar')

    tap('Not now')
    later(PICK_ADVANCE_MS * 3)

    expect(isOn(1)).toBe(true)
    expect(host.onDecline).toHaveBeenCalledWith('q1', {
      q1: 'guitar',
      q2: null,
      q3: [],
      q4: [],
    })
  })
})

describe('Merc', () => {
  it('drops in as the screens open, then rests', () => {
    const host = open()

    expect(host.onMercState).toHaveBeenNthCalledWith(1, 'drop')
    // Assert: he rests once the drop has finished, not before
    later(1299)
    expect(host.onMercState).toHaveBeenCalledTimes(1)
    later(1)
    expect(host.onMercState).toHaveBeenLastCalledWith('idle')
  })

  it('hops Merc on a pick', () => {
    const host = open()
    later(3000)
    host.onMercState.mockClear()

    tap('Guitar')

    expect(host.onMercState).toHaveBeenCalledWith('hop')
    // Assert: the hop lasts 0.9 s, inside the wait before the next question
    later(899)
    expect(host.onMercState).toHaveBeenLastCalledWith('hop')
    later(1)
    expect(host.onMercState).toHaveBeenLastCalledWith('idle')
  })

  it('listens on the third question and rests on the others', () => {
    const host = open()

    toThirdQuestion()
    expect(host.onMercState).toHaveBeenLastCalledWith('listen')
    next()

    expect(host.onMercState).toHaveBeenLastCalledWith('idle')
  })

  it('sends nothing once the screens are gone', () => {
    const host = open()
    tap('Guitar')
    cleanup()
    const sent = host.onMercState.mock.calls.length

    later(PICK_ADVANCE_MS * 3)

    expect(host.onMercState).toHaveBeenCalledTimes(sent)
  })
})

describe('where the screens open', () => {
  it('opens on the answers it was given', () => {
    const host = open({
      initial: { q1: 'piano', q2: 'fun', q3: ['other', 'time'], q4: ['app'] },
      initialTexts: { q3other: WRISTS, q4app: PIANO_APP },
    })
    expect(isPressed('Piano')).toBe(true)
    expect(screen.getByText(INSTRUMENTS[2].line)).toBeInTheDocument()

    // Act: tap each answer again to carry on
    tap('Piano')
    later(PICK_ADVANCE_MS)
    tap('Just for fun')
    later(PICK_ADVANCE_MS)

    expect(isPressed(SOMETHING_ELSE)).toBe(true)
    expect(screen.getByRole('textbox', { name: OTHER_FIELD })).toHaveValue(
      WRISTS,
    )
    next()
    expect(screen.getByRole('textbox', { name: APP_FIELD })).toHaveValue(
      PIANO_APP,
    )
    next()
    expect(host.onDone.mock.calls[0][0]).toEqual({
      q1: 'piano',
      q2: 'fun',
      q3: ['other', 'time'],
      q4: ['app'],
    })
    expect(host.onDone.mock.calls[0][1]).toEqual({
      q3other: WRISTS,
      q4app: PIANO_APP,
    })
  })

  it('opens over a standing answer with Next, and hands the answer on', () => {
    // Arrange: the review of an answered plan, opened on its first answer
    const host = open({ initial: { q1: 'piano', q2: null, q3: [], q4: [] } })
    expect(quiet()).toHaveAccessibleName('Next')
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()

    tap('Next')
    tap('Skip')
    next()
    next()

    expect(host.onDone.mock.calls[0][0].q1).toBe('piano')
  })

  it('cuts a prefilled line that is longer than its field', () => {
    open({
      initial: { q1: null, q2: null, q3: ['other'], q4: ['app'] },
      initialTexts: { q3other: 'y'.repeat(200), q4app: 'z'.repeat(100) },
    })
    tap('Skip')
    tap('Skip')

    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: OTHER_FIELD })
        .value,
    ).toHaveLength(140)
    next()
    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: APP_FIELD }).value,
    ).toHaveLength(60)
  })

  it('settles answers that break the rules before it shows them', () => {
    // Arrange: three hard parts, and Nothing yet beside a video lesson
    const host = open({
      initial: {
        q1: 'guitar',
        q2: 'song',
        q3: ['time', 'what', 'tempo'],
        q4: ['starting', 'video'],
      },
    })
    tap('Guitar')
    later(PICK_ADVANCE_MS)
    tap(q2Label('song'))
    later(PICK_ADVANCE_MS)

    expect(isPressed(q3Label('tempo'))).toBe(false)
    next()
    next()

    expect(host.onDone.mock.calls[0][0]).toEqual({
      q1: 'guitar',
      q2: 'song',
      q3: ['time', 'what'],
      q4: ['video'],
    })
  })

  it('opens each question on the line of the answer it holds', () => {
    // Arrange: tapped in an order the lists do not follow, so the first and
    // the last tapped are not the first and the last listed
    open({
      initial: {
        q1: 'guitar',
        q2: 'song',
        q3: ['what', 'time'],
        q4: ['teacher', 'video'],
      },
    })

    tap('Guitar')
    later(PICK_ADVANCE_MS)
    tap(q2Label('song'))
    later(PICK_ADVANCE_MS)

    // Assert: the first hard part tapped decides on Q3, the last way on Q4
    expect(mercSays()).toHaveTextContent(q3Line('what'))
    next()
    expect(mercSays()).toHaveTextContent(q4Line('video'))
  })

  it('keeps its own answers when the host changes the ones it opened with', () => {
    const given: PlanChoices = { q1: 'guitar', q2: 'song', q3: [], q4: [] }
    open({ initial: given })

    // Act: a store on the host's side writes into what it gave
    given.q3.push('time')
    given.q4.push('video')
    tap('Guitar')
    later(PICK_ADVANCE_MS)
    tap(q2Label('song'))
    later(PICK_ADVANCE_MS)

    expect(isPressed(q3Label('time'))).toBe(false)
    next()
    expect(isPressed(q4Label('video'))).toBe(false)
  })

  it('keeps its own answers when the host changes the ones it was handed', () => {
    const host = open()
    toThirdQuestion()
    next()
    next()
    const handed = host.onDone.mock.calls[0][0]

    // Act: a store on the host's side writes into what it was given
    handed.q3.push('time')
    handed.q4.push('video')

    // Assert: each screen reads its answers again when it comes back
    tap('Back')
    expect(isPressed(q3Label('time'))).toBe(false)
    next()
    expect(isPressed(q4Label('video'))).toBe(false)
  })

  it('does not write into a frozen set of answers', () => {
    const host = open({ initial: EMPTY_CHOICES })

    tap('Guitar')
    later(PICK_ADVANCE_MS)
    tap(q2Label('song'))
    later(PICK_ADVANCE_MS)
    tap(q3Label('time'))
    next()
    tap(q4Label('video'))
    next()

    expect(host.onDone.mock.calls[0][0].q3).toEqual(['time'])
    expect(EMPTY_CHOICES).toEqual({ q1: null, q2: null, q3: [], q4: [] })
  })

  it('moves focus to the new question when the screen moves on, not on open', () => {
    open()
    expect(document.body).toHaveFocus()

    tap('Guitar')
    later(PICK_ADVANCE_MS)

    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  })

  it('opens each question at the top, whatever the last one was scrolled to', () => {
    open()
    toThirdQuestion()
    // The root is the one scroll region for all four questions
    const region = mercSays().parentElement as HTMLElement
    region.scrollTop = 240

    next()

    expect(region.scrollTop).toBe(0)
  })
})
