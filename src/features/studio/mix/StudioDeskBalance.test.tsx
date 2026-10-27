// Studio desk balance tests — Auto-balance sits beside Reset sound in the desk's master heading, shows its progress there, and says briefly how it ended.
import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioCommand } from '@/lib/studio/model/commands'
import { applyStudioCommand } from '@/lib/studio/model/commands'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioBalanceOutcome } from '../sound/useStudioSound'
import { STUDIO_DESK_OUTCOME_MS } from './StudioDeskBalance'
import { StudioMixDesk } from './StudioMixDesk'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function mount(options: { clips?: boolean } = {}) {
  const fixture = studioFixture()
  // Space turned up, so the heading says "Adjusted".
  const adjusted = {
    ...fixture.project,
    mix: {
      ...fixture.project.mix,
      macros: { ...fixture.project.mix.macros, space: 80 },
    },
  }
  const [project, setProject] = createSignal(
    options.clips === false ? { ...adjusted, clips: [] } : adjusted,
  )
  const [busy, setBusy] = createSignal(false)
  const [cancelling, setCancelling] = createSignal(false)
  const [progress, setProgress] = createSignal<{
    completed: number
    total: number
  } | null>(null)
  const [outcome, setOutcome] = createSignal<{
    kind: StudioBalanceOutcome
  } | null>(null)
  const autoBalance = vi.fn(async () => true)
  const cancel = vi.fn(() => setCancelling(true))
  const command = vi.fn((edit: StudioCommand) => {
    setProject((current) =>
      applyStudioCommand(current, edit, { assets: [fixture.asset] }),
    )
    return true
  })
  render(() => (
    <StudioMixDesk
      project={project()}
      writable={!busy()}
      meter={{
        meter: () => null,
        meterReady: () => false,
        peakL: () => 0,
        peakR: () => 0,
        resetPeakHold: () => undefined,
      }}
      balance={{
        busy,
        cancelling,
        progress,
        outcome,
        autoBalance,
        cancel,
      }}
      onCommand={command}
      onClose={() => undefined}
    />
  ))
  const master = screen.getByRole('group', { name: 'Master' })
  return {
    master,
    command,
    autoBalance,
    cancel,
    setBusy,
    setProgress,
    setOutcome,
  }
}

describe('Studio desk balance', () => {
  it('offers Auto-balance beside Reset sound in the master heading and runs the Sound panel balance', () => {
    const { master, autoBalance, command } = mount()

    fireEvent.click(
      within(master).getByRole('button', { name: 'Auto-balance' }),
    )
    fireEvent.click(within(master).getByRole('button', { name: 'Reset sound' }))

    expect(autoBalance).toHaveBeenCalledOnce()
    expect(command).toHaveBeenCalledWith({
      type: 'set-sound-flavour',
      flavourId: 'natural',
    })
  })

  it('cannot balance a song without clips', () => {
    const { master } = mount({ clips: false })

    expect(
      within(master).getByRole('button', { name: 'Auto-balance' }),
    ).toBeDisabled()
  })

  it('gives the buttons over to progress and Cancel while it runs', () => {
    const { master, cancel, setBusy, setProgress } = mount()

    setBusy(true)
    setProgress({ completed: 1, total: 3 })
    const status = within(master).getByRole('status')
    const running = status.textContent
    fireEvent.click(
      within(master).getByRole('button', { name: 'Cancel Auto-balance' }),
    )

    expect(running).toBe('Balancing 1 of 3')
    expect(
      within(master).queryByRole('button', { name: 'Auto-balance' }),
    ).toBeNull()
    expect(
      within(master).queryByRole('button', { name: 'Reset sound' }),
    ).toBeNull()
    expect(cancel).toHaveBeenCalledOnce()
    expect(status).toHaveTextContent('Stopping…')
  })

  it('says how a run ended for five seconds, where Adjusted otherwise sits', () => {
    vi.useFakeTimers()
    const { master, setOutcome } = mount()
    expect(within(master).getByText('Adjusted')).toBeInTheDocument()

    setOutcome({ kind: 'applied' })
    const said = within(master).getByRole('status')
    expect(said).toHaveTextContent('Balanced')
    expect(within(master).queryByText('Adjusted')).toBeNull()
    vi.advanceTimersByTime(STUDIO_DESK_OUTCOME_MS - 1)
    expect(said).toBeInTheDocument()
    setOutcome({ kind: 'cancelled' })
    expect(within(master).getByRole('status')).toHaveTextContent(
      'Balance cancelled',
    )
    vi.advanceTimersByTime(STUDIO_DESK_OUTCOME_MS)

    expect(within(master).queryByRole('status')).toBeNull()
    expect(within(master).getByText('Adjusted')).toBeInTheDocument()
  })
})
