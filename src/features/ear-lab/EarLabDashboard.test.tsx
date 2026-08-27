// ============================================================
// The bench renders honestly on a fresh store, and keeps every hook
// the page tour and the phone audit rely on.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetEarLabStore } from '@/stores/ear-lab-store'
import type { EarLabView } from './EarLabDashboard'
import { EarLabDashboard } from './EarLabDashboard'
import { EarRoomShell } from './EarRoomShell'

/** The bench inside its room, the way EarLabPage composes them. */
function Bench(props: { onNavigate?: (view: EarLabView) => void }) {
  const go = (view: EarLabView) => props.onNavigate?.(view)
  return (
    <EarRoomShell onNavigate={go} onToday={() => undefined}>
      <EarLabDashboard onNavigate={go} />
    </EarRoomShell>
  )
}

const TOUR_HOOKS = [
  'ear.column',
  'ear.index',
  'ear.faculties',
  'ear.sprint',
  'ear.actions',
  'ear.drills',
  'ear.latency',
  'ear.rulers',
] as const

describe('EarLabDashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    resetEarLabStore()
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps the panel id and every tour hook on a fresh store', () => {
    const { container } = render(() => <Bench />)
    expect(container.querySelector('#ear-lab-panel')).not.toBeNull()
    for (const hook of TOUR_HOOKS) {
      expect(
        container.querySelector(`[data-tour="${hook}"]`),
        `missing data-tour="${hook}"`,
      ).not.toBeNull()
    }
  })

  it('says Unmeasured for every faculty and never shows a percent', () => {
    const { container } = render(() => <Bench />)
    const faculties = container.querySelector('[data-tour="ear.faculties"]')
    expect(faculties?.textContent).toContain('Unmeasured')
    expect(faculties?.querySelectorAll('li')).toHaveLength(6)
    expect(container.querySelector('#ear-lab-panel')?.textContent).not.toMatch(
      /\d%/,
    )
    expect(screen.getAllByText('Not yet marked').length).toBeGreaterThan(0)
  })

  it('routes the amber control to calibration and the strip to its drill', () => {
    const onNavigate = vi.fn()
    render(() => <Bench onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: /Run Calibration/ }))
    expect(onNavigate).toHaveBeenCalledWith('calibration')
    fireEvent.click(screen.getByRole('listitem', { name: /^Hairline/ }))
    expect(onNavigate).toHaveBeenCalledWith('hairline')
  })

  it('opens the rack from the bridge and closes it on Escape', () => {
    render(() => <Bench />)
    const rack = screen.getByTestId('ear-rack')
    expect(rack.getAttribute('aria-hidden')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Instruments' }))
    expect(rack.getAttribute('aria-hidden')).toBeNull()
    expect(screen.getByRole('dialog').textContent).toContain('The Grid')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(rack.getAttribute('aria-hidden')).toBe('true')
  })

  it('opens the rulers plate from the session bar', () => {
    render(() => <Bench />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Why there is no percent here' }),
    )
    expect(screen.getByRole('dialog').textContent).toContain(
      'frozen difficulty',
    )
  })
})
