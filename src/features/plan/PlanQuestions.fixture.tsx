// ============================================================
// PlanQuestions fixture — what the two PlanQuestions test files share
// ============================================================
//
// The screens are opened and tapped the way a singer taps them, so both test
// files need the same few things: a host with its three callbacks faked, taps
// by the name a screen reader gives a control, and the way to the third and
// fourth questions.
//
// A guitar player is the one asked throughout, because guitar has its own
// Q2 label ("Playing with other people"), its own Q3 hard part and its own
// Q4 sing-along line; the labels come from questions.ts, so a copy change
// there does not break the flow in either file. The two buttons whose words
// depend on what is picked (the quiet one on Q1 and Q2, the one on Q3 and Q4)
// are found by test id, so a test can say what they read without tapping them
// by it.
//
// Each file starts the fake timers in its own beforeEach and stops them in
// its own afterEach: a fixture cannot register a file's hooks for it.

import { fireEvent, render, screen } from '@solidjs/testing-library'
import type { Mock } from 'vitest'
import { expect, vi } from 'vitest'
import type { MercState } from '@/lib/merc/constants'
import type { PlanQuestionsProps } from './PlanQuestions'
import { PICK_ADVANCE_MS, PlanQuestions } from './PlanQuestions'
import type { Q3Id, Q4Id } from './questions'
import { q2Options, q3Options, q4Options } from './questions'

export interface Host {
  onMercState: Mock<(s: MercState) => void>
  onDone: Mock<PlanQuestionsProps['onDone']>
  onDecline: Mock<PlanQuestionsProps['onDecline']>
}

/** The screens on the first question, with the host's three callbacks faked. */
export function open(props: Partial<PlanQuestionsProps> = {}): Host {
  const host: Host = {
    onMercState: vi.fn<(s: MercState) => void>(),
    onDone: vi.fn<PlanQuestionsProps['onDone']>(),
    onDecline: vi.fn<PlanQuestionsProps['onDecline']>(),
  }
  render(() => <PlanQuestions returning={false} {...props} {...host} />)
  return host
}

export const button = (name: string): HTMLElement =>
  screen.getByRole('button', { name })
export const tap = (name: string): void => {
  fireEvent.click(button(name))
}
export const isPressed = (name: string): boolean =>
  button(name).getAttribute('aria-pressed') === 'true'
export const isLocked = (name: string): boolean =>
  button(name).getAttribute('aria-disabled') === 'true'
export const later = (ms: number): void => {
  vi.advanceTimersByTime(ms)
}
export const isOn = (n: number): boolean =>
  screen.queryByText(`Question ${n} of 4`) !== null

/** The quiet control on Q1 and Q2: Skip while no answer stands, Next while one does. */
export const quiet = (): HTMLElement => screen.getByTestId('plan-quiet')

/** What the button on Q3 and Q4 says with nothing picked. */
export const SKIP_THIS_ONE = 'Skip this one'
export const SKIP_TO_PLAN = 'Skip to my plan'

/** The button on Q3 and Q4, whose words depend on whether anything is picked. */
export const nextButton = (): HTMLElement => screen.getByTestId('plan-next')
export const next = (): void => {
  fireEvent.click(nextButton())
}

/** Merc's line: the one polite live region on the screens. */
export const mercSays = (): HTMLElement => {
  const regions = document.querySelectorAll<HTMLElement>('[aria-live="polite"]')
  expect(regions).toHaveLength(1)
  return regions[0]
}

export const q2Label = (id: string): string =>
  q2Options('guitar').find((o) => o.id === id)!.label
export const q3Label = (id: Q3Id): string =>
  q3Options('guitar').find((o) => o.id === id)!.label
export const q4Label = (id: Q4Id): string =>
  q4Options('guitar').find((o) => o.id === id)!.label
export const q3Line = (id: Q3Id): string =>
  q3Options('guitar').find((o) => o.id === id)!.line
export const q4Line = (id: Q4Id): string =>
  q4Options('guitar').find((o) => o.id === id)!.line
export const NOTHING_YET = q4Label('starting')
export const SOMETHING_ELSE = q3Label('other')
export const ANOTHER_APP = q4Label('app')

/** What a screen reader calls the two typed lines, and eighteen characters to type. */
export const OTHER_FIELD = 'Something else, in a few words'
export const APP_FIELD = 'Which app?'
export const TYPED_LINE = 'My hands get tired'

/** Guitar, then "A song I love": the third question is open. */
export function toThirdQuestion(): void {
  tap('Guitar')
  later(PICK_ADVANCE_MS)
  tap(q2Label('song'))
  later(PICK_ADVANCE_MS)
}

export function toFourthQuestion(): void {
  toThirdQuestion()
  next()
}

/** Opens question `n` by passing the ones before it, with nothing picked. */
export function passTo(n: number): void {
  if (n > 1) tap('Skip')
  if (n > 2) tap('Skip')
  if (n > 3) next()
}

export function typeInto(name: string, value: string): void {
  fireEvent.input(screen.getByRole('textbox', { name }), { target: { value } })
}
