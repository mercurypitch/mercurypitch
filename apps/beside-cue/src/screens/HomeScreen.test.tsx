// ============================================================
// Home — the plan as text beside the deck, and every action it offers
// ============================================================
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HomePlan } from './HomeScreen'
import { CUE_HANDOFF_MS, HomeScreen } from './HomeScreen'

const PLAN: HomePlan = {
  pullText: 'Endless scrolling',
  bSideText: 'Walk to the end of the street',
  cueContextText: 'When one post turns into another.',
  pullId: 'scrolling',
  paused: false,
  scheduleTime: '20:30',
}

function handlers() {
  return {
    onRecordSettled: vi.fn(),
    onChangeView: vi.fn(),
    onCueNow: vi.fn(),
    onPauseToggle: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenReminder: vi.fn(),
    onReplace: vi.fn(),
    onStartPlan: vi.fn(),
    onOpenGames: vi.fn(),
    onMuteToggle: vi.fn(),
  }
}

function renderHome(
  overrides: Partial<{
    plan: HomePlan | undefined
    cueStatePending: boolean
    recordSide: 'A' | 'B'
    recordSettle: boolean
  }> = {},
) {
  const actions = handlers()
  const props = {
    plan: PLAN,
    cueStatePending: false,
    recordSide: 'A' as const,
    recordSettle: false,
    ...overrides,
  }
  const result = render(() => (
    <HomeScreen
      {...(props.plan === undefined ? {} : { plan: props.plan })}
      cueStatePending={props.cueStatePending}
      recordSide={props.recordSide}
      recordSettle={props.recordSettle}
      activeView="cue"
      muted={false}
      {...actions}
    />
  ))
  return { ...result, actions }
}

function scene(): HTMLElement {
  const element = document.querySelector<HTMLElement>('[data-record]')
  if (element === null) throw new Error('Expected the Home scene')
  return element
}

describe('Home screen', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows the plan as stationary, selectable text with its rows and actions', () => {
    const { actions } = renderHome()
    expect(
      screen.getByRole('heading', { name: 'Your current plan' }),
    ).toHaveClass('visually-hidden')
    expect(screen.getByText('Your Side B')).toBeInTheDocument()
    expect(screen.getByText('Walk to the end of the street')).toHaveAttribute(
      'data-selection',
      'text',
    )
    expect(screen.getByText('Endless scrolling')).toHaveAttribute(
      'data-selection',
      'text',
    )
    expect(
      screen.getByText('When one post turns into another.'),
    ).toHaveAttribute('data-selection', 'text')
    expect(scene().contains(screen.getByText('Endless scrolling'))).toBe(false)
    expect(scene()).toHaveAttribute('data-record', 'A')
    expect(scene()).toHaveAttribute('data-motion', 'still')

    const reminder = screen.getByRole('button', { name: /^Daily reminder/u })
    expect(reminder).toHaveTextContent('Around 20:30')
    expect(reminder).toHaveTextContent('Change')
    fireEvent.click(reminder)
    expect(actions.onOpenReminder).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /^Change this plan/u }))
    expect(actions.onReplace).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /^Cue me now/u }))
    expect(actions.onCueNow).toHaveBeenCalledTimes(1)
    expect(scene()).toHaveAttribute('data-motion', 'still')

    fireEvent.click(screen.getByRole('button', { name: 'Pause this plan' }))
    expect(actions.onPauseToggle).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /^B-side games/u }))
    expect(actions.onOpenGames).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(actions.onOpenSettings).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Paused')).not.toBeInTheDocument()
  })

  it('offers to set a reminder when there is none', () => {
    renderHome({ plan: { ...PLAN, scheduleTime: undefined } })
    const reminder = screen.getByRole('button', { name: /^Daily reminder/u })
    expect(reminder).toHaveTextContent('Only when I ask')
    expect(reminder).toHaveTextContent('Set')
    expect(reminder).not.toHaveTextContent('Change')
  })

  it('reads paused on the scene and makes Resume the primary action', () => {
    const { actions } = renderHome({ plan: { ...PLAN, paused: true } })
    expect(scene()).toHaveTextContent('Paused')
    expect(scene()).toHaveAttribute('data-motion', 'still')
    expect(
      screen.queryByRole('button', { name: /^Cue me now/u }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Pause this plan' }),
    ).not.toBeInTheDocument()
    const reminder = screen.getByRole('button', { name: /^Daily reminder/u })
    expect(reminder).toHaveTextContent(
      'This reminder stays off while your plan is paused.',
    )
    expect(reminder).toHaveTextContent('Off')
    const resume = screen.getByRole('button', { name: /^Resume this plan/u })
    expect(resume).toHaveAccessibleDescription(/still here/u)
    fireEvent.click(resume)
    expect(actions.onPauseToggle).toHaveBeenCalledTimes(1)
  })

  it('comes back from Side B on the turned face and settles once', () => {
    const { actions } = renderHome({ recordSide: 'B', recordSettle: true })
    expect(screen.getByText('Your Side B · turned today')).toBeInTheDocument()
    expect(scene()).toHaveAttribute('data-record', 'B')
    expect(scene()).toHaveAttribute('data-motion', 'settle')
    fireEvent.animationEnd(scene().querySelector('svg[data-side] g')!)
    expect(actions.onRecordSettled).toHaveBeenCalledTimes(1)
  })

  it('shows the empty deck and Start a plan when no plan exists', () => {
    const { actions } = renderHome({ plan: undefined })
    expect(scene()).toHaveAttribute('data-record', 'empty')
    expect(screen.getByText('No plan on the deck yet.')).toBeInTheDocument()
    expect(screen.getByText('Your first plan')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Start a plan/u }))
    expect(actions.onStartPlan).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole('button', { name: /^Daily reminder/u }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^B-side games/u }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Cue me now/u }),
    ).not.toBeInTheDocument()
  })

  it('turns the record for one beat before handing off when motion is wanted', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
    const { actions } = renderHome()
    const cue = screen.getByRole('button', { name: /^Cue me now/u })
    fireEvent.click(cue)
    fireEvent.click(cue)
    expect(actions.onCueNow).not.toHaveBeenCalled()
    expect(scene()).toHaveAttribute('data-motion', 'spin')
    expect(cue).toHaveAttribute('aria-busy', 'true')
    vi.advanceTimersByTime(CUE_HANDOFF_MS - 1)
    expect(actions.onCueNow).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(actions.onCueNow).toHaveBeenCalledTimes(1)
    expect(scene()).toHaveAttribute('data-motion', 'still')
  })

  it('hands off at once under reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
    const { actions } = renderHome()
    fireEvent.click(screen.getByRole('button', { name: /^Cue me now/u }))
    expect(actions.onCueNow).toHaveBeenCalledTimes(1)
    expect(scene()).toHaveAttribute('data-motion', 'still')
  })
})
