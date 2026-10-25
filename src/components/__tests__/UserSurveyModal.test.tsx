// ============================================================
// UserSurveyModal — one question, dismissal hardening + feedback mode
// ============================================================
//
// The GH #97 survey asks one thing: what the singer was trying to do the last
// time the app got in their way. Its role and use questions are asked up front
// now, and a feature request is an idea taken at face value where this asks
// for a problem. The answer is saved as `{ kind: 'gh97-v2', gotInTheWay }`.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db/services/survey-service', () => ({
  submitSurvey: vi.fn(async () => ({ id: 'r1' })),
}))

import UserSurveyModal from '@/components/UserSurveyModal'
import { submitSurvey } from '@/db/services/survey-service'
import { notifications, resetNotifications } from '@/stores/notifications-store'
import { APP_KEYS, overheard, press, stopOverhearing, } from '@/tests/utils/trap-keys'

const sent = vi.mocked(submitSurvey)

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  // Back to the factory's answer, with no calls and no queued answers left by
  // an earlier test: restoreAllMocks does not reset a vi.fn().
  sent.mockReset()
  resetNotifications()
})
afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const QUESTION =
  'What were you trying to do the last time the app got in your way?'

const skip = () => screen.getByTestId('survey-skip')
const submit = () => screen.getByTestId('survey-submit')
const field = () => screen.getByLabelText<HTMLTextAreaElement>(QUESTION)
const typeAnswer = (text: string) =>
  fireEvent.input(field(), { target: { value: text } })

// The ten option buttons the old modal held, by name. They are checked by name
// and not by counting buttons, so a control added later breaks nothing here.
const OLD_OPTIONS = [
  'Singer / Vocalist',
  'Guitarist',
  'Musician (multi-instrument)',
  'Producer / Songwriter',
  'Just exploring',
  'Singing practice',
  'Guitar practice',
  'Jam sessions',
  'Karaoke singing',
  'Ear training',
]

