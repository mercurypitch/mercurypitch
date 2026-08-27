// ============================================================
// QuietScreen tests — optional local starters never redefine the saved choice
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LocalActionStarter } from '../action-starters/action-starter'
import { QuietScreen } from './QuietScreen'

function instructionStarter(instruction: string): LocalActionStarter {
  return { kind: 'instruction', instruction }
}

function timerStarter(minutes: number): LocalActionStarter {
  return {
    kind: 'quiet-timer',
    instruction: 'Stand by an open window.',
    actionId: 'bside.open-window-pause',
    durationMs: minutes * 60_000,
  }
}

function renderQuietScreen(
  starter: LocalActionStarter | undefined,
  overrides: {
    choseBSide?: boolean
    onDone?: () => void
    onTimerComplete?: () => void
  } = {},
) {
  const onDone = overrides.onDone ?? vi.fn()
  const onTimerComplete = overrides.onTimerComplete ?? vi.fn()
  const result = render(() => (
    <QuietScreen
      choseBSide={overrides.choseBSide ?? true}
      message="The turn is yours now."
      starter={starter}
      onTimerComplete={onTimerComplete}
      onDone={onDone}
    />
  ))

  return { ...result, onDone, onTimerComplete }
}

async function settleFocus(): Promise<void> {
  if (vi.isFakeTimers()) {
    await vi.runAllTicks()
  }
  await Promise.resolve()
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('quiet screen', () => {
  it('preserves the neutral Not now handoff without offering an action starter', async () => {
    const { onDone, onTimerComplete } = renderQuietScreen(undefined, {
      choseBSide: false,
    })
    await settleFocus()

    const heading = screen.getByRole('heading', {
      name: 'The turn is yours now.',
    })
    expect(screen.getByText('Not now is okay')).toBeInTheDocument()
    expect(
      screen.getByText('You made a choice. The next cue stays gentle.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /timer/iu })).toBeNull()
    expect(screen.getByText('The screen can go quiet now')).toBeInTheDocument()
    expect(heading).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Back to home' }))
    expect(onDone).toHaveBeenCalledOnce()
    expect(onTimerComplete).not.toHaveBeenCalled()
  })

  it('hands off an exact saved instruction without inventing completion work', async () => {
    const instruction = 'Put one clean plate away.'
    renderQuietScreen(instructionStarter(instruction))
    await settleFocus()

    const heading = screen.getByRole('heading', { name: instruction })
    expect(screen.getByText('Your Side B')).toBeInTheDocument()
    expect(screen.getByText('The turn is yours now.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Your choice is recorded. You can leave Beside Cue and begin.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /timer/iu })).toBeNull()
    expect(heading).toHaveFocus()
  })

  it.each([2, 3, 5])(
    'offers but does not automatically start the authored %i-minute timer',
    async (minutes) => {
      const onTimerComplete = vi.fn()
      renderQuietScreen(timerStarter(minutes), { onTimerComplete })
      await settleFocus()

      expect(
        screen.getByRole('button', {
          name: `Start ${String(minutes)}-minute timer`,
        }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Continue without timer' }),
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'A short timer is here if it helps. Your choice is already recorded.',
        ),
      ).toBeInTheDocument()
      expect(screen.queryByRole('timer')).not.toBeInTheDocument()
      expect(onTimerComplete).not.toHaveBeenCalled()
    },
  )

  it('starts from an absolute deadline without making every second a live announcement', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-28T12:00:00Z'))
    const { onTimerComplete } = renderQuietScreen(timerStarter(2))
    await settleFocus()

    fireEvent.click(
      screen.getByRole('button', { name: 'Start 2-minute timer' }),
    )
    await settleFocus()

    const timer = screen.getByRole('timer')
    expect(timer).toHaveTextContent('02:00')
    expect(timer).toHaveAttribute('aria-live', 'off')
    expect(timer).toHaveAccessibleName('2 minutes remaining')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Timer started for 2 minutes.',
    )
    expect(screen.getByText('Turn toward Side B')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Keep this screen open for the finish haptic. You can end the timer at any point; your choice stays recorded.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Stand by an open window.' }),
    ).toHaveFocus()
    expect(onTimerComplete).not.toHaveBeenCalled()
  })

  it('recomputes a delayed countdown from the deadline when visibility changes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-28T12:00:00Z'))
    renderQuietScreen(timerStarter(5))
    await settleFocus()
    fireEvent.click(
      screen.getByRole('button', { name: 'Start 5-minute timer' }),
    )

    vi.setSystemTime(new Date('2026-08-28T12:04:12.400Z'))
    document.dispatchEvent(new Event('visibilitychange'))

    expect(screen.getByRole('timer')).toHaveTextContent('00:48')
    expect(screen.getByRole('timer')).toHaveAccessibleName(
      '48 seconds remaining',
    )
  })

  it('finishes naturally once without claiming the action was completed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-28T12:00:00Z'))
    const { onTimerComplete } = renderQuietScreen(timerStarter(2))
    await settleFocus()
    fireEvent.click(
      screen.getByRole('button', { name: 'Start 2-minute timer' }),
    )

    vi.advanceTimersByTime(120_000)
    await settleFocus()

    const heading = screen.getByRole('heading', { name: 'Timer finished' })
    expect(heading).toHaveFocus()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.getByText('Stand by an open window.')).toBeInTheDocument()
    expect(
      screen.getByText('Your choice was already recorded. No check-in needed.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Turn toward Side B')).toBeInTheDocument()
    expect(screen.getByRole('status').textContent?.trim()).toBe('')
    expect(screen.queryByText(/action completed|you completed/iu)).toBeNull()
    expect(onTimerComplete).toHaveBeenCalledOnce()

    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(120_000)
    expect(onTimerComplete).toHaveBeenCalledOnce()
  })

  it('ends early without reporting a natural completion', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-28T12:00:00Z'))
    const onDone = vi.fn()
    const onTimerComplete = vi.fn()
    renderQuietScreen(timerStarter(3), { onDone, onTimerComplete })
    await settleFocus()
    fireEvent.click(
      screen.getByRole('button', { name: 'Start 3-minute timer' }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'End timer' }))
    vi.advanceTimersByTime(180_000)

    expect(onDone).toHaveBeenCalledOnce()
    expect(onTimerComplete).not.toHaveBeenCalled()
    expect(screen.queryByText('Timer finished')).toBeNull()
  })

  it('cleans up a running timer without reporting completion after unmount', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-28T12:00:00Z'))
    const onTimerComplete = vi.fn()
    const { unmount } = renderQuietScreen(timerStarter(2), {
      onTimerComplete,
    })
    await settleFocus()
    fireEvent.click(
      screen.getByRole('button', { name: 'Start 2-minute timer' }),
    )

    unmount()
    vi.advanceTimersByTime(120_000)

    expect(onTimerComplete).not.toHaveBeenCalled()
  })
})
