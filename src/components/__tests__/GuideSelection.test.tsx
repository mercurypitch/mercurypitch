// ============================================================
// GuideSelection: Your plan stands first
// ============================================================
//
// The Guide's first row is the plan: "Your plan" once the four questions are
// answered, "Your plan, in four taps" before. The Guide lives in
// src/components and may not import a feature, so the host hands it the row
// as two props (a way to open the plan, and whether it is answered) and the
// row is drawn only when the host gives the first, and never in the native
// build, which has no plan. What is pinned here is the row: where it stands,
// what it says, what a tap on it does, the line above the rows (which names the
// plan where the row is drawn and keeps its own words where it is not), and
// that a host with no plan, or the native build, gets a Guide without it. The
// tours below it are the Guide's own and are not tested here.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import type { ComponentProps } from 'solid-js'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuideSelection } from '@/components/GuideSelection'
import type * as NativeBuild from '@/lib/native-build'

// The build, per case: the native app has no plan, so its Guide draws no row
// whatever the host hands it.
const build = vi.hoisted(() => ({ native: false }))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get IS_NATIVE_BUILD() {
    return build.native
  },
}))

type Props = ComponentProps<typeof GuideSelection>

/** The Guide, open, with its three hand-overs faked; `plan` false is a host with no plan. */
function open(more: Partial<Props> = {}, plan = true) {
  const host = {
    onClose: vi.fn<() => void>(),
    onStartTour: vi.fn<(sectionIds: string[]) => void>(),
    onOpenPlan: vi.fn<() => void>(),
  }
  render(() => (
    <GuideSelection
      isOpen
      onClose={host.onClose}
      onStartTour={host.onStartTour}
      onOpenPlan={plan ? host.onOpenPlan : undefined}
      {...more}
    />
  ))
  return host
}

/** The Guide's rows in the order they stand: every button but the close cross. */
const rows = (): string[] =>
  screen
    .getAllByRole('button')
    .filter((button) => button.getAttribute('aria-label') !== 'Close')
    .map((button) => button.textContent?.trim() ?? '')

const FIRST_TOUR = 'Full Tour (All Sections)'

/** The line above the rows: with the plan's row it names the plan, without it it is the Guide's own. */
const PLAN_LINE =
  'Start with your plan, or pick a tour. Each tour lights up part of the app and explains what it does.'
const TOUR_LINE =
  'Choose a guided spotlight tour. The tour highlights UI elements and explains how they work.'

afterEach(() => {
  cleanup()
  build.native = false
})

describe('the first row of the Guide', () => {
  it('puts Your plan first', () => {
    open()

    const standing = rows()

    expect(standing[0]).toBe('Your plan, in four taps')
    expect(standing[1]).toBe(FIRST_TOUR)
  })

  it('is called Your plan once the questions are answered, and follows the answer', () => {
    const [answered, setAnswered] = createSignal(false)
    open({ planAnswered: answered })
    expect(rows()[0]).toBe('Your plan, in four taps')

    setAnswered(true)

    expect(rows()[0]).toBe('Your plan')
    expect(rows()[1]).toBe(FIRST_TOUR)
  })

  it('hands the choice to the host and then closes itself on a tap, tour untouched', () => {
    const host = open()

    fireEvent.click(screen.getByRole('button', { name: /^Your plan/ }))

    expect(host.onOpenPlan).toHaveBeenCalledTimes(1)
    expect(host.onClose).toHaveBeenCalledTimes(1)
    expect(host.onStartTour).not.toHaveBeenCalled()
    expect(host.onOpenPlan.mock.invocationCallOrder[0]).toBeLessThan(
      host.onClose.mock.invocationCallOrder[0],
    )
  })

  it('is not drawn where the host has no plan to open', () => {
    open({ planAnswered: () => true }, false)

    const standing = rows()

    expect(standing[0]).toBe(FIRST_TOUR)
    expect(standing.some((row) => row.startsWith('Your plan'))).toBe(false)
  })

  it('is not drawn in the native build, whatever the host hands it', () => {
    build.native = true
    open({ planAnswered: () => true })

    const standing = rows()

    expect(standing[0]).toBe(FIRST_TOUR)
    expect(standing.some((row) => row.startsWith('Your plan'))).toBe(false)
  })

  it('draws nothing while the Guide is closed', () => {
    open({ isOpen: false })

    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('the line above the rows', () => {
  it('names the plan where its row is drawn', () => {
    open()

    expect(screen.getByText(PLAN_LINE)).toBeInTheDocument()
    expect(screen.queryByText(TOUR_LINE)).toBeNull()
  })

  it("keeps the Guide's own words where the host has no plan", () => {
    open({}, false)

    expect(screen.getByText(TOUR_LINE)).toBeInTheDocument()
    expect(screen.queryByText(PLAN_LINE)).toBeNull()
  })

  it("keeps the Guide's own words in the native build, where no row is drawn", () => {
    build.native = true
    open()

    expect(screen.getByText(TOUR_LINE)).toBeInTheDocument()
    expect(screen.queryByText(PLAN_LINE)).toBeNull()
  })
})