describe('UserSurveyModal — the one question', () => {
  it('asks one question about the last time the app got in the way', () => {
    render(() => <UserSurveyModal onClose={vi.fn()} />)

    expect(
      screen.getByRole('heading', { name: 'One question' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Optional. Skip it if nothing got in your way.'),
    ).toBeInTheDocument()
    // getByRole throws when there is more than one text field.
    expect(field()).toBe(screen.getByRole('textbox'))
    expect(field()).toHaveAttribute(
      'placeholder',
      'For example, load my own song',
    )
    expect(field()).toHaveAttribute('maxlength', '500')
  })

  it('no longer asks the role, use and feature questions', () => {
    render(() => <UserSurveyModal onClose={vi.fn()} />)

    expect(
      screen.queryAllByRole('button', {
        name: (name) => OLD_OPTIONS.includes(name),
      }),
    ).toHaveLength(0)
    expect(screen.getByTestId('user-survey-modal')).not.toHaveTextContent(
      /I am a|I plan to use|most like to see/,
    )
  })

  it.each<[string, 'onboarding' | 'feedback']>([
    ['the app', 'onboarding'],
    ['the singer', 'feedback'],
  ])(
    'saves the answer as the new survey kind when %s opened it',
    async (_, mode) => {
      const onClose = vi.fn()
      render(() => <UserSurveyModal mode={mode} onClose={onClose} />)
      typeAnswer('  load my own song  ')

      fireEvent.click(submit())

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
      expect(sent).toHaveBeenCalledTimes(1)
      // Strict, so a stray `background: undefined` would fail it.
      expect(sent.mock.calls[0][0]).toStrictEqual({
        kind: 'gh97-v2',
        gotInTheWay: 'load my own song',
      })
    },
  )

  // The button has to come back after a failed send, with the text still in it.
  // The first send is held open to see "Sending..." and let it fail (the
  // service answers null), then the same answer goes again.
  it('lets the singer send again after a failed send', async () => {
    let fail!: (saved: null) => void
    sent.mockReturnValueOnce(
      new Promise<null>((resolve) => {
        fail = resolve
      }),
    )
    const onClose = vi.fn()
    render(() => <UserSurveyModal onClose={onClose} />)
    typeAnswer('load my own song')

    fireEvent.click(submit())
    expect(submit()).toBeDisabled()
    expect(submit()).toHaveTextContent('Sending...')
    fail(null)

    await waitFor(() => expect(submit()).not.toBeDisabled())
    expect(submit()).toHaveTextContent('Submit')
    expect(field().value).toBe('load my own song')
    expect(onClose).not.toHaveBeenCalled()
    expect(notifications()).toContainEqual(
      expect.objectContaining({
        message:
          'Could not send right now. Your answer is still here, so try again.',
        type: 'error',
      }),
    )

    fireEvent.click(submit())

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(sent).toHaveBeenCalledTimes(2)
  })
})

describe('UserSurveyModal — accidental dismissal', () => {
  // The modal can arrive while hands are already moving; a click meant for the
  // app must not land on Skip and burn the one prompt this browser ever gets.
  it('holds Skip inert until the arming delay passes', async () => {
    const onClose = vi.fn()
    render(() => <UserSurveyModal onClose={onClose} />)

    expect(skip()).toBeDisabled()
    fireEvent.click(skip())
    expect(onClose).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3200)
    await waitFor(() => expect(skip()).not.toBeDisabled())
    fireEvent.click(skip())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('counts down so the disabled button explains itself', () => {
    render(() => <UserSurveyModal onClose={vi.fn()} />)
    expect(skip().textContent).toMatch(/Skip \(\d\)/)
  })

  // The tooltip is the one place the button says why it is disabled.
  it('explains the wait in the Skip tooltip', () => {
    render(() => <UserSurveyModal onClose={vi.fn()} />)
    expect(skip()).toHaveAttribute(
      'title',
      'Just a moment, so this is not dismissed by accident',
    )
  })

  // Clicking the backdrop was the same trap as Skip, and easier to hit.
  it('ignores a backdrop click until armed, then honours it', async () => {
    const onClose = vi.fn()
    render(() => <UserSurveyModal onClose={onClose} />)
    const overlay = screen.getByTestId('user-survey-modal')

    fireEvent.click(overlay)
    expect(onClose).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3200)
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// The survey opens by itself over a tab that may be playing. The app's
// shortcuts listen on the window, so a key that leaves the survey plays or
// pauses the tab behind it, or opens the microphone.
describe('UserSurveyModal — the app behind it', () => {
  afterEach(stopOverhearing)

  it('takes the focus as it opens, so a Space, an M or an Escape never reaches the app', async () => {
    render(() => <UserSurveyModal onClose={vi.fn()} />)
    await Promise.resolve()
    const heard = overheard()

    expect(screen.getByRole('dialog')).toContainElement(
      document.activeElement as HTMLElement,
    )
    for (const key of APP_KEYS) {
      fireEvent.keyDown(document.activeElement ?? document.body, key)
    }
    expect(heard).toEqual([])
  })

  it('opens on its heading, not the field, so a phone keeps its keyboard down', async () => {
    render(() => <UserSurveyModal onClose={vi.fn()} />)
    await Promise.resolve()

    expect(screen.getByRole('heading', { name: 'One question' })).toHaveFocus()
    expect(field()).not.toHaveFocus()
  })

  it('keeps the focus in it when a press lands on its words', async () => {
    render(() => <UserSurveyModal onClose={vi.fn()} />)
    await Promise.resolve()
    const heard = overheard()

    press(screen.getByText('Optional. Skip it if nothing got in your way.'))

    for (const key of APP_KEYS) {
      fireEvent.keyDown(document.activeElement ?? document.body, key)
    }
    expect(heard).toEqual([])
  })

  it('closes on Escape only once Skip would, in the prompt the app opens', async () => {
    const onClose = vi.fn()
    render(() => <UserSurveyModal onClose={onClose} />)
    await Promise.resolve()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3200)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('UserSurveyModal — empty responses', () => {
  it('will not send a response with nothing in it', () => {
    render(() => <UserSurveyModal onClose={vi.fn()} />)
    expect(submit()).toBeDisabled()
    fireEvent.click(submit())
    expect(sent).not.toHaveBeenCalled()
  })

  it('keeps Submit off until something is typed', () => {
    render(() => <UserSurveyModal onClose={vi.fn()} />)
    expect(submit()).toBeDisabled()

    typeAnswer('load my own song')

    expect(submit()).not.toBeDisabled()
  })

  // Spaces and line breaks are what a mis-tap leaves behind.
  it('keeps Submit off when only spaces are typed', () => {
    render(() => <UserSurveyModal onClose={vi.fn()} />)

    typeAnswer('   \n  ')

    expect(submit()).toBeDisabled()
    fireEvent.click(submit())
    expect(sent).not.toHaveBeenCalled()
  })

  it('tells the singer to write something first, not to pick an option', () => {
    render(() => <UserSurveyModal onClose={vi.fn()} />)
    expect(submit()).toHaveAttribute('title', 'Write something first')
  })
})

describe('UserSurveyModal — feedback mode', () => {
  // Opened deliberately from Settings: they are already looking at it, so a
  // delay would only be in the way.
  it('is dismissable immediately and drops the title the app gives it', () => {
    const onClose = vi.fn()
    render(() => <UserSurveyModal mode="feedback" onClose={onClose} />)

    expect(skip()).not.toBeDisabled()
    expect(skip().textContent).toContain('Close')
    expect(screen.queryByText('One question')).not.toBeInTheDocument()
    expect(screen.getByText('Share your feedback')).toBeInTheDocument()

    fireEvent.click(skip())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('says what the feedback is for, with the product named in full', () => {
    render(() => <UserSurveyModal mode="feedback" onClose={vi.fn()} />)

    const dialog = screen.getByTestId('user-survey-modal')

    expect(dialog).toHaveTextContent(
      'Tell us what would make Mercury Pitch better. Anonymous, no account needed.',
    )
    expect(dialog).not.toHaveTextContent(
      'Optional. Skip it if nothing got in your way.',
    )
  })

  it('still refuses an empty response', () => {
    render(() => <UserSurveyModal mode="feedback" onClose={vi.fn()} />)
    expect(submit()).toBeDisabled()
  })
})
